/**
 * 把各类接口返回的识别结果统一成可离线保存/导出的记录。
 * 结构用「像什么」定义而不是 import 页面层的类型，避免 lib ↔ m 循环依赖。
 */
import {
  makeScanId,
  summarize,
  type OfflineQuestion,
  type OfflineScan,
} from './offlineHistory'

/** check / grade 接口里单题的公共字段 */
export interface MetricLike {
  type?: string
  answer?: string | null
  expected?: string | null
  correct?: boolean | null
  uncertain?: boolean
  confidence?: number | null
  points?: number
  score?: number
}

/** check / grade 接口里单张图片的结果 */
export interface CheckItemLike {
  fileId: number
  success: boolean
  metrics?: Record<string, MetricLike>
  answers?: Record<string, string | null>
  code?: string
  error?: string
}

export interface ResultDetailLike {
  id: number
  examId: number
  paperId: number
  fileId: number
  uTime: number
  candidateNumber?: string | null
  score?: number
  maxScore?: number
  examName?: string
  paperName?: string
  details?: Record<string, MetricLike & { points?: number; score?: number }>
}

export function metricsToQuestions(metrics?: Record<string, MetricLike>): OfflineQuestion[] {
  if (!metrics) return []
  return Object.entries(metrics).map(([id, m]) => ({
    id,
    type: m.type,
    answer: m.answer ?? null,
    expected: m.expected ?? null,
    correct: m.correct ?? null,
    uncertain: Boolean(m.uncertain),
    confidence: m.confidence ?? null,
    points: m.points,
    score: m.score,
  }))
}

export function buildScan(input: {
  id?: string
  at?: number
  title: string
  source: OfflineScan['source']
  paperId: number | null
  paperName?: string
  fileName?: string
  fileId?: number
  candidateNumber?: string | null
  score?: number
  maxScore?: number
  questions: OfflineQuestion[]
}): OfflineScan {
  const questions = input.questions
  return {
    id: input.id ?? makeScanId(),
    at: input.at ?? Date.now(),
    title: input.title,
    source: input.source,
    paperId: input.paperId,
    paperName: input.paperName,
    fileName: input.fileName,
    fileId: input.fileId,
    candidateNumber: input.candidateNumber ?? null,
    score: input.score,
    maxScore: input.maxScore,
    questions,
    ...summarize(questions),
  }
}

/** 单张 check 结果 → 离线记录 */
export function scanFromCheckItem(
  item: CheckItemLike,
  meta: { paperId: number | null; paperName?: string; title?: string; at?: number },
): OfflineScan {
  const questions = metricsToQuestions(item.metrics)
  return buildScan({
    title: meta.title ?? `${meta.paperName ?? '识别结果'} · 文件 #${item.fileId}`,
    at: meta.at,
    source: 'capture',
    paperId: meta.paperId,
    paperName: meta.paperName,
    fileId: item.fileId,
    questions,
  })
}

/** 成绩详情 → 离线记录（用于成绩页一键导出，不写入本机历史） */
export function scanFromResultDetail(data: ResultDetailLike): OfflineScan {
  const questions = metricsToQuestions(data.details as Record<string, MetricLike> | undefined)
  return buildScan({
    id: `result_${data.id}`,
    at: data.uTime ? data.uTime * 1000 : Date.now(),
    title: `${data.examName ?? `考试 #${data.examId}`} · 考号 ${data.candidateNumber ?? '未识别'}`,
    source: 'grade',
    paperId: data.paperId,
    paperName: data.paperName,
    fileId: data.fileId,
    candidateNumber: data.candidateNumber ?? null,
    score: data.score,
    maxScore: data.maxScore,
    questions,
  })
}
