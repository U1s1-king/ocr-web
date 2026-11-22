import { jsonRequest, request } from './client'
import type { Student } from './types'

const P = '/api/v1/students/batch'

export interface AddStudentsResult {
  count: number
  students: Student[]
}

export interface DeleteStudentsResult {
  deletedCount: number
  ids: number[]
}

/** 批量增加学生（不鉴权），1–1000 条 */
export function addStudents(students: Student[]): Promise<AddStudentsResult> {
  return jsonRequest<AddStudentsResult>(P, 'POST', { students })
}

/** 批量修改学生（每条必须带 id） */
export function updateStudents(students: Student[]): Promise<AddStudentsResult> {
  return jsonRequest<AddStudentsResult>(P, 'PUT', { students })
}

/** 批量删除学生，任意 id 不存在则整批失败 */
export function deleteStudents(ids: number[]): Promise<DeleteStudentsResult> {
  return jsonRequest<DeleteStudentsResult>(P, 'DELETE', { ids })
}


export interface StudentListParams {
  offset?: number
  limit?: number
  q?: string
  className?: string
  grade?: string
  major?: string
}

/** 批量获取学生（GET /api/v1/students） */
export function listStudents(params: StudentListParams = {}): Promise<Student[]> {
  const sp = new URLSearchParams()
  const push = (k: string, v: string | number | undefined) => {
    if (v !== undefined && v !== '') sp.append(k, String(v))
  }
  push('offset', params.offset ?? 0)
  push('limit', params.limit ?? 10000)
  push('q', params.q)
  push('className', params.className)
  push('grade', params.grade)
  push('major', params.major)
  return request<Student[]>(`/api/v1/students?${sp.toString()}`)
}
