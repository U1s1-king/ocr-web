/**
 * 本机请求日志：把每次接口请求的 方法 / 路径 / 状态 / 耗时 / 错误 记在内存里，
 * 诊断页与请求日志页直接订阅，不依赖服务端日志接口是否可用。
 */

export interface LocalRequestLog {
  id: string
  /** 毫秒时间戳 */
  at: number
  method: string
  path: string
  status: number | null
  durationMs: number
  ok: boolean
  code?: string
  error?: string
}

const MAX = 80
let seq = 0
let logs: LocalRequestLog[] = []
const listeners = new Set<(logs: LocalRequestLog[]) => void>()

export function recordRequest(input: Omit<LocalRequestLog, 'id' | 'at'>): void {
  const item: LocalRequestLog = {
    ...input,
    id: `${Date.now().toString(36)}-${(seq += 1)}`,
    at: Date.now(),
  }
  logs = [item, ...logs].slice(0, MAX)
  listeners.forEach((fn) => {
    try {
      fn(logs)
    } catch {
      /* 单个订阅者出错不影响其它订阅者 */
    }
  })
}

export function getLocalLogs(limit = MAX): LocalRequestLog[] {
  return logs.slice(0, limit)
}

export function subscribeLocalLogs(cb: (logs: LocalRequestLog[]) => void): () => void {
  listeners.add(cb)
  cb(logs)
  return () => {
    listeners.delete(cb)
  }
}

export function clearLocalLogs(): void {
  logs = []
  listeners.forEach((fn) => fn(logs))
}

export function localLogStats(list: LocalRequestLog[] = logs): {
  total: number
  errors: number
  avgMs: number
} {
  const total = list.length
  const errors = list.filter((l) => !l.ok).length
  const avgMs = total ? Math.round(list.reduce((s, l) => s + l.durationMs, 0) / total) : 0
  return { total, errors, avgMs }
}
