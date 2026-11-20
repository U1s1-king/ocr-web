/**
 * 试卷设计文档 v2
 *
 * 与后端 v1（ExamContent）的区别：
 *  - v1 只有一块画布 + 一堆题目区域，适合做识别，不适合做设计
 *  - v2 面向设计器：A3/A4、正反两面、所有元素都能自由拖动/旋转
 * 保存时用 compile() 把 v2 压回 v1 交给后端，识别链路完全不用改。
 */

import type { Block, ExamContent, Marker, Question } from '../api/types'

/* ================= 纸型 ================= */

export type PaperSize = 'A4' | 'A3'
export type Orientation = 'portrait' | 'landscape'
export type Side = 'front' | 'back'

/** 毫米尺寸（竖版），横版时宽高互换 */
export const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
}

export const PAPER_LABEL: Record<PaperSize, string> = {
  A4: 'A4 · 210×297',
  A3: 'A3 · 297×420',
}

/** 设计器内部统一用「每毫米 2 单位」，1 单位 ≈ 0.5mm，够细也够整 */
export const MM = 2

/** A3 默认横放（真实答题卡多为横向对折），A4 默认竖放 */
export function defaultOrientation(size: PaperSize): Orientation {
  return size === 'A3' ? 'landscape' : 'portrait'
}

export function canvasOf(size: PaperSize, o: Orientation) {
  const m = PAPER_MM[size]
  const w = o === 'portrait' ? m.w : m.h
  const h = o === 'portrait' ? m.h : m.w
  return { w: w * MM, h: h * MM, mmW: w, mmH: h }
}

/* ================= 元素 ================= */

export type ElementKind =
  | 'title'
  | 'subtitle'
  | 'notice'
  | 'barcode'
  | 'studentInfo'
  | 'examNo'
  | 'legend'
  | 'forbidden'
  | 'objective'
  | 'questionList'
  | 'subjective'
  | 'gridPaper'
  | 'scoreBox'
  | 'divider'
  | 'markers'
  | 'image'

export interface BaseEl {
  id: string
  kind: ElementKind
  /** 左上角坐标，单位=设计单位 */
  x: number
  y: number
  w: number
  h: number
  /** 旋转角，度 */
  rotate?: number
  locked?: boolean
  hidden?: boolean
  /** 外框：真实答题卡用它圈住答题区域 */
  frame?: 'none' | 'red' | 'gray'
}

export interface TextEl extends BaseEl {
  kind: 'title' | 'subtitle' | 'notice'
  text: string
  fontSize: number
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
  /** 左侧竖排标签，真卡「注意事项」就是竖着印的 */
  sideLabel?: string
  /** 文字颜色，真卡的考试名称、卷别标题都是红色 */
  color?: string
  /** 底色：第Ⅰ卷/第Ⅱ卷 是深色横条 */
  fill?: string
  /** 是否反白（深底白字） */
  invert?: boolean
}

/** 条形码：只画占位框 + 文字，不生成真码；可拖动可旋转 */
export interface BarcodeEl extends BaseEl {
  kind: 'barcode'
  label: string
  rotate: number
  /** 竖排：真实答题卡条形码是竖贴的，文字从下往上读 */
  vertical?: boolean
  /** 虚线框（真卡「贴条形码区」就是虚线） */
  dashed?: boolean
  /** 框下小字，如「由监考员负责粘贴」 */
  note?: string
}

export interface StudentInfoEl extends BaseEl {
  kind: 'studentInfo'
  fields: string[]
  /** 每行几个字段 */
  columns: number
  fontSize: number
  /** 是否画填涂框 */
  boxed: boolean
}

/** 客观题：一次给「排数 × 每排题数 × 选项数」，自动编号 */
export interface ObjectiveEl extends BaseEl {
  kind: 'objective'
  /** 每栏行数 */
  rows: number
  /** 一排放几道题（横向重复几组「题号 + 选项」） */
  cols: number
  options: string[]
  startNumber: number
  fontSize: number
  /** 每题分值，写进后端 questions[].score */
  score: number
  /** 分几块（真卡每 20 题一块，块间留空） */
  blocks: number
  /** 实际题数，最后一块不满时据此截断 */
  count?: number
  /** 'bracket' 用方框，'circle' 用圆框 */
  markStyle: 'bracket' | 'circle'
}

