export type ThemeItem = { id: string; name: string; color: string }

export const PRESETS: ThemeItem[] = [
  { id: 'sakura', name: '樱花粉', color: '#e06a8f' },
  { id: 'sky', name: '晴空蓝', color: '#2b62f0' },
  { id: 'matcha', name: '抹茶绿', color: '#12a15a' },
  { id: 'dusk', name: '暮光紫', color: '#6b4ef2' },
  { id: 'citrus', name: '柑橘橙', color: '#ef8a2c' },
  { id: 'lagoon', name: '湖水青', color: '#0d9fb5' },
  { id: 'garnet', name: '石榴红', color: '#c2334a' },
  { id: 'obsidian', name: '曜石黑', color: '#4a4f57' },
]

export const DEFAULT_COLOR = '#e06a8f'

const KEY_COLOR = 'ac.themeColor'
const KEY_LIST = 'ac.themes'
const KEY_ACTIVE = 'ac.themeActive'

export function currentColor(): string {
  const c = localStorage.getItem(KEY_COLOR)
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : DEFAULT_COLOR
}

export function applyTheme(color: string, activeId = '') {
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR
  document.documentElement.style.setProperty('--accent', c)
  document.documentElement.style.setProperty('--mo-accent', c)
  localStorage.setItem(KEY_COLOR, c)
  if (activeId) localStorage.setItem(KEY_ACTIVE, activeId)
  else localStorage.removeItem(KEY_ACTIVE)
  // 让浏览器 UI 配色也跟着走
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', c)
}

export function initTheme() {
  const c = currentColor()
  document.documentElement.style.setProperty('--accent', c)
}

export function activeThemeId(): string {
  return localStorage.getItem(KEY_ACTIVE) ?? ''
}

export function loadThemes(): ThemeItem[] {
  try {
    const raw = localStorage.getItem(KEY_LIST)
    const list = raw ? (JSON.parse(raw) as ThemeItem[]) : []
    return Array.isArray(list) ? list.filter((t) => t && /^#[0-9a-fA-F]{6}$/.test(t.color)) : []
  } catch {
    return []
  }
}

function saveThemes(list: ThemeItem[]) {
  localStorage.setItem(KEY_LIST, JSON.stringify(list))
}

export function addTheme(name: string, color: string): { list: ThemeItem[]; item: ThemeItem } {
  const item: ThemeItem = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: name.trim() || '我的配色',
    color,
  }
  const list = [item, ...loadThemes()]
  saveThemes(list)
  return { list, item }
}

export function updateTheme(id: string, patch: Partial<Omit<ThemeItem, 'id'>>): ThemeItem[] {
  const list = loadThemes().map((t) => (t.id === id ? { ...t, ...patch } : t))
  saveThemes(list)
  return list
}

export function removeTheme(id: string): ThemeItem[] {
  const list = loadThemes().filter((t) => t.id !== id)
  saveThemes(list)
  if (activeThemeId() === id) localStorage.removeItem(KEY_ACTIVE)
  return list
}

/** 从主色派生色阶，用于预览 */
export function shade(hex: string, pct: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const to = pct >= 100 ? 0 : 255
  const k = Math.abs(pct - 100) / 100
  const mix = (a: number) => Math.round(a + (to - a) * k)
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
