/**
 * 答题卡自动排版引擎（毫米排版，输出画布单位）。
 *
 * 目标：给定题量/选项/主观题块，稳定地算出一张不越界、不重叠、可打印、可识别的卡。
 * 排版顺序：表头 → 客观题 → 主观题（A3 分栏）→ 页脚；
 * 容量不够时先压行距/字号，仍不够就整体按比例收缩，最后自动升纸型（A4→A3）并给出提示。
 */
import type { Block, ExamContent, Question } from '../../api/types'
import { ANSWER_CARD_BARCODE_AREA } from '../barcode/templates'
import { createSubjectBack } from './back'
import { pageProfileOf } from './reflow'
import {
  canvasOf,
  mm2u,
  u2mm,
  paperMm,
  round2,
  type BlockMeta,
  type CardDoc,
  type CardBarcode,
  type CardSpec,
  type ObjectiveGroupSpec,
  type Orientation,
  type PaperSize,
  type QuestionMeta,
  type SubjectiveGroupSpec,
} from './types'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface LayoutCtx {
  page: { w: number; h: number }
  marginX: number
  marginTop: number
  marginBottom: number
  contentX0: number
  contentX1: number
  contentW: number
  markers: { size: number; inset: number }
  /** 主观题区域可用列数 */
  subjCols: number
}

interface Built {
  doc: CardDoc
  overflow: boolean
  warnings: string[]
}

const LINE_MM = 6.4
const GRID_CELL_MM = 4.9
const SECTION_TITLE_MM = 5.6
const FOOTER_MM = 6

function ctxOf(size: PaperSize, orientation: Orientation, subjColsOverride?: number): LayoutCtx {
  const page = paperMm(size, orientation)
  // 参照 AnswerSheetMaker 的 A3 真卡边距：左右 14mm、下边 10mm
  const marginX = size === 'A3' ? 14 : 11
  const marginTop = 12
  const marginBottom = size === 'A3' ? 10 : 11
  const contentX0 = marginX
  const contentX1 = page.w - marginX
  return {
    page,
    marginX,
    marginTop,
    marginBottom,
    contentX0,
    contentX1,
    contentW: contentX1 - contentX0,
    markers: { size: 6, inset: 5 },
    subjCols: subjColsOverride ?? (orientation === 'landscape' && size === 'A3' ? 3 : 1),
  }
}

function newBuilder(spec: CardSpec, subjCols?: number) {
  const ctx = ctxOf(spec.paperSize, spec.orientation, subjCols)
  const canvas = canvasOf(spec.paperSize, spec.orientation)
  const doc: CardDoc = {
    version: 3,
    meta: {
      paperSize: spec.paperSize,
      orientation: spec.orientation,
      title: spec.title,
      subtitle: spec.subtitle,
      system: spec.system,
      subject: spec.subject,
      gaokao: spec.gaokao,
    },
    content: {
      schemaVersion: 1,
      unit: 'canvas',
      canvas,
      markers: [],
      blocks: [],
      questions: [],
      answerKey: {},
    },
    qmeta: {},
    bmeta: {},
    updatedAt: Date.now(),
  }
  let blockSeq = 0
  const warnings: string[] = []
  let tooCompressed = false

  function addBlock(text: string, boxMm: Box, style: Block['style'], meta: BlockMeta): string {
    blockSeq += 1
    const id = `b${blockSeq}`
    doc.content.blocks!.push({
      id,
      type: 'text',
      region: { x: mm2u(boxMm.x), y: mm2u(boxMm.y), width: mm2u(boxMm.w), height: mm2u(boxMm.h) },
      text,
      style,
    })
    doc.bmeta[id] = meta
    return id
  }

  function addQuestion(q: Question, qm?: QuestionMeta) {
    doc.content.questions!.push(q)
    if (qm) doc.qmeta[q.id] = qm
  }

  return {
    ctx,
    doc,
    addBlock,
    addQuestion,
    warnings,
    get tooCompressed() {
      return tooCompressed
    },
    set tooCompressed(v: boolean) {
      tooCompressed = v
    },
  }
}

