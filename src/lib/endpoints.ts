export type Endpoint = { id: string; name: string; base: string; token: string }

const KEY = 'ac.endpoints'

export function loadEndpoints(): Endpoint[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as Endpoint[]) : []
    return Array.isArray(list) ? list.filter((e) => e && typeof e.base === 'string') : []
  } catch {
    return []
  }
}

export function saveEndpoints(list: Endpoint[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addEndpoint(ep: Omit<Endpoint, 'id'>): Endpoint[] {
  const list = loadEndpoints()
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const next = [{ ...ep, id }, ...list]
  saveEndpoints(next)
  return next
}

export function updateEndpoint(id: string, patch: Partial<Omit<Endpoint, 'id'>>): Endpoint[] {
  const next = loadEndpoints().map((e) => (e.id === id ? { ...e, ...patch } : e))
  saveEndpoints(next)
  return next
}

export function removeEndpoint(id: string): Endpoint[] {
  const next = loadEndpoints().filter((e) => e.id !== id)
  saveEndpoints(next)
  return next
}

export function activeEndpointId(): string {
  return localStorage.getItem('ac.endpointActive') ?? ''
}

export function setActiveEndpoint(id: string) {
  if (id) localStorage.setItem('ac.endpointActive', id)
  else localStorage.removeItem('ac.endpointActive')
}

export function maskToken(t: string) {
  if (!t) return '无令牌'
  if (t.length <= 8) return '••••'
  return `${t.slice(0, 4)}••••${t.slice(-4)}`
}
