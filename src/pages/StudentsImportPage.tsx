import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatTile } from '../components/PageHeader'
import { Badge, Button, Card, Field, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'
import { UploadIcon } from '../components/icons'
import { errorText } from '../api/client'
import { addStudents } from '../api/students'
import { STUDENT_FIELDS, parseCsv, toStudentDraft, validateStudent } from '../lib/students'

const SAMPLE = `姓名,考生号,班级,年级,专业
张三,2026001,1班,2026级,计算机
李四,2026002,1班,2026级,计算机`

type Row = { draft: ReturnType<typeof toStudentDraft>; error: string | null; line: number }

export default function StudentsImportPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const rows: Row[] = useMemo(() => {
    if (!text.trim()) return []
    return parseCsv(text).map((r, i) => {
      const draft = toStudentDraft(r)
      return { draft, error: validateStudent(draft), line: i + 1 }
    })
  }, [text])

  const bad = rows.filter((r) => r.error).length
  const good = rows.length - bad

  async function readFile(file: File | null) {
    if (!file) return
    const t = await file.text()
    setText(t)
    toast(`已读取 ${file.name}`, 'ok')
  }

  async function submit() {
    if (!good) return
    setBusy(true)
    try {
      const res = await addStudents(rows.filter((r) => !r.error).map((r) => r.draft))
      toast(`成功导入 ${res.count} 条学生记录`, 'ok')
      nav('/students')
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="批量导入"
        desc="粘贴或上传 CSV / TSV，第一行可以是表头。导入前会逐行校验，有问题的行不会被提交。"
        crumb={[{ label: '学生管理', to: '/students' }, { label: '批量导入' }]}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatTile label="总行数" value={rows.length} delay={0} />
        <StatTile label="可导入" value={good} tone="ok" delay={60} />
        <StatTile label="有问题" value={bad} tone={bad ? 'err' : 'brand'} delay={120} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="anim-lift">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">原始数据</h3>
            <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>
              填入示例
            </Button>
          </div>

          <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/50 px-4 py-6 text-xs font-semibold text-brand-800 transition hover:border-brand-400 hover:bg-brand-50">
            <UploadIcon className="h-4 w-4" />
            点击选择 .csv / .txt 文件
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => readFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <Field label="或直接粘贴" hint={`列顺序：${STUDENT_FIELDS.map((f) => f.label).join(' / ')}`}>
            <textarea
              className={`${inputCls} min-h-[180px] font-mono text-[11.5px] leading-relaxed`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={SAMPLE}
              spellCheck={false}
            />
          </Field>
        </Card>

        <Card className="anim-lift flex flex-col">
          <h3 className="mb-3 text-sm font-bold text-ink">预览与校验</h3>
          {rows.length === 0 ? (
            <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-brand-200 py-10 text-xs text-ink-soft/50">
              粘贴数据后这里会实时显示校验结果
            </p>
          ) : (
            <div className="max-h-[420px] flex-1 overflow-y-auto rounded-xl border border-brand-100">
              <table className="w-full text-[11.5px]">
                <thead className="sticky top-0 bg-brand-50/90 backdrop-blur">
                  <tr className="text-left text-[10.5px] text-ink-soft/70">
                    <th className="px-2.5 py-2 font-semibold">#</th>
                    {STUDENT_FIELDS.slice(0, 3).map((f) => (
                      <th key={f.key} className="px-2.5 py-2 font-semibold">
                        {f.label}
                      </th>
                    ))}
                    <th className="px-2.5 py-2 font-semibold">状态</th>
                  </tr>
                </thead>
                <tbody className="stagger divide-y divide-brand-100/70">
                  {rows.map((r) => (
                    <tr key={r.line} className={r.error ? 'bg-red-50/50' : 'hover:bg-brand-50/50'}>
                      <td className="px-2.5 py-1.5 tabnum text-ink-soft/50">{r.line}</td>
                      <td className="px-2.5 py-1.5 font-semibold text-ink">{r.draft.name || '—'}</td>
                      <td className="px-2.5 py-1.5 tabnum text-ink-soft">{r.draft.candidateNumber || '—'}</td>
                      <td className="px-2.5 py-1.5 text-ink-soft">{r.draft.className || '—'}</td>
                      <td className="px-2.5 py-1.5">
                        {r.error ? <Badge tone="err">{r.error}</Badge> : <Badge tone="ok">可导入</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] text-ink-soft/60">
              {bad > 0 ? `${bad} 行有问题，将被跳过` : '全部通过校验'}
            </p>
            <Button disabled={!good || busy} onClick={submit}>
              {busy ? '导入中…' : `导入 ${good} 条`}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
