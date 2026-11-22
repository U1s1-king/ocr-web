import { ApiError, errorText, getApiBase, getApiToken, request } from '../api/client'
import { recordRequest } from '../lib/requestLog'
import { clearCache } from './cache'
import type { ExamContent } from '../api/types'
import { listStudents } from '../api/students'

export { ApiError, errorText }
export type PaperJson = ExamContent

/* ================= 类型：与 /api/v1 文档一一对应 ================= */

export interface PaperSummary {
  id: number
  name: string
}

export interface PaperDetail {
  id: number
  name: string
  paper: (PaperJson & { designV2?: unknown }) | Record<string, never>
}

export interface ExamSummary {
  id: number
  name: string
  paperId: number
  paperName: string
  uTime: number
  resultCount: number
}

export interface ResultItem {
  id: number
  examId: number
  paperId: number
  fileId: number
  uTime: number
  candidateNumber: string | null
  score: number
}

export interface QuestionDetail {
  type: 'mark' | 'subjective'
  answer: string | null
  expected?: string | null
  correct?: boolean | null
  points?: number
  score?: number
  uncertain?: boolean
}

export interface ResultDetail extends ResultItem {
  examName?: string
  paperName?: string
  maxScore?: number
  details?: Record<string, QuestionDetail>
}

export interface ExamResults {
  examId: number
  examName: string
  paperId: number
  paperName: string
  results: ResultDetail[]
}

export interface FileItem {
  fileId: number
  hash: string
  uTime: number
  name: string
  suffix: string
}

export interface FileSearchResult {
  query: string
  suffix: string
  total: number
  limit: number
  offset: number
  items: FileItem[]
}

export interface Student {
  id?: number
  name: string
  candidateNumber?: string
  className?: string
  grade?: string
  major?: string
}

/* 人工复核：GET /reviews、GET /reviews/{id}、GET /reviews/{id}/image、PUT /reviews/{id} */
export type ReviewType = 'objective_dispute' | 'subjective'
export type ReviewStatus = 'pending' | 'resolved' | 'ignored'

export interface ReviewItem {
  id: number
  examId?: number
  examName?: string
  paperId?: number
  fileId?: number
  resultId?: number
  questionId?: string
  candidateNumber?: string | null
  type: ReviewType
  status: ReviewStatus
  reason?: string | null
  localAnswer?: string | null
  aiAnswer?: string | null
  finalAnswer?: string | null
  finalScore?: number | null
  maxScore?: number | null
  imageUrl?: string | null
  uTime?: number
}

/* 接口日志：GET /api/v1/logs */
export interface ApiLogItem {
  id: number
  method: string
  path: string
  status: number
  duration?: number | null
  uTime: number
  requestBody?: string | null
  responseBody?: string | null
}

export interface ApiLogPage {
  items: ApiLogItem[]
  total: number
}

export interface ExamBatch {
  id: number
  name: string
  uTime: number
  examIds: number[]
  examCount: number
}

export interface ResultSummary {
  resultCount: number
  averageScore: number
  maxScore: number
}

export interface ResultPage {
  items: ResultItem[]
  total: number
  summary: ResultSummary
}

export interface GradeItem {
  fileId: number
  success: boolean
  candidateNumber?: string | null
  score?: number
  maxScore?: number
  correctCount?: number
  gradedCount?: number
  resultId?: number
  details?: Record<string, QuestionDetail>
  code?: string
  error?: string
}

export interface GradeResponse {
  examId: number
  examName: string
  paperId: number
  paperName: string
  total: number
  successCount: number
  failureCount: number
  totalScore: number
  results: GradeItem[]
}

export interface CheckItem {
  fileId: number
  success: boolean
  answers?: Record<string, string | null>
  metrics?: Record<string, QuestionDetail & { confidence?: number; ratios?: number[]; selectedOptions?: string[] }>
  markers?: { x: number; y: number }[]
  image?: { width: number; height: number }
  code?: string
  error?: string
}

