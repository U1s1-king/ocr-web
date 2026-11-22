import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { IcChart, IcHome, IcLayers, IcSearch, IcUsers } from './icons'
import { initTheme } from './theme'
import SearchPanel from './SearchPanel'
import { ScrollFx } from '../components/ScrollFx'
import { useVisualPrefs } from '../lib/visualPrefs'

const TABS = [
  { to: '/m', label: '首页', Icon: IcHome, match: (p: string) => p === '/m' },
  {
    to: '/m/papers',
    label: '试卷',
    Icon: IcLayers,
    match: (p: string) => p.startsWith('/m/papers'),
  },
  {
    to: '/m/results',
    label: '成绩',
    Icon: IcChart,
    match: (p: string) => p.startsWith('/m/results'),
  },
  {
    to: '/m/mine',
    label: '我的',
    Icon: IcUsers,
    match: (p: string) =>
      p.startsWith('/m/mine') ||
      p.startsWith('/m/theme') ||
      p.startsWith('/m/history') ||
      p.startsWith('/m/settings') ||
      p.startsWith('/m/logs'),
  },
]

export default function MobileShell() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [searching, setSearching] = useState(false)
  const visual = useVisualPrefs()

  function haptic() {
    try { navigator.vibrate?.(6) } catch { /* ignore */ }
  }

  useEffect(() => initTheme(), [])

  useEffect(() => {
    const open = () => setSearching(true)
    window.addEventListener('mo:search', open)
    return () => window.removeEventListener('mo:search', open)
  }, [])

  return (
    <div className="mo-shell">
      <motion.div
        key={pathname}
        className="mo-scroll"
        initial={visual.motion ? { opacity: 0, y: 14 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.div>
      <ScrollFx scope="mobile" />

      <div className="mo-dock-wrap">
        <nav className="mo-dock" aria-label="底部导航">
          {TABS.map(({ to, label, Icon, match }) => (
            <DockItem key={to} label={label} active={match(pathname)} onClick={() => { haptic(); nav(to) }}>
              <Icon style={{ fontSize: 18 }} />
            </DockItem>
          ))}
        </nav>
        <button
          type="button"
          className="mo-dock-search"
          aria-label="搜索功能与文件"
          onClick={() => { haptic(); setSearching(true) }}
        >
          <IcSearch style={{ fontSize: 20 }} />
        </button>
      </div>

      <SearchPanel open={searching} onClose={() => setSearching(false)} />
    </div>
  )
}

function DockItem({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="mo-dock-item"
      data-active={active}
      aria-label={label}
      onClick={onClick}
    >
      <span className="mo-dock-ico">{children}</span>
      {label}
    </button>
  )
}
