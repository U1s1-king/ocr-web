import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, StatTile } from '../components/PageHeader'
import { Badge, Button, Card, Empty } from '../components/ui'
import { AlertIcon, ArrowLeftIcon, ChevronRightIcon, ImageIcon, PlusIcon } from '../components/icons'
import { examsApi, type ExamResults, type ResultDetail } from '../m/api'

/** 考试详情（桌面端）：绑定的试卷 + 这份考试下的成绩 */
export default function ExamOverviewPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const eid = Number(id)

  const [data, setData] = useState<ExamResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!Number.isFinite(eid)) {
      setError('考试 id 不对')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    examsApi
      .results(eid)
      .then((r) => {
        if (!alive) return
        setData(r)
        setError('')
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [eid])

  const results: ResultDetail[] = data?.results ?? []
  const scores = results.map((r) => r.score ?? 0)
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const max = scores.length ? Math.max(...scores) : 0

  return (
    <div>
      <PageHeader
        title={data?.examName ?? `考试 #${eid}`}
        desc="这场考试绑定的试卷、已批改的成绩，以及批改入口。"
        crumb={[{ label: '考试', to: '/exams' }, { label: data?.examName ?? `#${eid}` }]}
        extra={
          <>
            <Button variant="ghost" size="sm" onClick={() => nav('/exams')}>
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              返回列表
            </Button>
            <Button size="sm" onClick={() => nav('/check')}>
              <PlusIcon className="h-3.5 w-3.5" />
              批量批改
            </Button>
          </>
        }
      />

      {error && false && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          <AlertIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="已批改" value={results.length} />
        <StatTile label="平均分" value={avg} delay={60} />
        <StatTile label="最高分" value={max} tone="ok" delay={120} />
        <StatTile label="绑定的试卷" value={data?.paperName ?? '未绑定'} tone={data?.paperId ? 'brand' : 'warn'} delay={180} />
      </div>

      <Card className="mb-5 flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <ImageIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">
            {data?.paperName ?? '这场考试还没绑定试卷'}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-soft">
            {data?.paperId
              ? `试卷 #${data.paperId}，版式与答案键在「试卷」模块里维护`
              : '没绑试卷就无法判分，去试卷模块建一张，再回来绑定'}
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={() => nav(data?.paperId ? `/papers/${data.paperId}/edit` : '/papers')}>
          {data?.paperId ? '打开试卷' : '去建试卷'}
        </Button>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-brand-100 bg-brand-50/60 px-4 py-2.5">
          <h3 className="text-[12px] font-bold text-ink">成绩</h3>
          <button
            type="button"
            className="text-[11.5px] text-ink-soft hover:text-brand-700"
            onClick={() => nav('/results')}
          >
            看总表 →
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-brand-50" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <Empty title="还没有成绩" hint="上传答题卡照片，批改后成绩会出现在这里" />
        ) : (
          results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => nav(`/results/${r.id}`)}
              className={`flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-brand-50/60 ${
                i === results.length - 1 ? '' : 'border-b border-brand-100'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-ink">{r.candidateNumber ?? '未知考号'}</span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-soft">文件 #{r.fileId}</span>
              </span>
              <Badge>{r.score}</Badge>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-soft/40" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