/** 表头：标题 / 副标题 / 考生信息 / 注意事项 / 填涂样例 / 条形码 */
function layoutHeader(
  b: ReturnType<typeof newBuilder>,
  spec: CardSpec,
  top: number,
): number {
  const { ctx, doc } = b
  const { contentX0, contentW } = ctx
  let y = top
  const barcodeW = ANSWER_CARD_BARCODE_AREA.width
  const barcodeH = ANSWER_CARD_BARCODE_AREA.height
  const hasBarcode = spec.showBarcode
  const leftW = hasBarcode ? contentW - barcodeW - 4 : contentW

  // 考试名称（红）
  y += 1
  b.addBlock(
    spec.title,
    { x: contentX0, y, w: leftW, h: 7 },
    { fontSize: 4.6, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.1 },
    { kind: 'examLine' },
  )
  y += 7.2

  // 科目 / 答题卡
  b.addBlock(
    spec.subtitle,
    { x: contentX0, y, w: leftW, h: 10 },
    { fontSize: 7.2, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.1 },
    { kind: 'title' },
  )
  y += 10.4

  // 考生信息
  if (spec.showStudent) {
    const text = spec.studentFields.map((f) => `${f}：${'　'.repeat(4)}`).join('  ')
    // 字符数 ≈ 全角字数；按可用宽度反推字号，保证单行不折行
    const chars = spec.studentFields.reduce((n, f) => n + f.length + 5, 0) + (spec.studentFields.length - 1) * 1
    const fs = Math.max(2.8, Math.min(3.9, (leftW / Math.max(1, chars)) * 1.02))
    b.addBlock(
      text,
      { x: contentX0, y, w: leftW, h: 7.2 },
      { fontSize: fs, fontWeight: 'normal', textAlign: 'left', lineHeight: 1.3 },
      { kind: 'student', fields: spec.studentFields, boxed: true },
    )
    y += 7.7
  }

  // 准考证号方格（高考真卡特征）
  if (spec.gaokao && (spec.examNoDigits ?? 0) > 0) {
    b.addBlock(
      '准考证号',
      { x: contentX0, y, w: leftW, h: 7.5 },
      { fontSize: 3.1, fontWeight: 'bold', textAlign: 'left', lineHeight: 1.2 },
      { kind: 'examNo', digits: spec.examNoDigits },
    )
    y += 8
  }

  // 注意事项
  if (spec.showNotice) {
    b.addBlock(
      spec.notes,
      { x: contentX0, y, w: leftW, h: 18 },
      { fontSize: 2.75, fontWeight: 'normal', textAlign: 'left', lineHeight: 1.55 },
      { kind: 'notice', boxed: true },
    )
    y += 18.5
  }

  // 填涂样例
  if (spec.showLegend) {
    b.addBlock(
      '正确填涂：■　　错误填涂：√　×　○　　缺考标记：□',
      { x: contentX0, y, w: leftW, h: 5 },
      { fontSize: 2.9, fontWeight: 'normal', textAlign: 'left', lineHeight: 1.2 },
      { kind: 'legend' },
    )
    y += 5.5
  }

  // 条形码占位
  if (hasBarcode) {
    const rect = { x: ctx.contentX1 - barcodeW, y: top + 1, w: barcodeW, h: barcodeH }
    doc.meta.barcodeRect = rect
    b.addBlock(
      '贴条形码区',
      rect,
      { fontSize: 2.9, fontWeight: 'normal', textAlign: 'center', lineHeight: 1.3 },
      { kind: 'barcode', boxed: true },
    )
  }

  // 试卷类型 / 缺考标记：放在条形码框下方（真卡右侧栏）
  let rightBottom = top + 4
  if (hasBarcode) {
    rightBottom = top + barcodeH + 4
    if (spec.gaokao && (spec.showPaperType || spec.showAbsent)) {
      b.addBlock(
        `${spec.showPaperType ? '试卷类型' : ''}${spec.showAbsent ? '　缺考标记' : ''}`,
        { x: ctx.contentX1 - barcodeW, y: rightBottom, w: barcodeW, h: 10 },
        { fontSize: 2.9, fontWeight: 'normal', textAlign: 'center', lineHeight: 1.3 },
        { kind: 'paperType', paperTypes: spec.showPaperType ? ['A', 'B'] : [], boxed: true },
      )
      rightBottom += 11
    }
  }

  return Math.max(y + 2, rightBottom)
}