export interface CheckResponse {
  paperId: number
  total: number
  successCount: number
  failureCount: number
  results: CheckItem[]
}

/* ================= 请求工具 ================= */

const P = '/api/v1'

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)))
    else sp.append(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** 搜索框防抖间隔，全局共用一个值 */
export const INPUT_DEBOUNCE = 260


function json<T>(path: string, method: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/* ================= 试卷 ================= */

export const papersApi = {
  list: () => request<PaperSummary[]>(`${P}/papers`),
  get: (id: number) => request<PaperDetail>(`${P}/papers/${id}`),
  create: async (name: string) => {
    const r = await json<PaperDetail>(`${P}/papers`, 'POST', { name })
    clearCache('papers')
    return r
  },
  /** 第二参数可选：把设计文档 v2 一起塞进 paper JSON 的 designV2 字段 */
  update: async (id: number, paper: PaperJson, design?: unknown) => {
    const payload = design ? { ...paper, designV2: design } : paper
    const r = await json<PaperDetail>(`${P}/papers/${id}`, 'PUT', payload)
    clearCache('papers')
    return r
  },
  /** 设计稿专用通道：后端开放 /papers/{id}/design 后生效 */
  getDesign: (id: number) => request<import('../lib/design').PaperDesign>(`${P}/papers/${id}/design`),
  putDesign: async (id: number, design: import('../lib/design').PaperDesign) => {
    const r = await json<import('../lib/design').PaperDesign>(`${P}/papers/${id}/design`, 'PUT', design)
    return r
  },
  setAnswers: async (id: number, answerKey: Record<string, string>) => {
    const r = await json<{ id: number; name: string; answerKey: Record<string, string> }>(
      `${P}/papers/${id}/answers`,
      'PUT',
      { answerKey },
    )
    clearCache('papers')
    return r
  },
  remove: async (id: number) => {
    const r = await request<void>(`${P}/papers/${id}`, { method: 'DELETE' })
    clearCache('papers')
    return r
  },
  check: (id: number, fileIds: number[]) => json<CheckResponse>(`${P}/papers/${id}/check`, 'POST', { fileIds }),
}

export interface TemplateSummary { id: number; name: string }

/** 模板接口：模板与试卷共用 papers 表，模板 id 就是 papers.id */
export const templatesApi = {
  list: () => request<TemplateSummary[]>(`${P}/templates`),
  get: (id: number) => request<PaperDetail>(`${P}/templates/${id}`),
  /** 由模板生成一张新试卷：先建空卷，再把模板内容整份写进去 */
  instantiate: async (tplId: number, name: string): Promise<PaperDetail> => {
    const tpl = await request<PaperDetail>(`${P}/templates/${tplId}`)
    const created = await json<PaperDetail>(`${P}/papers`, 'POST', { name })
    const paper = tpl.paper
    if (paper && Object.keys(paper).length > 0) {
      await json<PaperDetail>(`${P}/papers/${created.id}`, 'PUT', paper)
    }
    clearCache('papers')
    return { ...created, paper }
  },
}

export const examsApi = {
  list: () => request<ExamSummary[]>(`${P}/exams`),
  get: (id: number) => request<ExamSummary>(`${P}/exams/${id}`),
  create: async (name: string, paperId: number) => {
    const r = await json<ExamSummary>(`${P}/exams`, 'POST', { name, paperId })
    clearCache('exams')
    return r
  },
  remove: async (id: number) => {
    const r = await request<void>(`${P}/exams/${id}`, { method: 'DELETE' })
    clearCache('exams')
    return r
  },
  results: (id: number) => request<ExamResults>(`${P}/exams/${id}/results`),
  grade: async (id: number, fileIds: number[], candidateNumbers?: Record<string, string>) => {
    const r = await json<GradeResponse>(`${P}/exams/${id}/grade`, 'POST', { fileIds, candidateNumbers })
    clearCache('exams')
    clearCache('results')
    return r
  },
}

/* ================= 人工复核 ================= */

export const reviewsApi = {
  list: (params: { type?: ReviewType; status?: ReviewStatus; examId?: number; limit?: number; offset?: number } = {}) =>
    request<ReviewItem[]>(`${P}/reviews${qs(params)}`),
  get: (id: number) => request<ReviewItem>(`${P}/reviews/${id}`),
  /** 题目裁剪图：直接返回图片地址，交给 <img> 用（带鉴权时由页面拼 header 不行，这里走 blob） */
  image: async (id: number): Promise<string> => {
    const base = getApiBase()
    const token = getApiToken()
    const res = await fetch(`${base}${P}/reviews/${id}/image`, {
      headers: token ? { Authorization: `Bearer ${token}`, 'client-cookie': token } : {},
    })
    if (!res.ok) throw new ApiError(res.status, '', `图片获取失败（${res.status}）`)
    return URL.createObjectURL(await res.blob())
  },
  resolve: (id: number, body: { status: ReviewStatus; finalAnswer?: string; finalScore?: number }) =>
    json<ReviewItem>(`${P}/reviews/${id}`, 'PUT', body),
}

/* ================= 接口日志 ================= */

export const logsApi = {
  list: (params: { method?: string[]; status?: (number | string)[]; q?: string; limit?: number; offset?: number } = {}) =>
    rawRequest<ApiLogItem[]>(`${P}/logs${qs(params)}`).then((raw) => ({
      items: raw.data ?? [],
      total: typeof (raw.meta as { total?: number } | undefined)?.total === 'number'
        ? (raw.meta as { total: number }).total
        : (raw.data ?? []).length,
    })) as Promise<ApiLogPage>,
}

/* ================= 文件 ================= */

export const filesApi = {
  search: (params: { q?: string; suffix?: string; limit?: number; offset?: number }) =>
    request<FileSearchResult>(`${P}/files/search${qs(params)}`),
  upload: (file: File, onProgress?: (pct: number) => void) =>
    uploadWithProgress<{ fileId: number; hash: string; uTime: number; name: string; suffix: string }>(
      `${P}/files`,
      file,
      onProgress,
    ),
}

/** 需要上传进度时走 XHR，其余走 fetch */
function uploadWithProgress<T>(path: string, file: File, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = performance.now()
    const xhr = new XMLHttpRequest()
    const root = getApiBase()
    const token = getApiToken()
    xhr.open('POST', `${root}${path}`)
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('client-cookie', token)
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let payload: unknown = null
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        payload = null
      }
      const data = (payload as { data?: T } | null)?.data
      const ok = xhr.status >= 200 && xhr.status < 300
      recordRequest({
        method: 'POST',
        path,
        status: xhr.status,
        durationMs: Math.round(performance.now() - started),
        ok,
        code: ok ? undefined : (payload as { code?: string } | null)?.code,
        error: ok ? undefined : (payload as { error?: string } | null)?.error,
      })
      if (ok) resolve((data ?? payload) as T)
      else {
        const err = payload as { code?: string; error?: string } | null
        reject(new ApiError(xhr.status, err?.code ?? '', err?.error ?? `上传失败（${xhr.status}）`))
      }
    }
    xhr.onerror = () => {
      recordRequest({
        method: 'POST',
        path,
        status: null,
        durationMs: Math.round(performance.now() - started),
        ok: false,
        code: 'NETWORK',
        error: '网络中断，上传失败',
      })
      reject(new ApiError(0, 'NETWORK', '网络中断，上传失败'))
    }
    const form = new FormData()
    form.append('file', file, file.name)
    xhr.send(form)
  })
}

