import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorText, papersApi, type PaperSummary } from '../m/api'
import { validatePaperName } from '../lib/paperName'

export default function PapersPage() {
  const nav = useNavigate()
  const [rows, setRows] = useState<PaperSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const list = await papersApi.list()
      setRows(list)
    } catch (e) {
      setErr(errorText(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function create() {
    if (busy) return
    const bad = validatePaperName(name, rows.map((r) => r.name))
    if (bad) {
      setErr(bad)
      return
    }
    const n = name.trim()
    setBusy(true)
    setErr('')
    try {
      const p = await papersApi.create(n)
      setName('')
      nav(`/papers/${p.id}/edit`)
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number, paperName: string) {
    if (!window.confirm(`删除试卷「${paperName}」？内容不可恢复。`)) return
    try {
      await papersApi.remove(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      setErr(errorText(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">试卷库</h1>
          <p className="mt-1 text-[12px] text-ink-soft/70">从模板一键出卡、精调题区、打印或存 PDF；也可直接新建空白试卷</p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-200/70 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create()
            }}
            placeholder="空白试卷名称，回车创建"
            maxLength={100}
            className="min-w-[220px] flex-1 rounded-xl border border-brand-200/80 bg-white px-3 py-2 text-[12px] font-semibold text-ink outline-none placeholder:text-ink-soft/45"
          />
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2 text-[12px] font-bold text-white shadow-soft disabled:opacity-60"
          >
            {busy ? '创建中…' : '新建试卷'}
          </button>
          <button
            type="button"
            onClick={() => nav('/papers/studio')}
            className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-2 text-[12px] font-bold text-brand-700"
          >
            答题卡制作
          </button>
          <button
            type="button"
            onClick={() => nav('/papers/templates')}
            className="rounded-xl border border-brand-200 bg-white px-4 py-2 text-[12px] font-bold text-brand-700"
          >
            条形码制作
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-brand-200 bg-white px-4 py-2 text-[12px] font-bold text-brand-700"
          >
            刷新
          </button>
        </div>
        {err && false && <p className="mt-2 text-[11.5px] font-semibold text-amber-700">{err}</p>}
      </div>

      {loading ? (
        <p className="py-14 text-center text-[12px] font-semibold text-ink-soft/60">正在加载试卷…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-brand-200/70 bg-white py-14 text-center">
          <p className="text-[13px] font-bold text-ink">还没有试卷</p>
          <p className="mt-1 text-[11.5px] text-ink-soft/65">上面输入名字就能建一张空白答题卡</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <div key={p.id} className="rounded-2xl border border-brand-200/70 bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-ink">{p.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft/55">#{p.id}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => nav(`/papers/${p.id}/edit`)}
                  className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11.5px] font-bold text-brand-700"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => nav(`/papers/${p.id}/print`)}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11.5px] font-bold text-neutral-700"
                >
                  打印预览
                </button>
                <button
                  type="button"
                  onClick={() => void remove(p.id, p.name)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11.5px] font-bold text-rose-600"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
