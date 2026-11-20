import type { Student } from '../api/types'

export const STUDENT_FIELDS = [
  { key: 'name', label: '姓名', placeholder: '张三' },
  { key: 'candidateNumber', label: '考生号', placeholder: '2026001' },
  { key: 'className', label: '班级', placeholder: '1班' },
  { key: 'grade', label: '年级', placeholder: '2026级' },
  { key: 'major', label: '专业', placeholder: '计算机' },
] as const

export type StudentFieldKey = (typeof STUDENT_FIELDS)[number]['key']

/** 简易 CSV 解析（支持逗号/制表符，第一行可为表头） */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const head = lines[0].split(sep).map((h) => h.trim())
  const isHeader = /姓名|name/i.test(head[0] ?? '')
  const cols = isHeader ? head : STUDENT_FIELDS.map((f) => f.key)
  const body = isHeader ? lines.slice(1) : lines
  return body.map((line) => {
    const cells = line.split(sep)
    const o: Record<string, string> = {}
    cols.forEach((c, i) => {
      o[c] = (cells[i] ?? '').trim()
    })
    return o
  })
}

/** 校验单条学生记录，返回错误说明或 null */
export function validateStudent(s: Record<string, unknown>): string | null {
  const name = String(s.name ?? '').trim()
  const no = String(s.candidateNumber ?? '').trim()
  if (!name) return '姓名不能为空'
  if (name.length > 32) return '姓名过长'
  if (no && !/^[A-Za-z0-9-]{1,32}$/.test(no)) return `考生号格式不合法：${no}`
  return null
}

/** 把 CSV 行转成待提交的学生对象（不含 id） */
export function toStudentDraft(row: Record<string, string>): Omit<Student, 'id'> {
  return {
    name: (row.name ?? '').trim(),
    candidateNumber: (row.candidateNumber ?? '').trim() || undefined,
    className: (row.className ?? '').trim() || undefined,
    grade: (row.grade ?? '').trim() || undefined,
    major: (row.major ?? '').trim() || undefined,
  } as Omit<Student, 'id'>
}