/* ================= 学生 ================= */

export const studentsApi = {
  /** 后端为主、本地为辅：接口失败时继续使用本机名单 */
  list: async (): Promise<Student[]> => {
    try {
      const remote = await listStudents({ limit: 10000 })
      studentsApi.saveLocal(remote)
      return remote
    } catch {
      try {
        const raw = localStorage.getItem('ac.students')
        return raw ? (JSON.parse(raw) as Student[]) : []
      } catch {
        return []
      }
    }
  },
  saveLocal: (students: Student[]): void => {
    localStorage.setItem('ac.students', JSON.stringify(students))
  },
  add: (students: Student[]) => json<{ count: number; students: Student[] }>(`${P}/students/batch`, 'POST', { students }),
  update: (students: Student[]) =>
    json<{ count: number; students: Student[] }>(`${P}/students/batch`, 'PUT', { students }),
  remove: (ids: number[]) => json<{ deletedCount: number; ids: number[] }>(`${P}/students/batch`, 'DELETE', { ids }),
}

/* ================= 考试批次 ================= */

export const batchesApi = {
  list: () => request<ExamBatch[]>(`${P}/exam-batches`),
  get: (id: number) => request<ExamBatch>(`${P}/exam-batches/${id}`),
  create: (name: string, examIds: number[]) => json<ExamBatch>(`${P}/exam-batches`, 'POST', { name, examIds }),
  update: (id: number, name: string, examIds: number[]) =>
    json<ExamBatch>(`${P}/exam-batches/${id}`, 'PUT', { name, examIds }),
  remove: (id: number) => request<void>(`${P}/exam-batches/${id}`, { method: 'DELETE' }),
}

