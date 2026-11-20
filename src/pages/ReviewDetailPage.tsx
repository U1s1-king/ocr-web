import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Card, Field, inputCls } from '../components/ui'
import { AlertIcon, ArrowLeftIcon, ImageIcon, SaveIcon } from '../components/icons'
import { useToast } from '../components/Toast'
import { reviewsApi, type ReviewItem } from '../m/api'

const TYPE_LABEL: Record<string, string> = {
  objective_dispute: '客观题争议',
  subjective: '主观题评分',
}

export default function ReviewDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const rid = Number(id)

  const [item, setItem] = useState<ReviewItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [img, setImg] = useState<string | null>(null)
  const [imgErr, setImgErr] = useState('')
  const [answer, setAnswer] = useState('')
  const [score, setScore] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!Number.isFinite(rid)) {
      setError('复核 id 不对')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    reviewsApi
      .get(rid)
      .then((r) => {
        if (!alive) return
        setItem(r)
        setAnswer(r.finalAnswer ?? r.aiAnswer ?? '')
        setScore(r.finalScore != null ? String(r.finalScore) : '')
        setError('')
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => alive && setLoading(false))

    reviewsApi
      .image(rid)
      .then((url) => alive && setImg(url))
      .catch((e) => alive && setImgErr(e instanceof Error ? e.message : '图片拉不下来'))

    return () => {
      alive = false
    }
  }, [rid])

  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img)
  }, [img])

  async function submit(status: 'resolved' | 'ignored') {
    if (!item) return
    setSaving(true)
    try {
      await reviewsApi.resolve(item.id, {
        status,
        finalAnswer: status === 'resolved' ? answer : undefined,
        finalScore: status === 'resolved' && score !== '' ? Number(score) : undefined,
      })
      toast(status === 'resolved' ? '判定已提交' : '已忽略这条', 'ok')
      nav('/reviews')
    } catch (e) {
      toast(e instanceof Error ? e.message : '提交失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="复核详情"
        desc="对照题目原图确认答案，判定后会改写这份成绩里该题的得分。"
        crumb={[{ label: '首页', to: '/exams' }, { label: '人工复核', to: '/reviews' }, { label: `#${rid}` }]}
        extra={
          <Button variant="ghost" size="sm" onClick={() => nav('/reviews')}>
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            返回队列
          </Button>
        }
      />

      {error && false && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          <AlertIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading && !item ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[420px] animate-pulse rounded-3xl border border-brand-200/70 bg-white" />
          <div className="h-[420px] animate-pulse rounded-3xl border border-brand-200/70 bg-white" />
        </div>
      ) : item ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* 左：原图 */}
          <Card className="p-3">
            {img ? (
              <img src={img} alt="题目裁剪图" className="block w-full rounded-2xl" />
            ) : (
              <div className="grid h-[380px] place-items-center rounded-2xl bg-brand-50/70 text-center text-[12px] text-ink-soft">
                <div>
                  <ImageIcon className="mx-auto h-7 w-7 text-brand-300" />
                  <p className="mt-2">{imgErr || '正在取题目原图…'}</p>
                  <p className="mt-1 text-[10.5px] text-ink-soft/60">接口 GET /reviews/{rid}/image</p>
                </div>
              </div>
            )}
          </Card>

          {/* 右：判定面板 */}
          <div className="space-y-4">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Badge tone={item.status === 'pending' ? 'warn' : 'mute'}>
                  {item.status === 'pending' ? '待处理' : item.status === 'resolved' ? '已处理' : '已忽略'}
                </Badge>
                <span className="text-[12px] font-semibold text-ink">{TYPE_LABEL[item.type] ?? item.type}</span>
                <span className="ml-auto text-[11px] text-ink-soft/60">#{item.id}</span>
              </div>

              <div className="space-y-2 text-[12px]">
                <Line k="考号" v={item.candidateNumber ?? '—'} />
                <Line k="题号" v={item.questionId ?? '—'} />
                <Line k="本地答案" v={item.localAnswer ?? '—'} />
                <Line k="AI 答案" v={item.aiAnswer ?? '—'} />
                <Line k="当前得分" v={item.finalScore != null ? String(item.finalScore) : '—'} />
                <Line k="满分" v={item.maxScore != null ? String(item.maxScore) : '—'} />
              </div>

              {item.reason && (
                <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-800">
                  <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {item.reason}
                </p>
              )}
            </Card>

            <Card>
              <Field label="最终答案" hint="客观题填选项，主观题可留空">
                <input className={inputCls} value={answer} onChange={(e) => setAnswer(e.target.value)} />
              </Field>

              <div className="mt-3">
                <Field label="最终得分" hint={item.maxScore != null ? `0 – ${item.maxScore}` : undefined}>
                  <input
                    className={`${inputCls} tabnum`}
                    value={score}
                    inputMode="decimal"
                    onChange={(e) => setScore(e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </Field>
              </div>

              <div className="mt-4 flex gap-2">
                <Button disabled={saving} onClick={() => void submit('resolved')}>
                  <SaveIcon className="h-3.5 w-3.5" />
                  {saving ? '提交中…' : '提交判定'}
                </Button>
                <Button variant="ghost" disabled={saving} onClick={() => void submit('ignored')}>
                  忽略
                </Button>
              </div>
            </Card>

            {item.resultId && (
              <Button variant="soft" className="w-full" onClick={() => nav(`/m/results/${item.resultId}`)}>
                查看这份成绩 →
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-100/70 pb-1.5 last:border-0">
      <span className="text-ink-soft/70">{k}</span>
      <span className="tabnum font-semibold text-ink">{v}</span>
    </div>
  )
}
