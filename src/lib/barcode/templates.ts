import type { CardBarcodeFormat } from '../card/types'

/**
 * 答题卡右上角「贴条形码区」标准尺寸。
 * 高考/考试常用条码纸规格参考 50×20mm（也有 75×28.5mm 的版本）。
 * 条形码制作页与答题卡占位区共用这一尺寸，保证联动。
 */
export const ANSWER_CARD_BARCODE_AREA = { width: 50, height: 20 }

export type BarcodeLayout = 'roll' | 'sheet'
export type BarcodeOrder = 'row' | 'column'

export interface BarcodeTemplate {
  id: string
  name: string
  desc: string
  layout: BarcodeLayout
  /** 打印页尺寸 mm；卷纸模式=单张标签尺寸 */
  pageW: number
  pageH: number
  labelW: number
  labelH: number
  columns: number
  rows: number
  gapX: number
  gapY: number
  format: CardBarcodeFormat
  showText: boolean
  /** 多列时先左→右还是先上→下 */
  order: BarcodeOrder
  /** 标签四周留白 mm */
  pad?: number
}

export const BARCODE_TEMPLATES: BarcodeTemplate[] = [
  {
    id: 'gaokao-roll-50x20',
    name: '高考贴纸 · 单列卷纸 50×20',
    desc: '考试常用 50×20mm 不干胶标签，一张一张连续出纸；适合桌面标签打印机。',
    layout: 'roll',
    pageW: 50,
    pageH: 20,
    labelW: 50,
    labelH: 20,
    columns: 1,
    rows: 1,
    gapX: 0,
    gapY: 0,
    format: 'CODE128',
    showText: true,
    order: 'row',
    pad: 0.8,
  },
  {
    id: 'gaokao-sheet-50x20-2col',
    name: 'A4 双列 · 50×20',
    desc: 'A4 纸左右两份，每行 2 张，每页 24 张；适合批量打印后裁切。',
    layout: 'sheet',
    pageW: 210,
    pageH: 297,
    labelW: 50,
    labelH: 20,
    columns: 2,
    rows: 12,
    gapX: 6,
    gapY: 3,
    format: 'CODE128',
    showText: true,
    order: 'row',
    pad: 0.8,
  },
  {
    id: 'exam-sheet-40x25-2col',
    name: 'A4 双列 · 40×25',
    desc: '较宽的考试条码标签，A4 左右两份，每页 20 张。',
    layout: 'sheet',
    pageW: 210,
    pageH: 297,
    labelW: 40,
    labelH: 25,
    columns: 2,
    rows: 10,
    gapX: 8,
    gapY: 4,
    format: 'CODE128',
    showText: true,
    order: 'row',
    pad: 0.8,
  },
  {
    id: 'exam-roll-75x28',
    name: '考试标签 · 单列卷纸 75×28.5',
    desc: '较大的考试条码纸规格，单张连续出纸。',
    layout: 'roll',
    pageW: 75,
    pageH: 28.5,
    labelW: 75,
    labelH: 28.5,
    columns: 1,
    rows: 1,
    gapX: 0,
    gapY: 0,
    format: 'CODE128',
    showText: true,
    order: 'row',
    pad: 0.8,
  },
  {
    id: 'exam-sheet-70x30-2col',
    name: 'A4 双列 · 70×30',
    desc: 'A4 左右两份，每页 16 张大标签，适合姓名 + 考号 + 条码。',
    layout: 'sheet',
    pageW: 210,
    pageH: 297,
    labelW: 70,
    labelH: 30,
    columns: 2,
    rows: 8,
    gapX: 8,
    gapY: 4,
    format: 'CODE128',
    showText: true,
    order: 'row',
    pad: 1,
  },
  {
    id: 'custom',
    name: '自定义标签',
    desc: '自定义纸张、标签尺寸、行数、列数和排列顺序。',
    layout: 'sheet',
    pageW: 210,
    pageH: 297,
    labelW: 50,
    labelH: 20,
    columns: 2,
    rows: 10,
    gapX: 6,
    gapY: 3,
    format: 'CODE128',
    showText: true,
    order: 'row',
    pad: 0.8,
  },
]

export function templateById(id: string): BarcodeTemplate {
  return BARCODE_TEMPLATES.find((t) => t.id === id) ?? BARCODE_TEMPLATES[0]
}

export function capacityOf(t: BarcodeTemplate): number {
  if (t.layout === 'roll') return 1
  return Math.max(1, t.columns * t.rows)
}

/** 预览/打印页的标签槽位（mm） */
export function labelSlots(t: BarcodeTemplate): Array<{ x: number; y: number; w: number; h: number }> {
  const slots: Array<{ x: number; y: number; w: number; h: number }> = []
  const cols = t.layout === 'roll' ? 1 : Math.max(1, t.columns)
  const rows = t.layout === 'roll' ? 1 : Math.max(1, t.rows)
  const totalW = cols * t.labelW + (cols - 1) * t.gapX
  const totalH = rows * t.labelH + (rows - 1) * t.gapY
  const startX = Math.max(0, (t.pageW - totalW) / 2)
  const startY = Math.max(0, (t.pageH - totalH) / 2)
  const order = t.layout === 'roll' ? 'row' : t.order
  if (order === 'column') {
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        slots.push({ x: startX + c * (t.labelW + t.gapX), y: startY + r * (t.labelH + t.gapY), w: t.labelW, h: t.labelH })
      }
    }
  } else {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        slots.push({ x: startX + c * (t.labelW + t.gapX), y: startY + r * (t.labelH + t.gapY), w: t.labelW, h: t.labelH })
      }
    }
  }
  return slots
}
