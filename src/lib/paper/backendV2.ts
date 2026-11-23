import type {
  Barcode,
  Block,
  ExamContent,
  Marker,
  Question,
} from '../../api/types'
import type { PaperV2, PaperV2Page, PaperV2Question, RawPaperDetail } from '../../api/typesV2'
import type { PaperDetail } from '../../m/api'
import { docFromContent } from '../card/generator'

/** 判断是不是后端 v2 包装（兼容部分文档里仍写 schemaVersion:1 的旧示例） */
export function isPaperV2(value: unknown): value is PaperV2 {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<PaperV2>
  return (
    Boolean(v.answerCard && Array.isArray(v.answerCard.pages)) &&
    Boolean(v.paper && Array.isArray(v.paper.pages))
  )
}

/** 空内容：新建试卷后后端返回 {} */
export function emptyPaperV2(): PaperV2 {
  return {
    schemaVersion: 2,
    answerCard: { answerKey: {}, pages: [] },
    paper: { pages: [] },
  }
}

/**
 * 把当前前端的单页 ExamContent 包成后端 v2。
 * 后端 v2 目前只保存答题卡版面，不保存题干/解析；题干仍在前端/题库侧维护。
 */
export function toPaperV2(content: ExamContent): PaperV2 {
  const page: PaperV2Page = {
    page: 1,
    unit: 'canvas',
    canvas: content.canvas,
    markers: content.markers as Marker[],
    blocks: (content.blocks ?? []) as Block[],
    questions: content.questions.map((q) => ({
      id: q.id,
      displayNumber: q.displayNumber,
      type: q.type,
      score: Number(q.score) || 0,
      region: q.region,
      ...(q.type === 'mark' ? { choices: q.choices ?? [] } : {}),
    })) as PaperV2Question[],
    ...(content.barcode ? { barcode: content.barcode as Barcode } : {}),
  }

  // 答案键只允许 mark 题；主观题答案不进入后端 v2
  const markIds = new Set(content.questions.filter((q) => q.type === 'mark').map((q) => q.id))
  const answerKey = Object.fromEntries(
    Object.entries(content.answerKey ?? {}).filter(([id, value]) => markIds.has(id) && Boolean(value)),
  )

  return {
    schemaVersion: 2,
    answerCard: { answerKey, pages: [page] },
    paper: { pages: [] },
  }
}

/** 把后端 v2 的第一页还原成当前编辑器使用的单页 ExamContent */
export function fromPaperV2(doc: PaperV2): ExamContent {
  const page = doc.answerCard.pages[0]
  if (!page) {
    return {
      schemaVersion: 1,
      unit: 'canvas',
      canvas: { width: 300, height: 424.29 },
      markers: [],
      questions: [],
      blocks: [],
      answerKey: {},
    }
  }
  return {
    schemaVersion: 1,
    unit: 'canvas',
    canvas: page.canvas,
    markers: page.markers ?? [],
    blocks: page.blocks ?? [],
    questions: page.questions.map((q) => ({
      id: q.id,
      displayNumber: q.displayNumber,
      type: q.type === 'mark' ? 'mark' : 'subjective',
      score: q.score,
      region: q.region,
      ...(q.type === 'mark' ? { choices: q.choices ?? [] } : {}),
    })) as Question[],
    ...(page.barcode ? { barcode: page.barcode } : {}),
    answerKey: doc.answerCard.answerKey ?? {},
  }
}

export function pageCountOf(doc: PaperV2): { answerCard: number; paper: number } {
  return { answerCard: doc.answerCard.pages.length, paper: doc.paper.pages.length }
}

/** API 返回归一化：内部继续给旧组件提供单页 ExamContent，同时保留原始 v2 */
export function normalizePaperDetail(raw: RawPaperDetail): PaperDetail {
  if (!raw || typeof raw !== 'object') {
    return { id: 0, name: '', paper: {} }
  }
  const paper = raw.paper
  if (isPaperV2(paper)) {
    return {
      id: raw.id,
      name: raw.name,
      paper: fromPaperV2(paper),
      rawPaper: paper,
      schemaVersion: 2,
      pageCount: pageCountOf(paper),
    }
  }
  const old = paper as unknown as ExamContent
  if (old && typeof old === 'object' && Array.isArray(old.questions)) {
    return {
      id: raw.id,
      name: raw.name,
      paper: old,
      schemaVersion: 1,
      pageCount: { answerCard: 1, paper: 0 },
    }
  }
  return { id: raw.id, name: raw.name, paper: {}, pageCount: { answerCard: 0, paper: 0 } }
}

/**
 * 后端 v2（可能多页）→ 前端 CardDoc。
 * 第一页作为正面，其余页合并进 doc.back，供打印/预览使用。
 */
export function paperV2ToCardDoc(doc: PaperV2, name: string): CardDoc {
  const pages = doc.answerCard?.pages ?? []
  if (!pages.length) return docFromContent(fromPaperV2(doc), name)
  const build = (page: PaperV2Page) => {
    const single: PaperV2 = {
      ...doc,
      answerCard: { ...doc.answerCard, pages: [page] },
      paper: { pages: [] },
    }
    return docFromContent(fromPaperV2(single), name)
  }
  const front = build(pages[0])
  const rest = pages.slice(1).map(build)
  if (rest.length) {
    const back = rest[rest.length - 1]
    front.back = { content: back.content, qmeta: back.qmeta, bmeta: back.bmeta, hidden: [] }
  }
  return front
}

