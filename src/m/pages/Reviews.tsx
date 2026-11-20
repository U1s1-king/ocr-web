import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reviewsApi, type ReviewItem, type ReviewStatus, type ReviewType } from '../api'
import { MODULE_TONE } from '../../lib/modules'
import { IcAlert, IcCheck, IcPen, IcRight } from '../icons'
import { Chip, Empty, ErrorBar, Page, Segmented, useLoad } from '../ui'
import { StatsStrip } from '../StatsStrip'

const TYPE_LABEL: Record<ReviewType, string> = {
  objective_dispute: '客观题争议',
  subjective: '主观题评分',
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: '待处理',
  resolved: '已处理',
  ignored: '已忽略',
}

/** 「人工复核」二级页：待处理 / 已处理两栏，可再按类型筛 */
export default function Reviews() {
  const nav = useNavigate()
  const [status, setStatus] = useState<ReviewStatus>('pending')
  const [type, setType] = useState<ReviewType | 'all'>('all')

  const list = useLoad<ReviewItem[]>(
    () => reviewsApi.list({ status, limit: 50 }),
    [] as ReviewItem[],
    [status],
  )
  const tone = MODULE_TONE.rose

  const shown = list.data.filter((r) => type === 'all' || r.type === type)

  return (
    <Page
      title="人工复核"
      sub={`${list.data.length} 条${STATUS_LABEL[status]}`}
      back
    >
      <StatsStrip
        className="mb-3"
        items={[
          { label: '当前列表', value: list.data.length },
          { label: '待处理', value: status === 'pending' ? list.data.length : '—' },
          { label: '本次筛选', value: shown.length },
        ]}
      />

      <Segmented
        value={status}
        onChange={(v) => setStatus(v)}
        items={[
          { value: 'pending' as ReviewStatus, label: '待处理' },
          { value: 'resolved' as ReviewStatus, label: '已处理' },
          { value: 'ignored' as ReviewStatus, label: '已忽略' },
        ]}
      />

      <div className="mo-scroll-x mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
        <Chip active={type === 'all'} onClick={() => setType('all')}>
          全部
        </Chip>
        <Chip active={type === 'objective_dispute'} onClick={() => setType('objective_dispute')}>
          客观题争议
        </Chip>
        <Chip active={type === 'subjective'} onClick={() => setType('subjective')}>
          主观题评分
        </Chip>
      </div>

      {list.error && (
        <div className="mt-3">
          <ErrorBar text={list.error} onRetry={list.reload} />
        </div>
      )}

      <div className="mo-sec-head mt-5 mb-2.5">
        <h2 className="mo-eyebrow">复核队列</h2>
        <button type="button" className="text-[11.5px] text-ink-soft" onClick={list.reload}>
          刷新
        </button>
      </div>

      {list.loading && list.data.length === 0 ? (
        <div className="mo-card space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="mo-skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="mo-skeleton h-3 w-1/2" />
                <div className="mo-skeleton h-2.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Empty
          icon={<IcCheck style={{ fontSize: 22 }} />}
          title={status === 'pending' ? '队列是空的' : '这里还没有记录'}
          tip={
            status === 'pending'
              ? '识别有疑问的题目会自动进这个队列，处理完就清空了'
              : '处理过的条目会归档到这里，方便复查'
          }
        />
      ) : (
        <div className="mo-list">
          {shown.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`mo-list-row ${i === shown.length - 1 ? 'is-last' : ''}`}
              onClick={() => nav(`/m/reviews/${r.id}`)}
            >
              <span
                className="grid h-9 w-9 flex-none place-items-center rounded-[11px]"
                style={{ background: tone.bg, color: tone.fg }}
              >
                <IcPen style={{ fontSize: 16 }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">
                  {TYPE_LABEL[r.type] ?? r.type}
                  {r.questionId ? ` · 第 ${r.questionId} 题` : ''}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-soft">
                  {r.candidateNumber ?? '未知考号'}
                  {r.examName ? ` · ${r.examName}` : ''}
                  {r.reason ? ` · ${r.reason}` : ''}
                </span>
              </span>
              <IcRight style={{ fontSize: 13 }} className="flex-none text-ink-soft/50" />
            </button>
          ))}
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-soft">
        <IcAlert style={{ fontSize: 13, marginTop: 2 }} />
        判定会直接改写对应成绩的逐题得分，改完建议回成绩详情确认一次。
      </p>
    </Page>
  )
}
