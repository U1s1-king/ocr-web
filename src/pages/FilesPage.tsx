import { useEffect, useRef, useState } from 'react'
import { errorText, examsApi, filesApi, type ExamSummary, type FileItem } from '../m/api'
import { Button } from '../components/ui'

const PAGE = 30

function fmtTime(v?: number) {
  if (!v) return '—'
  const d = new Date(v * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function FilesPage() {
  const [items, setItems] = useState<FileItem[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [suffix, setSuffix] = useState('')
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [pct, setPct] = useState(-1)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<number[]>([])
  const [exams, setExams] = useState<ExamSummary[]>([])
  const [gradeOpen, setGradeOpen] = useState(false)
  const [gradeExam, setGradeExam] = useState('')
  const [grading, setGrading] = useState(false)
  const [gradeMsg, setGradeMsg] = useState('')

  async function load(offset = 0, append = false) {
    if (append) setMore(true)
    else setLoading(true)
    setErr('')
    try {
      const res = await filesApi.search({ q: q.trim() || undefined, suffix: suffix || undefined, limit: PAGE, offset })
      setItems((prev) => (append ? [...prev, ...res.items] : res.items))
      setTotal(res.total)
    } catch (e) {
      setErr(errorText(e))
      if (!append) setItems([])
    } finally {
      setLoading(false)
      setMore(false)
    }
  }

  useEffect(() => {
    void load(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suffix])

  useEffect(() => {
    examsApi.list().then(setExams).catch(() => setExams([]))
  }, [])

  async function onPick(file: File | null) {
    if (!file) return
    setPct(0)
    setMsg('')
    setErr('')
    try {
      await filesApi.upload(file, (p) => setPct(p))
      setMsg(`已上传：${file.name}`)
      setPct(-1)
      await load(0, false)
    } catch (e) {
      setErr(errorText(e))
      setPct(-1)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">文件库</h1>
          <p className="mt-1 text-[12px] text-ink-soft/70">上传的原图与识别文件都在这，共 {total} 个</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2 text-[12px] font-bold text-white shadow-soft transition hover:brightness-105"
          >
            上传文件
          </button>
          <button
            type="button"
            disabled={!picked.length}
            onClick={() => setGradeOpen(true)}
            className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-2 text-[12px] font-bold text-brand-700 disabled:opacity-45"
          >
            批改到考试{picked.length ? ` (${picked.length})` : ''}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-200/70 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load(0, false)
            }}
            placeholder="搜文件名，回车确认"
            className="min-w-[180px] flex-1 rounded-xl border border-brand-200/80 bg-white px-3 py-2 text-[12px] font-semibold text-ink outline-none placeholder:text-ink-soft/45"
          />
          <select
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            className="rounded-xl border border-brand-200/80 bg-white px-3 py-2 text-[12px] font-semibold text-ink outline-none"
          >
            <option value="">全部类型</option>
            <option value="jpg">jpg</option>
            <option value="png">png</option>
            <option value="pdf">pdf</option>
          </select>
          <button
            type="button"
            onClick={() => void load(0, false)}
            className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-[12px] font-bold text-brand-700 transition hover:bg-brand-100"
          >
            搜索
          </button>
        </div>
        {pct >= 0 && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink-soft/70">上传中 {pct}%</p>
          </div>
        )}
        {msg && <p className="mt-2 text-[11.5px] font-semibold text-emerald-700">{msg}</p>}
        {err && false && <p className="mt-2 text-[11.5px] font-semibold text-amber-700">{err}</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-soft">
        {loading ? (
          <p className="py-12 text-center text-[12px] font-semibold text-ink-soft/60">正在加载文件…</p>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13px] font-bold text-ink">还没有文件</p>
            <p className="mt-1 text-[11.5px] text-ink-soft/65">上传答题卡照片后，这里会显示</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-100 bg-brand-50/60 text-[11px] font-bold text-ink-soft">
                <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={items.length > 0 && picked.length === items.length} onChange={(e) => setPicked(e.target.checked ? items.map((f) => f.fileId) : [])} /></th>
                <th className="px-4 py-2.5 text-left">文件ID</th>
                <th className="px-4 py-2.5 text-left">名称</th>
                <th className="px-4 py-2.5 text-left">类型</th>
                <th className="px-4 py-2.5 text-left">时间</th>
                <th className="px-4 py-2.5 text-left">Hash</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.fileId} className="border-b border-brand-50 text-[12px] hover:bg-brand-50/40">
                  <td className="px-3 py-2.5"><input type="checkbox" checked={picked.includes(f.fileId)} onChange={(e) => setPicked((cur) => e.target.checked ? [...cur, f.fileId] : cur.filter((x) => x !== f.fileId))} /></td>
                  <td className="px-4 py-2.5 font-black text-ink-soft/50">{f.fileId}</td>
                  <td className="max-w-[280px] truncate px-4 py-2.5 font-semibold text-ink">{f.name}</td>
                  <td className="px-4 py-2.5 uppercase text-ink-soft/70">{f.suffix || '—'}</td>
                  <td className="px-4 py-2.5 text-ink-soft/60">{fmtTime(f.uTime)}</td>
                  <td className="max-w-[160px] truncate px-4 py-2.5 font-mono text-[10.5px] text-ink-soft/45">{f.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {gradeMsg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[11.5px] font-semibold text-emerald-700">{gradeMsg}</p>}

      {gradeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onClick={() => !grading && setGradeOpen(false)}>
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-black text-ink">批改到考试</h3>
            <p className="mt-1 text-[11px] text-ink-soft/65">已选 {picked.length} 个文件；批改结果会写入该考试的成绩。</p>
            <select className="mt-3 w-full rounded-xl border border-brand-200 px-3 py-2 text-[12px]" value={gradeExam} onChange={(e) => setGradeExam(e.target.value)}>
              <option value="">选择考试</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setGradeOpen(false)} disabled={grading}>取消</Button>
              <Button
                disabled={!gradeExam || grading}
                onClick={async () => {
                  setGrading(true)
                  try {
                    const r = await examsApi.grade(Number(gradeExam), picked)
                    setGradeMsg(`批改完成：成功 ${r.successCount}，失败 ${r.failureCount}，总分 ${r.totalScore}`)
                    setPicked([])
                    setGradeOpen(false)
                  } catch (e) {
                    setGradeMsg(errorText(e))
                  } finally {
                    setGrading(false)
                  }
                }}
              >
                {grading ? '批改中…' : '开始批改'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {items.length < total && (
        <button
          type="button"
          onClick={() => void load(items.length, true)}
          disabled={more}
          className="w-full rounded-xl border border-brand-200 bg-white py-2.5 text-[12px] font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
        >
          {more ? '正在加载…' : `加载更多（还剩 ${total - items.length} 个）`}
        </button>
      )}
    </div>
  )
}