/* ================= 跨考试结果 ================= */

export const resultsApi = {
  list: async (params: {
    examIds?: number[]
    batchId?: number
    offset?: number
    limit?: number
    sortBy?: string[]
    sortDirection?: string[]
  }): Promise<ResultPage> => {
    const path = `${P}/exam-results${qs({
      examIds: params.examIds,
      batchId: params.batchId,
      offset: params.offset ?? 0,
      limit: params.limit ?? 20,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
    })}`
    const raw = await rawRequest<ResultItem[]>(path)
    const meta = raw.meta as
      | { total?: number; summary?: ResultSummary }
      | undefined
    return {
      items: raw.data ?? [],
      total: typeof meta?.total === 'number' ? meta.total : -1,
      summary: meta?.summary ?? { resultCount: 0, averageScore: 0, maxScore: 0 },
    }
  },
  get: (id: number) => request<ResultDetail>(`${P}/exam-results/${id}`),

  /** 文档要求必须带 examIds 或 batchId：先取全部考试 id 再查，避免 EXAM_SCOPE_REQUIRED */
  listAll: async (params: {
    offset?: number
    limit?: number
    sortBy?: string[]
    sortDirection?: string[]
  } = {}): Promise<ResultPage> => {
    const exams = await request<ExamSummary[]>(`${P}/exams`)
    const ids = exams.map((e) => e.id)
    if (ids.length === 0) {
      return { items: [], total: 0, summary: { resultCount: 0, averageScore: 0, maxScore: 0 } }
    }
    return resultsApi.list({ ...params, examIds: ids })
  },
}

/** 需要 meta 分页信息时用原始包装 */
async function rawRequest<T>(path: string): Promise<{ data: T; meta?: unknown }> {
  const base = getApiBase()
  const token = getApiToken()
  const started = performance.now()
  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}`, 'client-cookie': token } : {},
    })
  } catch (err) {
    const message = `请求失败：${(err as Error).message}`
    recordRequest({
      method: 'GET',
      path,
      status: null,
      durationMs: Math.round(performance.now() - started),
      ok: false,
      code: 'NETWORK',
      error: message,
    })
    throw new ApiError(0, 'NETWORK', message)
  }
  if (!res.ok) {
    const message = `请求失败（${res.status}）`
    recordRequest({
      method: 'GET',
      path,
      status: res.status,
      durationMs: Math.round(performance.now() - started),
      ok: false,
      code: 'HTTP_ERROR',
      error: message,
    })
    throw new ApiError(res.status, '', message)
  }
  recordRequest({ method: 'GET', path, status: res.status, durationMs: Math.round(performance.now() - started), ok: true })
  return (await res.json()) as { data: T; meta?: unknown }
}

