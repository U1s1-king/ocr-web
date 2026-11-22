import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronRightIcon, CloseIcon, MenuIcon, ScanIcon } from './icons'
import { Logo } from './Logo'
import { AccountDialog } from './AccountDialog'
import { useAccount } from '../lib/account'
import { ACCOUNT_AVATAR_IDB, hydrateAccountAvatar, resolveAccountAvatar } from '../lib/accountAvatar'
import { BRAND } from '../lib/brand'
import { MODULES, MODULE_GROUPS, type ModuleDef } from '../lib/modules'
import type { ModuleIconKey } from '../lib/modules'
import { MODULE_ICONS } from './moduleIcons'
import { motion } from 'framer-motion'
import { ParticleField } from './ParticleField'
import { WebOrnament } from './Ornament'
import { ScrollFx } from './ScrollFx'
import { useVisualPrefs } from '../lib/visualPrefs'

/** 二级导航：把八大模块里的每一项都落到具体的桌面路由上（键必须与 MODULES 的 id 一致） */
const SECONDARY: Record<string, { to: string; label: string }[]> = {
  papers: [
    { to: '/papers', label: '试卷库' },
    { to: '/papers/bundle', label: '统一试卷预览' },
    { to: '/papers/studio', label: '答题卡制作' },
    { to: '/papers/templates', label: '条形码制作' },

    { to: '/papers/dsl', label: '文本出卡' },
  ],
  exams: [
    { to: '/exams', label: '考试列表' },
    { to: '/exams/new', label: '新建考试' },
    { to: '/exams/batches', label: '考试批次' },
    { to: '/check', label: '上传批改' },
    { to: '/check/history', label: '识别记录' },
  ],
  results: [
    { to: '/results', label: '成绩分析' },
  ],
  reviews: [
    { to: '/reviews', label: '复核队列' },
  ],
  files: [
    { to: '/files', label: '文件库' },
  ],
  students: [
    { to: '/students', label: '学生名册' },
    { to: '/students/import', label: '批量导入' },
  ],
  logs: [
    { to: '/logs', label: '接口日志' },
  ],
  settings: [
    { to: '/settings', label: '接口配置' },
    { to: '/settings/diagnostics', label: '识别诊断' },
    { to: '/settings/theme', label: '主题配色' },
    { to: '/settings/advanced', label: '高级选项' },
    { to: '/settings/about', label: '关于系统' },
  ],
}

const CLIN = 'sidebarCollapsed'

/** 只取桌面路由：带 :id 这类占位符的子项跳过，缺省项回退到模块首页 */
function childrenOf(m: ModuleDef) {
  const curated = SECONDARY[m.id]
  if (curated && curated.length) return curated
  const own = m.children
    .filter((c) => c.to && !c.to.includes(':'))
    .map((c) => ({ to: c.to, label: c.label }))
  const uniq = own.filter((c, i) => own.findIndex((x) => x.to === c.to) === i)
  return uniq.length ? uniq : [{ to: m.to, label: m.label }]
}

