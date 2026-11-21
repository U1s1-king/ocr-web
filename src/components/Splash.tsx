import { useEffect, useState } from 'react'
import { LogoMark } from './Logo'
import { BRAND } from '../lib/brand'

/** 开屏：极光 + 星尘 + 三层轨道 + 扫描徽章 + 进度 + 光圈爆开退场 */
const HOLD = 2250
const END = 3000

export function Splash() {
  const [pct, setPct] = useState(0)
  const [out, setOut] = useState(false)
  const [gone, setGone] = useState(false)
  // 调试用：#...splashstatic 时静态展示，方便截图核对
  const [frozen] = useState(() => window.location.href.includes('splashstatic'))

  useEffect(() => {
    if (window.location.href.includes('splashstatic')) return
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / (HOLD - 200))
      setPct(Math.round(100 * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t1 = window.setTimeout(() => setOut(true), reduce ? 700 : HOLD)
    const t2 = window.setTimeout(() => setGone(true), reduce ? 1100 : END)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  if (gone) return null

  return (
    <div className={`splash-root${frozen ? ' sp-static' : ''}`} data-out={out}>
      <div className="sp-veil">
        <span className="sp-aurora" />
        <span className="sp-grid" />
      </div>

      {/* 星尘 */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 38 }).map((_, i) => {
          const left = ((i * 47 + 13) % 94) + 3
          const top = ((i * 61 + 7) % 90) + 4
          const size = i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5
          return (
            <span
              key={i}
              className="sp-dust"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                animationDelay: `${(i % 9) * 0.23}s`,
                animationDuration: `${2.6 + (i % 5) * 0.5}s`,
              }}
            />
          )
        })}
      </div>

      {/* 流星 */}
      <span className="sp-meteor sp-meteor-1" />
      <span className="sp-meteor sp-meteor-2" />
      <span className="sp-meteor sp-meteor-3" />

      <div className="sp-stage">
        <div className="sp-core">
          <span className="sp-halo" />
          <span className="sp-ring sp-ring-1" />
          <span className="sp-ring sp-ring-2" />
          <span className="sp-ring sp-ring-3" />
          <span className="sp-comet sp-comet-1" />
          <span className="sp-comet sp-comet-2" />
          <span className="sp-comet sp-comet-3" />
          <span className="sp-comet sp-comet-4" />
          <span className="sp-badge">
            <span className="sp-badge-beam" />
            <span className="sp-seal" />
            <LogoMark className="sp-logo" animated />
          </span>
        </div>

        <div className="sp-copy">
          <p className="sp-word sp-word-1">{BRAND.name}</p>
          <p className="sp-word sp-word-2">{BRAND.pinyin}</p>
        </div>

        <div className="sp-progress">
          <span className="sp-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="sp-pct">{frozen ? '100' : pct}%</p>
      </div>

      <span className="sp-burst" />
    </div>
  )
}
