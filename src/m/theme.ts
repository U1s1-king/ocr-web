/* 移动端主题色：预设 + 自定义，存在本机 localStorage。
   默认与预设都走低饱和路线，避免荧光色让界面显得廉价。 */

const KEY = 'ac.mobileTheme'

export type ThemePreset = {
  id: string
  name: string
  color: string
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'graphite', name: '曜石黑', color: '#2c2f34' },
  { id: 'sky', name: '晴空蓝', color: '#3a63b8' },
  { id: 'sakura', name: '樱花粉', color: '#c2778c' },
  { id: 'matcha', name: '抹茶绿', color: '#4e8a6b' },
  { id: 'violet', name: '暮光紫', color: '#6c62a8' },
  { id: 'clay', name: '陶土橙', color: '#b07a4d' },
  { id: 'lagoon', name: '湖水青', color: '#3d8189' },
  { id: 'wine', name: '石榴红', color: '#a8505c' },
]

export const DEFAULT_THEME = '#3a63b8'

export function getThemeColor(): string {
  try {
    const v = localStorage.getItem(KEY)
    return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(color: string) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_THEME
  document.documentElement.style.setProperty('--mo-accent', hex)
  document.documentElement.style.setProperty('--mo-tint', `color-mix(in srgb, ${hex} 8%, #f7f8fa)`)
  document.documentElement.style.setProperty('--mo-tint-strong', `color-mix(in srgb, ${hex} 13%, #f4f6fa)`)
  document.documentElement.style.setProperty('--accent', hex)
  syncMeta()
  try {
    localStorage.setItem(KEY, hex)
  } catch {
    /* 隐私模式忽略 */
  }
}

/** 让安卓地址栏 / iOS 状态栏用的是浅灰画布色，而不是主色 */
function syncMeta() {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', '#f4f5f7')
}

/** 应用启动时调用一次 */
export function initTheme() {
  const hex = getThemeColor()
  document.documentElement.style.setProperty('--mo-accent', hex)
  document.documentElement.style.setProperty('--mo-tint', `color-mix(in srgb, ${hex} 8%, #f7f8fa)`)
  document.documentElement.style.setProperty('--mo-tint-strong', `color-mix(in srgb, ${hex} 13%, #f4f6fa)`)
  document.documentElement.style.setProperty('--accent', hex)
  syncMeta()
}

export function presetOf(color: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.color.toLowerCase() === color.toLowerCase())
}