/** 客观题：分组标题 + 若干行「题号 + 选项框」 */
function layoutObjective(
  b: ReturnType<typeof newBuilder>,
  groups: ObjectiveGroupSpec[],
  startTop: number,
  rowH: number,
  fontSize: number,
  area?: { x0: number; w: number; maxPerRow?: number },
): number {
  const { ctx } = b
  const contentX0 = area?.x0 ?? ctx.contentX0
  const contentW = area?.w ?? ctx.contentW
  let y = startTop
  let number = 1

  for (const g of groups) {
    if (g.count <= 0) continue
    b.addBlock(
      g.title,
      { x: contentX0, y, w: contentW, h: SECTION_TITLE_MM },
      { fontSize: 3.9, fontWeight: 'bold', textAlign: 'left', lineHeight: 1.1 },
      { kind: 'section' },
    )
    y += SECTION_TITLE_MM + 0.6

    const options = g.options ?? ['A', 'B', 'C', 'D']
    const labelW = 6.2
    const gap = 2.2
    const optW = Math.max(4.6, fontSize * 1.45)
    const cellW = labelW + options.length * optW + 1.6
    const fitPerRow = Math.max(1, Math.floor((contentW + gap) / (cellW + gap)))
    const maxPerRow = Math.min(fitPerRow, area?.maxPerRow ?? (ctx.page.w > 260 ? 10 : 8))
    const rowCount = Math.max(1, Math.ceil(g.count / maxPerRow))
    const perRow = Math.max(1, Math.ceil(g.count / rowCount))
    const rows = Math.ceil(g.count / perRow)
    const cellGapX = perRow > 1 ? (contentW - perRow * cellW) / (perRow - 1) : 0

    for (let i = 0; i < g.count; i += 1) {
      const r = Math.floor(i / perRow)
      const c = i % perRow
      const x = contentX0 + c * (cellW + cellGapX)
      const qy = y + r * rowH
      const q: Question = {
        id: `q${number}`,
        displayNumber: number,
        type: 'mark',
        score: g.score,
        region: {
          x: mm2u(x),
          y: mm2u(qy),
          width: mm2u(cellW),
          height: mm2u(rowH),
        },
        choices: options.map((value, k) => {
          const cx = labelW + k * optW + 0.8
          return {
            value,
            region: {
              x: round2(cx / cellW),
              y: round2(0.18),
              width: round2((optW * 0.82) / cellW),
              height: round2(0.64),
            },
          }
        }),
      }
      b.addQuestion(q)
      number += 1
    }
    y += rows * rowH + 2.4
  }
  return y
}


/** 只有「一、…」「二、…」「第Ⅰ卷」这种才是分组标题，其余单题说明直接印在题目框里 */
function isSectionTitle(title: string): boolean {
  return /^[一二三四五六七八九十]+[、.．]/.test(title.trim()) || /^第[IVX一二三四五六七八九十]+[卷部]/.test(title.trim())
}

/** 主观题需求高度 */
function subjectiveNeeds(group: SubjectiveGroupSpec, colW: number): { h: number; gridCols?: number; gridRows?: number } {
  const items = group.items.length ? group.items : [{ rows: 6, score: 5 }]
  if (group.style === 'grid') {
    const score = items.reduce((s, it) => s + it.score, 0)
    const gridCols = Math.max(16, Math.floor((colW - 4) / GRID_CELL_MM))
    const cells = Math.max(240, Math.round(score * 13))
    const gridRows = Math.ceil(cells / gridCols)
    const cell = (colW - 4) / gridCols
    return { h: SECTION_TITLE_MM + 1 + gridRows * cell + 2, gridCols, gridRows }
  }
  let h = SECTION_TITLE_MM + 1
  for (const it of items) h += Math.max(16, it.rows * LINE_MM + 6)
  return { h }
}

