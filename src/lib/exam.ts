import type { ExamContent } from '../api/types'

/** 生成默认空白试卷内容（A4 比例画布） */
export function createBlankExam(): ExamContent {
  const canvas = { width: 300, height: 424.26 }
  const size = 10.5
  return {
    schemaVersion: 1,
    unit: 'canvas',
    canvas,
    markers: [
      { id: 'top-left', x: 9, y: 12.73, size },
      { id: 'top-right', x: canvas.width - 9 - size, y: 12.73, size },
      { id: 'bottom-left', x: 9, y: canvas.height - 12.73 - size, size },
      { id: 'bottom-right', x: canvas.width - 9 - size, y: canvas.height - 12.73 - size, size },
    ],
    questions: [],
    blocks: [],
    answerKey: {},
  }
}

/** 试卷是否有内容 */
export function isBlank(content: ExamContent | Record<string, never>): boolean {
  return !content || Object.keys(content).length === 0
}

export const WIN_ILLEGAL = /[<>:"/\\|?*]/

/** 前端预校验试卷名，规则与后端一致 */
export function validateExamName(name: string): string | null {
  if (!name) return '试卷名不能为空'
  if (name !== name.trim()) return '试卷名不能有首尾空白'
  if (name.length > 100) return '试卷名不能超过 100 个字符'
  if (WIN_ILLEGAL.test(name)) return '试卷名不能包含 < > : " / \\ | ? *'
  return null
}

/** 深度校验试卷内容，返回错误列表 */
export function validateExamContent(c: ExamContent): string[] {
  const errs: string[] = []
  const { canvas, markers, questions } = c
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) errs.push('画布尺寸不合法')

  const need = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  const ids = new Set((markers ?? []).map((x) => x.id))
  if (markers?.length !== 4) errs.push('定位块必须正好 4 个')
  for (const k of need) if (!ids.has(k as never)) errs.push(`缺少定位块 ${k}`)
  if (new Set(markers?.map((x) => x.id)).size !== (markers?.length ?? 0)) errs.push('定位块 id 重复')

  if (!questions?.length) errs.push('至少需要 1 道小题')

  const allIds = new Set<string>()
  for (const q of questions ?? []) {
    if (!q.id) errs.push('小题缺少 id')
    if (allIds.has(q.id)) errs.push(`id 重复：${q.id}`)
    allIds.add(q.id)
    const r = q.region
    if (!r) errs.push(`${q.id} 缺少区域`)
    else if (r.x < 0 || r.y < 0 || r.x + r.width > canvas.width + 1e-6 || r.y + r.height > canvas.height + 1e-6)
      errs.push(`${q.id} 超出画布范围`)
    if (q.type === 'mark') {
      if (!q.choices || q.choices.length < 2) errs.push(`${q.id} 涂卡题至少需要 2 个选项`)
      const vals = new Set(q.choices?.map((o) => o.value))
      if (vals.size !== (q.choices?.length ?? 0)) errs.push(`${q.id} 选项值重复`)
    }
  }

  for (const b of c.blocks ?? []) {
    if (allIds.has(b.id)) errs.push(`内容块 id 与小题重复：${b.id}`)
    allIds.add(b.id)
    if (!b.text?.trim()) errs.push(`内容块 ${b.id} 文本为空`)
  }

  for (const [qid, ans] of Object.entries(c.answerKey ?? {})) {
    const q = questions?.find((x) => x.id === qid)
    if (!q) errs.push(`答案键引用了不存在的题：${qid}`)
    else if (q.type !== 'mark') errs.push(`答案键只能引用涂卡题：${qid}`)
    else if (!q.choices?.some((o) => o.value === ans)) errs.push(`${qid} 的答案 ${ans} 不在选项中`)
  }

  return errs
}

let seq = 0
export function uid(prefix: string): string {
  seq += 1
  return `${prefix}${Date.now().toString(36).slice(-5)}${seq}`
}
