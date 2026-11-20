import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatTile } from '../components/PageHeader'
import { Button, Card, Empty } from '../components/ui'
import { AlertIcon, CheckIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '../components/icons'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { examsApi, papersApi, type ExamSummary, type PaperSummary } from '../m/api'

/**
 * 考试列表（桌面端）：只关心「考了什么」，试卷由创建考试时下拉绑定。
 * 与移动端 m/pages/Exams.tsx 功能一致，仅版式不同。
 */
export default function ExamListPage() {
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState<ExamSummary[]>([])
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([examsApi.list(), papersApi.list().catch(() => [] as PaperSummary[])])
      .then(([e, p]) => {
        if (!alive) return
        setRows(e)
        setPapers(p)
        setError('')
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [tick])

  const list = useMemo(
    () => rows.filter((e) => !q || e.name.includes(q) || (e.paperName ?? '').includes(q)),
    [rows, q],
  )

  async function remove(e: ExamSummary) {
    const ok = await confirm({
      title: `删除考试「${e.name}」？`,
      description: '会同时删除这场考试的全部成绩记录，试卷与文件不受影响。',
      confirmText: '删除考试',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await examsApi.remove(e.id)
      toast('考试已删除', 'ok')
      setTick((t) => t + 1)
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'err')
    }
  }

  const totalResults = rows.reduce((s, e) => s + (e.resultCount ?? 0), 0)
  const unbound = rows.filter((e) => !e.paperId).length

  return (
    <div>
      <PageHeader
        title="考试"
        desc="考试是一次批改活动，创建时选择已建好的试卷；试卷本身在「试卷」模块里独立维护。"
        crumb={[{ label: '首页', to: '/exams' }, { label: '考试' }]}
        extra={
          <Button onClick={() => nav('/exams/new')}>
            <PlusIcon className="h-4 w-4" />
            新建考试
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="考试总数" value={rows.length} />
        <StatTile label="成绩记录" value={totalResults} delay={60} />
        <StatTile label="可用试卷" value={papers.length} delay={120} />
        <StatTile label="未绑定试卷" value={unbound} tone={unbound ? 'warn' : 'ok'} delay={180} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="w-full max-w-[280px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-brand-400"
          placeholder="搜考试名、试卷名"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button variant="ghost" size="sm" onClick={() => nav('/exams/batches')}>
          考试批次
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setTick((t) => t + 1)}>
          刷新
        </Button>
      </div>

      {error && false && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          <AlertIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      {papers.length === 0 && rows.length === 0 && !loading && (
        <Card className="mb-4 border-amber-200 bg-amber-50/70">
          <p className="text-[12.5px] font-semibold text-amber-800">
            还没有试卷。考试要绑定试卷才有答案键可判分，
          </p>
          <Button className="mt-3" size="sm" onClick={() => nav('/papers')}>
            先去创建试卷
          </Button>
        </Card>
      )}

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-brand-200/70 bg-white" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty
          title={rows.length === 0 ? '还没有考试' : '没有匹配的考试'}
          hint={rows.length === 0 ? '建一场考试绑定试卷，就能开始批改了' : undefined}
          action={
            rows.length === 0 ? (
              <Button onClick={() => nav('/exams/new')}>
                <PlusIcon className="h-4 w-4" />
                新建考试
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-soft">
          {list.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-center gap-4 px-4 py-3.5 transition hover:bg-brand-50/60 ${
                i === list.length - 1 ? '' : 'border-b border-brand-100'
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckIcon className="h-4 w-4" />
              </span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => nav(`/exams/${e.id}`)}>
                <span className="block truncate text-[13px] font-semibold text-ink">{e.name}</span>
                <span className="mt-0.5 block truncate text-[11.5px] text-ink-soft">
                  {e.paperId ? `试卷：${e.paperName}` : '未绑定试卷'} · {e.resultCount ?? 0} 份成绩
                  {e.uTime ? ` · ${new Date(e.uTime).toLocaleDateString('zh-CN')}` : ''}
                </span>
              </button>
              {!e.paperId && (
                <span className="hidden shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700 sm:block">
                  待绑试卷
                </span>
              )}
              <button
                type="button"
                aria-label="删除考试"
                className="shrink-0 rounded-lg p-1.5 text-ink-soft/50 hover:bg-red-50 hover:text-red-600"
                onClick={() => void remove(e)}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="进入考试"
                className="shrink-0 rounded-lg p-1.5 text-ink-soft/50 hover:text-brand-700"
                onClick={() => nav(`/exams/${e.id}`)}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
