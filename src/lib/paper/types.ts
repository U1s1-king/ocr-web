import type { BlockStyle, ExamContent, Region } from '../../api/types'

/** 题目类型：题库/组卷使用 */
export type PaperQuestionType =
  | 'single'
  | 'multi'
  | 'judge'
  | 'blank'
  | 'short'
  | 'calc'
  | 'essay'

/** 答题卡上渲染成客观题还是主观题 */
export type PaperCardQuestionType = 'mark' | 'subjective'

export type PaperSide = 'front' | 'back'

export interface PaperBundleMeta {
  id: string
  title: string
  subject: string
  grade: string
  examName: string
  durationMinutes: number
  paperSize: 'A4' | 'A3' | '8K'
  orientation: 'portrait' | 'landscape'
  /** 答题卡纸型，和试卷纸型可以不同 */
  answerCardSize?: 'A4' | 'A3'
  sides: 1 | 2
  variant?: 'A' | 'B'
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface PaperSection {
  id: string
  title: string
  type: PaperQuestionType
  instructions?: string
}

export interface PaperMedia {
  type: 'image' | 'audio' | 'file'
  url: string
  alt?: string
}

export interface PaperQuestion {
  id: string
  sectionId: string
  number: number
  type: PaperQuestionType
  stem: string
  options: { key: string; text: string }[]
  answer: string
  analysis?: string
  score: number
  difficulty?: number
  knowledgePoints?: string[]
  media?: PaperMedia[]
  answerCard: {
    page: PaperSide
    type: PaperCardQuestionType
    region: Region
    choices?: { value: string; region: Region }[]
    render?: {
      rows?: number
      style?: 'lines' | 'grid' | 'blank'
      gridCols?: number
    } | null
  }
}

export interface PaperBlock {
  id: string
  kind: string
  text: string
  region: Region
  style?: BlockStyle
}

export interface PaperCardPage {
  id: string
  side: PaperSide
  paperSize: 'A4' | 'A3' | '8K'
  orientation: 'portrait' | 'landscape'
  /** 答题卡纸型，和试卷纸型可以不同 */
  answerCardSize?: 'A4' | 'A3'
  canvas: { width: number; height: number; unit: 'canvas' }
  markers: { id: string; x: number; y: number; size: number }[]
  blocks: PaperBlock[]
}

export interface PaperBarcodeConfig {
  format: 'CODE128'
  valueSource: string
  page: PaperSide
  region: Region
  showText?: boolean
}

export interface PaperAnswerCard {
  pages: PaperCardPage[]
  barcode?: PaperBarcodeConfig
}

/** 统一试卷包：题目只存 questions[]，其他视图全部派生 */
export interface PaperBundle {
  schema: 'paper-bundle'
  schemaVersion: 1
  meta: PaperBundleMeta
  sections: PaperSection[]
  questions: PaperQuestion[]
  answerCard: PaperAnswerCard
}

export function bundleTotalScore(bundle: PaperBundle): number {
  return Math.round(bundle.questions.reduce((sum, q) => sum + (Number(q.score) || 0), 0) * 100) / 100
}

export function answersOf(bundle: PaperBundle): Record<string, string> {
  return Object.fromEntries(bundle.questions.map((q) => [q.id, q.answer]))
}

export function questionsForPage(bundle: PaperBundle, side: PaperSide): PaperQuestion[] {
  return bundle.questions
    .filter((q) => q.answerCard.page === side)
    .sort((a, b) => a.number - b.number)
}

export function questionsOfSection(bundle: PaperBundle, sectionId: string): PaperQuestion[] {
  return bundle.questions
    .filter((q) => q.sectionId === sectionId)
    .sort((a, b) => a.number - b.number)
}

export function sectionTotalScore(bundle: PaperBundle, sectionId: string): number {
  return Math.round(questionsOfSection(bundle, sectionId).reduce((sum, q) => sum + q.score, 0) * 100) / 100
}

/**
 * 派生给现有后端的 ExamContent（某一面）
 * 不改变后端识别结构：questions 里只放识别需要的字段
 */
export function toExamContent(bundle: PaperBundle, side: PaperSide): ExamContent {
  const page = bundle.answerCard.pages.find((p) => p.side === side)
  if (!page) throw new Error(`试卷没有 ${side} 页`)

  const questions = questionsForPage(bundle, side).map((q) => ({
    id: q.id,
    displayNumber: q.number,
    type: q.answerCard.type,
    score: q.score,
    region: q.answerCard.region,
    ...(q.answerCard.type === 'mark' ? { choices: q.answerCard.choices ?? [] } : {}),
  }))

  return {
    schemaVersion: 1,
    unit: 'canvas',
    canvas: page.canvas,
    markers: page.markers,
    blocks: page.blocks.map((b) => ({
      id: b.id,
      type: 'text',
      region: b.region,
      text: b.text,
      style: b.style,
    })),
    questions,
    ...(bundle.answerCard.barcode
      ? {
          barcode: {
            id: 'barcode',
            type: 'code128' as const,
            value: '',
            anchor: 'top-left' as const,
            offset: {
              unit: 'canvas' as const,
              x: bundle.answerCard.barcode.region.x,
              y: bundle.answerCard.barcode.region.y,
            },
            size: {
              unit: 'canvas' as const,
              width: bundle.answerCard.barcode.region.width,
              height: bundle.answerCard.barcode.region.height,
            },
          },
        }
      : {}),
    answerKey: Object.fromEntries(questionsForPage(bundle, side).map((q) => [q.id, q.answer])),
  }
}

export interface PaperBundleIssue {
  level: 'error' | 'warn'
  code: string
  message: string
}

/** 存储/打印前的轻量校验 */
export function validatePaperBundle(bundle: PaperBundle): PaperBundleIssue[] {
  const issues: PaperBundleIssue[] = []
  if (bundle.schema !== 'paper-bundle') issues.push({ level: 'error', code: 'SCHEMA', message: 'schema 不正确' })
  if (bundle.schemaVersion !== 1) issues.push({ level: 'error', code: 'VERSION', message: 'schemaVersion 不正确' })

  const ids = new Set<string>()
  const numbers = new Set<number>()
  for (const q of bundle.questions) {
    if (ids.has(q.id)) issues.push({ level: 'error', code: 'DUP_ID', message: `题目 id 重复：${q.id}` })
    ids.add(q.id)
    if (numbers.has(q.number)) issues.push({ level: 'error', code: 'DUP_NUMBER', message: `题号重复：${q.number}` })
    numbers.add(q.number)
    if (!bundle.sections.some((s) => s.id === q.sectionId)) {
      issues.push({ level: 'error', code: 'SECTION_MISSING', message: `题目 ${q.id} 的大题不存在` })
    }
    if (!(q.score > 0)) issues.push({ level: 'error', code: 'SCORE', message: `题目 ${q.number} 分值无效` })
    if (!q.answer?.trim()) issues.push({ level: 'warn', code: 'ANSWER_EMPTY', message: `题目 ${q.number} 没有答案` })
    if (!bundle.answerCard.pages.some((p) => p.side === q.answerCard.page)) {
      issues.push({ level: 'error', code: 'PAGE_MISSING', message: `题目 ${q.number} 的页面不存在` })
    }
  }

  for (const page of bundle.answerCard.pages) {
    for (const q of questionsForPage(bundle, page.side)) {
      const r = q.answerCard.region
      if (r.x < 0 || r.y < 0 || r.x + r.width > page.canvas.width || r.y + r.height > page.canvas.height) {
        issues.push({ level: 'error', code: 'REGION_OUT', message: `题目 ${q.number} 超出 ${page.side} 页画布` })
      }
    }
  }
  return issues
}