export function Layout() {
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(CLIN) === '1')
  const loc = useLocation()
  const visual = useVisualPrefs()
  const account = useAccount()
  const [accountOpen, setAccountOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    let alive = true
    if (account.avatar === ACCOUNT_AVATAR_IDB) {
      void hydrateAccountAvatar().then((url) => { if (alive) setAvatarUrl(url) })
    } else {
      setAvatarUrl(resolveAccountAvatar(account.avatar))
    }
    return () => { alive = false }
  }, [account])

  useEffect(() => {
    setDrawer(false)
  }, [loc.pathname])

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawer])

  function toggleRail() {
    setCollapsed((v) => {
      localStorage.setItem(CLIN, v ? '0' : '1')
      return !v
    })
  }

  /** 当前落在哪个模块：先看路由，再回退到模块自己的 m 入口 */
  const activeId = useMemo(() => {
    const scored = MODULES.map((m) => {
      const kids = childrenOf(m)
      const hit = kids.some((k) => loc.pathname === k.to || loc.pathname.startsWith(k.to + '/'))
      const self = loc.pathname === m.m || loc.pathname.startsWith(m.m + '/')
      return { id: m.id, score: hit ? 2 : self ? 1 : 0 }
    })
    const best = scored.sort((a, b) => b.score - a.score)[0]
    return best?.score ? best.id : MODULES[0].id
  }, [loc.pathname])

  const current = MODULES.find((m) => m.id === activeId) ?? MODULES[0]

  const renderModule = (m: ModuleDef, on: boolean, compact: boolean) => {
    const Icon = MODULE_ICONS[m.icon as ModuleIconKey]
    return (
      <div key={m.id}>
        <NavLink
          to={childrenOf(m)[0]?.to ?? '/exams'}
          className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-300 ${
            on ? 'bg-brand-100 text-brand-800' : 'text-ink-soft hover:bg-brand-50 hover:text-ink'
          }`}
        >
          {on && <span className="absolute top-1/2 -left-2 h-6 w-1 -translate-y-1/2 rounded-full bg-brand-600" />}
          <Icon className={`h-[18px] w-[18px] shrink-0 ${on ? 'text-brand-700' : 'text-ink-soft/60'}`} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{m.label}</span>
            <span className="truncate text-[10px] font-normal text-ink-soft/50">{m.hint}</span>
          </span>
        </NavLink>

        {on && !compact && (
          <div className="anim-fade-up mt-1 ml-4 space-y-0.5 border-l border-brand-200/80 pl-3">
            {childrenOf(m).map((c) => (
              <NavLink
                key={c.to}
                to={c.to}
                className={({ isActive }) =>
                  `block rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-soft/70 hover:bg-brand-50/70 hover:text-ink'
                  }`
                }
              >
                {c.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-100/70 via-brand-50 to-brand-50 text-ink">
      <ParticleField enabled={visual.particles} />
      <WebOrnament />
      <ScrollFx scope="web" />
      {/* ===== 桌面侧栏 ===== */}
      <aside
        className={`site-sidebar fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col overflow-x-hidden overflow-y-auto border-r border-brand-200/80 bg-white/85 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] lg:flex ${
          collapsed ? 'sidebar-hidden' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 py-5">
          <Logo className="h-10 w-10 shrink-0" rounded="rounded-xl" glow />
          <span className="min-w-0">
            <span className="anim-fade-up block truncate text-[12px] font-bold tracking-wide">{BRAND.tagline}</span>
            <span className="block truncate text-[9px] tracking-[0.18em] text-ink-soft/45">{BRAND.pinyin}</span>
          </span>
        </div>

        <NavLink
          to="/m"
          className="switch-mobile-btn btn-press mx-2.5 mb-3 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold"
        >
          <ScanIcon className="h-4 w-4 shrink-0" />
          <span>切换到手机版</span>
        </NavLink>

        <nav className="stagger flex-1 space-y-1 overflow-y-auto px-2.5 pb-4">
          {MODULE_GROUPS.map((group) => (
            <div key={group.id} className="pt-2 first:pt-0">
              <p className="px-3 pb-1 text-[9px] font-bold tracking-[0.16em] text-ink-soft/40">{group.label}</p>
              {MODULES.filter((m) => group.ids.includes(m.id)).map((m) => renderModule(m, m.id === activeId, false))}
            </div>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <button type="button" className="sidebar-account" onClick={() => setAccountOpen(true)}>
            <span className="sidebar-account-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : (account.name || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-bold text-ink">{account.name}</span>
              <span className="mt-0.5 block text-[9.5px] text-ink-soft/55">本地账号</span>
            </span>
            <span className="text-[9px] text-ink-soft/40">编辑</span>
          </button>
          <p className="mt-1 text-center text-[9px] text-ink-soft/30">八大模块 · {BRAND.version}</p>
        </div>
      </aside>

      {/* ===== 悬浮折叠按钮（桌面端）===== */}
      <button
        type="button"
        onClick={toggleRail}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        className={`sidebar-toggle-btn hidden lg:flex ${collapsed ? 'is-collapsed' : ''}`}
      >
        <ChevronRightIcon className={`h-4 w-4 text-brand-700 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {/* ===== 移动顶栏 ===== */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-brand-200/70 bg-white/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="btn-press rounded-xl border border-brand-200 p-2 text-ink-soft"
          aria-label="打开菜单"
        >
          <MenuIcon className="h-4 w-4" />
        </button>
        <Logo className="h-8 w-8 shrink-0" rounded="rounded-lg" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold leading-tight">{current.label}</span>
          <span className="block truncate text-[9px] tracking-[0.14em] text-ink-soft/45">{BRAND.pinyin} · {BRAND.tagline}</span>
        </span>
        <NavLink
          to="/m"
          className="btn-press ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-3 py-2 text-[11.5px] font-bold text-white brand-shadow"
        >
          <ScanIcon className="h-3.5 w-3.5" />
          手机版
        </NavLink>
      </header>

      {/* ===== 移动抽屉 ===== */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="anim-backdrop-in absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <aside className="anim-drawer-in absolute inset-y-0 left-0 flex w-[78%] max-w-[300px] flex-col bg-white shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-brand-100 px-4 py-4">
              <Logo className="h-9 w-9 shrink-0" rounded="rounded-xl" />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-bold">{BRAND.tagline}</span>
                <span className="block truncate text-[9px] tracking-[0.18em] text-ink-soft/45">{BRAND.pinyin}</span>
              </span>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="btn-press ml-auto rounded-lg p-1.5 text-ink-soft/60 hover:bg-brand-50"
                aria-label="关闭菜单"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <nav className="stagger flex-1 space-y-1 overflow-y-auto p-3">
              <NavLink
                to="/m"
                className="switch-mobile-btn btn-press mb-1 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[12.5px] font-bold"
              >
                <ScanIcon className="h-[18px] w-[18px]" />
                切换到手机版
              </NavLink>
              {MODULE_GROUPS.map((group) => (
                <div key={group.id} className="pt-2 first:pt-0">
                  <p className="px-3 pb-1 text-[9px] font-bold tracking-[0.16em] text-ink-soft/40">{group.label}</p>
                  {MODULES.filter((m) => group.ids.includes(m.id)).map((m) => renderModule(m, m.id === activeId, true))}
                </div>
              ))}
            </nav>

            <div className="px-4 pb-5">
              <p className="text-center text-[9px] text-ink-soft/30">八大模块 · {BRAND.version}</p>
            </div>
          </aside>
        </div>
      )}

      <main
        className={`transition-[padding] duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${
          collapsed ? 'lg:pl-0' : 'lg:pl-[240px]'
        }`}
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <motion.div
            key={loc.pathname}
            initial={visual.motion ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  )
}
