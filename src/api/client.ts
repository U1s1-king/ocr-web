import type { ApiErrorInfo } from './types'
import { recordRequest } from '../lib/requestLog'

const LS_BASE = 'ac.apiBase'
const LS_TOKEN = 'ac.apiToken'

/** 默认指向当前部署的隧道地址；改了地址的用户仍然优先用本机保存的值 */
export const DEFAULT_BASE = 'https://diffs-entered-goat-formula.trycloudflare.com'

const ENV_BASE = import.meta.env.VITE_API_BASE ?? ''
const ENV_TOKEN = import.meta.env.VITE_API_TOKEN ?? ''

/** 服务不可用事件：由全局弹窗接管提示，页面里不再写错误文案 */
function notifyServerDown(status: number, code: string, message: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('api:server-down', { detail: { status, code, message } }))
}

/**
 * 归一接口基址：
 * - 空 → 默认隧道地址
 * - `/` → 同源（生产由 Pages Functions / 反向代理转发 /api，开发由 Vite 代理）
 * - 其它 → 去掉末尾斜杠的完整地址
 */
function normalizeBase(input: string): string {
  const raw = input.trim()
  if (!raw) return DEFAULT_BASE
  if (raw === '/') return ''
  return raw.replace(/\/+$/, '')
}

export function getApiBase(): string {
  const stored = localStorage.getItem(LS_BASE)?.trim()
  return normalizeBase(stored || ENV_BASE)
}

export function setApiBase(base: string): void {
  localStorage.setItem(LS_BASE, base.trim().replace(/\/+$/, ''))
}

export function getApiToken(): string {
  const stored = localStorage.getItem(LS_TOKEN)?.trim()
  return stored || ENV_TOKEN
}

export function setApiToken(token: string): void {
  localStorage.setItem(LS_TOKEN, token.trim())
}

export class ApiError extends Error implements ApiErrorInfo {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** 错误码 → 中文说明（与后端文档一致） */
export const ERROR_TEXT: Record<string, string> = {
  INVALID_PATH_PARAM: '路径参数不合法',
  UNAUTHORIZED: '鉴权失败，请检查 API Token',
  EXAM_NOT_FOUND: '试卷不存在',
  EXAM_CONFIG_INVALID: '已保存的试卷内容不合法',
  EXAM_NAME_EXISTS: '已存在同名试卷',
  EXAM_EMPTY: '试卷还没有配置内容',
  VALIDATION_ERROR: '请求参数不合法',
  INVALID_JSON: '请求体不是合法 JSON',
  INVALID_FILE_COUNT: '必须且只能上传一个文件',
  INVALID_FORM_DATA: '不是合法的表单',
  FILE_TOO_LARGE: '文件大小不能达到或超过 10 MiB',
  FILE_NOT_FOUND: '文件不存在',
  CHECK_FAILED: '图片定位或识别失败',
  DUPLICATE_IDS: '请求中存在重复 id',
  STUDENT_NOT_FOUND: '部分学生不存在',
  CANDIDATE_NUMBER_EXISTS: '考生号已存在',
  AUTH_NOT_CONFIGURED: '服务端未配置鉴权令牌',
  UNSUPPORTED_MEDIA_TYPE: 'Content-Type 不支持',
}

function authHeaders(): Record<string, string> {
  const token = getApiToken()
  return token ? { Authorization: `Bearer ${token}`, 'client-cookie': token } : {}
}

/** 解包 { data } 包装并归一错误 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${getApiBase()}${path}`
  const method = (init.method ?? 'GET').toUpperCase()
  const started = performance.now()
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...authHeaders(), ...((init.headers as Record<string, string>) ?? {}) },
    })
  } catch (err) {
    const message = `无法连接服务：${(err as Error).message}`
    recordRequest({
      method,
      path,
      status: null,
      durationMs: Math.round(performance.now() - started),
      ok: false,
      code: 'NETWORK',
      error: message,
    })
    notifyServerDown(0, 'NETWORK', message)
    throw new ApiError(0, 'NETWORK', message)
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let code = ''
    let message = ''
    try {
      const json = JSON.parse(raw) as { code?: string; error?: string; message?: string }
      code = json.code ?? ''
      message = json.error ?? json.message ?? ''
    } catch {
      // 代理/后端异常时可能返回整个 SPA 的 HTML，不能把 HTML 直接丢给用户
      message = /<!doctype|<html|<!\[/i.test(raw) ? '接口返回了 HTML 页面，请检查 /api 代理或后端服务' : raw.slice(0, 120)
    }
    const err = new ApiError(res.status, code, message || ERROR_TEXT[code] || `请求失败（${res.status}）`)
    if (res.status >= 500 || /<!doctype|<html/i.test(raw)) notifyServerDown(res.status, code || 'HTTP_ERROR', err.message)
    recordRequest({
      method,
      path,
      status: res.status,
      durationMs: Math.round(performance.now() - started),
      ok: false,
      code: code || 'HTTP_ERROR',
      error: err.message,
    })
    throw err
  }

  recordRequest({
    method,
    path,
    status: res.status,
    durationMs: Math.round(performance.now() - started),
    ok: true,
  })

  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('json')) {
    // 常见于 /api 代理失效时返回了 SPA 的 index.html：不能把 HTML 当数据返回
    const err = new ApiError(
      502,
      'BAD_CONTENT_TYPE',
      `接口返回了非 JSON 内容（${ct || 'unknown'}），请检查 /api 代理或后端地址`,
    )
    notifyServerDown(502, err.code, err.message)
    recordRequest({
      method,
      path,
      status: res.status,
      durationMs: Math.round(performance.now() - started),
      ok: false,
      code: err.code,
      error: err.message,
    })
    throw err
  }
  const json = (await res.json()) as { data?: T } & Record<string, unknown>
  return (json.data !== undefined ? json.data : json) as T
}

export function jsonRequest<T>(path: string, method: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    return err.code && ERROR_TEXT[err.code] ? ERROR_TEXT[err.code] : err.message
  }
  const msg = err instanceof Error ? err.message : String(err)
  return /<!doctype|<html/i.test(msg) ? '接口返回异常，请稍后重试' : msg
}
