import type { Barcode, Block, Marker, Question, Region } from './types'

/** 后端 2026-11-22 起使用的试卷 JSON v2（多页包装结构） */
export interface PaperV2Question extends Question {
  /** 后端 v2 自己会校验分值 */
  score: number
}

export interface PaperV2Page {
  page: number
  unit: 'canvas'
  canvas: { width: number; height: number }
  markers?: Marker[]
  blocks?: Block[]
  questions: PaperV2Question[]
  barcode?: Barcode
}

export interface PaperV2AnswerCard {
  answerKey: Record<string, string>
  pages: PaperV2Page[]
}

export interface PaperV2 {
  schemaVersion: 2
  answerCard: PaperV2AnswerCard
  paper: { pages: PaperV2Page[] }
}

export interface RawPaperDetail {
  id: number
  name: string
  paper: PaperV2 | Record<string, never>
}

/** 某一页的题目区域；v2 的 paper.pages 与 answerCard.pages 共用 */
export type PaperV2Region = Region