/* ========================================================================== */
/* PaperBundle（前端统一试卷模型）→ 后端 v2                                    */
/* ========================================================================== */

import type { PaperBundle } from './types'

/**
 * 把前端的 PaperBundle 转成后端 v2 包装。
 * answerCard.pages 保存答题卡几何；paper.pages 保存题面 stem / choices.text。
 * 答案只放在 answerCard.answerKey；解析仍由前端/题库侧维护。
 */
export function bundleToPaperV2(bundle: PaperBundle): PaperV2 {
  const answerPages: PaperV2Page[] = bundle.answerCard.pages.map((page, i) => ({
    page: i + 1,
    unit: 'canvas',
    canvas: page.canvas,
    markers: page.markers,
    blocks: page.blocks.map((b) => ({
      id: b.id,
      type: 'text' as const,
      region: b.region,
      text: b.text,
      ...(b.style ? { style: b.style } : {}),
    })),
    questions: bundle.questions
      .filter((q) => q.answerCard.page === page.side)
      .sort((a, b) => a.number - b.number)
      .map((q) => ({
        id: q.id,
        displayNumber: q.number,
        type: q.answerCard.type,
        score: q.score,
        region: q.answerCard.region,
        ...(q.answerCard.type === 'mark' ? { choices: q.answerCard.choices ?? [] } : {}),
      })) as PaperV2Question[],
  }))

  const paperPages: PaperV2Page[] = bundle.answerCard.pages.map((page, i) => ({
    page: i + 1,
    unit: 'canvas',
    canvas: page.canvas,
    blocks: page.blocks.map((b) => ({
      id: b.id,
      type: 'text' as const,
      region: b.region,
      text: b.text,
      ...(b.style ? { style: b.style } : {}),
    })),
    questions: bundle.questions
      .filter((q) => q.answerCard.page === page.side)
      .sort((a, b) => a.number - b.number)
      .map((q) => ({
        id: q.id,
        displayNumber: q.number,
        type: q.answerCard.type,
        stem: q.stem,
        score: q.score,
        region: q.answerCard.region,
        choices:
          q.answerCard.type === 'mark'
            ? q.options.map((opt) => {
                const cardChoice = q.answerCard.choices?.find((c) => c.value === opt.key)
                return {
                  value: opt.key,
                  text: opt.text,
                  region: cardChoice?.region ?? { x: 0, y: 0, width: 0.2, height: 1 },
                }
              })
            : undefined,
      })) as PaperV2Question[],
  }))

  const markAnswers: Record<string, string> = {}
  for (const q of bundle.questions) {
    if (q.answerCard.type === 'mark' && q.answer) markAnswers[q.id] = q.answer
  }

  return {
    schemaVersion: 2,
    answerCard: { answerKey: markAnswers, pages: answerPages },
    paper: { pages: paperPages },
  }
}

/* ========================================================================== */
/* CardDoc → 后端 v2（模板/答题卡双面导出）                                     */
/* ========================================================================== */

import { backAsDoc } from '../card/back'
import type { CardDoc } from '../card/types'

function pageFromCardDoc(doc: CardDoc, page: number): PaperV2Page {
  const prefix = page > 1 ? `p${page}-` : ''
  const maxH = doc.content.canvas.height
  const maxW = doc.content.canvas.width
  const fit = <T extends { region: { x: number; y: number; width: number; height: number } }>(item: T): T => {
    const r = item.region
    if (r.y >= maxH) r.y = Math.max(0, maxH - 8)
    if (r.x >= maxW) r.x = Math.max(0, maxW - 8)
    r.width = Math.min(r.width, maxW - r.x)
    r.height = Math.min(r.height, maxH - r.y)
    return item
  }
  return {
    page,
    unit: 'canvas',
    canvas: doc.content.canvas,
    markers: doc.content.markers as Marker[],
    blocks: (doc.content.blocks ?? []).map((b) => fit({ ...b, id: `${prefix}${b.id}` })) as Block[],
    questions: (doc.content.questions ?? []).map((q) =>
      fit({
        id: `${prefix}${q.id}`,
        displayNumber: q.displayNumber,
        type: q.type,
        score: Number(q.score) || 0,
        region: { ...q.region },
        ...(q.type === 'mark' ? { choices: q.choices ?? [] } : {}),
      }),
    ) as PaperV2Question[],
    ...(doc.content.barcode ? { barcode: doc.content.barcode as Barcode } : {}),
  }
}

/** 把一张双面答题卡（正面 + doc.back）导出为后端 v2 模板结构 */
export function cardDocToPaperV2(doc: CardDoc): PaperV2 {
  const pages: PaperV2Page[] = [pageFromCardDoc(doc, 1)]
  if (doc.back) pages.push(pageFromCardDoc(backAsDoc(doc), 2))
  const answerKey = Object.fromEntries(
    (doc.content.questions ?? [])
      .filter((q) => q.type === 'mark')
      .map((q) => [q.id, doc.content.answerKey?.[q.id] ?? ''])
      .filter(([, value]) => Boolean(value)),
  )
  return {
    schemaVersion: 2,
    answerCard: { answerKey, pages },
    paper: { pages: [] },
  }
}
