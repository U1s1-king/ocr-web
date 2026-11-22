import { useEffect, useState } from 'react'
import { errorText } from '../api/client'
import { addStudents, deleteStudents, listStudents, updateStudents } from '../api/students'
import type { Student } from '../api/types'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { PlusIcon, TrashIcon, UploadIcon } from '../components/icons'
import { Badge, Button, Card, Empty, Field, SectionTitle, Spinner, inputCls } from '../components/ui'

const FIELDS = [
  { key: 'name', label: '姓名', placeholder: '张三' },
  { key: 'candidateNumber', label: '考生号', placeholder: '2026001' },
  { key: 'className', label: '班级', placeholder: '1班' },
  { key: 'grade', label: '年级', placeholder: '2026级' },
  { key: 'major', label: '专业', placeholder: '计算机' },
] as const

/** 简易 CSV 解析（支持逗号/制表符，第一行可为表头） */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const head = lines[0].split(sep).map((h) => h.trim())
  const isHeader = /姓名|name/i.test(head[0] ?? '')
  const cols = isHeader ? head : ['name', 'candidateNumber', 'className', 'grade', 'major']
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

export default function StudentsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let alive = true
    listStudents()
      .then((list) => { if (alive) setRows(list) })
      .catch(() => {
        if (!alive) return
        try {
          const raw = localStorage.getItem('ac.students')
          if (raw) setRows(JSON.parse(raw) as Student[])
        } catch { /* ignore */ }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const [form, setForm] = useState<Student>({
    name: '',
    candidateNumber: '',
    className: '',
    grade: '',
    major: '',
  })

  function validateStu(s: Student): string | null {
    for (const f of FIELDS) if (!String(s[f.key] ?? '').trim()) return `${f.label}不能为空`
    return null
  }

  async function handleAdd() {
    const err = validateStu(form)
    if (err) {
      toast(err, 'err')
      return
    }
    setBusy(true)
    try {
      const r = await addStudents([form])
      setRows((xs) => [...xs, ...r.students])
      setForm({ name: '', candidateNumber: '', className: '', grade: '', major: '' })
      toast(`已添加 ${r.count} 名学生`, 'ok')
      setAdding(false)
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(text: string) {
    const list = parseCsv(text)
    if (!list.length) {
      toast('没有解析到数据', 'err')
      return
    }
    if (list.length > 1000) {
      toast('一次最多 1000 条', 'err')
      return
    }
    const bad = list.find((s) => FIELDS.some((f) => !String(s[f.key] ?? '').trim()))
    if (bad) {
      toast('存在字段为空的行，请检查文件', 'err')
      return
    }
    setBusy(true)
    try {
      const r = await addStudents(list as unknown as Student[])
      setRows((xs) => [...xs, ...r.students])
      toast(`已导入 ${r.count} 名学生`, 'ok')
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(s: Student) {
    if (s.id === undefined) return
    const ok = await confirm({
      title: `删除学生「${s.name}」？`,
      description: `考生号 ${s.candidateNumber}`,
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteStudents([s.id])
      setRows((xs) => xs.filter((x) => x.id !== s.id))
      toast('已删除', 'ok')
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdate(s: Student) {
    const err = validateStu(s)
    if (err) {
      toast(err, 'err')
      return
    }
    setBusy(true)
    try {
      await updateStudents([s])
      toast('已保存', 'ok')
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="anim-page-in space-y-5">
      <header>
        <h1 className="text-xl font-black tracking-tight">学生管理</h1>
        <p className="mt-1 text-xs text-ink-soft">
          批量增加、修改、删除考生信息。考生号唯一，重复会返回 409。
        </p>
      </header>

      <Card>
        <SectionTitle
          extra={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
                <PlusIcon className="h-3.5 w-3.5" />
                单个添加
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-200">
                <UploadIcon className="h-3.5 w-3.5" />
                导入 CSV
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const text = await f.text()
                    await handleImport(text)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          }
        >
          学生名单
        </SectionTitle>

        <p className="mb-3 text-[11px] leading-relaxed text-ink-soft/60">
          CSV 列顺序：姓名, 考生号, 班级, 年级, 专业（首行可为表头）
        </p>

        {adding && (
          <div className="anim-fade-up mb-4 grid gap-2 rounded-2xl border border-brand-200 bg-brand-50/60 p-3 sm:grid-cols-5">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  className={inputCls}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              </Field>
            ))}
            <div className="sm:col-span-5">
              <Button size="sm" onClick={handleAdd} disabled={busy}>
                {busy ? <Spinner /> : <PlusIcon className="h-3.5 w-3.5" />}
                确认添加
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-[12px] font-semibold text-ink-soft/60">正在加载学生名单…</p>
        ) : rows.length === 0 ? (
          <Empty title="还没有学生" hint="用上方表单单个添加，或导入 CSV 批量录入。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-xs">
              <thead>
                <tr className="text-left text-[11px] text-ink-soft/60">
                  <th className="px-2 font-semibold">id</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="px-2 font-semibold">{f.label}</th>
                  ))}
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={s.id ?? i} className="bg-white">
                    <td className="rounded-l-xl px-2 py-1 font-mono text-[10px] text-ink-soft/50">{s.id ?? '—'}</td>
                    {FIELDS.map((f) => (
                      <td key={f.key} className="px-1 py-1">
                        <input
                          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-ink outline-none transition hover:border-brand-200 focus:border-brand-400 focus:bg-white"
                          value={String(s[f.key] ?? '')}
                          onChange={(e) =>
                            setRows((xs) =>
                              xs.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)),
                            )
                          }
                          onBlur={() => void handleUpdate(rows[i])}
                        />
                      </td>
                    ))}
                    <td className="rounded-r-xl px-1 py-1">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void handleDelete(s)}
                          className="rounded-lg p-1.5 text-ink-soft/35 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-soft/45">
          <Badge tone="mute">提示</Badge>
          修改单元格后失焦即自动保存；学生接口当前不需要鉴权。
        </p>
      </Card>
    </div>
  )
}
