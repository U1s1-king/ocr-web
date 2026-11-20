/**
 * 答题卡文档 v3 —— 面向「模板自动出卡 + 精调」的新模型。
 *
 * 设计原则（对应试卷 JSON 标准 v1）：
 *  - 后端只认识 ExamContent（canvas 单位、markers、blocks、questions、answerKey）
 *  - content 就是最终提交给后端的标准 JSON，编辑器直接改它，不再做有损的 v2→v1 编译
 *  - 页面物理尺寸只由 meta（纸型/方向）决定，1 画布单位 = 0.7mm（A4 画布 300×424.29）
 *  - qmeta / bmeta 是「打印渲染需要的附加信息」（主观题横线行数、标题块样式等），只存本机
 */
import type { Barcode, Block, ExamContent, Marker, Question, Region } from '../../api/types'

export type PaperSize = 'A4' | 'A3'
export type Orientation = 'portrait' | 'landscape'

/** 1 画布单位 = 0.7mm：A4 竖版 = 300×424.29，A3 横版 = 600×424.29 */
export const MM_PER_UNIT = 0.7
export const UNITS_PER_MM = 1 / MM_PER_UNIT

export interface PaperMm {
  w: number
  h: number
}

const PAPER_MM: Record<PaperSize, PaperMm> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
}

export function paperMm(size: PaperSize, orientation: Orientation): PaperMm {
  const base = PAPER_MM[size]
  return orientation === 'portrait'
    ? { w: base.w, h: base.h }
    : { w: base.h, h: base.w }
}

export function canvasOf(size: PaperSize, orientation: Orientation): { width: number; height: number } {
  const mm = paperMm(size, orientation)
  return { width: round2(mm.w * UNITS_PER_MM), height: round2(mm.h * UNITS_PER_MM) }
}

export function mm2u(mm: number): number {
  return round2(mm * UNITS_PER_MM)
}

