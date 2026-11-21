import type { Block, ExamContent, Question } from '../../api/types'
import {
  cloneDoc,
  mm2u,
  paperMm,
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
