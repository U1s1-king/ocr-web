import { useEffect, useMemo, useRef, useState } from 'react'
import { readCache, writeCache } from '../m/cache'
import { errorText, examsApi, resultsApi, type ExamSummary, type ResultItem, type ResultSummary } from '../m/api'
import { BarChart, DonutChart, LineChart, type Point } from '../m/charts'
import { DownloadIcon } from '../components/icons'
import { downloadText } from '../lib/image'

type View = 'bar' | 'line' | 'donut' | 'list'
type Sort = 'time_desc' | 'score_desc' | 'score_asc'

type Filters = {
  examIds: number[]
  sort: Sort
  min: string
  max: string
  keyword: string
}

const DEFAULT_FILTERS: Filters = { examIds: [], sort: 'time_desc', min: '', max: '', keyword: '' }
const FIRST = 20
const BATCH = 50

const VIEWS: { key: View; label: string }[] = [
  { key: 'bar', label: '分数段' },
  { key: 'line', label: '走势' },
  { key: 'donut', label: '占比' },
  { key: 'list', label: '明细' },
]

const SORTS: { key: Sort; label: string }[] = [
  { key: 'time_desc', label: '最新优先' },
  { key: 'score_desc', label: '分数从高到低' },
  { key: 'score_asc', label: '分数从低到高' },
]

