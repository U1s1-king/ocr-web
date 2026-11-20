import { useEffect, useState } from 'react'

export interface VisualPrefs {
  /** Web 端 3D 粒子背景（鼠标靠近时连线） */
  particles: boolean
  /** 页面/滚动交互动效 */
  motion: boolean
}

const KEY = 'ac.visualPrefs'
const DEFAULTS: VisualPrefs = { particles: true, motion: true }

export function getVisualPrefs(): VisualPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const obj = JSON.parse(raw) as Partial<VisualPrefs>
    return {
      particles: typeof obj.particles === 'boolean' ? obj.particles : DEFAULTS.particles,
      motion: typeof obj.motion === 'boolean' ? obj.motion : DEFAULTS.motion,
    }
  } catch {
    return DEFAULTS
  }
}

export function setVisualPrefs(patch: Partial<VisualPrefs>) {
  const next = { ...getVisualPrefs(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('ac:prefs'))
}

export function useVisualPrefs(): VisualPrefs {
  const [prefs, setPrefs] = useState<VisualPrefs>(() => getVisualPrefs())
  useEffect(() => {
    const sync = () => setPrefs(getVisualPrefs())
    window.addEventListener('ac:prefs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('ac:prefs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return prefs
}
