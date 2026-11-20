import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { errorText, examsApi, resultsApi, type ExamSummary, type ResultItem, type ResultSummary } from '../api'
import { readCache, writeCache } from '../cache'
import { IcChart, IcSliders, IcRefresh, IcSearch } from '../icons'
import { BarChart, DonutChart, LineChart, type Point } from '../charts'
import { StatsStrip } from '../StatsStrip'
import {
  Bar,
  Btn,
  Chip,
  Empty,
  ErrorBar,
  ListSkeleton,
  Page,
  Ring,
  Sheet,
  fmtTime,
  useLoad,
} from '../ui'

const FIRST = 20
const BATCH = 50

type Sort = 'time_desc' | 'time_asc' | 'score_desc' | 'score_asc'
type Band = 'all' | 'a' | 'b' | 'c' | 'd'
type View = 'list' | 'bar' | 'line' | 'donut'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'time_desc', label: '最新' },
  { key: 'time_asc', label: '最旧' },
  { key: 'score_desc', label: '高分' },
  { key: 'score_asc', label: '低分' },
]

const BANDS: { key: Band; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'a', label: '优秀' },
  { key: 'b', label: '良好' },
  { key: 'c', label: '及格' },
  { key: 'd', label: '待提高' },
]

const VIEWS: { key: View; label: string }[] = [
  { key: 'list', label: '明细' },
  { key: 'bar', label: '柱状' },
  { key: 'line', label: '折线' },
  { key: 'donut', label: '圆环' },
]

