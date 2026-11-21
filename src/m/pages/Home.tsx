import { useNavigate } from 'react-router-dom'
import { resultsApi, type ResultItem, type ResultPage } from '../api'
import { BRAND } from '../../lib/brand'
import { MODULES, MODULE_GROUPS, MODULE_TONE, type ModuleIconKey } from '../../lib/modules'
import { MODULE_ICONS } from '../../components/moduleIcons'
import { LogoMark } from '../../components/Logo'
import { IcCamera, IcChart, IcFile, IcPlus, IcRight, IcSearch, IcUsers } from '../icons'
import { fmtTime, useCountUp, useLoad } from '../ui'

const QUICK = [
  { to: '/m/capture', label: '拍照批改', Icon: IcCamera },
  { to: '/m/papers', label: '试卷', Icon: IcFile },
  { to: '/m/results', label: '成绩', Icon: IcChart },
  { to: '/m/exams/new', label: '新建考试', Icon: IcPlus },
]

/** 移动端首页：功能入口页，按核心/资源/系统分组链接到各模块 */
export default function Home() {
  const nav = useNavigate()
  const results = useLoad<ResultPage>(
    () => resultsApi.listAll({ limit: 4, sortBy: ['uTime'], sortDirection: ['desc'] }),
    { items: [], total: 0, summary: { resultCount: 0, averageScore: 0, maxScore: 0 } },
    [],
    'results.recent',
  )
  const count = Math.round(useCountUp(results.data.summary.resultCount || 0, 700))

  function openSearch() {
    window.dispatchEvent(new Event('mo:search'))
  }

  return (
    <div className="mhome">
      <div className="mhome-head mo-stagger" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="mhome-date-row">
          <span className="mhome-date">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</span>
          <span className="mhome-status" data-state="ok">
            <i /> 功能入口
          </span>
        </div>
        <div className="mhome-title-row">
          <div className="min-w-0">
            <h1 className="mhome-title">功能入口</h1>
            <p className="mhome-sub">试卷、考试、成绩、复核，按模块进入</p>
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

      <button
        type="button"
        className="mhome-start mo-stagger"
        style={{ '--i': 1 } as React.CSSProperties}
        onClick={() => nav('/m/capture')}
      >
        <span className="mhome-start-ico">
          <IcCamera style={{ fontSize: 22 }} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[13px] font-extrabold">开始一次批改</span>
          <span className="mt-0.5 block text-[10.5px] text-white/70">拍照 / 上传答题卡，自动识别并出分</span>
        </span>
        <IcRight style={{ fontSize: 15 }} />
      </button>

      <div className="mo-sec-head mt-4 mb-2">
        <h2 className="mo-eyebrow">常用入口</h2>
      </div>
      <div className="mhome-quick mo-stagger" style={{ '--i': 2 } as React.CSSProperties}>
        {QUICK.map(({ to, label, Icon }) => (
          <button key={to} type="button" className="mhome-quick-item" onClick={() => nav(to)}>
            <span className="mhome-quick-ico">
              <Icon style={{ fontSize: 20 }} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="mo-sec-head mt-6 mb-2">
        <h2 className="mo-eyebrow">全部模块</h2>
        <span className="text-[11.5px] text-ink-soft">{MODULES.length} 个模块</span>
      </div>

      <div className="space-y-3">
        {MODULE_GROUPS.map((group, gi) => (
          <div key={group.id}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <p className="text-[10.5px] font-black tracking-[0.12em] text-ink-soft/60">{group.label}</p>
              <p className="text-[9.5px] text-ink-soft/40">{group.hint}</p>
            </div>
            <div className="mhome-modules">
              {MODULES.filter((m) => group.ids.includes(m.id)).map((m, i) => {
                const Icon = MODULE_ICONS[m.icon as ModuleIconKey]
                const tone = MODULE_TONE[m.tone]
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="mhome-module"
                    style={{ '--i': gi * 4 + i + 3 } as React.CSSProperties}
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
          </div>
        ))}
      </div>

      <div className="mo-sec-head mt-6 mb-2">
        <h2 className="mo-eyebrow">最近成绩</h2>
        <button type="button" className="text-[11.5px] text-ink-soft" onClick={() => nav('/m/results')}>
          查看全部
        </button>
      </div>
      {results.data.items.length === 0 ? (
        <button type="button" className="mhome-empty w-full" onClick={() => nav('/m/capture')}>
          <span className="mhome-empty-ico">
            <IcUsers style={{ fontSize: 19 }} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[12.5px] font-bold">还没有成绩</span>
            <span className="mt-0.5 block text-[10.5px] text-ink-soft">先去批改一份答题卡</span>
          </span>
          <IcRight style={{ fontSize: 13 }} className="text-ink-soft/50" />
        </button>
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
                <span className="mo-rank-sub block truncate">考试 #{r.examId} · {fmtTime(r.uTime)}</span>
              </span>
              <span className="mo-btn-soft flex-none">{r.score} 分</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 opacity-40">
        <LogoMark className="h-4 w-4" />
        <span className="text-[9.5px] tracking-[0.12em] text-ink-soft">{count} 份成绩 · {BRAND.pinyin}</span>
      </div>
      <div className="h-2" />
    </div>
  )
}
