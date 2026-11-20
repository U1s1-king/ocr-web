import { useNavigate } from 'react-router-dom'
import { examsApi, resultsApi, reviewsApi, type ExamSummary, type ResultItem, type ResultPage } from '../api'
import { BRAND } from '../../lib/brand'
import { MODULES, MODULE_TONE, type ModuleIconKey } from '../../lib/modules'
import { MODULE_ICONS } from '../../components/moduleIcons'
import { LogoMark } from '../../components/Logo'
import { IcCamera, IcChart, IcFile, IcPlus, IcRight, IcSearch, IcUpload, IcUsers } from '../icons'
import { fmtTime, useCountUp, useLoad } from '../ui'

const QUICK = [
  { to: '/m/capture', label: '拍照批改', Icon: IcCamera },
  { to: '/m/files', label: '上传批改', Icon: IcUpload },
  { to: '/m/exams/new', label: '新建考试', Icon: IcPlus },
  { to: '/m/results', label: '成绩分析', Icon: IcChart },
]

/**
 * 移动端首页：工作台 / 总入口
 * 视觉参照 vivo Today + 大厂 App 首页（大标题、搜索、Bento 卡、快捷入口、金刚区、列表）
 */
export default function Home() {
  const nav = useNavigate()

  const exams = useLoad<ExamSummary[]>(() => examsApi.list(), [] as ExamSummary[], [], 'exams.list')
  const results = useLoad<ResultPage>(
    () => resultsApi.listAll({ limit: 4, sortBy: ['uTime'], sortDirection: ['desc'] }),
    { items: [], total: 0, summary: { resultCount: 0, averageScore: 0, maxScore: 0 } },
    [],
    'results.recent',
  )
  const reviews = useLoad(() => reviewsApi.list({ status: 'pending', limit: 1 }), [], [], 'reviews.pending')

  const summary = results.data.summary
  const avg = Math.round(useCountUp(summary.averageScore || 0, 800))
  const pendingExams = exams.data.filter((e) => e.resultCount === 0).length
  const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

  function openSearch() {
    window.dispatchEvent(new Event('mo:search'))
  }

  return (
    <div className="mhome">
      {/* 顶栏 */}
      <div className="mhome-head" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="mhome-date-row">
          <span className="mhome-date">{dateStr}</span>
        </div>
        <div className="mhome-title-row">
          <div className="min-w-0">
            <h1 className="mhome-title">工作台</h1>
            <p className="mhome-sub">试卷、考试、成绩与复核，一站式处理</p>
          </div>
          <button type="button" className="mhome-avatar" onClick={() => nav('/m/mine')} aria-label="我的">
            <LogoMark className="h-[26px] w-[26px]" />
          </button>
        </div>

        <button type="button" className="mhome-search" onClick={openSearch}>
          <IcSearch style={{ fontSize: 17 }} />
          <span>搜索试卷、考试、学生…</span>
        </button>
      </div>

      {/* 主行动卡 */}
      <section className="mhome-hero" style={{ '--i': 1 } as React.CSSProperties}>
        <span className="mhome-hero-bg" aria-hidden="true" />
        <svg className="mhome-hero-art" viewBox="0 0 240 180" aria-hidden="true">
          <path className="hero-line l1" d="M 6 152 C 64 94 132 168 234 88" />
          <path className="hero-line l2" d="M 18 170 C 88 132 158 184 238 126" />
          <rect className="hero-scan" x="6" y="20" width="228" height="1.2" rx="1" />
          <circle className="hero-dot" r="2.8">
            <animateMotion dur="4.5s" repeatCount="indefinite" path="M 6 152 C 64 94 132 168 234 88" />
          </circle>
          <circle className="hero-dot faint" r="7">
            <animateMotion dur="4.5s" repeatCount="indefinite" path="M 6 152 C 64 94 132 168 234 88" />
          </circle>
        </svg>
        <span className="mhome-hero-eyebrow">答题卡识别</span>
        <h2 className="mhome-hero-title">拍照，当场出分</h2>
        <p className="mhome-hero-desc">自动定位四角、识别涂卡、按答案键判分</p>
        <div className="mhome-hero-actions">
          <button type="button" className="mhome-hero-primary" onClick={() => nav('/m/capture')}>
            <IcCamera style={{ fontSize: 16 }} /> 立即拍照
          </button>
          <button type="button" className="mhome-hero-ghost" onClick={() => nav('/m/files')}>
            <IcUpload style={{ fontSize: 15 }} /> 批量上传
          </button>
        </div>
      </section>

      {/* 快捷入口 */}
      <div className="mo-sec-head mt-4 mb-2">
        <h2 className="mo-eyebrow">快捷入口</h2>
      </div>
      <div className="mhome-quick" style={{ '--i': 2 } as React.CSSProperties}>
        {QUICK.map(({ to, label, Icon }) => (
          <button key={to} type="button" className="mhome-quick-item" onClick={() => nav(to)}>
            <span className="mhome-quick-ico">
              <Icon style={{ fontSize: 20 }} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 数据概览 */}
      <div className="mhome-stats" style={{ '--i': 3 } as React.CSSProperties}>
        <button type="button" className="mhome-stat" onClick={() => nav('/m/results')}>
          <b className="mo-num">{summary.resultCount}</b>
          <span>已存成绩</span>
        </button>
        <button type="button" className="mhome-stat" onClick={() => nav('/m/results')}>
          <b className="mo-num">{avg}</b>
          <span>平均分</span>
        </button>
        <button type="button" className="mhome-stat" onClick={() => nav('/m/exams')}>
          <b className="mo-num">{pendingExams}</b>
          <span>待批改</span>
        </button>
      </div>

      {/* 全部功能：金刚区 / 模块入口 */}
      <div className="mo-sec-head mt-6 mb-2.5">
        <h2 className="mo-eyebrow">全部功能</h2>
        <span className="text-[11.5px] text-ink-soft">{MODULES.length} 个模块</span>
      </div>
      <div className="mhome-modules">
        {MODULES.map((m, i) => {
          const Icon = MODULE_ICONS[m.icon as ModuleIconKey]
          const tone = MODULE_TONE[m.tone]
          return (
            <button
              key={m.id}
              type="button"
              className="mhome-module"
              style={{ '--i': i + 4 } as React.CSSProperties}
              onClick={() => nav(m.m)}
            >
              <span className="mhome-module-ico" style={{ background: tone.bg, color: tone.fg }}>
                <Icon className="h-[20px] w-[20px]" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="mhome-module-title">{m.label}</span>
                <span className="mhome-module-desc">{m.hint}</span>
              </span>
              <IcRight style={{ fontSize: 13 }} className="flex-none text-ink-soft/50" />
            </button>
          )
        })}
      </div>

      {/* 最近成绩 */}
      <div className="mo-sec-head mt-6 mb-2.5">
        <h2 className="mo-eyebrow">最近成绩</h2>
        <button type="button" className="text-[11.5px] text-ink-soft" onClick={() => nav('/m/results')}>
          查看全部
        </button>
      </div>
      {results.data.items.length === 0 ? (
        <div className="mhome-empty">
          <span className="mhome-empty-ico">
            <IcFile style={{ fontSize: 19 }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mhome-empty-title">还没有成绩</p>
            <p className="mhome-empty-desc">先去批改一份，成绩会出现在这里</p>
          </div>
          <button type="button" className="mo-btn-soft" onClick={() => nav('/m/capture')}>
            去批改
          </button>
        </div>
      ) : (
        <div className="mo-list">
          {results.data.items.map((r: ResultItem, i) => (
            <button
              key={r.id}
              type="button"
              className={`mo-list-row ${i === results.data.items.length - 1 ? 'is-last' : ''}`}
              onClick={() => nav(`/m/results/${r.id}`)}
            >
              <span className="mo-rank-num">{i + 1}</span>
              <span className="mo-rank-thumb">
                <IcChart style={{ fontSize: 19 }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="mo-rank-title block truncate">{r.candidateNumber ?? '未知考号'}</span>
                <span className="mo-rank-sub block truncate">
                  考试 #{r.examId} · {fmtTime(r.uTime)}
                </span>
              </span>
              <span className="mo-btn-soft flex-none">{r.score} 分</span>
            </button>
          ))}
        </div>
      )}

      {/* 待办 / 复核 */}
      <button type="button" className="mhome-todo" style={{ '--i': 12 } as React.CSSProperties} onClick={() => nav('/m/reviews')}>
        <span className="mhome-todo-ico">
          <IcUsers style={{ fontSize: 19 }} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="mhome-todo-title">待复核与待批改</span>
          <span className="mhome-todo-desc">
            {pendingExams} 场考试待批改{reviews.data.length > 0 ? ` · ${reviews.data.length} 条待复核` : ''}
          </span>
        </span>
        <span className="mhome-todo-go">
          去处理 <IcRight style={{ fontSize: 12 }} />
        </span>
      </button>


      <div className="mt-7 text-center">
        <p className="text-[10.5px] leading-relaxed text-ink-soft/60">「{BRAND.quote}」</p>
        <p className="mt-1 text-[9.5px] text-ink-soft/40">——{BRAND.source}</p>
        <div className="mt-2 flex items-center justify-center gap-1.5 opacity-40">
          <LogoMark className="h-4 w-4" />
          <span className="text-[9.5px] tracking-[0.14em] text-ink-soft">{BRAND.pinyin} · {MODULES.length} 模块</span>
        </div>
      </div>
    </div>
  )
}
