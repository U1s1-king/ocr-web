import { useMemo, useState } from 'react'
import { logsApi, type ApiLogItem } from '../api'
import { MODULE_TONE } from '../../lib/modules'
import { IcAlert, IcSearch } from '../icons'
import { Chip, Empty, ErrorBar, Page, fmtTime, useLoad } from '../ui'
import { StatsStrip } from '../StatsStrip'

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const

function statusTone(code: number): { bg: string; fg: string } {
  if (code >= 500) return { bg: '#f8eef0', fg: '#96606a' }
  if (code >= 400) return { bg: '#f7f2e7', fg: '#8a7038' }
  if (code >= 200) return { bg: '#eef4ef', fg: '#4c7a5e' }
  return { bg: '#eef0f3', fg: '#5c6570' }
}

/** 「接口日志」二级页：按方法 / 状态码筛，点开展开请求与响应 */
export default function Logs() {
  const [method, setMethod] = useState<string[]>([])
  const [onlyError, setOnlyError] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  const logs = useLoad<ApiLogItem[]>(
    () =>
      logsApi
        .list({ method: method.length ? method : undefined, limit: 60 })
        .then((r) => r.items),
    [] as ApiLogItem[],
    [method.join(',')],
  )

  const tone = MODULE_TONE.slate
  const list = useMemo(
    () =>
      logs.data.filter(
        (l) =>
          (!onlyError || l.status >= 400) &&
          (!q || l.path.toLowerCase().includes(q.toLowerCase()) || l.method.toLowerCase().includes(q.toLowerCase())),
      ),
    [logs.data, onlyError, q],
  )

  const failCount = logs.data.filter((l) => l.status >= 400).length

  return (
    <Page title="接口日志" sub={`最近 ${logs.data.length} 条 · ${failCount} 条异常`} back>
      <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2.5">
        <IcSearch style={{ fontSize: 15 }} className="flex-none text-ink-soft" />
        <input
          className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-ink-soft/80"
          placeholder="搜路径，例如 /exams"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mo-scroll-x mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
        {METHODS.map((m) => (
          <Chip
            key={m}
            active={method.includes(m)}
            onClick={() =>
              setMethod((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
            }
          >
            {m}
          </Chip>
        ))}
        <Chip active={onlyError} onClick={() => setOnlyError((v) => !v)}>
          只看异常
        </Chip>
      </div>

      <StatsStrip
        className="mb-3"
        items={[
          { label: '请求', value: logs.data.length },
          { label: '异常', value: failCount },
          { label: '筛选结果', value: list.length },
        ]}
      />

      {logs.error && (
        <div className="mt-3">
          <ErrorBar text={logs.error} onRetry={logs.reload} />
        </div>
      )}

      <div className="mo-sec-head mt-5 mb-2.5">
        <h2 className="mo-eyebrow">请求记录</h2>
        <button type="button" className="text-[11.5px] text-ink-soft" onClick={logs.reload}>
          刷新
        </button>
      </div>

      {logs.loading && logs.data.length === 0 ? (
        <div className="mo-card space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="mo-skeleton h-3 w-3/5" />
              <div className="mo-skeleton h-2.5 w-2/5" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty
          icon={<IcAlert style={{ fontSize: 22 }} />}
          title="没有匹配的日志"
          tip="换个方法筛选，或清空搜索词再看看"
        />
      ) : (
        <div className="space-y-2">
          {list.map((l, i) => {
            const st = statusTone(l.status)
            const expanded = open === l.id
            return (
              <button
                key={l.id}
                type="button"
                className="mo-stagger block w-full rounded-[16px] bg-white p-3.5 text-left active:bg-[#fafbfc]"
                style={{ '--i': Math.min(i, 12) } as React.CSSProperties}
                onClick={() => setOpen(expanded ? null : l.id)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex-none rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {l.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{l.path}</span>
                  <span
                    className="mo-num flex-none rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    {l.status}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-soft">
                  <span>{fmtTime(l.uTime)}</span>
                  {l.duration != null && <span>· {l.duration} ms</span>}
                  <span className="ml-auto">#{l.id}</span>
                </div>

                {expanded && (
                  <div className="mt-2.5 space-y-2 border-t border-line pt-2.5">
                    <Payload label="请求体" text={l.requestBody} />
                    <Payload label="响应体" text={l.responseBody} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </Page>
  )
}

function Payload({ label, text }: { label: string; text?: string | null }) {
  if (!text) return <p className="text-[11px] text-ink-soft">{label}：空</p>
  let pretty = text
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    /* 不是 JSON 就原样显示 */
  }
  return (
    <div>
      <p className="mb-1 text-[11px] text-ink-soft">{label}</p>
      <pre className="max-h-[190px] overflow-auto rounded-[10px] bg-[#f6f7f9] p-2.5 text-[11px] leading-relaxed break-all whitespace-pre-wrap text-[#4b5158]">
        {pretty}
      </pre>
    </div>
  )
}