/** 准考证号：一行方格，一格一位 */
export interface ExamNoEl extends BaseEl {
  kind: 'examNo'
  label: string
  digits: number
  fontSize: number
}

/** 填涂样例：正确 ■ 与错误 √ × ○ 各一个 */
export interface LegendEl extends BaseEl {
  kind: 'legend'
  fontSize: number
}

/** 此栏考生禁填 */
export interface ForbiddenEl extends BaseEl {
  kind: 'forbidden'
  fontSize: number
}

/** 小题列表：像「71. ______ / 72. ______」这样一题一段横线 */
export interface QuestionListEl extends BaseEl {
  kind: 'questionList'
  startNumber: number
  /** 每题占几行横线 */
  items: number[]
  fontSize: number
  rowHeight: number
}

/** 作文格：真正的方格纸组件，每行格数可调，格子永远是正方形 */
export interface GridPaperEl extends BaseEl {
  kind: 'gridPaper'
  /** 每行几格 */
  cols: number
  /** 格边长（设计单位），不填就按宽度均分 */
  cell?: number
  /** 上方那条「题目：____」 */
  topicLine?: boolean
}

/** 主观题：作答区，按行数画横线 */
export interface SubjectiveEl extends BaseEl {
  kind: 'subjective'
  label: string
  rows: number
  rowHeight: number
  /** 是否画田字格（作文用） */
  grid?: boolean
  /** 作文题上方那条「题目：______」 */
  topicLine?: boolean
  /** 题首提示，如「解：」「证明：」 */
  prompt?: string
  /** 是否画横线（解答题常留白，填空常画线） */
  ruled?: boolean
}

/** 阅卷得分栏：题号 + 得分 + 阅卷人 */
export interface ScoreBoxEl extends BaseEl {
  kind: 'scoreBox'
  count: number
  fontSize: number
}

export interface DividerEl extends BaseEl {
  kind: 'divider'
  dashed: boolean
}

/** 底图：直接把扫描/实拍的真实答题卡铺在画布上，一比一还原 */
export interface ImageEl extends BaseEl {
  kind: 'image'
  /** dataURL 或 http 地址 */
  src: string
  /** 不透明度，作为底图时常调到 1 */
  opacity?: number
  /** 是否垫在最底层（不可选的底图） */
  backdrop?: boolean
}

/** 四角定位块，识别用的。元素本身占满画布，四角位置由 inset 控制 */
export interface MarkersEl extends BaseEl {
  kind: 'markers'
  size: number
  inset: { x: number; y: number }
}

export type PaperElement =
  | TextEl
  | BarcodeEl
  | StudentInfoEl
  | ExamNoEl
  | LegendEl
  | ForbiddenEl
  | ObjectiveEl
  | QuestionListEl
  | GridPaperEl
  | SubjectiveEl
  | ScoreBoxEl
  | DividerEl
  | MarkersEl
  | ImageEl

/* ================= 文档 ================= */

export interface DesignSide {
  size: PaperSize
  orientation: Orientation
  side: Side
  elements: PaperElement[]
}

export interface PaperDesign {
  schemaVersion: 2
  front: DesignSide
  back: DesignSide
  /** 客观题答案键，与后端 answerKey 一致 */
  answerKey?: Record<string, string>
  uTime?: number
}

export function emptySide(size: PaperSize, side: Side, orientation: Orientation = 'portrait'): DesignSide {
  return { size, side, orientation, elements: [] }
}

export function emptyDesign(size: PaperSize = 'A4', orientation?: Orientation): PaperDesign {
  const o = orientation ?? defaultOrientation(size)
  return {
    schemaVersion: 2,
    front: emptySide(size, 'front', o),
    back: emptySide(size, 'back', o),
  }
}

export function isDesign(v: unknown): v is PaperDesign {
  return !!v && typeof v === 'object' && (v as PaperDesign).schemaVersion === 2
}

