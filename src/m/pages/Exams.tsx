import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { examsApi, type ExamSummary } from '../api'
import { IcCalendar, IcLayers, IcPlus, IcRight, IcSearch } from '../icons'
import { DemoTag, Empty, ErrorBar, Page, Segmented, fmtTime, useLoad } from '../ui'
import { StatsStrip } from '../StatsStrip'

type Filter = 'all' | 'pending' | 'done'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待批改' },
  { value: 'done', label: '已出分' },
]

const FEATURES = [
  {
    key: 'new',
    eyebrow: '考试',
    title: '新建考试',
    desc: '绑定一张试卷，开始一场批改',
    to: '/m/exams/new',
    Icon: IcPlus,
    background: 'linear-gradient(135deg, color-mix(in srgb, var(--mo-accent) 92%, #0b1224), color-mix(in srgb, var(--mo-accent) 50%, #15203a))',
  },
  {
    key: 'capture',
    eyebrow: '批改',
    title: '批量批改',
    desc: '上传答题卡，一次处理整叠',
    to: '/m/capture',
    Icon: IcCalendar,
    background: 'linear-gradient(135deg, #3d7d6a, #245448)',
  },
  {
    key: 'batches',
    eyebrow: '批次',
    title: '考试批次',
    desc: '把多场考试组合成一次汇总',
    to: '/m/batches',
    Icon: IcLayers,
    background: 'linear-gradient(135deg, #8a6a3a, #5c4425)',
  },
] as const

/**
 * 考试页版式参照 vivo「表盘」页：
 * 精选专题横滑大卡 → 分段胶囊（周最热/最热/飙升）→ 排行榜式考试列表。
 */
export default function Exams() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const exams = useLoad<ExamSummary[]>(() => examsApi.list(), [] as ExamSummary[], [], 'exams.list')

  const list = useMemo(() => {
    return exams.data
      .filter((e) => (filter === 'pending' ? e.resultCount === 0 : filter === 'done' ? e.resultCount > 0 : true))
      .filter((e) => !q || e.name.includes(q) || e.paperName.includes(q))
  }, [exams.data, filter, q])

  return (
    <Page
      title="考试"
      sub={`${exams.data.length} 场 · 共 ${exams.data.reduce((s, e) => s + e.resultCount, 0)} 份成绩`}
      actions={
        <div className="flex items-center gap-2">
          {exams.demo && <DemoTag />}
          <button type="button" className="mo-icon-btn" aria-label="新建考试" onClick={() => nav('/m/exams/new')}>
            <IcPlus style={{ fontSize: 17 }} />
          </button>
        </div>
      }
    >
      {/* 精选专题：横滑大卡 */}
      <div className="mo-hscroll mo-carousel -mx-4 mt-1 px-4">
        {FEATURES.map((f) => (
          <button
            key={f.key}
            type="button"
            className="mo-feature-card"
            style={{ background: f.background }}
            onClick={() => nav(f.to)}
          >
            <span className="mo-feature-ico">
              <f.Icon style={{ fontSize: 19 }} />
            </span>
            <span className="text-[10.5px] font-semibold opacity-70">{f.eyebrow}</span>
            <span className="mo-feature-title">{f.title}</span>
            <span className="mo-feature-desc">{f.desc}</span>
          </button>
        ))}
      </div>

      <StatsStrip
        className="mt-3"
        items={[
          { label: '考试', value: exams.data.length },
          { label: '待批改', value: exams.data.filter((e) => e.resultCount === 0).length },
          { label: '已出分', value: exams.data.filter((e) => e.resultCount > 0).length },
          { label: '成绩', value: exams.data.reduce((s, e) => s + e.resultCount, 0) },
        ]}
      />

      {/* 分段胶囊 */}
      <div className="mt-4">
        <Segmented value={filter} items={FILTERS} onChange={setFilter} />
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-full bg-white px-3.5 py-2.5">
        <IcSearch style={{ fontSize: 15 }} className="flex-none text-ink-soft" />
        <input
          className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-ink-soft/80"
          placeholder="搜考试名、试卷名"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {exams.error && (
        <div className="mt-3">
          <ErrorBar text={exams.error} onRetry={exams.reload} />
        </div>
      )}

      <div className="mo-sec-head mt-5 mb-2.5">
        <h2 className="mo-eyebrow">全部考试</h2>
        <button type="button" className="text-[11.5px] text-ink-soft" onClick={exams.reload}>
          刷新
        </button>
      </div>

      {exams.loading && exams.data.length === 0 ? (
        <div className="mo-card space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="mo-skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="mo-skeleton h-3 w-2/3" />
                <div className="mo-skeleton h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : exams.data.length === 0 ? (
        <Empty
          icon={<IcCalendar style={{ fontSize: 22 }} />}
          title="还没有考试"
          tip="考试是批改和成绩的归属主体，先建一场"
        />
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-ink-soft">没有匹配的考试</p>
      ) : (
        <div className="mo-list">
          {list.map((e, i) => (
            <div
              key={e.id}
              className={`mo-list-row ${i === list.length - 1 ? 'is-last' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => nav(`/m/exams/${e.id}`)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') nav(`/m/exams/${e.id}`)
              }}
            >
              <span className="mo-rank-num">{i + 1}</span>
              <span className="mo-rank-thumb">
                <IcCalendar style={{ fontSize: 19 }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="mo-rank-title block truncate">{e.name}</span>
                <span className="mo-rank-sub block truncate">
                  {e.paperName} · {e.resultCount} 份 · {fmtTime(e.uTime)}
                </span>
              </span>
              <button
                type="button"
                className="mo-btn-soft flex-none"
                onClick={(ev) => {
                  ev.stopPropagation()
                  nav(e.resultCount === 0 ? '/m/capture' : `/m/exams/${e.id}`)
                }}
              >
                {e.resultCount === 0 ? '去批改' : '查看'}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[18px] bg-white py-3 text-[13px] text-ink-soft active:bg-[#fafbfc]"
        onClick={() => nav('/m/reviews')}
      >
        去看人工复核
        <IcRight style={{ fontSize: 13 }} />
      </button>
    </Page>
  )
}