export function u2mm(u: number): number {
  return round2(u * MM_PER_UNIT)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 毫米矩形直接用画布单位表示 */
export function rectMm(x: number, y: number, w: number, h: number): Region {
  return { x: mm2u(x), y: mm2u(y), width: mm2u(w), height: mm2u(h) }
}

export function regionMm(r: Region): { x: number; y: number; w: number; h: number } {
  return { x: u2mm(r.x), y: u2mm(r.y), w: u2mm(r.width), h: u2mm(r.height) }
}

/* ---------------- 渲染附加信息 ---------------- */

export type SubjectiveStyle = 'lines' | 'grid' | 'blank'

export interface QuestionMeta {
  style: SubjectiveStyle
  /** 横线行数（主观题） */
  rows?: number
  /** 作文格每行格数 */
  gridCols?: number
  /** 题首说明 / 单题标签，例如「18（12 分）」 */
  prompt?: string
  label?: string
}

export type BlockKind =
  | 'text'
  | 'examLine'
  | 'title'
  | 'student'
  | 'notice'
  | 'legend'
  | 'section'
  | 'footer'
  | 'barcode'
  | 'examNo'
  | 'paperType'
  | 'pageFooter'
  | 'divider'
  | 'scoreBox'

export interface BlockMeta {
  kind: BlockKind
  /** 学生信息栏字段 */
  fields?: string[]
  /** 是否需要外框 */
  boxed?: boolean
  /** 准考证号位数 / 试卷类型等附加信息 */
  digits?: number
  paperTypes?: string[]
  /** 文本块旋转角（度），只影响打印，不影响识别 */
  rotate?: number
}

export interface CardMeta {
  paperSize: PaperSize
  orientation: Orientation
  /** 考试名称（同时作为试卷标题的默认值） */
  title: string
  /** 科目 / 答题卡副标题 */
  subtitle?: string
  system?: string
  subject?: string
  templateId?: string
  templateName?: string
  /** 条形码绘制区域（mm），只用于前端打印，后端字段是 content.barcode */
  barcodeRect?: { x: number; y: number; w: number; h: number }
  /** 高考真卡版式：宋体排版、准考证号方格、试卷类型、缺考标记 */
  gaokao?: boolean
}

export interface CardDoc {
  version: 3
  meta: CardMeta
  /** 提交给后端的标准试卷 JSON */
  content: ExamContent
  /** 主观题的打印样式 */
  qmeta: Record<string, QuestionMeta>
  /** 文本块的语义（标题/注意事项/页脚…），决定打印外观 */
  bmeta: Record<string, BlockMeta>
  /** 编辑/打印时隐藏的元素 id（不进后端，不影响识别） */
  hidden?: string[]
  updatedAt: number
}

/* ---------------- 模板生成规格 ---------------- */

export interface ObjectiveGroupSpec {
  title: string
  count: number
  score: number
  /** 每题选项，默认 ABCD */
  options?: string[]
}

export interface SubjectiveItemSpec {
  /** 该小题题首说明，如「17.」由生成器自动编号，这里可放「解：」 */
  label?: string
  rows: number
  score: number
}

export interface SubjectiveGroupSpec {
  title: string
  style: SubjectiveStyle
  /** 作文格每行格数 */
  gridCols?: number
  items: SubjectiveItemSpec[]
}

export interface CardSpec {
  /** 模板 / 试卷显示名 */
  name: string
  title: string
  subtitle: string
  system: string
  subject: string
  paperSize: PaperSize
  orientation: Orientation
  objectiveGroups: ObjectiveGroupSpec[]
  subjectiveGroups: SubjectiveGroupSpec[]
  studentFields: string[]
  notes: string
  showBarcode: boolean
  showLegend: boolean
  showNotice: boolean
  showStudent: boolean
  /** 页脚提示 */
  footer?: string
  /** 高考真卡版式 */
  gaokao?: boolean
  /** 准考证号位数（0 表示不画方格） */
  examNoDigits?: number
  showPaperType?: boolean
  showAbsent?: boolean
}

/* ---------------- 校验 ---------------- */

export type IssueLevel = 'error' | 'warn'

export interface CardIssue {
  level: IssueLevel
  code: string
  message: string
  /** 出问题的元素 id（question / block / marker） */
  target?: string
}

export function questionKind(q: Question): 'mark' | 'subjective' {
  return q.type === 'subjective' ? 'subjective' : 'mark'
}

export function isRegionInside(r: Region, canvas: { width: number; height: number }, tolerance = 0.05): boolean {
  return (
    r.x >= -tolerance &&
    r.y >= -tolerance &&
    r.width > 0 &&
    r.height > 0 &&
    r.x + r.width <= canvas.width + tolerance &&
    r.y + r.height <= canvas.height + tolerance
  )
}

/** 校验整份答题卡，返回所有会阻止保存/识别的问题与可忽略的警告 */
export function validateCard(doc: CardDoc): CardIssue[] {
  const issues: CardIssue[] = []
  const { content } = doc
  const canvas = content.canvas

  /* 画布与定位块 */
  if (!canvas || !(canvas.width > 0) || !(canvas.height > 0)) {
    issues.push({ level: 'error', code: 'CANVAS_EMPTY', message: '画布尺寸缺失' })
  }
  const ids = content.markers?.map((m) => m.id) ?? []
  const need = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  if (content.markers?.length !== 4 || need.some((id) => !ids.includes(id))) {
    issues.push({ level: 'error', code: 'MARKERS_INVALID', message: '定位块必须正好 4 个：左上/右上/左下/右下' })
  }
  for (const m of content.markers ?? []) {
    if (!isRegionInside({ x: m.x, y: m.y, width: m.size, height: m.size }, canvas)) {
      issues.push({ level: 'error', code: 'MARKER_OUT_OF_BOUNDS', message: `定位块 ${m.id} 超出画布`, target: m.id })
    }
  }

  /* 题目 */
  if (!content.questions?.length) {
    issues.push({ level: 'error', code: 'NO_QUESTIONS', message: '至少需要一道题才能识别' })
  }
  const allIds = new Set<string>()
  for (const q of content.questions ?? []) {
    if (!q.id) {
      issues.push({ level: 'error', code: 'QUESTION_ID_EMPTY', message: '存在没有 id 的题目' })
      continue
    }
    if (allIds.has(q.id)) {
      issues.push({ level: 'error', code: 'QUESTION_ID_DUP', message: `题目 id「${q.id}」重复`, target: q.id })
    }
    allIds.add(q.id)

    if (!(q.score != null && q.score > 0)) {
      issues.push({ level: 'error', code: 'QUESTION_SCORE', message: `${labelOf(q)} 分值必须大于 0`, target: q.id })
    }
    if (!isRegionInside(q.region, canvas)) {
      issues.push({ level: 'error', code: 'QUESTION_OUT_OF_BOUNDS', message: `${labelOf(q)} 超出画布`, target: q.id })
    }
    if (u2mm(q.region.height) < 4 || u2mm(q.region.width) < 8) {
      issues.push({ level: 'warn', code: 'QUESTION_TOO_SMALL', message: `${labelOf(q)} 区域过小，识别可能不稳`, target: q.id })
    }
    if (q.type === 'mark') {
      const choices = q.choices ?? []
      if (choices.length < 2) {
        issues.push({ level: 'error', code: 'CHOICES_MISSING', message: `${labelOf(q)} 至少要有 2 个选项`, target: q.id })
      }
      const vals = new Set<string>()
      for (const c of choices) {
        if (vals.has(c.value)) {
          issues.push({ level: 'error', code: 'CHOICE_DUP', message: `${labelOf(q)} 选项「${c.value}」重复`, target: q.id })
        }
        vals.add(c.value)
        const r = c.region
        if (r.x < -0.001 || r.y < -0.001 || r.width <= 0 || r.height <= 0 || r.x + r.width > 1.001 || r.y + r.height > 1.001) {
          issues.push({
            level: 'error',
            code: 'CHOICE_OUT_OF_BOUNDS',
            message: `${labelOf(q)} 选项「${c.value}」比例超出 0–1`,
            target: q.id,
          })
        }
      }
    }
  }

  /* 内容块 */
  for (const b of content.blocks ?? []) {
    if (!b.text?.trim()) {
      issues.push({ level: 'error', code: 'BLOCK_TEXT_EMPTY', message: '内容块文字不能为空', target: b.id })
    }
    if (allIds.has(b.id)) {
      issues.push({ level: 'error', code: 'BLOCK_ID_DUP', message: `内容块 id「${b.id}」与题目重复`, target: b.id })
    }
    allIds.add(b.id)
    if (!isRegionInside(b.region, canvas)) {
      issues.push({ level: 'warn', code: 'BLOCK_OUT_OF_BOUNDS', message: `内容块「${b.id}」超出画布`, target: b.id })
    }
  }

  /* 答案键 */
  const byId = new Map((content.questions ?? []).map((q) => [q.id, q] as const))
  for (const [qid, value] of Object.entries(content.answerKey ?? {})) {
    const q = byId.get(qid)
    if (!q) {
      issues.push({ level: 'warn', code: 'ANSWER_KEY_UNKNOWN', message: `答案键引用了不存在的题目「${qid}」`, target: qid })
      continue
    }
    if (!q.choices?.some((c) => c.value === value)) {
      issues.push({ level: 'warn', code: 'ANSWER_KEY_INVALID', message: `${labelOf(q)} 的答案「${value}」不在选项里`, target: qid })
    }
  }

  /* 重叠检查：识别靠区域采样，重叠会互相污染 */
  const qs = (content.questions ?? []).filter((q) => q.type === 'mark')
  for (let i = 0; i < qs.length; i += 1) {
    for (let j = i + 1; j < qs.length; j += 1) {
      const a = qs[i].region
      const b = qs[j].region
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (ox > 0.2 && oy > 0.2) {
        issues.push({
          level: 'warn',
          code: 'QUESTION_OVERLAP',
          message: `${labelOf(qs[i])} 与 ${labelOf(qs[j])} 区域重叠`,
          target: qs[i].id,
        })
      }
    }
  }

  return issues
}

export function labelOf(q: Question): string {
  return q.displayNumber != null ? `第 ${q.displayNumber} 题` : `题目「${q.id}」`
}

export function blankContent(size: PaperSize, orientation: Orientation): ExamContent {
  const canvas = canvasOf(size, orientation)
  const mk = 11
  const inset = 8
  return {
    schemaVersion: 1,
    unit: 'canvas',
    canvas,
    markers: [
      { id: 'top-left', x: inset, y: inset, size: mk },
      { id: 'top-right', x: round2(canvas.width - inset - mk), y: inset, size: mk },
      { id: 'bottom-left', x: inset, y: round2(canvas.height - inset - mk), size: mk },
      { id: 'bottom-right', x: round2(canvas.width - inset - mk), y: round2(canvas.height - inset - mk), size: mk },
    ],
    blocks: [],
    questions: [],
    answerKey: {},
  }
}

export function emptyDoc(spec: CardSpec): CardDoc {
  return {
    version: 3,
    meta: {
      paperSize: spec.paperSize,
      orientation: spec.orientation,
      title: spec.title,
      subtitle: spec.subtitle,
      system: spec.system,
      subject: spec.subject,
    },
    content: blankContent(spec.paperSize, spec.orientation),
    qmeta: {},
    bmeta: {},
    updatedAt: Date.now(),
  }
}

/* ---------------- 实用 ---------------- */

export function cloneContent(content: ExamContent): ExamContent {
  return JSON.parse(JSON.stringify(content)) as ExamContent
}

export function cloneDoc(doc: CardDoc): CardDoc {
  return JSON.parse(JSON.stringify(doc)) as CardDoc
}

export function markerRects(content: ExamContent): Marker[] {
  return content.markers ?? []
}

export function barcodeOf(content: ExamContent): Barcode | undefined {
  return content.barcode
}

export function blockIds(content: ExamContent): string[] {
  return (content.blocks ?? []).map((b: Block) => b.id)
}
