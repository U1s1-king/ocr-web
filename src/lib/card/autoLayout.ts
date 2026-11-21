import { mm2u, paperMm, round2, u2mm, type CardBarcode, type CardDoc, type CardGroup } from './types'
import { createBackDoc } from './back'
import type { Block, Question } from '../../api/types'

const MARGIN_MM = 14
const GAP_MM = 3
const BOTTOM_MARGIN = 10

interface Box {
  id: string
  kind: 'question' | 'block' | 'barcode'
  x: number
  y: number
  w: number
  h: number
  ref: Question | Block | CardBarcode
}

function boxes(doc: CardDoc): Box[] {
  const out: Box[] = []
  for (const q of doc.content.questions) {
    out.push({ id: q.id, kind: 'question', x: u2mm(q.region.x), y: u2mm(q.region.y), w: u2mm(q.region.width), h: u2mm(q.region.height), ref: q })
  }
  for (const b of doc.content.blocks ?? []) {
    out.push({ id: b.id, kind: 'block', x: u2mm(b.region.x), y: u2mm(b.region.y), w: u2mm(b.region.width), h: u2mm(b.region.height), ref: b })
  }
  for (const bc of doc.barcodes ?? []) {
    out.push({ id: bc.id, kind: 'barcode', x: u2mm(bc.region.x), y: u2mm(bc.region.y), w: u2mm(bc.region.width), h: u2mm(bc.region.height), ref: bc })
  }
  return out
}

function setRegion(box: Box, patch: { x?: number; y?: number; w?: number; h?: number }) {
  const r = box.ref.region
  if (patch.x !== undefined) { r.x = mm2u(round2(patch.x)); box.x = patch.x }
  if (patch.y !== undefined) { r.y = mm2u(round2(patch.y)); box.y = patch.y }
  if (patch.w !== undefined) { r.width = mm2u(round2(patch.w)); box.w = patch.w }
  if (patch.h !== undefined) { r.height = mm2u(round2(patch.h)); box.h = patch.h }
}

function splitGroups(doc: CardDoc, moveIds: Set<string>): { stay: CardGroup[]; move: CardGroup[] } {
  const stay: CardGroup[] = []
  const move: CardGroup[] = []
  for (const group of doc.groups ?? []) {
    const moved = group.itemIds.filter((id) => moveIds.has(id))
    const kept = group.itemIds.filter((id) => !moveIds.has(id))
    if (kept.length) stay.push({ ...group, itemIds: kept })
    if (moved.length) move.push({ ...group, itemIds: moved })
  }
  return { stay, move }
}

/** 将一组内容干净地顺排到背面（全宽纵向，不保留多栏坐标） */
function flowToBack(front: CardDoc, incoming: CardDoc, existingBack: CardDoc | null, moveIds: Set<string>) {
  const page = paperMm(incoming.meta.paperSize, incoming.meta.orientation)
  const back: CardDoc = existingBack ? JSON.parse(JSON.stringify(existingBack)) : createBackDoc(front, 'blank')
  const backBoxes = boxes(back)
  let cursor = backBoxes.length ? Math.max(...backBoxes.map((b) => b.y + b.h)) + GAP_MM : MARGIN_MM
  const moved = boxes(incoming)
    .filter((b) => moveIds.has(b.id))
    .sort((a, b) => a.y - b.y || a.x - b.x)

  for (const box of moved) {
    const width = page.w - MARGIN_MM * 2
    setRegion(box, { x: MARGIN_MM, y: cursor, w: width })
    if (box.kind === 'question') {
      const q = box.ref as Question
      back.content.questions.push(q)
      if (incoming.qmeta[q.id]) back.qmeta[q.id] = incoming.qmeta[q.id]
    } else if (box.kind === 'block') {
      const b = box.ref as Block
      back.content.blocks = [...(back.content.blocks ?? []), b]
      if (incoming.bmeta[b.id]) back.bmeta[b.id] = incoming.bmeta[b.id]
    } else {
      const bc = box.ref as CardBarcode
      back.barcodes = [...(back.barcodes ?? []), bc]
    }
    cursor += box.h + 2
  }

  const split = splitGroups(incoming, moveIds)
  const nextFront = JSON.parse(JSON.stringify(front)) as CardDoc
  nextFront.groups = split.stay
  nextFront.content.questions = nextFront.content.questions.filter((q) => !moveIds.has(q.id))
  nextFront.content.blocks = (nextFront.content.blocks ?? []).filter((b) => !moveIds.has(b.id))
  nextFront.barcodes = (nextFront.barcodes ?? []).filter((b) => !moveIds.has(b.id))
  for (const id of moveIds) {
    delete nextFront.qmeta[id]
    delete nextFront.bmeta[id]
  }
  back.groups = [...(back.groups ?? []), ...split.move]
  const maxBottom = Math.max(...boxes(back).map((b) => b.y + b.h), 0)
  return { front: nextFront, back, overflow: maxBottom > page.h + 20 }
}