let seq = 0
export function uid(prefix = 'el') {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

/* ================= 元素工厂 ================= */

export function makeElement(kind: ElementKind, at: { x: number; y: number }): PaperElement {
  const base = { id: uid(kind), x: at.x, y: at.y }
  switch (kind) {
    case 'title':
      return { ...base, kind, w: 900, h: 64, text: '2026—2027 学年第一学期期中考试', fontSize: 34, bold: true, align: 'center' }
    case 'subtitle':
      return { ...base, kind, w: 700, h: 44, text: '数学 答题卡', fontSize: 26, bold: true, align: 'center' }
    case 'notice':
      return {
        ...base,
        kind,
        w: 900,
        h: 96,
        text: '注意事项：\n1. 答题前请将姓名、考号填写清楚。\n2. 选择题用 2B 铅笔填涂，非选择题用 0.5mm 黑色签字笔作答。\n3. 保持卡面清洁，不要折叠、不要弄破。',
        fontSize: 13,
        align: 'left',
        lineHeight: 1.7,
      }
    case 'barcode':
      return { ...base, kind, w: 300, h: 96, label: '条形码粘贴处', rotate: 0, vertical: false }
    case 'studentInfo':
      return { ...base, kind, w: 760, h: 120, fields: ['姓名', '考号', '班级', '座位号'], columns: 2, fontSize: 15, boxed: true }
    case 'examNo':
      return { ...base, kind, w: 420, h: 44, label: '准考证号', digits: 15, fontSize: 12, frame: 'gray' }
    case 'legend':
      return { ...base, kind, w: 360, h: 34, fontSize: 10 }
    case 'forbidden':
      return { ...base, kind, w: 360, h: 34, fontSize: 10, frame: 'red' }
    case 'objective':
      return {
        ...base,
        kind,
        w: 900,
        h: 260,
        rows: 5,
        cols: 4,
        options: ['A', 'B', 'C', 'D'],
        startNumber: 1,
        fontSize: 15,
        score: 1,
        blocks: 1,
        count: 20,
        markStyle: 'bracket',
      }
    case 'gridPaper':
      return { ...base, kind, w: 900, h: 360, cols: 20, topicLine: true }
    case 'questionList':
      return { ...base, kind, w: 900, h: 200, startNumber: 1, items: [3, 3, 3, 3, 3], fontSize: 14, rowHeight: 36 }
    case 'subjective':
      return { ...base, kind, w: 900, h: 300, label: '二、解答题', rows: 6, rowHeight: 40 }
    case 'scoreBox':
      return { ...base, kind, w: 900, h: 70, count: 8, fontSize: 13 }
    case 'divider':
      return { ...base, kind, w: 900, h: 2, dashed: true }
    case 'image':
      return { ...base, kind, w: 840, h: 594, src: '', opacity: 1, backdrop: true }
    case 'markers':
      return { ...base, kind, x: 0, y: 0, w: 400, h: 560, size: 22, inset: { x: at.x || 20, y: at.y || 20 } }
    default:
      return { ...base, kind: 'title', w: 900, h: 64, text: '', fontSize: 30 }
  }
}

/* ================= 容量估算（自动出卷用） ================= */

/** 一个客观题元素实际占多高（按行数） */
export function objectiveHeight(el: ObjectiveEl) {
  const blocks = Math.max(1, el.blocks ?? 1)
  const blockGap = el.fontSize * 1.1
  return 12 + blocks * el.rows * (el.fontSize * 2.2) + (blocks - 1) * blockGap
}

/** 一个主观题元素实际占多高 */
export function subjectiveHeight(el: SubjectiveEl) {
  return 30 + el.rows * el.rowHeight
}

/* ================= 存盘：v2 → v1 ================= */

/**
 * 把设计文档压成后端认识的 ExamContent。
 *  - 客观题按「每排题数」拆成一个个 question.region
 *  - 文字类压成 blocks
 *  - 四角定位块 → markers
 */
export function compile(design: PaperDesign): ExamContent {
  const c = canvasOf(design.front.size, design.front.orientation)
  const markers: Marker[] = []
  const questions: Question[] = []
  const blocks: Block[] = []

  const pageEls = [...design.front.elements, ...design.back.elements]

  // 后端要求 markers 恰好 4 个，取第一个定位块元素镜像出四角
  const mk = pageEls.find((el): el is MarkersEl => el.kind === 'markers' && !el.hidden)
  if (mk) {
    const s0 = mk.size
    const ix = mk.inset?.x ?? mk.x
    const iy = mk.inset?.y ?? mk.y
    markers.push(
      { id: 'top-left', x: ix, y: iy, size: s0 },
      { id: 'top-right', x: c.w - ix - s0, y: iy, size: s0 },
      { id: 'bottom-left', x: ix, y: c.h - iy - s0, size: s0 },
      { id: 'bottom-right', x: c.w - ix - s0, y: c.h - iy - s0, size: s0 },
    )
  }

  for (const el of pageEls) {
    if (el.hidden) continue

    if (el.kind === 'title' || el.kind === 'subtitle' || el.kind === 'notice') {
      blocks.push({
        id: el.id,
        type: 'text',
        region: { x: el.x, y: el.y, width: el.w, height: el.h },
        text: el.text,
        style: {
          fontSize: el.fontSize,
          fontWeight: el.bold ? 'bold' : 'normal',
          textAlign: el.align ?? 'left',
          lineHeight: el.lineHeight,
        },
      })
    }

    if (el.kind === 'objective') {
      const gapX = el.w / el.cols
      const rowH = el.fontSize * 2.2
      const optN = Math.max(2, el.options.length)
      const blocks = Math.max(1, el.blocks ?? 1)
      const blockH = el.rows * rowH + el.fontSize * 1.1
      const cap = el.count ?? blocks * el.cols * el.rows
      let emitted = 0
      for (let b = 0; b < blocks; b += 1) {
      for (let r = 0; r < el.rows; r += 1) {
        for (let i = 0; i < el.cols; i += 1) {
          if (emitted >= cap) break
          const n = el.startNumber + b * el.cols * el.rows + r * el.cols + i
          emitted += 1
          questions.push({
            id: `q${n}`,
            displayNumber: n,
            type: 'mark',
            score: el.score ?? 1,
            region: {
              x: Math.round(el.x + i * gapX + 22),
              y: Math.round(el.y + 6 + b * blockH + r * rowH),
              width: Math.max(20, Math.round(gapX - 26)),
              height: Math.max(12, Math.round(rowH - 4)),
            },
            // 后端要求：选项区域是相对小题的比例（0–1），且不能越界
            choices: el.options.map((opt, k) => ({
              value: opt,
              region: { x: k / optN, y: 0, width: 1 / optN, height: 1 },
            })),
          })
        }
      }
    }
  }
  }

  return {
    schemaVersion: 1,
    unit: 'canvas',
    canvas: { width: Math.round(c.w), height: Math.round(c.h) },
    markers,
    questions,
    blocks,
    answerKey: design.answerKey ?? {},
  }
}

/** 反过来：v1 → v2 的粗略还原，打开老试卷时不至于全空白 */
export function decompile(content: ExamContent, name: string): PaperDesign {
  const design = emptyDesign('A4')
  const c = content.canvas ?? { width: 420, height: 594 }
  const closeToA3 = c.width > 500
  design.front.size = closeToA3 ? 'A3' : 'A4'

  const els: PaperElement[] = []
  if (name) {
    els.push({
      id: uid('title'),
      kind: 'title',
      x: 60,
      y: 40,
      w: c.width - 120,
      h: 60,
      text: name,
      fontSize: 30,
      bold: true,
      align: 'center',
    })
  }
  ;(content.blocks ?? []).forEach((b) => {
    els.push({
      id: b.id || uid('notice'),
      kind: 'notice',
      x: b.region.x,
      y: b.region.y,
      w: b.region.width,
      h: b.region.height,
      text: b.text,
      fontSize: b.style?.fontSize ?? 14,
      align: b.style?.textAlign ?? 'left',
      lineHeight: 1.6,
    })
  })
  if (content.markers?.length) {
    const tl = content.markers.find((m) => m.id === 'top-left')
    if (tl) {
      els.push({
        id: uid('mk'),
        kind: 'markers',
        x: 0,
        y: 0,
        w: c.width,
        h: c.height,
        size: tl.size,
        inset: { x: tl.x, y: tl.y },
      })
    }
  }
  design.front.elements = els
  return design
}
