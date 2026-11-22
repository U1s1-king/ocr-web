import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, StatTile } from '../components/PageHeader'
import { Badge, Button, Card, Empty, Spinner } from '../components/ui'
import { ArrowLeftIcon, ChevronRightIcon } from '../components/icons'
import { errorText } from '../api/client'
import { resultsApi, type ResultDetail } from '../m/api'

/** 桌面端成绩详情：GET /api/v1/exam-results/{id} */
export default function ResultDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const rid = Number(id)
  const [data, setData] = useState<ResultDetail | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(rid)) {
      setErr('成绩 id 不对')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    resultsApi
      .get(rid)
      .then((r) => {
        if (!alive) return
        setData(r)
        setErr('')
      })
      .catch((e) => alive && setErr(errorText(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [rid])

  const details = Object.entries(data?.details ?? {})

  return (
    <div className="anim-page-in space-y-4">
      <PageHeader
        title={data?.candidateNumber ? `成绩 · ${data.candidateNumber}` : `成绩 #${rid}`}
        desc={data ? `${data.examName ?? `考试 #${data.examId}`} · ${data.paperName ?? `试卷 #${data.paperId}`}` : '查看本次批改的逐题结果'}
        crumb={[{ label: '成绩', to: '/results' }, { label: `#${rid}` }]}
        extra={
          <Button variant="ghost" onClick={() => nav(-1)}>
            <ArrowLeftIcon className="h-3.5 w-3.5" /> 返回
          </Button>
        }
      />

      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">{err}</div>}

      {loading ? (
        <Card className="grid place-items-center py-16"><Spinner /></Card>
      ) : !data ? (
        <Card><Empty title="成绩不存在" hint="可能已被删除，或接口尚未同步" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="得分" value={data.score ?? 0} />
            <StatTile label="满分" value={data.maxScore ?? '—'} />
            <StatTile label="文件" value={`#${data.fileId}`} />
            <StatTile label="考试" value={`#${data.examId}`} />
          </div>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-black text-ink">逐题明细</h3>
              <Badge tone="mute">{details.length} 题</Badge>
            </div>
            {details.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-ink-soft/60">这次成绩没有逐题明细</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-brand-100">
                {details.map(([qid, d], i) => (
                  <div key={qid} className={`grid grid-cols-[90px_1fr_90px] items-center gap-2 px-3 py-2 text-[11.5px] ${i ? 'border-t border-brand-50' : ''}`}>
                    <span className="font-black text-ink-soft/60">{qid}</span>
                    <span className="min-w-0 truncate text-ink-soft">
                      {d.type === 'subjective' ? '主观题' : `作答 ${d.answer ?? '—'}`}
                      {d.expected ? ` · 正确答案 ${d.expected}` : ''}
                    </span>
                    <span className="text-right">
                      {d.uncertain ? <Badge tone="warn">待复核</Badge> : <Badge tone={d.correct === false ? 'err' : 'ok'}>{d.score ?? d.points ?? 0} 分</Badge>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => nav(`/exams/${data.examId}`)}>
              看考试详情 <ChevronRightIcon className="h-3 w-3" />
            </Button>
            <Button variant="ghost" onClick={() => nav('/results')}>
              返回成绩总表
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
