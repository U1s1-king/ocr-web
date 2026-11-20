import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatTile } from '../components/PageHeader'
import { Badge, Button, Empty } from '../components/ui'
import { AlertIcon, CheckCircleIcon, ChevronRightIcon } from '../components/icons'
import { reviewsApi, type ReviewItem, type ReviewStatus, type ReviewType } from '../m/api'

const TYPE_LABEL: Record<ReviewType, string> = {
  objective_dispute: '客观题争议',
  subjective: '主观题评分',
}

const STATUS_TABS: { value: ReviewStatus; label: string }[] = [
  { value: 'pending', label: '待处理' },
  { value: 'resolved', label: '已处理' },
  { value: 'ignored', label: '已忽略' },
]

function useReviewList(status: ReviewStatus) {
  const [data, setData] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    reviewsApi
      .list({ status, limit: 100 })
      .then((items) => {
        if (!alive) return
        setData(items)
        setError('')
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [status, tick])

  return { data, loading, error, reload: () => setTick((t) => t + 1) }
}

export default function ReviewsPage() {
  const nav = useNavigate()
  const [status, setStatus] = useState<ReviewStatus>('pending')
  const [type, setType] = useState<ReviewType | 'all'>('all')
  const { data, loading, error, reload } = useReviewList(status)

  const list = data.filter((r) => type === 'all' || r.type === type)
  const objective = data.filter((r) => r.type === 'objective_dispute').length
  const subjective = data.filter((r) => r.type === 'subjective').length

  return (
    <div>
      <PageHeader
        title="人工复核"
        desc="识别存疑的题目会进入队列，判定后直接改写对应成绩的逐题得分。"
        crumb={[{ label: '首页', to: '/exams' }, { label: '人工复核' }]}
        extra={
          <Button variant="ghost" onClick={reload}>
            刷新
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="当前队列" value={data.length} delay={0} />
        <StatTile label="客观题争议" value={objective} tone="warn" delay={60} />
        <StatTile label="主观题评分" value={subjective} delay={120} />
        <StatTile label="状态" value={STATUS_TABS.find((s) => s.value === status)?.label ?? '—'} tone="ok" delay={180} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
              status === s.value
                ? 'bg-brand-600 text-white shadow-soft'
                : 'border border-brand-200 bg-white text-ink-soft hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-brand-200" />
        {(['all', 'objective_dispute', 'subjective'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
              type === t ? 'bg-brand-100 text-brand-800' : 'text-ink-soft hover:bg-brand-50'
            }`}
          >
            {t === 'all' ? '全部类型' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {error && false && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          <AlertIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading && list.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-brand-200/70 bg-white p-4">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-brand-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-brand-100" />
                <div className="h-2.5 w-2/3 animate-pulse rounded bg-brand-50" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty
          title={status === 'pending' ? '队列已清空' : '这里还没有记录'}
          hint={status === 'pending' ? '识别有疑问的题目会自动进这个队列' : '处理过的条目会归档到这里'}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-soft">
          {list.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => nav(`/reviews/${r.id}`)}
              className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-brand-50/60 ${
                i === list.length - 1 ? '' : 'border-b border-brand-100'
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <CheckCircleIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-ink">
                    {TYPE_LABEL[r.type] ?? r.type}
                    {r.questionId ? ` · 第 ${r.questionId} 题` : ''}
                  </span>
                  <Badge tone={r.status === 'pending' ? 'warn' : 'mute'}>
                    {r.status === 'pending' ? '待处理' : r.status === 'resolved' ? '已处理' : '已忽略'}
                  </Badge>
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-ink-soft">
                  {r.candidateNumber ?? '未知考号'}
                  {r.examName ? ` · ${r.examName}` : ''}
                  {r.reason ? ` · ${r.reason}` : ''}
                </span>
              </span>
              <span className="hidden shrink-0 text-[11px] text-ink-soft/60 sm:block">
                答案 {r.aiAnswer ?? r.localAnswer ?? '—'}
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-soft/40" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
