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

/**
 * 强制两页自动分页：
 * 把一张答题卡的全部题目/题区按顺序重新排版，正面放不下的内容强制顺延到背面。
 * 表头（标题、姓名、准考证号、条形码、注意事项）固定在正面顶部。
 */
export function reflowTwoPages(front: CardDoc): { front: CardDoc; back: CardDoc; overflow: boolean } {
  const page = paperMm(front.meta.paperSize, front.meta.orientation)
  const questions = front.content.questions ?? []
  const blocks = front.content.blocks ?? []
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
  ].sort((a, b) => a.y - b.y || a.w - b.w)

  const page1Questions: Question[] = []
  const page2Questions: Question[] = []
  const page1Blocks: Block[] = []
  const page2Blocks: Block[] = []
  const frontIds = new Set<string>()
  const backIds = new Set<string>()

  let pageNo: 1 | 2 = 1
  let cursorY = headerBottom + 4
  let row: FlowItem[] = []
  let rowH = 0
  let overflow = false

  const contentW = page.w - MARGIN_X * 2
  const markCols = Math.max(2, Math.min(8, Math.floor((contentW + GAP) / 32)))
  const markW = (contentW - (markCols - 1) * GAP) / markCols
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
    } else {
      overflow = true
    }
  }
  function flushRow() {
    if (!row.length) return
    if (cursorY + rowH > limit) newPage()
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

  for (const item of flowItems) {
    if (item.kind === 'question' && item.question!.type !== 'subjective') {
      if (row.length >= markCols) flushRow()
      row.push(item)
      rowH = Math.max(rowH, item.h)
      continue
    }
    flushRow()
    const isSubjective = item.kind === 'question' && item.question!.type === 'subjective'
    const h = Math.min(item.h, page.h - MARGIN_TOP - MARGIN_BOTTOM)
    if (cursorY + h > limit) newPage()
    if (item.kind === 'question') {
      const q = item.question!
      q.region.x = mm2u(MARGIN_X)
      q.region.y = mm2u(round2(cursorY))
      q.region.width = mm2u(round2(contentW))
      q.region.height = mm2u(round2(h))
      pushQuestion(q)
    } else {
      const b = item.block!
      b.region.x = mm2u(MARGIN_X)
      b.region.y = mm2u(round2(cursorY))
      b.region.width = mm2u(round2(contentW))
      b.region.height = mm2u(round2(h))
      pushBlock(b)
    }
    cursorY += h + (isSubjective ? 2.5 : GAP)
  }
  flushRow()

  // 表头固定在正面；页脚放最后一页底部
  const nextFront = clone(front)
  const nextBack = createBackDoc(front, 'blank')
  nextFront.content.questions = page1Questions
  nextFront.content.blocks = [...headerBlocks, ...page1Blocks]
  nextFront.barcodes = (front.barcodes ?? []).filter((b) => u2mm(b.region.y) < firstQ - 1)
  nextBack.content.questions = page2Questions
  nextBack.content.blocks = page2Blocks

  // 头部的自定义条形码固定在正面；其余数据不重复
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

  // 正面标记/画布沿用；背面使用同一套定位标记
  const backBottom = [...(nextBack.content.questions ?? []), ...(nextBack.content.blocks ?? [])].reduce(
    (m, x) => Math.max(m, u2mm(x.region.y) + u2mm(x.region.height)),
    0,
  )
  return { front: nextFront, back: nextBack, overflow: overflow || backBottom > page.h }
}
