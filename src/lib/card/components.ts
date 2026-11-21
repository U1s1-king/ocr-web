import type { Question } from '../../api/types'
import {
  mm2u,
  paperMm,
  round2,
  type BlockKind,
  type CardDoc,
  type CardGroup,
  type CardGroupKind,
  type SubjectiveStyle,
} from './types'

const MARGIN_MM = 14
const GAP_MM = 3

export interface GroupOptions {
  count: number
  options?: number
  rows?: number
  style?: SubjectiveStyle
  score?: number
  gridCols?: number
  heightMm?: number
}

function contentWidth(doc: CardDoc): number {
  const page = paperMm(doc.meta.paperSize, doc.meta.orientation)
  return page.w - MARGIN_MM * 2
}

function contentHeight(doc: CardDoc): number {
  return paperMm(doc.meta.paperSize, doc.meta.orientation).h
}

/** 当前所有内容的最低点，作为新组件的插入位置 */
function insertY(doc: CardDoc): number {
  let y = MARGIN_MM
  for (const q of doc.content.questions) y = Math.max(y, (q.region.y + q.region.height) * 0.7)
  for (const b of doc.content.blocks ?? []) y = Math.max(y, (b.region.y + b.region.height) * 0.7)
  return Math.min(contentHeight(doc) - 12, y + GAP_MM)
}

function nextNumber(doc: CardDoc): number {
  return Math.max(0, ...doc.content.questions.map((q) => q.displayNumber ?? 0)) + 1
}

