import type { Block, ExamContent, Question } from '../../api/types'
import {
  cloneDoc,
  mm2u,
  paperMm,
  u2mm,
  type CardBack,
  type CardDoc,
  type QuestionMeta,
  type BlockMeta,
} from './types'

export type BackPreset = 'blank' | 'essay' | 'math3'

const PRESETS: Array<{ id: BackPreset; label: string; desc: string }> = [
  { id: 'blank', label: '空白背面', desc: '只生成定位块，自己添加题区' },
  { id: 'essay', label: '语文 · 作文背面', desc: '整页作文格，适合语文/英语作文' },
  { id: 'math3', label: '数学 · 三栏背面', desc: '背面竖分三栏大题区域' },
]

export function backPresets() {
  return PRESETS
}

function markerCopy(front: CardDoc): ExamContent['markers'] {
  return (front.content.markers ?? []).map((m) => ({ ...m }))
}

function baseContent(front: CardDoc, blocks: Block[], questions: Question[]): ExamContent {
  return {
    schemaVersion: 1,
    unit: 'canvas',
    canvas: { ...front.content.canvas },
    markers: markerCopy(front),
    blocks,
    questions,
    answerKey: {},
  }
}

/** 生成一页背面设计文档（只在本机/design JSON 中保存） */
export function createBackDoc(front: CardDoc, preset: BackPreset): CardDoc {
  const page = paperMm(front.meta.paperSize, front.meta.orientation)
  const qmeta: Record<string, QuestionMeta> = {}
  const bmeta: Record<string, BlockMeta> = {}
  const blocks: Block[] = []
  const questions: Question[] = []

  if (preset === 'essay') {
    blocks.push({
      id: 'back-title',
      type: 'text',
      text: '作文',
      region: { x: mm2u(14), y: mm2u(10), width: mm2u(page.w - 28), height: mm2u(9) },
      style: { fontSize: 4.5, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.1 },
    })
    const id = 'back-essay'
    questions.push({
      id,
      displayNumber: 23,
      type: 'subjective',
      score: 60,
      region: { x: mm2u(14), y: mm2u(20), width: mm2u(page.w - 28), height: mm2u(page.h - 32) },
    })
    qmeta[id] = { style: 'grid', gridCols: 20, rows: 20, label: '作文' }
  } else if (preset === 'math3') {
    const gap = 6
    const margin = 14
    const colW = (page.w - margin * 2 - gap * 2) / 3
    for (let i = 0; i < 3; i += 1) {
      const id = `back-q${17 + i}`
      questions.push({
        id,
        displayNumber: 17 + i,
        type: 'subjective',
        score: 12,
        region: {
          x: mm2u(margin + i * (colW + gap)),
          y: mm2u(18),
          width: mm2u(colW),
          height: mm2u(page.h - 32),
        },
      })
      qmeta[id] = { style: 'blank', rows: 1, label: `${17 + i}` }
    }
  }

  return {
    version: 3,
    meta: { ...front.meta },
    content: baseContent(front, blocks, questions),
    qmeta,
    bmeta,
    barcodes: [],
    updatedAt: Date.now(),
  }
}

/** 从前面文档里取背面内容 */
export function backDataOf(front: CardDoc): CardBack | undefined {
  return front.back
}

/** 把背面文档转换成可渲染/编辑的 CardDoc */
export function backAsDoc(front: CardDoc): CardDoc {
  const back = front.back
  if (!back) return createBackDoc(front, 'blank')
  return {
    ...cloneDoc(front),
    content: back.content,
    qmeta: back.qmeta,
    bmeta: back.bmeta,
    hidden: back.hidden ?? [],
    barcodes: [],
    back: undefined,
    groups: [],
  }
}

/** 把当前编辑页（背面）合并回正面文档 */
export function withBack(front: CardDoc, back: CardDoc | null): CardDoc {
  if (!back) return { ...cloneDoc(front), back: undefined }
  return {
    ...cloneDoc(front),
    back: {
      content: back.content,
      qmeta: back.qmeta,
      bmeta: back.bmeta,
      hidden: back.hidden,
    },
  }
}

/**
 * 科目化双面背面：
 * 语文=整页作文格；英语=应用文+读后续写；数学/理科=三栏解答区；文科=两栏作答区。
 * 所有模板生成时默认附带这一页，实现真正的双面答题卡。
 */
