/** 试卷名称前端校验：与后端规则保持一致，避免提交后才报「参数不合法」 */

const BAD = /[\\/:*?"<>|]/

export function validatePaperName(raw: string, existing: string[] = []): string | null {
  const n = raw.trim()
  if (!n) return '给试卷起个名字吧'
  if (n !== raw) return '名字前后不要留空格'
  if (n.length > 100) return '名字最多 100 个字'
  if (BAD.test(n)) return '名字不能包含 \\ / : * ? " < > | 这些符号'
  if (existing.some((x) => x.trim() === n)) return `已经有一张叫「${n}」的试卷了`
  return null
}
