import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { reviewsApi, type ReviewItem } from '../api'
import { IcAlert, IcCheck, IcRight } from '../icons'
import { Btn, Page, Skeleton, fmtTime, useLoad } from '../ui'

/** 单条复核：看题目图 → 给出判定 / 改分 */
export default function ReviewDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const rid = Number(id)

  const item = useLoad<ReviewItem | null>(() => (Number.isFinite(rid) ? reviewsApi.get(rid) : Promise.resolve(null)), null, [rid])
  const [img, setImg] = useState<string | null>(null)
  const [imgErr, setImgErr] = useState('')
  const [answer, setAnswer] = useState('')
  const [score, setScore] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!Number.isFinite(rid)) return
    let alive = true
    setImg(null)
    setImgErr('')
    reviewsApi
      .image(rid)
      .then((url) => alive && setImg(url))
      .catch((e) => alive && setImgErr(e instanceof Error ? e.message : '图片拉不下来'))
    return () => {
      alive = false
    }
  }, [rid])

  useEffect(() => {
    if (item.data) {
      setAnswer(item.data.finalAnswer ?? item.data.aiAnswer ?? '')
      setScore(item.data.finalScore != null ? String(item.data.finalScore) : '')
    }
  }, [item.data])

  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img)
  }, [img])

  async function submit(status: 'resolved' | 'ignored') {
    if (!item.data) return
    setSaving(true)
    try {
      await reviewsApi.resolve(item.data.id, {
        status,
        finalAnswer: status === 'resolved' ? answer : undefined,
        finalScore: status === 'resolved' && score !== '' ? Number(score) : undefined,
      })
      toast(status === 'resolved' ? '已提交判定' : '已忽略这条', 'ok')
      nav(-1)
    } catch (e) {
      toast(e instanceof Error ? e.message : '提交失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  const d = item.data

  return (
    <Page title="复核详情" sub={d ? `#${d.id} · ${fmtTime(d.uTime)}` : '加载中'} back>
      {item.error && <p className="mb-3 text-[12px] text-ink-soft">{item.error}</p>}

      {item.loading && !d ? (
        <div className="space-y-2.5">
          <Skeleton h={180} r={18} />
          <Skeleton h={44} r={14} />
          <Skeleton h={44} r={14} />
        </div>
      ) : d ? (
        <>
          <div className="overflow-hidden rounded-[18px] bg-white">
            {img ? (
              <img src={img} alt="题目裁剪图" className="block w-full" />
            ) : (
              <div className="grid h-[180px] place-items-center bg-[#f3f4f7] text-[12px] text-ink-soft">
                {imgErr || '正在取题目原图…'}
              </div>
            )}
          </div>

          <div className="mo-list mt-3">
            <Line label="类型" value={d.type === 'subjective' ? '主观题评分' : '客观题争议'} />
            <Line label="考号" value={d.candidateNumber ?? '—'} />
            <Line label="题目" value={d.questionId ?? '—'} />
            <Line label="本地答案" value={d.localAnswer ?? '—'} />
            <Line label="AI 答案" value={d.aiAnswer ?? '—'} />
            <Line label="当前得分" value={d.finalScore != null ? String(d.finalScore) : d.maxScore != null ? `满分 ${d.maxScore}` : '—'} last />
          </div>

          {d.reason && (
            <p className="mt-3 flex items-start gap-1.5 rounded-[14px] bg-[#f8eef0] px-3 py-2.5 text-[12px] leading-relaxed text-[#96606a]">
              <IcAlert style={{ fontSize: 13, marginTop: 2 }} />
              {d.reason}
            </p>
          )}

          <label className="mo-field mt-4 block">
            <span className="mo-field-label">最终答案</span>
            <input
              className="mo-input"
              value={answer}
              placeholder="客观题填选项，主观题可留空"
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>

          <label className="mo-field mt-3 block">
            <span className="mo-field-label">最终得分</span>
            <input
              className="mo-input mo-num"
              value={score}
              inputMode="decimal"
              placeholder={d.maxScore != null ? `0 – ${d.maxScore}` : '输入分数'}
              onChange={(e) => setScore(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </label>

          <div className="mt-4 flex gap-2">
            <Btn block variant="ghost" disabled={saving} onClick={() => void submit('ignored')}>
              忽略
            </Btn>
            <Btn block disabled={saving} onClick={() => void submit('resolved')}>
              <IcCheck style={{ fontSize: 15 }} />
              {saving ? '提交中…' : '提交判定'}
            </Btn>
          </div>

          {d.resultId && (
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-[18px] bg-white py-3 text-[13px] text-ink-soft active:bg-[#fafbfc]"
              onClick={() => nav(`/m/results/${d.resultId}`)}
            >
              看这份成绩
              <IcRight style={{ fontSize: 13 }} />
            </button>
          )}
        </>
      ) : (
        <div className="mo-card flex items-center gap-2 text-[12.5px] text-ink-soft">
          <IcAlert style={{ fontSize: 15 }} />
          没找到这条复核
        </div>
      )}
    </Page>
  )
}

function Line({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3.5 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      <span className="w-[68px] flex-none text-[12px] text-ink-soft">{label}</span>
      <span className="mo-num min-w-0 flex-1 truncate text-[13px] text-ink">{value}</span>
    </div>
  )
}