/** 主观题：按列分配；必要时逐级压缩，直到每一组都能塞进某一列（绝不越界） */
function layoutSubjective(
  b: ReturnType<typeof newBuilder>,
  groups: SubjectiveGroupSpec[],
  top: number,
  bottom: number,
  area?: { x0: number; w: number; cols?: number },
  explicitAreas?: { x0: number; w: number; top: number; bottom: number }[],
): number {
  const { ctx } = b
  if (!groups.length) return top

  const areas = explicitAreas?.length
    ? explicitAreas
    : (() => {
        const cols = area?.cols ?? ctx.subjCols
        const colGap = 5
        const colW = ((area?.w ?? ctx.contentW) - colGap * (cols - 1)) / cols
        return Array.from({ length: cols }, (_, i) => ({
          x0: (area?.x0 ?? ctx.contentX0) + i * (colW + colGap),
          w: colW,
          top,
          bottom,
        }))
      })()

  const capacities = areas.map((a) => Math.max(20, a.bottom - a.top))
  const needsAt = (gi: number, colW: number) => subjectiveNeeds(groups[gi], colW)

  let placements: number[][] | null = null
  let used: number[] = []
  let scale = 1
  for (let attempt = 0; attempt <= 12; attempt += 1) {
    scale = 1 - attempt * 0.05
    const trial: number[][] = Array.from({ length: areas.length }, () => [])
    const trialUsed = new Array<number>(areas.length).fill(0)
    let ok = true
    groups.forEach((_, gi) => {
      // 先尝试窄列/剩余高度少的列，避免最后只剩一条窄列
      const order = areas.map((_, i) => i).sort((a, b) => trialUsed[a] - trialUsed[b])
      for (const c of order) {
        const h = Math.max(13, needsAt(gi, areas[c].w).h * scale)
        if (trialUsed[c] + h <= capacities[c] + 0.4) {
          trial[c].push(gi)
          trialUsed[c] += h
          return
        }
      }
      ok = false
    })
    if (ok) {
      placements = trial
      used = trialUsed
      break
    }
  }
  if (!placements) {
    placements = Array.from({ length: areas.length }, (_, c) => groups.map((_, gi) => gi).filter((gi) => gi % areas.length === c))
    used = capacities.map(() => 0)
    scale = 0.5
    b.warnings.push('主观题题量超出当前版面容量，已按最大压缩排版，建议减少题量或改用更大纸型')
  } else if (scale < 0.9) {
    b.warnings.push('题量偏多，已自动压缩主观题行距以放进一张卡')
  }
  if (scale < 0.7) b.tooCompressed = true

  let number = (b.doc.content.questions?.length ?? 0) + 1
  let maxY = top

  placements.forEach((list, c) => {
    const a = areas[c]
    let y = a.top
    const capacity = capacities[c]
    const stretch = list.length && used[c] > 0 ? Math.min(1.5, capacity / Math.max(1, used[c])) : 1
    for (const gi of list) {
      const g = groups[gi]
      const need = needsAt(gi, a.w)
      let h = Math.min(a.bottom - y, Math.max(13, need.h * scale) * stretch)
      const showHeader = isSectionTitle(g.title)

      if (showHeader) {
        b.addBlock(
          g.title,
          { x: a.x0, y, w: a.w, h: SECTION_TITLE_MM },
          { fontSize: 3.5, fontWeight: 'bold', textAlign: 'left', lineHeight: 1.1 },
          { kind: 'section' },
        )
        y += SECTION_TITLE_MM + 0.8
        h -= SECTION_TITLE_MM + 0.8
      }

      const items = g.items.length ? g.items : [{ rows: 6, score: 5 }]
      const itemH = Math.max(10, h / items.length)

      if (g.style === 'grid') {
        const gridCols = need.gridCols ?? 24
        const cell = (a.w - 4) / gridCols
        const rows = Math.max(6, Math.floor((itemH - 3) / cell))
        const boxH = Math.min(itemH, rows * cell + 2)
        if (boxH < 8) break
        const q: Question = {
          id: `q${number}`,
          displayNumber: number,
          type: 'subjective',
          score: items[0]?.score ?? 10,
          region: {
            x: mm2u(a.x0),
            y: mm2u(y),
            width: mm2u(a.w),
            height: mm2u(boxH),
          },
        }
        b.addQuestion(q, { style: 'grid', rows, gridCols, label: showHeader ? undefined : g.title })
        number += 1
        y = Math.min(a.bottom, y + boxH + 1.2)
        continue
      }

      for (const it of items) {
        const remain = Math.max(0, a.bottom - y)
        const boxH = Math.max(10, Math.min(itemH, remain))
        if (boxH < 8) break
        const q: Question = {
          id: `q${number}`,
          displayNumber: number,
          type: 'subjective',
          score: Math.max(0.5, it.score),
          region: {
            x: mm2u(a.x0),
            y: mm2u(y),
            width: mm2u(a.w),
            height: mm2u(boxH),
          },
        }
        const style = g.style === 'blank' ? 'blank' : 'lines'
        b.addQuestion(q, {
          style,
          rows: Math.max(2, Math.floor((boxH - 3) / LINE_MM)),
          label: showHeader ? undefined : g.title,
        })
        number += 1
        y = Math.min(a.bottom, y + boxH + 1.2)
      }
    }
    maxY = Math.max(maxY, y)
  })

  return Math.min(maxY, Math.max(...areas.map((a) => a.bottom)))
}

