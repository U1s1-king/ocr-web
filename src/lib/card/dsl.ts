/**
 * 答题卡文本 DSL（借鉴 AFObject/Sheeter 的「一行一题」写法，独立实现）
 *
 * 支持：
 *   #split 3        分几栏（默认 A3 横版 3 栏，A4 1 栏）
 *   #size 15        正文字号（仅影响块字号，题目区域由版式决定）
 *   # A3 / # A4     纸型（写在第一列注释也行）
 *   # 标题 / ## 副标题 / ### 大题标题
 *   1. X-4          单选 4 个选项
 *   2. T-2          填空 2 个空（每题 1 行）
 *   3. L-3          解答题 3 行横线
 *   4. B-3          数字涂卡 [1][2][3]
 *   5. J-5          空白作答区（5 行高）
 *   ---             分割线（忽略）
 *   ===             换栏
 *   普通文字         作为文本块
 *
 * 输出仍然是标准 v1 的 CardDoc，可直接精调、保存、打印。
 */
import type { Block, Choice, Question } from '../../api/types'
import {
  canvasOf,
  mm2u,
  paperMm,
  validateCard,
  type BlockMeta,
  type CardDoc,
  type CardIssue,
  type PaperSize,
  type SubjectiveStyle,
} from './types'

export type DslToken =
  | { type: 'title'; text: string }
  | { type: 'subtitle'; text: string }
  | { type: 'section'; text: string }
  | { type: 'text'; text: string }
  | { type: 'choice'; num: string; count: number }
  | { type: 'fill'; num: string; count: number }
  | { type: 'lines'; num: string; count: number }
  | { type: 'numbered'; num: string; count: number }
  | { type: 'blankspace'; num?: string; lines: number }
  | { type: 'colbreak' }
  | { type: 'hr' }

export interface DslConfig {
  split: number
  size: number
  paperSize: PaperSize
}

export interface DslParseResult {
  config: DslConfig
  tokens: DslToken[]
  warnings: string[]
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function parseSheetDsl(source: string): DslParseResult {
  const warnings: string[] = []
  const config: DslConfig = { split: 3, size: 15, paperSize: 'A3' }
  const tokens: DslToken[] = []
  let sawPaper = false

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t || t.startsWith('//')) continue