export function createSubjectBack(front: CardDoc): CardDoc {
  const subject = `${front.meta.subject ?? ''} ${front.meta.templateName ?? ''}`.toLowerCase()
  if (/语文|chinese|作文/.test(subject)) return createBackDoc(front, 'essay')
  const page = paperMm(front.meta.paperSize, front.meta.orientation)
  const qmeta: Record<string, QuestionMeta> = {}
  const bmeta: Record<string, BlockMeta> = {}
  const blocks: Block[] = []
  const questions: Question[] = []

  function title(text: string, y: number) {
    blocks.push({
      id: `back-title-${blocks.length}`,
      type: 'text',
      text,
      region: { x: mm2u(14), y: mm2u(y), width: mm2u(page.w - 28), height: mm2u(7) },
      style: { fontSize: 3.6, fontWeight: 'bold', textAlign: 'center' },
    })
  }

  if (/英语|english|外语/.test(subject)) {
    title('第Ⅱ卷 非选择题', 9)
    const parts = [
      { id: 'back-writing-1', label: '应用文写作', y: 19, h: (page.h - 38) * 0.36, score: 15 },
      { id: 'back-writing-2', label: '读后续写', y: 19 + (page.h - 38) * 0.4, h: (page.h - 38) * 0.56, score: 25 },
    ]
    for (const p of parts) {
      questions.push({ id: p.id, displayNumber: undefined, type: 'subjective', score: p.score, region: { x: mm2u(14), y: mm2u(p.y), width: mm2u(page.w - 28), height: mm2u(p.h) } })
      qmeta[p.id] = { style: 'grid', gridCols: 18, label: p.label }
    }
    return finish(front, blocks, questions, qmeta, bmeta)
  }

  const science = /数学|math|物理|physics|化学|chemistry|生物|biology/.test(subject)
  // A4 真卡背面通常两栏；A3 理科背面三栏
  const cols = science ? (page.w >= 380 ? 3 : 2) : 2
  title('第Ⅱ卷 非选择题', 9)
  const gap = 5
  const margin = 14
  const colW = (page.w - margin * 2 - gap * (cols - 1)) / cols
  for (let i = 0; i < cols; i += 1) {
    const id = `back-q${15 + i}`
    questions.push({
      id,
      displayNumber: 15 + i,
      type: 'subjective',
      score: science ? 15 : 12,
      region: { x: mm2u(margin + i * (colW + gap)), y: mm2u(18), width: mm2u(colW), height: mm2u(page.h - 30) },
    })
    qmeta[id] = { style: 'blank', rows: 1, label: `${15 + i}` }
  }
  return finish(front, blocks, questions, qmeta, bmeta)
}

/** 把正面表头/姓名/注意事项/定位点复制到背面，保证正反面对位一致 */
export function withHeaderFromFront(front: CardDoc, back: CardDoc): CardDoc {
  const page = paperMm(front.meta.paperSize, front.meta.orientation)
  const kinds = new Set(['examLine', 'title', 'student', 'notice', 'legend', 'examNo', 'barcode', 'paperType'])
  const header = (front.content.blocks ?? []).filter((b) => kinds.has(front.bmeta[b.id]?.kind ?? ''))
  if (!header.length) return back
  const headerBottom = Math.max(...header.map((b) => u2mm(b.region.y) + u2mm(b.region.height)))
  const shift = mm2u(headerBottom + 2)
  const bottom = mm2u(page.h - 10)
  const questions = (back.content.questions ?? []).map((q) => {
    const region = { ...q.region, y: q.region.y + shift }
    region.height = Math.max(region.height * 0.35, Math.min(region.height, bottom - region.y))
    return { ...q, region }
  })
  const blocks = [
    ...header.map((b) => ({ ...b })),
    ...(back.content.blocks ?? []).map((b) => ({ ...b, region: { ...b.region, y: b.region.y + shift } })),
  ]
  return { ...back, content: { ...back.content, blocks, questions } }
}

function finish(
  front: CardDoc,
  blocks: Block[],
  questions: Question[],
  qmeta: Record<string, QuestionMeta>,
  bmeta: Record<string, BlockMeta>,
): CardDoc {
  return {
    version: 3,
    meta: { ...front.meta },
    content: {
      schemaVersion: 1,
      unit: 'canvas',
      canvas: { ...front.content.canvas },
      markers: (front.content.markers ?? []).map((m) => ({ ...m })),
      blocks,
      questions,
      answerKey: {},
    },
    qmeta,
    bmeta,
    barcodes: [],
    groups: [],
    updatedAt: Date.now(),
  }
}
