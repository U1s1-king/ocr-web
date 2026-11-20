import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { errorText } from './api'
import { IcBack, IcCheck, IcX } from './icons'

/* ---------------- 通用工具 ---------------- */

export function ripple(e: RPointerEvent<HTMLElement>) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 1.15
  const span = document.createElement('span')
  span.className = 'mo-ripple'
  span.style.width = `${size}px`
  span.style.height = `${size}px`
  span.style.left = `${e.clientX - rect.left - size / 2}px`
  span.style.top = `${e.clientY - rect.top - size / 2}px`
  el.appendChild(span)
  window.setTimeout(() => span.remove(), 620)
}

export function fmtTime(ts?: number | null): string {
  if (!ts) return '—'
  const diff = Date.now() - ts * (ts > 1e12 ? 1 : 1000)
  const m = Math.round(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} 天前`
  return new Date(ts > 1e12 ? ts : ts * 1000).toLocaleDateString('zh-CN')
}

export function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const from = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 2)
      setVal(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // 兜底：动画环境不可用（无 rAF/后台标签）时也落到真值
    const guard = window.setTimeout(() => setVal(target), duration + 200)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(guard)
    }
  }, [target, duration])
  return val
}

/* ---------------- 数据加载 ---------------- */

type LoadState<T> = { data: T; loading: boolean; error: string; demo: boolean }

import { readCache, writeCache } from './cache'

export function useLoad<T>(loader: () => Promise<T>, fallback: T, deps: unknown[] = [], cacheKey?: string) {
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<LoadState<T>>(() => {
    if (cacheKey) {
      const hit = readCache<T>(cacheKey)
      if (hit) return { data: hit, loading: false, error: '', demo: false }
    }
    return { data: fallback, loading: true, error: '', demo: false }
  })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: s.data === fallbackRef.current, error: '' }))
    loaderRef
      .current()
      .then((data) => {
        if (alive) {
          setState({ data, loading: false, error: '', demo: false })
          if (cacheKey) writeCache(cacheKey, data)
        }
      })
      .catch((err) => {
        if (alive) setState({ data: fallbackRef.current, loading: false, error: errorText(err), demo: true })
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, cacheKey])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

/* ---------------- 页面骨架 ---------------- */

export function Page({
  title,
  sub,
  back,
  actions,
  children,
  bare,
}: {
  title: string
  sub?: string
  back?: boolean
  actions?: ReactNode
  children: ReactNode
  bare?: boolean
}) {
  const nav = useNavigate()
  return (
    <div className={bare ? '' : 'mo-page'}>
      <div className="mo-top">
        {back && (
          <button type="button" className="mo-icon-btn" aria-label="返回" onClick={() => nav(-1)}>
            <IcBack style={{ fontSize: 18 }} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="mo-top-title truncate">{title}</h1>
          {sub && <p className="mo-top-sub mt-0.5 truncate">{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function Card({ children, className = '', delay, tap }: { children: ReactNode; className?: string; delay?: number; tap?: boolean }) {
  return (
    <div
      className={`mo-card ${tap ? 'mo-card-tap' : ''} ${delay !== undefined ? 'mo-stagger' : ''} ${className}`}
      style={delay !== undefined ? ({ '--i': delay } as CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}

export function Row({
  icon,
  title,
  sub,
  right,
  onClick,
  delay,
}: {
  icon?: ReactNode
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  onClick?: () => void
  delay?: number
}) {
  return (
    <button
      type="button"
      className={`mo-row ${delay !== undefined ? 'mo-stagger' : ''}`}
      style={delay !== undefined ? ({ '--i': delay } as CSSProperties) : undefined}
      onClick={onClick}
    >
      {icon && <span className="mo-row-ico">{icon}</span>}
      <span className="mo-row-main">
        <span className="mo-row-title block truncate">{title}</span>
        {sub && <span className="mo-row-sub block truncate">{sub}</span>}
      </span>
      {right}
    </button>
  )
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  const idx = Math.max(0, items.findIndex((x) => x.value === value))
  return (
    <div className="mo-seg" role="tablist">
      <span
        className="mo-seg-pill"
        style={{
          width: `calc((100% - 6px) / ${items.length})`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          className="mo-seg-item"
          data-active={it.value === value}
          onClick={() => onChange(it.value)}
        >
          {it.label}
          {typeof it.count === 'number' && <span className="ml-1 opacity-50">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  block,
  sm,
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'plain'
  block?: boolean
  sm?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const cls =
    variant === 'primary' ? 'mo-btn-primary' : variant === 'ghost' ? 'mo-btn-ghost' : ''
  return (
    <button
      type={type}
      className={`mo-btn ${cls} ${block ? 'mo-btn-block' : ''} ${sm ? 'mo-btn-sm' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** 参照里的「获取」：浅底小胶囊按钮，用在列表行右侧 */
export function SoftBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className="mo-btn-soft flex-none" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}


export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    document.body.classList.add('mo-sheet-open')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('mo-sheet-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <div className="mo-backdrop" onClick={onClose} />
      <div className="mo-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mo-sheet-grip" />
        <div className="mo-sheet-head">
          <h2 className="mo-h2">{title}</h2>
          <button type="button" className="mo-icon-btn" aria-label="关闭" onClick={onClose} style={{ width: 32, height: 32 }}>
            <IcX style={{ fontSize: 15 }} />
          </button>
        </div>
        <div className="mo-sheet-body">{children}</div>
        {footer && <div className="px-[18px] pt-2">{footer}</div>}
      </div>
    </>
  )
}

