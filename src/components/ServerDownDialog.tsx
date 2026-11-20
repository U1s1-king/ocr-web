import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * 服务不可用提示：接口不通时统一弹一次，不再在每个页面写错误状态。
 * 具体原因只在「接口配置」页展示。
 */
export function ServerDownDialog() {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const loc = useLocation()
  const last = useRef(0)

  useEffect(() => {
    const onDown = () => {
      if (loc.pathname.startsWith('/settings') || loc.pathname.startsWith('/m/settings')) return
      const now = Date.now()
      if (now - last.current < 15000) return
      try {
        if (sessionStorage.getItem('ac.serverDownShown')) return
        sessionStorage.setItem('ac.serverDownShown', '1')
      } catch {
        /* ignore */
      }
      last.current = now
      setOpen(true)
    }
    window.addEventListener('api:server-down', onDown)
    return () => window.removeEventListener('api:server-down', onDown)
  }, [loc.pathname])

  // 接口配置页本身负责展示具体原因，进入后不再显示弹窗
  useEffect(() => {
    if (loc.pathname.startsWith('/settings') || loc.pathname.startsWith('/m/settings')) setOpen(false)
  }, [loc.pathname])

  if (!open) return null

  const mobile = loc.pathname.startsWith('/m')
  return createPortal(
    <div className="serverdown-mask" role="presentation" onClick={() => setOpen(false)}>
      <div className="serverdown" role="dialog" aria-modal="true" aria-label="服务不可用" onClick={(e) => e.stopPropagation()}>
        <svg className="serverdown-art" viewBox="0 0 200 120" aria-hidden="true">
          <ellipse cx="100" cy="104" rx="54" ry="8" fill="currentColor" opacity=".08" />
          <path d="M52 58c0-27 21-46 48-46s48 19 48 46" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M100 12v46" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M52 58h96c-8 10-18 14-30 14H82c-12 0-22-4-30-14Z" fill="currentColor" opacity=".12" />
          <circle cx="74" cy="84" r="10" fill="currentColor" opacity=".16" />
          <circle cx="110" cy="90" r="7" fill="currentColor" opacity=".12" />
          <path d="M66 80c4-4 12-4 16 0M104 86c3-3 9-3 12 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
        </svg>
        <h2 className="serverdown-title">服务器抽风去了，吃个瓜先</h2>
        <p className="serverdown-desc">后端服务暂时不可用，等它回来再试。</p>
        <div className="serverdown-actions">
          <button
            type="button"
            className="serverdown-btn ghost"
            onClick={() => setOpen(false)}
          >
            知道了
          </button>
          <button
            type="button"
            className="serverdown-btn primary"
            onClick={() => {
              setOpen(false)
              nav(mobile ? '/m/settings' : '/settings')
            }}
          >
            去接口配置
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
