import { mm2u, paperMm, round2, u2mm, type CardDoc, type CardGroup } from './types'
import { createBackDoc } from './back'
import type { Block, Question } from '../../api/types'

const MARGIN_X = 12
const MARGIN_TOP = 12
const MARGIN_BOTTOM = 12
const GAP = 2

interface FlowItem {
  id: string
  kind: 'question' | 'block'
  y: number
  h: number
  w: number
  question?: Question
  block?: Block
}

interface PageProfile {
  frontCols: number
  backCols: number
  /** 用于在 UI/日志里说明当前使用的科目版式 */
  label: string
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function splitGroups(doc: CardDoc, frontIds: Set<string>, backIds: Set<string>): { front: CardGroup[]; back: CardGroup[] } {
  const front: CardGroup[] = []
  const back: CardGroup[] = []
  for (const g of doc.groups ?? []) {
    const fIds = g.itemIds.filter((id) => frontIds.has(id))
    const bIds = g.itemIds.filter((id) => backIds.has(id))
    if (fIds.length) front.push({ ...g, itemIds: fIds })
    if (bIds.length) back.push({ ...g, itemIds: bIds })
  }
  return { front, back }
}

/** 科目感知：不同科目使用不同的正面/背面栏数 */
export function pageProfileOf(front: CardDoc): PageProfile {
  const page = paperMm(front.meta.paperSize, front.meta.orientation)
  const subject = `${front.meta.subject ?? ''} ${front.meta.templateName ?? ''}`.toLowerCase()
  const wide = page.w >= 380
  const essay = /语文|chinese/.test(subject)
  const english = /英语|english/.test(subject)
  const science = /数学|math|物理|physics|化学|chemistry|生物|biology/.test(subject)
  if (essay) return { frontCols: wide ? 2 : 1, backCols: 1, label: '语文 · 背面作文' }
  if (english) return { frontCols: wide ? 2 : 1, backCols: 1, label: '英语 · 背面写作' }
  if (science) return { frontCols: wide ? 2 : 1, backCols: 3, label: '数学/理科 · 背面三栏' }
  return { frontCols: wide ? 2 : 1, backCols: 2, label: '文科 · 背面两栏' }
}

/**
 * 科目感知的强制两页自动排版：
 * - 表头固定在正面顶部
 * - 选择题按网格排列
 * - 主观题按科目列数进入列流；正面列满后强制进入背面
 * - 背面按科目使用作文单栏、理科三栏、文科两栏
 */
export function reflowTwoPages(
  front: CardDoc,
  existingBack?: CardDoc | null,
): { front: CardDoc; back: CardDoc; overflow: boolean; profile: PageProfile } {
  const page = paperMm(front.meta.paperSize, front.meta.orientation)
  const profile = pageProfileOf(front)
  const questions = front.content.questions ?? []
  const blocks = front.content.blocks ?? []
  const backQuestions = existingBack?.content.questions ?? []
  const backBlocks = existingBack?.content.blocks ?? []
  const firstQ = questions.length ? Math.min(...questions.map((q) => u2mm(q.region.y))) : page.h

  const headerBlocks = blocks.filter((b) => u2mm(b.region.y) < firstQ - 1)
  const footerBlocks = blocks.filter((b) => front.bmeta[b.id]?.kind === 'footer')
  const flowBlocks = blocks.filter((b) => !headerBlocks.includes(b) && !footerBlocks.includes(b))
  const headerBottom = headerBlocks.length
    ? Math.max(page.h * 0.1, ...headerBlocks.map((b) => u2mm(b.region.y) + u2mm(b.region.height)))
    : MARGIN_TOP

  const flowItems: FlowItem[] = [
    ...flowBlocks.map((b) => ({ id: b.id, kind: 'block' as const, y: u2mm(b.region.y), h: u2mm(b.region.height), w: u2mm(b.region.width), block: b })),
    ...questions.map((q) => ({ id: q.id, kind: 'question' as const, y: u2mm(q.region.y), h: u2mm(q.region.height), w: u2mm(q.region.width), question: q })),
    ...backBlocks.map((b) => ({ id: b.id, kind: 'block' as const, y: 10000 + u2mm(b.region.y), h: u2mm(b.region.height), w: u2mm(b.region.width), block: b })),
    ...backQuestions.map((q) => ({ id: q.id, kind: 'question' as const, y: 10000 + u2mm(q.region.y), h: u2mm(q.region.height), w: u2mm(q.region.width), question: q })),
  ].sort((a, b) => a.y - b.y || a.w - b.w)

  const page1Questions: Question[] = []
  const page2Questions: Question[] = []
  const page1Blocks: Block[] = []
  const page2Blocks: Block[] = []
  const frontIds = new Set<string>()
  const backIds = new Set<string>()

  let pageNo: 1 | 2 = 1
  let cursorY = headerBottom + 4
  const contentW = page.w - MARGIN_X * 2
  const limit = page.h - MARGIN_BOTTOM

  function pushQuestion(q: Question) {
    if (pageNo === 1) {
      page1Questions.push(q)
      frontIds.add(q.id)
    } else {
      page2Questions.push(q)
      backIds.add(q.id)
    }
  }
  function pushBlock(b: Block) {
    if (pageNo === 1) {
      page1Blocks.push(b)
      frontIds.add(b.id)
    } else {
      page2Blocks.push(b)
      backIds.add(b.id)
    }
  }
  function newPage() {
    if (pageNo === 1) {
      pageNo = 2
      cursorY = MARGIN_TOP
    }
  }
  function colsNow(): number {
    return pageNo === 1 ? profile.frontCols : profile.backCols
  }
  function colW(cols: number): number {
    return (contentW - (cols - 1) * GAP) / cols
  }
  function colX(index: number, cols: number): number {
    return MARGIN_X + index * (colW(cols) + GAP)
  }

  // 1) 选择题排成网格
  const marks = flowItems.filter((it) => it.kind === 'question' && it.question!.type !== 'subjective')
  const others = flowItems.filter((it) => it.kind === 'block' || (it.kind === 'question' && it.question!.type === 'subjective'))
  const markCols = Math.max(2, Math.min(8, Math.floor((contentW + GAP) / 32)))
  const markW = (contentW - (markCols - 1) * GAP) / markCols
  let row: FlowItem[] = []
  let rowH = 0

  function flushRow() {
    if (!row.length) return
    if (cursorY + rowH > limit) {
      newPage()
      cursorY = MARGIN_TOP
    }
    row.forEach((it, i) => {
      const q = it.question!
      q.region.x = mm2u(round2(MARGIN_X + i * (markW + GAP)))
      q.region.y = mm2u(round2(cursorY))
      q.region.width = mm2u(round2(markW))
      q.region.height = mm2u(round2(rowH))
      pushQuestion(q)
    })
    cursorY += rowH + GAP
    row = []
    rowH = 0
  }
  for (const item of marks) {
    if (row.length >= markCols) flushRow()
    if (cursorY + Math.max(rowH, item.h) > limit) flushRow()
    row.push(item)
    rowH = Math.max(rowH, item.h)
  }
  flushRow()

  // 2) 主观题 / 题块按科目列流
  let col = 0
  let colY = pageNo === 1 ? cursorY : MARGIN_TOP
  const frontColStart = cursorY

  // 先估算两页可用高度；内容超出时统一压缩题区高度，强制塞进两页
  const needed = others.reduce((sum, it) => sum + it.h + 2.4, 0)
  const avail1 = Math.max(0, limit - frontColStart) * profile.frontCols
  const avail2 = Math.max(0, limit - MARGIN_TOP) * profile.backCols
  const fit = needed > 0 ? Math.min(1, ((avail1 + avail2) * 0.96) / needed) : 1
  if (fit < 1) {
    for (const it of others) it.h = Math.max(4, it.h * fit)
  }

  function advanceColumn(h: number) {
    let cols = colsNow()
    if (colY + h <= limit) return
    col += 1
    colY = pageNo === 1 ? frontColStart : MARGIN_TOP
    cols = colsNow()
    if (col >= cols) {
      newPage()
      col = 0
      colY = MARGIN_TOP
    }
  }

  for (const item of others) {
    let h = Math.min(item.h, limit - MARGIN_TOP)
    advanceColumn(h)
    const cols = colsNow()
    const cw = colW(cols)
    if (item.kind === 'question') {
      const q = item.question!
      q.region.x = mm2u(round2(colX(col, cols)))
      q.region.y = mm2u(round2(colY))
      q.region.width = mm2u(round2(cw))
      q.region.height = mm2u(round2(h))
      pushQuestion(q)
    } else {
      const b = item.block!
      b.region.x = mm2u(round2(colX(col, cols)))
      b.region.y = mm2u(round2(colY))
      b.region.width = mm2u(round2(cw))
      b.region.height = mm2u(round2(h))
      pushBlock(b)
    }
    colY += h + 2.4
  }

  // 3) 组装正面/背面
  const nextFront = clone(front)
  const nextBack = createBackDoc(front, 'blank')
  nextFront.content.questions = page1Questions
  nextFront.content.blocks = [...headerBlocks, ...page1Blocks]
  nextFront.barcodes = (front.barcodes ?? []).filter((b) => u2mm(b.region.y) < firstQ - 1)
  nextBack.content.questions = page2Questions
  nextBack.content.blocks = page2Blocks

  if (page2Questions.length || page2Blocks.length) {
    for (const footer of footerBlocks) {
      const f = clone(footer)
      f.region.y = mm2u(round2(page.h - MARGIN_BOTTOM - u2mm(f.region.height)))
      f.region.x = mm2u(MARGIN_X)
      f.region.width = mm2u(round2(contentW))
      nextBack.content.blocks = [...(nextBack.content.blocks ?? []), f]
    }
  } else {
    nextFront.content.blocks = [...nextFront.content.blocks, ...footerBlocks]
  }

  const groups = splitGroups(front, frontIds, backIds)
  nextFront.groups = groups.front
  nextBack.groups = groups.back
  const allQmeta = { ...front.qmeta, ...(front.back?.qmeta ?? {}) }
  const allBmeta = { ...front.bmeta, ...(front.back?.bmeta ?? {}) }
  nextFront.qmeta = allQmeta
  nextBack.qmeta = allQmeta
  nextFront.bmeta = allBmeta
  nextBack.bmeta = allBmeta

  let backBottom = [...(nextBack.content.questions ?? []), ...(nextBack.content.blocks ?? [])].reduce(
    (m, x) => Math.max(m, u2mm(x.region.y) + u2mm(x.region.height)),
    0,
  )
  // 第二页若略超页，自动压缩题区高度，保证内容优先落在两页内
  if (backBottom > page.h) {
    const items = [...(nextBack.content.questions ?? []), ...(nextBack.content.blocks ?? [])]
    const maxBottom = page.h - MARGIN_BOTTOM
    const minTop = Math.min(MARGIN_TOP, ...items.map((x) => u2mm(x.region.y)))
    const usable = maxBottom - minTop
    const current = backBottom - minTop
    const scale = current > 0 ? Math.max(0.45, usable / current) : 1
    if (scale < 1) {
      for (const x of items) {
        const r = x.region
        r.height = mm2u(round2(Math.max(4, u2mm(r.height) * scale)))
      }
      backBottom = items.reduce((m, x) => Math.max(m, u2mm(x.region.y) + u2mm(x.region.height)), 0)
    }
  }
  return { front: nextFront, back: nextBack, overflow: backBottom > page.h + 2, profile }
}