/** 生成一次（不含纸型回退） */
function buildOnce(spec: CardSpec, rowH: number, fontSize: number, subjCols?: number): Built {
  const b = newBuilder(spec, subjCols)
  const { ctx, doc } = b

  // 定位块：页面四角，压在页边距内
  const { size, inset } = ctx.markers
  const m = (x: number, y: number, id: string) => ({ id, x: mm2u(x), y: mm2u(y), size: mm2u(size) })
  doc.content.markers = [
    m(inset, inset, 'top-left'),
    m(ctx.page.w - inset - size, inset, 'top-right'),
    m(inset, ctx.page.h - inset - size, 'bottom-left'),
    m(ctx.page.w - inset - size, ctx.page.h - inset - size, 'bottom-right'),
  ]

  // 页脚
  const footerY = ctx.page.h - ctx.marginBottom - FOOTER_MM
  if (spec.gaokao) {
    b.addBlock(
      `${spec.subject || ''}答题卡 第1面（共1面）`,
      { x: ctx.contentX0, y: footerY - 5, w: ctx.contentW, h: 4.4 },
      { fontSize: 2.8, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.1 },
      { kind: 'pageFooter' },
    )
  }
  if (spec.footer) {
    b.addBlock(
      spec.footer,
      { x: ctx.contentX0, y: footerY, w: ctx.contentW, h: FOOTER_MM - 1 },
      { fontSize: 2.5, fontWeight: 'normal', textAlign: 'center', lineHeight: 1.2 },
      { kind: 'footer' },
    )
  }

  const afterHeader = layoutHeader(b, spec, ctx.marginTop)
  const subjectiveBottom = footerY - 1
  const splitA3 = spec.paperSize === 'A3' && spec.orientation === 'landscape' && spec.objectiveGroups.length > 0 && spec.subjectiveGroups.length > 0
  let overflow = false

  if (splitA3) {
    // 高考 A3 真卡：左栏选择题填涂，右侧及剩余区域主观题
    const leftW = Math.min(105, Math.max(82, ctx.contentW * 0.27))
    const gap = 5
    const left = { x0: ctx.contentX0, w: leftW, maxPerRow: 2 }
    const top = afterHeader + 1
    const objectiveEnd = layoutObjective(b, spec.objectiveGroups, top, rowH, fontSize, left)
    const rightX = ctx.contentX0 + leftW + gap
    const rightW = ctx.contentX1 - rightX
    const colGap = 5
    const rightColW = (rightW - colGap * 2) / 3
    const areas = [
      { x0: ctx.contentX0, w: leftW, top: objectiveEnd + 1, bottom: subjectiveBottom },
      { x0: rightX, w: rightColW, top, bottom: subjectiveBottom },
      { x0: rightX + rightColW + colGap, w: rightColW, top, bottom: subjectiveBottom },
      { x0: rightX + (rightColW + colGap) * 2, w: rightColW, top, bottom: subjectiveBottom },
    ]
    const end = layoutSubjective(b, spec.subjectiveGroups, top, subjectiveBottom, undefined, areas)
    overflow = end > subjectiveBottom + 0.5 || b.tooCompressed
  } else {
    const afterObjective = layoutObjective(b, spec.objectiveGroups, afterHeader, rowH, fontSize)
    const subjectiveTop = afterObjective + 1
    if (spec.subjectiveGroups.length) {
      const end = layoutSubjective(b, spec.subjectiveGroups, subjectiveTop, subjectiveBottom)
      overflow = end > subjectiveBottom + 0.5 || subjectiveTop > subjectiveBottom || b.tooCompressed
    }
  }

  // 空白卡：至少一道主观题占满剩余区域（后端要求至少 1 题）
  if (!spec.objectiveGroups.length && !spec.subjectiveGroups.length) {
    const top = afterHeader + 1
    const bottom = subjectiveBottom
    if (bottom - top > 20) {
      b.addBlock(
        '一、答题区',
        { x: ctx.contentX0, y: top, w: ctx.contentW, h: SECTION_TITLE_MM },
        { fontSize: 3.9, fontWeight: 'bold', textAlign: 'left', lineHeight: 1.1 },
        { kind: 'section' },
      )
      const q: Question = {
        id: 'q1',
        displayNumber: 1,
        type: 'subjective',
        score: 10,
        region: {
          x: mm2u(ctx.contentX0),
          y: mm2u(top + SECTION_TITLE_MM + 1),
          width: mm2u(ctx.contentW),
          height: mm2u(bottom - top - SECTION_TITLE_MM - 2),
        },
      }
      b.addQuestion(q, { style: 'lines', rows: Math.max(4, Math.floor((bottom - top - SECTION_TITLE_MM - 2) / LINE_MM)) })
    }
  }

  doc.updatedAt = Date.now()
  return { doc, overflow, warnings: b.warnings }
}