let seq = 0
function uid(prefix: string): string {
  seq += 1
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`
}

function groupId(): string {
  return uid('grp')
}

/** 选择题组：每题一行，选项横向排布，选项数可调 */
export function addChoiceGroup(doc: CardDoc, opts: GroupOptions): { doc: CardDoc; group: CardGroup } {
  const next: CardDoc = {
    ...doc,
    content: { ...doc.content, questions: [...doc.content.questions], blocks: [...(doc.content.blocks ?? [])] },
    qmeta: { ...doc.qmeta },
    groups: [...(doc.groups ?? [])],
  }
  const count = Math.max(1, Math.min(100, Math.round(opts.count || 1)))
  const options = Math.max(2, Math.min(8, Math.round(opts.options ?? 4)))
  const score = Math.max(0.5, Number(opts.score ?? 2))
  const maxWidthMm = contentWidth(doc)
  const rowMm = 7
  const labelMm = 6.2
  const widthMm = Math.min(maxWidthMm, labelMm + options * 6.2 + 3)
  const optW = (widthMm - labelMm - 2) / options
  const startY = insertY(doc)
  const number0 = nextNumber(doc)
  const ids: string[] = []
  for (let i = 0; i < count; i += 1) {
    const y = startY + i * (rowMm + 0.6)
    const id = uid('q')
    const q: Question = {
      id,
      displayNumber: number0 + i,
      type: 'mark',
      score,
      region: {
        x: mm2u(MARGIN_MM),
        y: mm2u(y),
        width: mm2u(widthMm),
        height: mm2u(rowMm),
      },
      choices: Array.from({ length: options }, (_, k) => {
        const cx = labelMm + k * optW + 0.8
        return {
          value: String.fromCharCode(65 + k),
          region: {
            x: round2(cx / widthMm),
            y: 0.16,
            width: round2((optW * 0.84) / widthMm),
            height: 0.68,
          },
        }
      }),
    }
    next.content.questions.push(q)
    ids.push(id)
  }
  const group: CardGroup = {
    id: groupId(),
    kind: 'choice',
    name: `选择题组 · ${count} 题 × ${options} 项`,
    itemIds: ids,
    config: { count, options, score, startNumber: number0 },
  }
  next.groups = [...(next.groups ?? []), group]
  next.updatedAt = Date.now()
  return { doc: next, group }
}

/** 主观题组：输入题数、每题行数；空白样式不画横线 */
export function addSubjectiveGroup(doc: CardDoc, opts: GroupOptions): { doc: CardDoc; group: CardGroup } {
  const next: CardDoc = {
    ...doc,
    content: { ...doc.content, questions: [...doc.content.questions], blocks: [...(doc.content.blocks ?? [])] },
    qmeta: { ...doc.qmeta },
    groups: [...(doc.groups ?? [])],
  }
  const count = Math.max(1, Math.min(50, Math.round(opts.count || 1)))
  const style: SubjectiveStyle = opts.style ?? 'lines'
  const rows = Math.max(0, Math.min(80, Math.round(opts.rows ?? (style === 'blank' ? 0 : 5))))
  const score = Math.max(0.5, Number(opts.score ?? 10))
  const widthMm = contentWidth(doc)
  const boxH = style === 'blank' ? Math.max(10, Number(opts.heightMm ?? 30)) : Math.max(14, 8 + rows * 4.8)
  const startY = insertY(doc)
  const number0 = nextNumber(doc)
  const ids: string[] = []
  for (let i = 0; i < count; i += 1) {
    const y = startY + i * (boxH + 2)
    const id = uid(style === 'blank' ? 'box' : 'q')
    next.content.questions.push({
      id,
      displayNumber: number0 + i,
      type: 'subjective',
      score,
      region: { x: mm2u(MARGIN_MM), y: mm2u(y), width: mm2u(widthMm), height: mm2u(boxH) },
    })
    next.qmeta[id] = {
      style,
      rows: Math.max(1, rows),
      gridCols: Math.max(4, Number(opts.gridCols ?? 20)),
    }
    ids.push(id)
  }
  const group: CardGroup = {
    id: groupId(),
    kind: style === 'blank' ? 'blank' : 'subjective',
    name: style === 'blank' ? `空白方框组 · ${count} 个` : `主观题组 · ${count} 题 × ${rows} 行`,
    itemIds: ids,
    config: { count, rows, style, score, heightMm: boxH, startNumber: number0, gridCols: opts.gridCols },
  }
  next.groups = [...(next.groups ?? []), group]
  next.updatedAt = Date.now()
  return { doc: next, group }
}

/** 单组件（文本 / 标题 / 分割线 / 注意事项 / 学生信息 / 条形码占位 / 页眉页脚） */
export function addPresetBlock(
  doc: CardDoc,
  kind: 'text' | 'title' | 'section' | 'divider' | 'notice' | 'student' | 'barcode' | 'header' | 'footer',
): { doc: CardDoc; group: CardGroup } {
  const widthMm = contentWidth(doc)
  const startY = insertY(doc)
  const id = uid(kind === 'barcode' ? 'bc' : 'b')
  const page = paperMm(doc.meta.paperSize, doc.meta.orientation)
  const blockH = kind === 'notice' ? 18 : kind === 'divider' ? 2 : kind === 'barcode' ? 26 : 9
  const region =
    kind === 'barcode'
      ? { x: mm2u(page.w - MARGIN_MM - 54), y: mm2u(startY), width: mm2u(54), height: mm2u(26) }
      : { x: mm2u(MARGIN_MM), y: mm2u(startY), width: mm2u(widthMm), height: mm2u(blockH) }
  const text =
    kind === 'text'
      ? '双击右侧文本框编辑内容'
      : kind === 'title'
        ? '答题卡标题'
        : kind === 'section'
          ? '一、选择题（每小题 2 分）'
          : kind === 'divider'
            ? '分割线'
            : kind === 'notice'
              ? '注意事项：\n1. 答题前请将姓名、考号填写清楚。\n2. 选择题用 2B 铅笔填涂。'
              : kind === 'student'
                ? '姓名：　　　　班级：　　　　考号：'
                : kind === 'barcode'
                  ? '贴条形码区'
                  : kind === 'header'
                    ? '2026 学年第一学期期中考试'
                    : '第 1 页 共 1 页'
  const bmeta: Record<string, BlockKind | undefined> = {
    text: 'text',
    title: 'title',
    section: 'section',
    divider: 'divider',
    notice: 'notice',
    student: 'student',
    barcode: 'barcode',
    header: 'examLine',
    footer: 'pageFooter',
  }
  const next: CardDoc = {
    ...doc,
    content: {
      ...doc.content,
      questions: [...doc.content.questions],
      blocks: [
        ...(doc.content.blocks ?? []),
        {
          id,
          type: 'text',
          region,
          text,
          style: {
            fontSize: kind === 'title' ? 6 : kind === 'section' ? 4.2 : kind === 'notice' ? 2.8 : 3.4,
            fontWeight: kind === 'title' || kind === 'section' ? 'bold' : 'normal',
            textAlign: kind === 'title' ? 'center' : 'left',
            lineHeight: 1.5,
          },
        },
      ],
    },
    bmeta: { ...doc.bmeta, [id]: { kind: bmeta[kind] ?? 'text' } },
    groups: [...(doc.groups ?? [])],
  }
  const group: CardGroup = {
    id: groupId(),
    kind: kind as CardGroupKind,
    name:
      kind === 'text'
        ? '文本'
        : kind === 'title'
          ? '标题'
          : kind === 'section'
            ? '分组标题'
            : kind === 'divider'
              ? '分割线'
              : kind === 'notice'
                ? '注意事项'
                : kind === 'student'
                  ? '学生信息'
                  : kind === 'barcode'
                    ? '贴条形码区'
                    : kind === 'header'
                      ? '页眉'
                      : '页脚 / 页码',
    itemIds: [id],
  }
  next.groups = [...(next.groups ?? []), group]
  next.updatedAt = Date.now()
  return { doc: next, group }
}

export function groupOf(doc: CardDoc, itemId: string): CardGroup | undefined {
  return (doc.groups ?? []).find((g) => g.itemIds.includes(itemId))
}

export function splitGroup(doc: CardDoc, groupIdValue: string): CardDoc {
  return { ...doc, groups: (doc.groups ?? []).filter((g) => g.id !== groupIdValue) }
}