export function Empty({
  icon,
  title,
  tip,
  action,
}: {
  icon: ReactNode
  title: string
  tip?: string
  action?: ReactNode
}) {
  return (
    <div className="mo-empty mo-pop">
      <div className="mo-empty-ico">{icon}</div>
      <p className="text-[13px] font-extrabold text-ink">{title}</p>
      {tip && <p className="mo-muted mx-auto mt-1.5 max-w-[240px]">{tip}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Skeleton({ h = 14, w = '100%', r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <div className="mo-skeleton" style={{ height: h, width: w, borderRadius: r }} />
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mo-card space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton h={38} w={38} r={13} />
          <div className="flex-1 space-y-2">
            <Skeleton h={12} w={`${60 + (i % 3) * 12}%`} />
            <Skeleton h={9} w="38%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Ring({
  value,
  max = 100,
  size = 84,
  stroke = 7,
  label,
  sub,
  tone = 'accent',
}: {
  value: number
  max?: number
  size?: number
  stroke?: number
  label?: string
  sub?: string
  tone?: 'accent' | 'onDark'
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0))
  const n = useCountUp(value, 700)
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="mo-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === 'onDark' ? '#ffffff33' : '#eef0f3'}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === 'onDark' ? '#fff' : 'var(--mo-accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          opacity={0.85}
        />
      </svg>
      <div className="absolute text-center">
        <p className={`mo-num text-[18px] font-semibold leading-none ${tone === 'onDark' ? 'text-white' : 'text-ink'}`}>
          {label ?? Math.round(n)}
        </p>
        {sub && (
          <p className={`mt-1 text-[10px] font-normal ${tone === 'onDark' ? 'text-white/70' : 'text-ink-soft'}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}


export function Bar({ pct, delay }: { pct: number; delay?: number }) {
  return (
    <div className="mo-bar">
      <div
        className="mo-bar-fill"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%`, animationDelay: `${delay ?? 0}ms` }}
      />
    </div>
  )
}

export function StatTile({ num, label, delay }: { num: ReactNode; label: string; delay?: number }) {
  return (
    <div className="mo-tile mo-stagger" style={{ '--i': delay ?? 0 } as CSSProperties}>
      <p className="mo-tile-num mo-num">{num}</p>
      <p className="mo-tile-label">{label}</p>
    </div>
  )
}

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" className="mo-chip" data-active={active} onClick={onClick}>
      {children}
    </button>
  )
}

export function CheckDot({ on }: { on: boolean }) {
  return (
    <span className="mo-check" data-on={on}>
      <IcCheck style={{ fontSize: 13 }} />
    </span>
  )
}

/* 错误提示条：去掉橙色系告警配色，用中性灰底 + 一行小字 */
export function ErrorBar(_props: { text: string; onRetry?: () => void }) {
  // 统一交给全局「服务器抽风」弹窗，避免各页面重复出现错误条
  return null
}

export function DemoTag() {
  // 服务状态只在接口配置页与全局弹窗提示，这里不再展示额外标签
  return null
}