export interface GeneratedCard {
  doc: CardDoc
  warnings: string[]
  /** 实际使用的纸型（题量过大时可能自动升级） */
  usedSize: PaperSize
  usedOrientation: Orientation
}

/**
 * 双面大题分配：
 * - 正反面表头/定位点保持同一坐标
 * - 主观题按题量从中间分开，背面每个大题占满一整栏
 * - 数学/理科背面三栏，文科两栏，语文/英语一栏
 */
function splitSubjectPages(front: CardDoc): { doc: CardDoc } {
  const page = paperMm(front.meta.paperSize, front.meta.orientation)
  const profile = pageProfileOf(front)
  const questions = front.content.questions ?? []
  const subjective = questions.filter((q) => q.type === 'subjective').sort((a, b) => a.region.y - b.region.y)
  const objective = questions.filter((q) => q.type !== 'subjective')

  // 少于 4 道主观题不拆，保持现有背面科目版式
  if (subjective.length < 4) {
    const back = createSubjectBack(front)
    return { doc: { ...front, back: { content: back.content, qmeta: back.qmeta, bmeta: back.bmeta, hidden: [] } } }
  }

  const half = Math.ceil(subjective.length / 2)
  const keep = subjective.slice(0, half)
  const moved = subjective.slice(half)
  const frontContent = {
    ...front.content,
    questions: [...objective, ...keep],
    answerKey: front.content.answerKey,
  }
  front = { ...front, content: frontContent }

  const headerKinds = new Set(['examLine', 'title', 'student', 'notice', 'legend', 'examNo', 'barcode', 'paperType'])
  const headerBlocks = (front.content.blocks ?? []).filter((b) => headerKinds.has(front.bmeta[b.id]?.kind ?? ''))
  const headerBottom = headerBlocks.length
    ? Math.max(...headerBlocks.map((b) => u2mm(b.region.y) + u2mm(b.region.height)))
    : 12
  const marginX = 14
  const marginBottom = 10
  const bottom = page.h - marginBottom
  const top = Math.min(bottom - 20, headerBottom + 4)
  const count = Math.max(1, Math.min(profile.backCols, moved.length))
  const gap = 5
  const colW = (page.w - marginX * 2 - gap * (count - 1)) / count
  const rows = Math.max(1, Math.ceil(moved.length / count))
  const rowH = (bottom - top - gap * (rows - 1)) / rows
  const qmeta: CardDoc['qmeta'] = {}
  const bmeta: CardDoc['bmeta'] = {}
  const blocks = headerBlocks.map((b) => ({ ...b }))
  const backQuestions = moved.map((q, i) => {
    const col = i % count
    const row = Math.floor(i / count)
    const region = {
      x: mm2u(marginX + col * (colW + gap)),
      y: mm2u(top + row * (rowH + gap)),
      width: mm2u(colW),
      height: mm2u(rowH),
    }
    qmeta[q.id] = { style: 'lines', rows: Math.max(3, Math.floor((rowH - 4) / LINE_MM)), label: q.displayNumber ? `${q.displayNumber}` : undefined }
    return { ...q, region }
  })
  const back: CardDoc['back'] = {
    content: {
      schemaVersion: 1,
      unit: 'canvas',
      canvas: { ...front.content.canvas },
      markers: (front.content.markers ?? []).map((m) => ({ ...m })),
      blocks,
      questions: backQuestions,
      answerKey: {},
    },
    qmeta,
    bmeta,
    hidden: [],
  }
  return { doc: { ...front, back } }
}