/**
 * 自动排版：
 * - 选择题按现有选择题的列数/行高追加到选择题末尾；
 * - 下方内容整体下移；正面放不下时，把下方内容顺排到背面；
 * - 主观题组追加在题目末尾，正面放不下时顺延到背面。
 */
export function autoInsertGroup(
  front: CardDoc,
  incoming: CardDoc,
  existingBack: CardDoc | null,
  group: CardGroup,
): { front: CardDoc; back: CardDoc | null; side: 'front' | 'back'; overflow: boolean } {
  const page = paperMm(front.meta.paperSize, front.meta.orientation)
  const newIds = new Set(group.itemIds)
  const incomingBoxes = boxes(incoming)
  const newBoxes = incomingBoxes.filter((b) => newIds.has(b.id))
  if (!newBoxes.length) return { front: incoming, back: existingBack, side: 'front', overflow: false }

  const oldBoxes = boxes(front)
  const oldQuestions = oldBoxes.filter((b) => b.kind === 'question')
  const oldMarks = oldQuestions.filter((b) => (b.ref as Question).type !== 'subjective')
  const isChoice = group.kind === 'choice'
  const frontLimit = page.h - BOTTOM_MARGIN

  let insertionY: number
  let addedH = 0
  const newQuestions = newBoxes.filter((b) => b.kind === 'question')
  const allContentBottom = oldBoxes.length ? Math.max(...oldBoxes.map((b) => b.y + b.h)) : 20

  if (isChoice) {
    const rows = [...new Set(oldMarks.map((b) => Math.round(b.y * 10) / 10))].sort((a, b) => a - b)
    const firstRow = oldMarks.filter((b) => Math.round(b.y * 10) / 10 === rows[0])
    const cols = firstRow.length
      ? firstRow.sort((a, b) => a.x - b.x).map((b) => ({ x: b.x, w: b.w }))
      : [0, 1, 2, 3, 4].map((i) => ({ x: MARGIN_MM + i * ((page.w - MARGIN_MM * 2) / 5), w: (page.w - MARGIN_MM * 2) / 5 - 2 }))
    const rowH = oldMarks.length ? Math.max(...oldMarks.map((b) => b.h)) : 8
    insertionY = oldMarks.length ? Math.max(...oldMarks.map((b) => b.y + b.h)) + 2 : 20
    const nRows = Math.ceil(newQuestions.length / cols.length)
    addedH = nRows * rowH + Math.max(0, nRows - 1) * 1.5
    newQuestions.forEach((box, i) => {
      const col = cols[i % cols.length]
      const row = Math.floor(i / cols.length)
      setRegion(box, { x: col.x, y: insertionY + row * (rowH + 1.5), w: col.w, h: rowH })
    })
  } else {
    insertionY = allContentBottom + 2
    let cursor = insertionY
    for (const box of newBoxes) {
      setRegion(box, { x: MARGIN_MM, y: cursor, w: page.w - MARGIN_MM * 2 })
      cursor += box.h + 2
    }
    addedH = cursor - insertionY
  }

  const belowIds = new Set<string>()
  for (const box of oldBoxes) {
    if (box.y + box.h > insertionY + 0.01) {
      belowIds.add(box.id)
      const target = incomingBoxes.find((b) => b.id === box.id)
      if (target) setRegion(target, { y: target.y + addedH })
    }
  }

  const shiftedBelow = incomingBoxes.filter((b) => belowIds.has(b.id))
  const newContentBottom = Math.max(...newBoxes.map((b) => b.y + b.h))
  const belowOverflow = shiftedBelow.some((b) => b.y + b.h > frontLimit) || newContentBottom > frontLimit

  if (belowOverflow) {
    const moveIds = new Set<string>()
    if (newContentBottom > frontLimit) {
      for (const b of newBoxes) moveIds.add(b.id)
    }
    for (const b of shiftedBelow) moveIds.add(b.id)
    if (moveIds.size) {
      const result = flowToBack(front, incoming, existingBack, moveIds)
      const newMoved = newBoxes.some((b) => moveIds.has(b.id))
      return { ...result, side: newMoved ? 'back' : 'front' }
    }
  }

  return { front: incoming, back: existingBack, side: 'front', overflow: false }
}