    let m = t.match(/^#split\s+(\d+)/i)
    if (m) {
      config.split = Math.max(1, Math.min(4, parseInt(m[1], 10)))
      continue
    }
    m = t.match(/^#size\s+(\d+)/i)
    if (m) {
      config.size = Math.max(8, Math.min(24, parseInt(m[1], 10)))
      continue
    }
    m = t.match(/^#(?:paper)?\s*(A3|A4)\b/i)
    if (m) {
      config.paperSize = m[1].toUpperCase() as PaperSize
      sawPaper = true
      continue
    }

    m = t.match(/^###\s+(.+)/)
    if (m) {
      tokens.push({ type: 'section', text: m[1].trim() })
      continue
    }
    m = t.match(/^##\s+(.+)/)
    if (m) {
      tokens.push({ type: 'subtitle', text: m[1].trim() })
      continue
    }
    m = t.match(/^#\s+(.+)/)
    if (m) {
      tokens.push({ type: 'title', text: m[1].trim() })
      continue
    }
    if (/^={3,}\s*$/.test(t)) {
      tokens.push({ type: 'colbreak' })
      continue
    }
    if (/^-{3,}\s*$/.test(t)) {
      tokens.push({ type: 'hr' })
      continue
    }

    m = t.match(/^K-(\d+)\s*$/i)
    if (m) {
      tokens.push({ type: 'blankspace', lines: Math.max(1, parseInt(m[1], 10)) })
      continue
    }

    m = t.match(/^([^.]+)\.\s*([A-Za-z])-(\d+)\s*$/)
    if (m) {
      const num = m[1].trim()
      const code = m[2].toUpperCase()
      const n = Math.max(1, parseInt(m[3], 10))
      if (code === 'X') tokens.push({ type: 'choice', num, count: Math.min(n, LETTERS.length) })
      else if (code === 'T') tokens.push({ type: 'fill', num, count: Math.min(n, 12) })
      else if (code === 'L') tokens.push({ type: 'lines', num, count: Math.min(n, 30) })
      else if (code === 'B') tokens.push({ type: 'numbered', num, count: Math.min(n, 12) })
      else if (code === 'J') tokens.push({ type: 'blankspace', num, lines: n })
      else tokens.push({ type: 'text', text: t })
      continue
    }

    // 没有 . 的数字开头也兼容：「1 X-4」
    m = t.match(/^(\d+)\s+([A-Za-z])-(\d+)\s*$/)
    if (m) {
      tokens.push({ type: 'choice', num: m[1], count: Math.min(parseInt(m[3], 10), LETTERS.length) })
      continue
    }

    warnings.push(`第 ${tokens.length + 1} 行未识别为题目，按普通文字处理：${t.slice(0, 30)}`)
    tokens.push({ type: 'text', text: t })
  }

  if (!sawPaper) {
    config.paperSize = config.split > 1 ? 'A3' : 'A4'
  }
  return { config, tokens, warnings }
}

export interface DslBuildResult {
  doc: CardDoc
  warnings: string[]
  issues: CardIssue[]
}

export function buildCardFromDsl(source: string, opts: { name?: string; paperSize?: PaperSize } = {}): DslBuildResult {
  const parsed = parseSheetDsl(source)
  const size = opts.paperSize ?? parsed.config.paperSize
  const orientation = size === 'A3' ? 'landscape' : 'portrait'
  const page = paperMm(size, orientation)
  const canvas = canvasOf(size, orientation)
  const warnings = [...parsed.warnings]

  const marginX = size === 'A3' ? 12 : 11
  const marginTop = 12
  const marginBottom = 11
  const contentX0 = marginX
  const contentX1 = page.w - marginX
  const contentW = contentX1 - contentX0
  const cols = Math.max(1, Math.min(parsed.config.split, size === 'A4' ? 2 : 4))
  const colGap = 5
  const colW = (contentW - colGap * (cols - 1)) / cols
  const footerH = 6
  const contentBottom = page.h - marginBottom - footerH

  const doc: CardDoc = {
    version: 3,
    meta: {
      paperSize: size,
      orientation,
      title: '',
      subtitle: '',
      templateId: 'dsl',
      templateName: opts.name ?? 'DSL 答题卡',
    },
    content: {
      schemaVersion: 1,
      unit: 'canvas',
      canvas,
      markers: [
        { id: 'top-left', x: mm2u(4), y: mm2u(4), size: mm2u(6) },
        { id: 'top-right', x: mm2u(page.w - 10), y: mm2u(4), size: mm2u(6) },
        { id: 'bottom-left', x: mm2u(4), y: mm2u(page.h - 10), size: mm2u(6) },
        { id: 'bottom-right', x: mm2u(page.w - 10), y: mm2u(page.h - 10), size: mm2u(6) },
      ],
      blocks: [],
      questions: [],
      answerKey: {},
    },
    qmeta: {},
    bmeta: {},
    updatedAt: Date.now(),
  }

  let blockSeq = 0
  let qSeq = 0
  let qNumber = 1
  let y = marginTop

  function addBlock(text: string, x: number, top: number, w: number, h: number, style: Block['style'], meta: BlockMeta): string {
    blockSeq += 1
    const id = `b${blockSeq}`
    doc.content.blocks!.push({
      id,
      type: 'text',
      region: { x: mm2u(x), y: mm2u(top), width: mm2u(w), height: mm2u(h) },
      text: text || '\u00a0',
      style,
    })
    doc.bmeta[id] = meta
    return id
  }

  function addSubjective(x: number, top: number, w: number, h: number, label: string, score: number, style: SubjectiveStyle, rows: number) {
    qSeq += 1
    const id = `q${qSeq}`
    const q: Question = {
      id,
      displayNumber: qNumber,
      type: 'subjective',
      score,
      region: { x: mm2u(x), y: mm2u(top), width: mm2u(w), height: mm2u(h) },
    }
    doc.content.questions.push(q)
    doc.qmeta[id] = { style, rows, label: label || undefined }
    qNumber += 1
  }

  function addMark(x: number, top: number, w: number, h: number, numLabel: string, count: number, numbered = false) {
    qSeq += 1
    const id = `q${qSeq}`
    const values = numbered
      ? Array.from({ length: count }, (_, i) => String(i + 1))
      : Array.from({ length: count }, (_, i) => LETTERS[i])
    const labelW = Math.min(12, w * 0.28)
    const optW = (w - labelW) / count
    const choices: Choice[] = values.map((value, i) => ({
      value,
      region: {
        x: round3((labelW + i * optW + optW * 0.1) / w),
        y: 0.16,
        width: round3((optW * 0.8) / w),
        height: 0.68,
      },
    }))
    const q: Question = {
      id,
      displayNumber: qNumber,
      type: 'mark',
      score: 1,
      region: { x: mm2u(x), y: mm2u(top), width: mm2u(w), height: mm2u(h) },
      choices,
    }
    doc.content.questions.push(q)
    doc.qmeta[id] = { style: 'blank', label: numLabel }
    qNumber += 1
  }

  // 表头与全宽文本块
  const headTokens = parsed.tokens.filter((t) => t.type === 'title' || t.type === 'subtitle')
  for (const tok of headTokens) {
    if (tok.type === 'title') {
      doc.meta.title = tok.text
      addBlock(tok.text, contentX0, y, contentW, 10, { fontSize: 7.2, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.1 }, { kind: 'examLine' })
      y += 10.5
    } else {
      doc.meta.subtitle = tok.text
      addBlock(tok.text, contentX0, y, contentW, 9, { fontSize: 5.6, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.1 }, { kind: 'title' })
      y += 9.5
    }
  }
  y += 1

  // 分栏
  let colIndex = 0
  const flowY = new Array(cols).fill(y as number)

  function advanceColumnIfNeeded(need: number): boolean {
    if (flowY[colIndex] + need <= contentBottom) return true
    if (colIndex < cols - 1) {
      colIndex += 1
      return flowY[colIndex] + need <= contentBottom
    }
    return false
  }
  function place(need: number): { x: number; y: number; w: number } {
    if (!advanceColumnIfNeeded(need)) {
      warnings.push('内容超出页面，已尽量缩小；建议减少题量或改用 A3')
      // 压缩：直接放在最后一栏底部前
      colIndex = cols - 1
      flowY[colIndex] = Math.min(flowY[colIndex], contentBottom - need)
    }
    const x = contentX0 + colIndex * (colW + colGap)
    const top = flowY[colIndex]
    flowY[colIndex] += need
    return { x, y: top, w: colW }
  }

  for (const tok of parsed.tokens) {
    if (tok.type === 'title' || tok.type === 'subtitle') continue
    if (tok.type === 'colbreak') {
      if (colIndex < cols - 1) colIndex += 1
      continue
    }
    if (tok.type === 'hr') {
      const spot = place(3)
      addBlock('—', spot.x, spot.y, spot.w, 2, { fontSize: 3, textAlign: 'center' }, { kind: 'divider' })
      flowY[colIndex] += 1
      continue
    }
    if (tok.type === 'section') {
      const rows = 6
      const spot = place(rows + 1)
      addBlock(tok.text, spot.x, spot.y, spot.w, rows, { fontSize: 3.8, fontWeight: 'bold', textAlign: 'left', lineHeight: 1.1 }, { kind: 'section' })
      flowY[colIndex] += 1
      continue
    }
    if (tok.type === 'text') {
      const rows = 5
      const spot = place(rows + 1)
      addBlock(tok.text, spot.x, spot.y, spot.w, rows, { fontSize: 3.4, textAlign: 'left', lineHeight: 1.4 }, { kind: 'text' })
      flowY[colIndex] += 1
      continue
    }
    if (tok.type === 'choice' || tok.type === 'numbered') {
      const h = 7
      if (!advanceColumnIfNeeded(h + 1)) warnings.push(`第 ${tok.num} 题空间不足`)
      const spot = place(h + 1)
      addMark(spot.x, spot.y, spot.w, h, tok.num, tok.count, tok.type === 'numbered')
      continue
    }
    if (tok.type === 'fill') {
      const h = 6.5
      const spot = place(h + 1)
      addSubjective(spot.x, spot.y, spot.w, h, `${tok.num}.`, 1, 'lines', 1)
      continue
    }
    if (tok.type === 'lines') {
      const h = Math.min(60, Math.max(16, tok.count * 6.4 + 3))
      if (!advanceColumnIfNeeded(h + 1)) warnings.push(`第 ${tok.num} 题空间不足，已压缩`)
      const spot = place(h + 1)
      addSubjective(spot.x, spot.y, spot.w, h, `${tok.num}.`, 1, 'lines', tok.count)
      continue
    }
    if (tok.type === 'blankspace') {
      const h = Math.min(80, Math.max(8, tok.lines * 3.2))
      const spot = place(h + 1)
      addSubjective(spot.x, spot.y, spot.w, h, tok.num ?? '', 1, 'blank', tok.lines)
    }
  }

  // 页脚
  const footText = `${doc.meta.subtitle || doc.meta.title || '答题卡'} 第1面（共1面）`
  addBlock(footText, contentX0, page.h - marginBottom - 5, contentW, 4.5, { fontSize: 2.8, textAlign: 'center' }, { kind: 'footer' })

  doc.updatedAt = Date.now()
  return { doc, warnings, issues: validateCard(doc) }
}

export const DSL_SAMPLE = `# A3
#split 3
#size 15

# 2026年普通高等学校招生全国统一考试
## 数学 答题卡

### 一、单项选择题（1–8题，每小题5分）
1. X-4
2. X-4
3. X-4
4. X-4
5. X-4
6. X-4
7. X-4
8. X-4

### 二、多项选择题（9–12题，每小题5分）
9. X-4
10. X-4
11. X-4
12. X-4

### 三、填空题（13–16题，每小题5分）
13. T-1
14. T-1
15. T-1
16. T-1

### 四、解答题（17–21题）
17. L-8
18. L-9
19. L-9
20. L-10
21. L-10
`

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}