/**
 * 自动出卡：A4 放不下时自动升级 A3，再放不下就整体压缩（保证不越界）。
 */
export function generateCard(spec: CardSpec): GeneratedCard {
  const warnings: string[] = []
  const attempts: Array<{ size: PaperSize; orientation: Orientation; cols: number; label: string }> =
    spec.paperSize === 'A4'
      ? [
          { size: 'A4', orientation: 'portrait', cols: 1, label: 'A4 单栏' },
          { size: 'A4', orientation: 'portrait', cols: 2, label: 'A4 双栏' },
          { size: 'A3', orientation: 'landscape', cols: 3, label: 'A3 三栏' },
        ]
      : [{ size: 'A3', orientation: spec.orientation, cols: 3, label: 'A3 三栏' }]

  let last: Built | null = null
  let lastAttempt = attempts[0]
  for (let i = 0; i < attempts.length; i += 1) {
    const a = attempts[i]
    const rowH = a.size === 'A3' ? 7.4 : 7.2
    const fontSize = a.size === 'A3' ? 3.4 : 3.2
    const built = buildOnce({ ...spec, paperSize: a.size, orientation: a.orientation }, rowH, fontSize, a.cols)
    last = built
    lastAttempt = a
    if (!built.overflow) {
      if (i > 0) {
        warnings.push(
          a.size !== spec.paperSize
            ? `按 ${spec.paperSize} 排版空间不足，已自动改用 ${a.size} ${a.orientation === 'landscape' ? '横版' : '竖版'}`
            : `按${attempts[0].label}排不下，已自动改为${a.label}`,
        )
      }
      warnings.push(...built.warnings)
      const split = splitSubjectPages(built.doc)
      return { doc: split.doc, warnings, usedSize: a.size, usedOrientation: a.orientation }
    }
  }

  const fallback = last ?? buildOnce(spec, 7.2, 3.2)
  warnings.push('内容过多，已尽量压缩；建议减少主观题行数或改用更大纸型')
  warnings.push(...fallback.warnings)
  const split = splitSubjectPages(fallback.doc)
  return { doc: split.doc, warnings, usedSize: lastAttempt.size, usedOrientation: lastAttempt.orientation }
}

/** 从后端试卷内容还原渲染文档（没有本地草稿时使用） */
export function docFromContent(
  content: ExamContent,
  name: string,
  fallbackSize: PaperSize = 'A4',
): CardDoc {
  const ratio = content.canvas.height / Math.max(1, content.canvas.width)
  const size: PaperSize = content.canvas.width >= 420 ? 'A3' : fallbackSize
  const orientation: Orientation = ratio > 1 ? 'portrait' : 'landscape'
  const qmeta: Record<string, QuestionMeta> = {}
  for (const q of content.questions ?? []) {
    if (q.type === 'subjective') {
      const h = (q.region.height ?? 0) * 0.7
      qmeta[q.id] = { style: 'lines', rows: Math.max(2, Math.floor((h - 3) / LINE_MM)) }
    }
  }
  const barcodes: CardBarcode[] = []
  if (content.barcode) {
    const bc = content.barcode
    const unit = (v: number, u: string) => {
      if (u === 'mm') return v / 0.7
      if (u === 'ratio') return v * content.canvas.width
      return v
    }
    let x = unit(bc.offset.x, bc.offset.unit)
    let y = unit(bc.offset.y, bc.offset.unit)
    const w = unit(bc.size.width, bc.size.unit)
    const h = unit(bc.size.height, bc.size.unit)
    if (bc.anchor.includes('right')) x = content.canvas.width - x - w
    if (bc.anchor.includes('bottom')) y = content.canvas.height - y - h
    barcodes.push({
      id: bc.id,
      region: { x, y, width: w, height: h },
      format: 'CODE128',
      value: bc.value,
      showText: true,
    })
  }
  return {
    version: 3,
    meta: {
      paperSize: size,
      orientation,
      title: name,
      subtitle: '',
    },
    content,
    qmeta,
    bmeta: {},
    barcodes,
    updatedAt: Date.now(),
  }
}
