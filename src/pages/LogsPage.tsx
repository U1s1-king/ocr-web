import { useEffect, useMemo, useState } from 'react'
import { PageHeader, StatTile } from '../components/PageHeader'
import { Badge, Button } from '../components/ui'
import { AlertIcon } from '../components/icons'
import { logsApi, type ApiLogItem } from '../m/api'

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const

function tone(code: number) {
  if (code >= 500) return 'bg-red-100 text-red-600'
  if (code >= 400) return 'bg-amber-100 text-amber-700'
  if (code >= 200) return 'bg-emerald-100 text-emerald-700'
  return 'bg-brand-50 text-ink-soft'
}

function pretty(text?: string | null) {
  if (!text) return '—'
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export default function LogsPage() {
  const [items, setItems] = useState<ApiLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [method, setMethod] = useState<string[]>([])
  const [onlyError, setOnlyError] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    logsApi
      .list({ method: method.length ? method : undefined, limit: 80 })
      .then((r) => {
        if (!alive) return
        setItems(r.items)
        setError('')
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [method, tick])

  const list = useMemo(
    () =>
      items.filter(
        (l) =>
          (!onlyError || l.status >= 400) &&
          (!q || l.path.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, onlyError, q],
  )

  const fails = items.filter((l) => l.status >= 400).length
  const slow = items.filter((l) => (l.duration ?? 0) > 1000).length

  return (
    <div>
      <PageHeader
        title="接口日志"
        desc="后端每次请求都会留档，排查识别失败、超时这类问题先从这里看。"
        crumb={[{ label: '首页', to: '/exams' }, { label: '接口日志' }]}
        extra={
          <Button variant="ghost" onClick={() => setTick((t) => t + 1)}>
            刷新
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="最近请求" value={items.length} />
        <StatTile label="异常响应" value={fails} tone="err" delay={60} />
        <StatTile label="超过 1s" value={slow} tone="warn" delay={120} />
        <StatTile label="当前筛选" value={list.length} tone="ok" delay={180} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="w-full max-w-[240px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-brand-400"
          placeholder="搜路径，例如 /exams"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() =>
              setMethod((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
            }
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
              method.includes(m)
                ? 'bg-brand-600 text-white'
                : 'border border-brand-200 bg-white text-ink-soft hover:text-ink'
            }`}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOnlyError((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
            onlyError ? 'bg-red-500 text-white' : 'border border-brand-200 bg-white text-ink-soft'
          }`}
        >
          只看异常
        </button>
      </div>

      {error && false && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          <AlertIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-soft">
        <div className="hidden grid-cols-[70px_60px_1fr_80px_80px_150px] gap-3 border-b border-brand-100 bg-brand-50/60 px-4 py-2.5 text-[11px] font-semibold text-ink-soft/70 lg:grid">
          <span>方法</span>
          <span>状态</span>
          <span>路径</span>
          <span>耗时</span>
          <span>#</span>
          <span>时间</span>
        </div>

        {loading && list.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-brand-50" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12.5px] text-ink-soft">没有匹配的日志</p>
        ) : (
          list.map((l) => (
            <div key={l.id} className="border-b border-brand-100 last:border-0">
              <button
                type="button"
                onClick={() => setOpen(open === l.id ? null : l.id)}
                className="grid w-full grid-cols-[70px_60px_1fr] items-center gap-3 px-4 py-2.5 text-left transition hover:bg-brand-50/60 lg:grid-cols-[70px_60px_1fr_80px_80px_150px]"
              >
                <span className="text-[11.5px] font-semibold text-ink-soft">{l.method}</span>
                <span className={`w-fit rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${tone(l.status)}`}>
                  {l.status}
                </span>
                <span className="truncate text-[12.5px] text-ink">{l.path}</span>
                <span className="hidden text-[11.5px] text-ink-soft lg:block">{l.duration != null ? `${l.duration} ms` : '—'}</span>
                <span className="hidden text-[11.5px] text-ink-soft/60 lg:block">#{l.id}</span>
                <span className="hidden text-[11.5px] text-ink-soft lg:block">
                  {l.uTime ? new Date(l.uTime).toLocaleString('zh-CN', { hour12: false }) : '—'}
                </span>
              </button>

              {open === l.id && (
                <div className="grid gap-3 border-t border-brand-100 bg-brand-50/40 px-4 py-3 lg:grid-cols-2">
                  {(['请求体', '响应体'] as const).map((label) => {
                    const text = label === '请求体' ? l.requestBody : l.responseBody
                    return (
                      <div key={label}>
                        <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-ink-soft">
                          {label}
                          <Badge tone="mute">{text ? `${text.length} B` : '空'}</Badge>
                        </p>
                        <pre className="max-h-[220px] overflow-auto rounded-xl bg-white p-3 text-[11.5px] leading-relaxed break-all whitespace-pre-wrap text-[#4b5158]">
                          {pretty(text)}
                        </pre>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
