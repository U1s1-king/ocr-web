import { jsonRequest, request } from './client'
import type { CheckBatchResult, ExamContent, ExamSummary } from './types'

const P = '/api/v1/exams'

/** 创建考试：POST /api/v1/exams，name 1–100 字符且不能重复，paperId 必填 */
export function createExam(name: string, paperId: number): Promise<ExamSummary> {
  return jsonRequest<ExamSummary>(P, 'POST', { name, paperId })
}

/** 获取试卷：新创建的 exam 为 {} */
export function getExam(id: number): Promise<ExamSummary> {
  return request<ExamSummary>(`${P}/${id}`)
}

/** 替换试卷内容（完整 JSON，不含 name） */
export function putExam(id: number, content: ExamContent): Promise<ExamSummary> {
  return jsonRequest<ExamSummary>(`${P}/${id}`, 'PUT', content)
}

export function deleteExam(id: number): Promise<void> {
  return request<void>(`${P}/${id}`, { method: 'DELETE' })
}

/** 批量检查：examId + fileIds（1–50 个） */
export function checkExam(examId: number, fileIds: number[]): Promise<CheckBatchResult> {
  return jsonRequest<CheckBatchResult>(`${P}/check`, 'POST', { examId, fileIds })
}
