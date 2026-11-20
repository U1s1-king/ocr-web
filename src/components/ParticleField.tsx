import { useEffect, useRef } from 'react'

interface P {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
}

interface Projected {
  x: number
  y: number
  z: number
  s: number
}

/**
 * Web 端 3D 粒子背景：
 * - 粒子在三维空间缓慢漂移并绕 Y 轴旋转，按 depth 缩放/调透明度
 * - 鼠标附近一定范围内的粒子自动连线，鼠标本身也有一个光点
 * - 支持开关（visualPrefs.particles），prefers-reduced-motion 时静止显示
 */
export function ParticleField({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!enabled) return
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia?.('(max-width: 1023px)').matches) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let running = true
    let angle = 0
    let accent = '#e06a8f'
    const mouse = { x: -9999, y: -9999, active: false }
    const particles: P[] = []

    const count = Math.min(170, Math.max(90, Math.round(window.innerWidth / 10)))
    const reset = () => {
      w = window.innerWidth
      h = window.innerHeight
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const seed = () => {
      particles.length = 0
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random(),
          vx: (Math.random() - 0.5) * 0.42,
          vy: (Math.random() - 0.5) * 0.32,
          vz: (Math.random() - 0.5) * 0.0016,
          size: 1 + Math.random() * 2.1,
        })
      }
    }

    const readAccent = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      if (/^#[0-9a-fA-F]{6}$/.test(v)) accent = v
    }

    // 全屏分布：屏幕坐标 + 不同 depth 的视差，保证粒子铺满整个可视区
    const project = (p: P): Projected => {
      const wobX = Math.sin(angle * 0.8 + p.z * 6.28) * (10 + p.z * 26)
      const wobY = Math.cos(angle * 0.55 + p.z * 4.2) * (8 + p.z * 22)
      return {
        x: p.x + wobX,
        y: p.y + wobY,
        z: p.z,
        s: 0.62 + p.z * 0.9,
      }
    }

    const draw = () => {
      if (!running) return
      ctx.clearRect(0, 0, w, h)
      const pts = particles.map(project)
      const rgb = hexToRgb(accent)
      const dark = rgb.split(',').map((n) => Math.round(Number(n) * 0.52)).join(',')

      // 粒子之间的弱连线（只连距离近的，避免糊成一片）
      for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d2 = dx * dx + dy * dy
          if (d2 > 136 * 136) continue
          const alpha = (1 - Math.sqrt(d2) / 136) * 0.13 * Math.min(pts[i].s, pts[j].s)
          ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(3)})`
          ctx.lineWidth = 0.7
          ctx.beginPath()
          ctx.moveTo(pts[i].x, pts[i].y)
          ctx.lineTo(pts[j].x, pts[j].y)
          ctx.stroke()
        }
      }

      // 鼠标连线
      if (mouse.active) {
        for (const p of pts) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const dist = Math.hypot(dx, dy)
          if (dist > 200) continue
          const alpha = (1 - dist / 200) * 0.72
          ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(3)})`
          ctx.lineWidth = 0.75
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.fillStyle = `rgba(${rgb},0.55)`
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.fillStyle = `rgba(${rgb},0.10)`
        ctx.arc(mouse.x, mouse.y, 24, 0, Math.PI * 2)
        ctx.fill()
      }

      // 粒子本体：越近越大、越亮
      for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i]
        const alpha = 0.3 + p.s * 0.4
        ctx.beginPath()
        ctx.fillStyle = i % 4 === 0 ? `rgba(${dark},${alpha.toFixed(3)})` : `rgba(${rgb},${alpha.toFixed(3)})`
        ctx.shadowColor = `rgba(${rgb},0.65)`
        ctx.shadowBlur = 9
        ctx.arc(p.x, p.y, Math.max(1, particles[i].size * p.s), 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      if (!reduce) angle += 0.0007
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.z += p.vz
        if (p.x < -40) p.x = w + 40
        if (p.x > w + 40) p.x = -40
        if (p.y < -40) p.y = h + 40
        if (p.y > h + 40) p.y = -40
        if (p.z < 0) { p.z = 0; p.vz *= -1 }
        if (p.z > 1) { p.z = 1; p.vz *= -1 }
      }
      raf = requestAnimationFrame(draw)
    }

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
    }
    const onLeave = () => {
      mouse.active = false
    }
    const onVisibility = () => {
      running = !document.hidden
      if (running && !raf) draw()
    }
    const onResize = () => {
      reset()
      seed()
    }

    reset()
    seed()
    readAccent()
    const colorTimer = window.setInterval(readAccent, 2000)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', onResize)
    draw()

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.clearInterval(colorTimer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
    }
  }, [enabled])

  if (!enabled) return null
  return <canvas ref={ref} className="web-particles" aria-hidden="true" />
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