function fmtTime(v?: number) {
  if (!v) return '—'
  const d = new Date(v * 1000)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function ResultsPage() {
  const [exams, setExams] = useState<ExamSummary[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const [panel, setPanel] = useState(false)

  const [view, setView] = useState<View>('bar')
  const [all, setAll] = useState<ResultItem[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<ResultSummary>({ resultCount: 0, averageScore: 0, maxScore: 0 })
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [err, setErr] = useState('')

  const genRef = useRef(0)
  const accRef = useRef<ResultItem[]>([])
  const sumRef = useRef<ResultSummary>({ resultCount: 0, averageScore: 0, maxScore: 0 })
  const totalRef = useRef(0)

  useEffect(() => {
    examsApi
      .list()
      .then((list) => setExams(list))
      .catch(() => setExams([]))
  }, [])

  const cacheKey = `results.${filters.examIds.join(',') || 'all'}.${filters.sort}`

  useEffect(() => {
    const gen = genRef.current + 1
    genRef.current = gen
    setErr('')

    const cached = readCache<{ items: ResultItem[]; summary: ResultSummary; total: number }>(cacheKey)
    const startItems = cached?.items ?? []
    accRef.current = startItems
    sumRef.current = cached?.summary ?? { resultCount: 0, averageScore: 0, maxScore: 0 }
    totalRef.current = cached?.total ?? 0
    setAll(startItems)
    setTotal(totalRef.current)
    setSummary(sumRef.current)
    setLoading(startItems.length === 0)

    // 缓存已是全量：直接用，不打后端
    if (cached && cached.total > 0 && startItems.length >= cached.total) {
      setStreaming(false)
      return
    }
    setStreaming(true)

    const order = {
      sortBy: [filters.sort === 'time_desc' ? 'uTime' : 'score'],
      sortDirection: [filters.sort === 'score_asc' ? 'asc' : 'desc'],
    }
    const page = (offset: number, limit: number) =>
      filters.examIds.length
        ? resultsApi.list({ offset, limit, ...order, examIds: filters.examIds })
        : resultsApi.listAll({ offset, limit, ...order })

    /* ---- 逐条填充：网络回来的数据先进队列，再一条条冒到界面上 ---- */
    const queue: ResultItem[] = []
    let pumping = false
    let stopped = false

    const pump = () => {
      if (pumping || stopped) return
      pumping = true
      const tick = () => {
        if (stopped || gen !== genRef.current) {
          pumping = false
          return
        }
        if (!queue.length) {
          pumping = false
          return
        }
        const take = queue.splice(0, 3)
        accRef.current = accRef.current.concat(take)
        setAll(accRef.current)
        window.setTimeout(tick, 16)
      }
      tick()
    }

    ;(async () => {
      let offset = startItems.length
      let failed = false
      try {
        for (;;) {
          // 第一轮只取一小撮，让界面立刻有内容；后面两路并行预取
          const first = offset === startItems.length
          const limit = first ? FIRST : BATCH
          const reqs = first ? [page(offset, limit)] : [page(offset, limit), page(offset + limit, limit)]
          const rs = await Promise.all(reqs)
          if (stopped || gen !== genRef.current) return
          const r1 = rs[0]
          const r2 = rs[1] as typeof r1 | undefined
          const reported = r2?.total ?? r1.total ?? 0
          const totalN = reported > 0 ? reported : totalRef.current
          totalRef.current = totalN
          sumRef.current = r1.summary
          setTotal(totalN)
          setSummary(r1.summary)
          setLoading(false)
          const batch = rs.reduce<ResultItem[]>((acc2, r) => acc2.concat(r.items), [])
          if (!batch.length) break
          queue.push(...batch)
          pump()
          offset += batch.length
          if (reported > 0 && offset >= reported) break
          if (r1.items.length < limit) break
        }
      } catch (e) {
        failed = true
        if (stopped || gen !== genRef.current) return
        setErr(errorText(e))
        setLoading(false)
      } finally {
        if (!stopped && gen === genRef.current) {
          const finish = () => {
            if (stopped || gen !== genRef.current) return
            if (queue.length) {
              window.setTimeout(finish, 60)
              return
            }
            if (failed) {
              setStreaming(false)
              return
            }
            writeCache(cacheKey, {
              items: accRef.current,
              summary: sumRef.current,
              total: totalRef.current || accRef.current.length,
            })
            setStreaming(false)
          }
          finish()
        }
      }
    })()

    return () => {
      stopped = true
    }
  }, [cacheKey])

  function openPanel() {
    setDraft(filters)
    setPanel(true)
  }

  function apply() {
    setFilters({ ...draft, min: draft.min.trim(), max: draft.max.trim(), keyword: draft.keyword.trim() })
    setPanel(false)
  }

  function reset() {
    setDraft(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    setPanel(false)
  }

  function toggleExam(id: number) {
    setDraft((d) => ({
      ...d,
      examIds: d.examIds.includes(id) ? d.examIds.filter((x) => x !== id) : [...d.examIds, id],
    }))
  }

  const filtered = useMemo(() => {
    const kw = filters.keyword.toLowerCase()
    const min = filters.min === '' ? null : Number(filters.min)
    const max = filters.max === '' ? null : Number(filters.max)
    return all.filter((r) => {
      if (kw && !(r.candidateNumber ?? '').toLowerCase().includes(kw)) return false
      if (min !== null && Number.isFinite(min) && r.score < min) return false
      if (max !== null && Number.isFinite(max) && r.score > max) return false
      return true
    })
  }, [all, filters.keyword, filters.min, filters.max])

  const ranks = useMemo(() => {
    const sorted = [...all].sort((a, b) => b.score - a.score)
    const map = new Map<number, number>()
    let lastScore: number | null = null
    let lastRank = 0
    sorted.forEach((r, i) => {
      if (r.score !== lastScore) {
        lastRank = i + 1
        lastScore = r.score
      }
      map.set(r.id, lastRank)
    })
    return map
  }, [all])

  const maxRef = useMemo(() => {
    const scores = all.map((r) => r.score)
    return Math.max(1, summary.maxScore || 0, ...scores)
  }, [all, summary.maxScore])

  const bandData: Point[] = useMemo(() => {
    const pct = (s: number) => (s / maxRef) * 100
    const buckets = [0, 0, 0, 0]
    filtered.forEach((r) => {
      const p = pct(r.score)
      if (p >= 85) buckets[0] += 1
      else if (p >= 70) buckets[1] += 1
      else if (p >= 60) buckets[2] += 1
      else buckets[3] += 1
    })
    return [
      { label: '优秀', value: buckets[0] },
      { label: '良好', value: buckets[1] },
      { label: '及格', value: buckets[2] },
      { label: '待提高', value: buckets[3] },
    ]
  }, [filtered, maxRef])

  const donutData: Point[] = useMemo(() => {
    const t = bandData.reduce((s, d) => s + d.value, 0) || 1
    return bandData.map((d) => ({ label: d.label, value: Math.round((d.value / t) * 100) }))
  }, [bandData])

  const lineData: Point[] = useMemo(() => {
    const byExam = new Map<number, { sum: number; n: number }>()
    filtered.forEach((r) => {
      const cur = byExam.get(r.examId) ?? { sum: 0, n: 0 }
      cur.sum += r.score
      cur.n += 1
      byExam.set(r.examId, cur)
    })
    return [...byExam.entries()]
      .map(([id, v]) => ({
        id,
        label: (exams.find((e) => e.id === id)?.name ?? `#${id}`).slice(0, 6),
        value: Math.round((v.sum / v.n) * 10) / 10,
      }))
      .sort((a, b) => a.id - b.id)
      .map(({ label, value }) => ({ label, value }))
  }, [filtered, exams])

  const condCount =
    filters.examIds.length + (filters.min !== '' ? 1 : 0) + (filters.max !== '' ? 1 : 0) + (filters.keyword ? 1 : 0)

  /** 导出当前筛选结果为 CSV（名次 / 考号 / 考试 / 时间 / 分数） */
  function exportCsv() {
    if (filtered.length === 0) return
    const esc = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const head = '名次,考号,考试,识别时间,分数'
    const lines = filtered.map((r) =>
      [
        ranks.get(r.id) ?? '',
        r.candidateNumber ?? '',
        exams.find((e) => e.id === r.examId)?.name ?? `考试 #${r.examId}`,
        r.uTime ? new Date(r.uTime * 1000).toLocaleString('zh-CN', { hour12: false }) : '',
        r.score,
      ]
        .map(esc)
        .join(','),
    )
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    downloadText(`\ufeff${head}\r\n${lines.join('\r\n')}\r\n`, `成绩分析_${stamp}.csv`, 'text/csv;charset=utf-8')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">成绩分析</h1>
          <p className="mt-1 text-[12px] text-ink-soft/70">先设筛选条件，再看分布、走势与占比</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-brand-200/70 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-soft">
            共 {summary.resultCount || total || all.length} 份 · 平均 {Math.round(summary.averageScore || 0)} · 最高 {summary.maxScore || 0}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-brand-200/70 bg-white px-3 py-2 text-[12px] font-bold text-ink-soft transition hover:text-ink disabled:opacity-40"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            导出 CSV
          </button>
          <button
            type="button"
            onClick={openPanel}
            className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2 text-[12px] font-bold text-white shadow-[0_10px_24px_-16px_rgba(0,0,0,.5)]"
          >
            筛选条件{condCount > 0 ? ` · ${condCount}` : ''}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '成绩总数', value: summary.resultCount || total || all.length, hint: '含已加载与后台数据' },
          { label: '平均分', value: Math.round(summary.averageScore || 0), hint: '当前筛选范围' },
          { label: '最高分', value: summary.maxScore || 0, hint: '本场最高' },
          {
            label: '优秀率',
            value: `${filtered.length ? Math.round(((bandData[0]?.value ?? 0) / filtered.length) * 100) : 0}%`,
            hint: '优秀分数段占比',
          },
        ].map((k) => (
          <div key={k.label} className="stat-kpi">
            <p className="stat-kpi-label">{k.label}</p>
            <p className="stat-kpi-value">{k.value}</p>
            <p className="stat-kpi-hint">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-brand-50 p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition ${
                view === v.key ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-soft/70 hover:text-ink'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-semibold text-ink-soft/60">
          {filters.examIds.length
            ? `已选 ${filters.examIds.length} 场考试`
            : '全部考试'}
          {filters.min !== '' || filters.max !== '' ? ` · 分数 ${filters.min || '不限'}–${filters.max || '不限'}` : ''}
          {filters.keyword ? ` · 考号含「${filters.keyword}」` : ''}
        </span>
      </div>

      {/* 加载状态条：边拉边填 */}
      {(streaming || all.length > 0) && !err && (
        <div className="rounded-xl border border-brand-200/70 bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-ink-soft">
              {streaming ? (total > 0 ? `正在加载 ${all.length} / ${total} 条` : `已加载 ${all.length} 条 · 后台继续`) : `已全部加载 ${all.length} 条`}
            </span>
            {streaming && (
              <span className="ml-auto text-[10.5px] font-semibold text-brand-700">后台继续拉取，可先看已加载部分</span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-50">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${total ? Math.min(100, (all.length / total) * 100) : 12}%` }}
            />
          </div>
        </div>
      )}

      {loading && all.length === 0 ? (
        <div className="rounded-2xl border border-brand-200/70 bg-white p-10 text-center text-[12px] font-semibold text-ink-soft/60">
          正在加载第一批成绩…
        </div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-brand-200/70 bg-white p-10 text-center">
          <p className="text-[13px] font-bold text-ink">没有符合条件的成绩</p>
          <p className="mt-1 text-[11.5px] text-ink-soft/65">换个筛选条件试试</p>
        </div>
      ) : (
        <>
          {view === 'bar' && (
            <div className="rounded-2xl border border-brand-200/70 bg-white p-4 shadow-soft">
              <p className="mb-3 text-[12px] font-bold text-ink-soft">分数段分布</p>
              <BarChart data={bandData} unit="" />
              <p className="mt-2 text-[11px] text-ink-soft/60">基于当前 {filtered.length} 份成绩</p>
            </div>
          )}

          {view === 'line' && (
            <div className="rounded-2xl border border-brand-200/70 bg-white p-4 shadow-soft">
              <p className="mb-2 text-[12px] font-bold text-ink-soft">各场考试平均分</p>
              {lineData.length > 1 ? (
                <LineChart data={lineData} />
              ) : (
                <p className="py-10 text-center text-[12px] text-ink-soft/60">至少两场考试才能画走势</p>
              )}
            </div>
          )}

          {view === 'donut' && (
            <div className="rounded-2xl border border-brand-200/70 bg-white p-4 shadow-soft">
              <p className="mb-3 text-[12px] font-bold text-ink-soft">分数段占比</p>
              <DonutChart data={donutData} centerValue={`${filtered.length}`} centerLabel="份成绩" />
              <p className="mt-3 text-[11px] text-ink-soft/60">
                优秀 ≥85% · 良好 70–85% · 及格 60–70% · 待提高 &lt;60%（满分按 {maxRef} 计）
              </p>
            </div>
          )}

          {view === 'list' && (
            <div className="overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-soft">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-100 bg-brand-50/60 text-[11px] font-bold text-ink-soft">
                    <th className="px-4 py-2.5 text-left">名次</th>
                    <th className="px-4 py-2.5 text-left">考号</th>
                    <th className="px-4 py-2.5 text-left">考试</th>
                    <th className="px-4 py-2.5 text-left">时间</th>
                    <th className="px-4 py-2.5 text-right">分数</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-brand-50 text-[12px] transition hover:bg-brand-50/50">
                      <td className="px-4 py-2.5 font-black text-ink-soft/60">{ranks.get(r.id) ?? '—'}</td>
                      <td className="px-4 py-2.5 font-bold text-ink">{r.candidateNumber ?? '未知考号'}</td>
                      <td className="px-4 py-2.5 text-ink-soft/75">
                        {exams.find((e) => e.id === r.examId)?.name ?? `考试 #${r.examId}`}
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft/60">{fmtTime(r.uTime)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-brand-700">{r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="py-8 text-center text-[12px] text-ink-soft/60">没有符合筛选的成绩</p>
              )}
            </div>
          )}
        </>
      )}

      {/* 二级筛选弹窗 */}
      {panel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="anim-fade-up max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-black text-ink">筛选条件</h2>
              <button
                type="button"
                onClick={() => setPanel(false)}
                className="rounded-lg px-2 py-1 text-[12px] font-bold text-ink-soft"
              >
                关闭
              </button>
            </div>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-soft/50">考试</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, examIds: [] }))}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
                  draft.examIds.length === 0
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-neutral-200 text-ink-soft'
                }`}
              >
                全部考试
              </button>
              {exams.map((e) => {
                const on = draft.examIds.includes(e.id)
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleExam(e.id)}
                    className={`max-w-full truncate rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
                      on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-neutral-200 text-ink-soft'
                    }`}
                  >
                    {e.name}
                  </button>
                )
              })}
            </div>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-soft/50">分数区间</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={draft.min}
                onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
                inputMode="numeric"
                placeholder="最低分"
                className="w-full rounded-xl border border-brand-200 px-3 py-2 text-[12px] font-semibold text-ink outline-none"
              />
              <span className="text-[12px] text-ink-soft/50">—</span>
              <input
                value={draft.max}
                onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
                inputMode="numeric"
                placeholder="最高分"
                className="w-full rounded-xl border border-brand-200 px-3 py-2 text-[12px] font-semibold text-ink outline-none"
              />
            </div>

            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-soft/50">考号关键词</p>
            <input
              value={draft.keyword}
              onChange={(e) => setDraft((d) => ({ ...d, keyword: e.target.value }))}
              placeholder="例如 2026"
              className="mt-2 w-full rounded-xl border border-brand-200 px-3 py-2 text-[12px] font-semibold text-ink outline-none"
            />

            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-soft/50">排序</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, sort: s.key }))}
                  className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
                    draft.sort === s.key ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-neutral-200 text-ink-soft'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-[12px] font-bold text-ink-soft"
              >
                清空条件
              </button>
              <button
                type="button"
                onClick={apply}
                className="flex-[2] rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 py-2.5 text-[12px] font-bold text-white"
              >
                应用并重新加载
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