export default function Results() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const initialExam = Number(params.get('examId')) || null

  const [examIds, setExamIds] = useState<number[]>(initialExam ? [initialExam] : [])
  const [sort, setSort] = useState<Sort>('time_desc')
  const [band, setBand] = useState<Band>('all')
  const initialView = params.get('view') as View | null
  const [view, setView] = useState<View>(
    initialView && VIEWS.some((v) => v.key === initialView) ? initialView : 'bar',
  )
  const [q, setQ] = useState('')
  const [total, setTotal] = useState(0)
  const [all, setAll] = useState<ResultItem[]>([])
  const [summary, setSummary] = useState<ResultSummary>({ resultCount: 0, averageScore: 0, maxScore: 0 })
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(false)
  const [tick, setTick] = useState(0)

  const [draftExams, setDraftExams] = useState<number[]>(examIds)
  const [draftBand, setDraftBand] = useState<Band>(band)
  const [draftSort, setDraftSort] = useState<Sort>(sort)
  const [draftQ, setDraftQ] = useState(q)

  const genRef = useRef(0)
  const accRef = useRef<ResultItem[]>([])
  const sumRef = useRef<ResultSummary>({ resultCount: 0, averageScore: 0, maxScore: 0 })
  const totalRef = useRef(0)
  const exams = useLoad<ExamSummary[]>(() => examsApi.list(), [], [])

  const examKey = examIds.join(',')
  const cacheKey = `results.stream.${examKey || 'all'}.${sort}`

  useEffect(() => {
    const gen = genRef.current + 1
    genRef.current = gen
    const useCache = tick === 0
    const cached = useCache
      ? readCache<{ items: ResultItem[]; summary: ResultSummary; total: number }>(cacheKey)
      : null
    const startItems = cached?.items ?? []
    accRef.current = startItems
    sumRef.current = cached?.summary ?? { resultCount: 0, averageScore: 0, maxScore: 0 }
    totalRef.current = cached?.total ?? 0
    setAll(startItems)
    setSummary(sumRef.current)
    setTotal(totalRef.current)
    setLoading(startItems.length === 0)
    setError('')

    if (cached && cached.total > 0 && startItems.length >= cached.total) {
      setStreaming(false)
      return
    }
    setStreaming(true)

    const order = {
      sortBy: [sort === 'time_desc' || sort === 'time_asc' ? 'uTime' : 'score'],
      sortDirection: [sort === 'time_asc' || sort === 'score_asc' ? 'asc' : 'desc'],
    }
    const page = (offset: number, limit: number) =>
      examIds.length
        ? resultsApi.list({ offset, limit, ...order, examIds })
        : resultsApi.listAll({ offset, limit, ...order })

    /* 网络数据先进队列，再逐条冒出来，做到拉一条显示一条 */
    const queue: ResultItem[] = []
    let pumping = false
    let stopped = false

    const pump = () => {
      if (pumping || stopped) return
      pumping = true
      const tickFn = () => {
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
        window.setTimeout(tickFn, 16)
      }
      tickFn()
    }

    ;(async () => {
      let offset = startItems.length
      let failed = false
      try {
        for (;;) {
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
      } catch (err) {
        if (stopped || gen !== genRef.current) return
        if (!cached) {
          setAll([])
          setSummary({ resultCount: 0, averageScore: 0, maxScore: 0 })
        }
        setError(errorText(err))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, tick])

  const maxRef = summary.maxScore || 100

  const bandOf = (score: number): Band => {
    const p = (score / Math.max(1, maxRef)) * 100
    if (p >= 85) return 'a'
    if (p >= 70) return 'b'
    if (p >= 60) return 'c'
    return 'd'
  }

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase()
    const list = all.filter((r) => {
      if (band !== 'all' && bandOf(r.score) !== band) return false
      if (key && !(r.candidateNumber ?? '').toLowerCase().includes(key)) return false
      return true
    })
    const sorted = [...list]
    if (sort === 'time_desc') sorted.sort((a, b) => b.uTime - a.uTime)
    if (sort === 'time_asc') sorted.sort((a, b) => a.uTime - b.uTime)
    if (sort === 'score_desc') sorted.sort((a, b) => b.score - a.score)
    if (sort === 'score_asc') sorted.sort((a, b) => a.score - b.score)
    return sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, band, q, sort, maxRef])

  const ranks = useMemo(() => {
    const byScore = [...filtered].sort((a, b) => b.score - a.score)
    const map = new Map<number, number>()
    byScore.forEach((r, idx) => {
      const prev = byScore[idx - 1]
      map.set(r.id, prev && prev.score === r.score ? (map.get(prev.id) ?? idx) : idx + 1)
    })
    return map
  }, [filtered])

  const bandData: Point[] = useMemo(
    () =>
      [
        { key: 'a' as Band, label: '优秀' },
        { key: 'b' as Band, label: '良好' },
        { key: 'c' as Band, label: '及格' },
        { key: 'd' as Band, label: '待提高' },
      ].map(({ key, label }) => ({
        label,
        value: filtered.filter((r) => bandOf(r.score) === key).length,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, maxRef],
  )

  const lineData: Point[] = useMemo(() => {
    const buckets = new Map<string, { sum: number; n: number; t: number }>()
    filtered.forEach((r) => {
      const d = new Date(r.uTime * 1000)
      const key = `${d.getMonth() + 1}/${d.getDate()}`
      const cur = buckets.get(key) ?? { sum: 0, n: 0, t: 0 }
      buckets.set(key, { sum: cur.sum + r.score, n: cur.n + 1, t: r.uTime })
    })
    return [...buckets.entries()]
      .sort((a, b) => a[1].t - b[1].t)
      .slice(-8)
      .map(([label, v]) => ({ label, value: Math.round(v.sum / v.n) }))
  }, [filtered])

  const donutData = bandData.filter((d) => d.value > 0)
  const examName = useMemo(() => {
    if (examIds.length === 0) return ''
    if (examIds.length === 1) return exams.data.find((e) => e.id === examIds[0])?.name ?? `考试 #${examIds[0]}`
    return `已选 ${examIds.length} 场考试`
  }, [examIds, exams.data])

  const condCount = examIds.length + (band !== 'all' ? 1 : 0) + (q.trim() ? 1 : 0)

  function openSheet() {
    setDraftExams(examIds)
    setDraftBand(band)
    setDraftSort(sort)
    setDraftQ(q)
    setSheet(true)
  }

  function apply() {
    setExamIds(draftExams)
    setBand(draftBand)
    setSort(draftSort)
    setQ(draftQ)
    setSheet(false)
  }

  function reset() {
    setDraftExams([])
    setDraftBand('all')
    setDraftSort('time_desc')
    setDraftQ('')
  }

  return (
    <Page
      title="成绩"
      sub="RESULTS"
      actions={
        <div className="flex gap-2">
          <button type="button" className="mo-icon-btn" aria-label="筛选" onClick={openSheet}>
            <IcSliders style={{ fontSize: 17 }} />
          </button>
          <button type="button" className="mo-icon-btn" aria-label="刷新" onClick={() => setTick((v) => v + 1)}>
            <IcRefresh style={{ fontSize: 17 }} />
          </button>
        </div>
      }
    >
      <section className="mo-hero">
        <div className="relative z-10">
          <p className="text-[10px] font-extrabold tracking-[.18em] text-white/70">
            {examName || '全部考试汇总'}
          </p>
          <div className="mt-2 flex items-end gap-3">
            <div>
              <p className="mo-num text-[36px] font-black leading-none">{Math.round(summary.averageScore || 0)}</p>
              <p className="mt-1 text-[10px] font-bold text-white/75">
                平均分 · {summary.resultCount} 份成绩
              </p>
            </div>
            <div className="ml-auto">
              <Ring value={summary.maxScore} max={maxRef} size={64} stroke={7} label={`${summary.maxScore}`} sub="最高" />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-3">
          <ErrorBar text={error} onRetry={() => setTick((v) => v + 1)} />
        </div>
      )}

      {/* 加载进度：边拉边显示 */}
      {(streaming || all.length > 0) && !error && (
        <div className="mo-card mt-3 !px-3.5 !py-2.5">
          <div className="flex items-center justify-between text-[11px] font-extrabold">
            <span className="text-ink-soft">
              {streaming ? (total > 0 ? `正在加载 ${all.length} / ${total} 条` : `已加载 ${all.length} 条 · 后台继续`) : `已全部加载 ${all.length} 条`}
            </span>
            {streaming && <span className="text-brand-700">后台填充中</span>}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-50">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${total ? Math.min(100, (all.length / total) * 100) : 12}%` }}
            />
          </div>
        </div>
      )}

      {/* 条件摘要 */}
      <button type="button" className="mo-card mt-3 !px-3.5 !py-2.5 text-left" onClick={openSheet}>
        <div className="flex items-center gap-2">
          <IcSliders style={{ fontSize: 14 }} className="text-brand-700" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold text-ink-soft">
            {condCount === 0 && sort === 'time_desc'
              ? '全部成绩 · 最新优先'
              : [
                  examIds.length ? `${examIds.length} 场考试` : '全部考试',
                  BANDS.find((b) => b.key === band)?.label,
                  SORTS.find((s) => s.key === sort)?.label,
                  q ? `考号含「${q}」` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </span>
          <span className="text-[11px] font-extrabold text-brand-700">筛选</span>
        </div>
      </button>

      <div className="mo-seg mt-3">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className="mo-seg-item flex-1"
            data-active={view === v.key}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <StatsStrip
        className="mt-3"
        items={[
          { label: '筛选成绩', value: filtered.length },
          {
            label: '平均分',
            value: filtered.length ? Math.round(filtered.reduce((s, r) => s + r.score, 0) / filtered.length) : 0,
          },
          { label: '最高分', value: summary.maxScore || 0 },
          {
            label: '优秀率',
            value: `${filtered.length ? Math.round(((bandData[0]?.value ?? 0) / filtered.length) * 100) : 0}%`,
          },
        ]}
      />

      {loading ? (
        <div className="mt-3">
          <ListSkeleton rows={5} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-3">
          <Empty
            icon={<IcChart style={{ fontSize: 24 }} />}
            title={all.length ? '没有符合条件的成绩' : '还没有成绩'}
            tip={all.length ? '换个分数段或清空考号试试' : '批改完答题卡后，成绩会出现在这里'}
          />
        </div>
      ) : view === 'bar' ? (
        <div className="mo-card mt-3">
          <p className="mo-eyebrow mb-3">分数段分布</p>
          <BarChart data={bandData} unit="" />
          <p className="mo-muted mt-2">基于当前 {filtered.length} 份成绩</p>
        </div>
      ) : view === 'line' ? (
        <div className="mo-card mt-3">
          <p className="mo-eyebrow mb-2">平均分走势</p>
          {lineData.length > 1 ? (
            <LineChart data={lineData} />
          ) : (
            <p className="mo-muted py-8 text-center">数据太少，至少两天的成绩才能画走势</p>
          )}
        </div>
      ) : view === 'donut' ? (
        <div className="mo-card mt-3">
          <p className="mo-eyebrow mb-3">分数段占比</p>
          <DonutChart data={donutData} centerValue={`${filtered.length}`} centerLabel="份成绩" />
          <p className="mo-muted mt-3">
            优秀 ≥85% · 良好 70–85% · 及格 60–70% · 待提高 &lt;60%（满分按 {maxRef} 计）
          </p>
        </div>
      ) : (
        <>
          <p className="mo-eyebrow mt-4 mb-2">明细 · {filtered.length} 条</p>
          <div className="space-y-2">
            {filtered.map((r, i) => {
              const exam = exams.data.find((e) => e.id === r.examId)
              const pct = Math.min(100, Math.round((r.score / Math.max(1, maxRef)) * 100))
              return (
                <button
                  key={r.id}
                  type="button"
                  className="mo-row mo-stagger w-full !bg-white !px-4 !py-3 text-left"
                  style={{ '--i': i } as React.CSSProperties}
                  onClick={() => nav(`/m/results/${r.id}`)}
                >
                  <span className="w-6 flex-none text-center text-[13px] font-black text-ink-soft/45">
                    {ranks.get(r.id) ?? i + 1}
                  </span>
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[#f2f4f7] text-[13px] font-black text-ink-soft">
                    {(r.candidateNumber ?? '卡').slice(-2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold text-ink">
                      {r.candidateNumber ?? '未知考号'}
                    </span>
                    <span className="mo-muted block truncate">
                      {exam?.name ?? `考试 #${r.examId}`} · {fmtTime(r.uTime)}
                    </span>
                    <span className="mt-1.5 block">
                      <Bar pct={pct} delay={i * 40} />
                    </span>
                  </span>
                  <span className="mo-btn-soft flex-none">{r.score} 分</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="筛选条件"
        footer={
          <div className="flex gap-2">
            <Btn variant="ghost" block onClick={reset}>
              清空
            </Btn>
            <Btn block onClick={apply}>
              应用筛选
            </Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mo-eyebrow mb-2">考试</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={draftExams.length === 0} onClick={() => setDraftExams([])}>
                全部
              </Chip>
              {exams.data.map((e) => (
                <Chip
                  key={e.id}
                  active={draftExams.includes(e.id)}
                  onClick={() =>
                    setDraftExams((list) =>
                      list.includes(e.id) ? list.filter((x) => x !== e.id) : [...list, e.id],
                    )
                  }
                >
                  {e.name.length > 10 ? `${e.name.slice(0, 10)}…` : e.name}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mo-eyebrow mb-2">分数段</p>
            <div className="flex flex-wrap gap-1.5">
              {BANDS.map((b) => (
                <Chip key={b.key} active={draftBand === b.key} onClick={() => setDraftBand(b.key)}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mo-eyebrow mb-2">排序</p>
            <div className="flex flex-wrap gap-1.5">
              {SORTS.map((s) => (
                <Chip key={s.key} active={draftSort === s.key} onClick={() => setDraftSort(s.key)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mo-eyebrow mb-2">考号</p>
            <div className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-white px-3 py-2.5">
              <IcSearch style={{ fontSize: 15 }} className="flex-none text-ink-soft/50" />
              <input
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="搜考号"
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-bold text-ink outline-none placeholder:text-ink-soft/45"
              />
              {draftQ && (
                <button type="button" className="text-[11px] font-bold text-brand-700" onClick={() => setDraftQ('')}>
                  清空
                </button>
              )}
            </div>
          </div>
        </div>
      </Sheet>
    </Page>
  )
}
