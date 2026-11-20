/* 轻量 SVG 图表：柱状 / 折线 / 圆环，配色跟随主色
 * 都带坐标轴刻度、点击查看数值、入场动画
 */
import { useId, useState } from 'react'

export type Point = { label: string; value: number }

const TONES = [100, 78, 56, 34, 18]

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  const m = steps.find((s) => n <= s) ?? 10
  return m * p
}

function fmt(v: number) {
  if (!isFinite(v)) return '0'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/* ---------------- 柱状图 ---------------- */

export function BarChart({ data, unit = '' }: { data: Point[]; unit?: string }) {
  const [act, setAct] = useState(-1)
  const max = Math.max(1, ...data.map((d) => d.value))
  const top = niceMax(max)
  const ticks = [top, (top * 2) / 3, top / 3, 0]
  const H = 160

  return (
    <div className="relative">
      <div className="flex">
        <div className="relative w-9 flex-none" style={{ height: H }}>
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute right-1.5 -translate-y-1/2 text-[9px] font-bold text-ink-soft/55"
              style={{ top: `${(i / 3) * 100}%` }}
            >
              {fmt(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: H }}>
          {ticks.map((_, i) => (
            <div
              key={i}
              className="absolute inset-x-0"
              style={{
                top: `${(i / 3) * 100}%`,
                borderTop: i === 3 ? '1px solid #dfe3ea' : '1px dashed #e9ecf1',
              }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-1.5">
            {data.map((d, i) => {
              const h = Math.max(3, (d.value / top) * (H - 6))
              const on = act === i
              return (
                <button
                  key={d.label}
                  type="button"
                  className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
                  onClick={() => setAct(on ? -1 : i)}
                  aria-label={`${d.label} ${d.value}${unit}`}
                >
                  {on && (
                    <span
                      className="mo-chart-bubble"
                      style={{ bottom: `${h + 8}px` }}
                    >
                      {d.value}
                      {unit}
                    </span>
                  )}
                  <span
                    className="mo-chart-bar mx-auto w-full max-w-[42px] rounded-t-[7px]"
                    style={{
                      height: h,
                      animationDelay: `${i * 55}ms`,
                      background: on
                        ? 'linear-gradient(180deg, var(--mo-accent), color-mix(in srgb, var(--mo-accent) 70%, #000 8%))'
                        : `linear-gradient(180deg, color-mix(in srgb, var(--mo-accent) ${Math.max(42, 100 - i * 12)}%, #fff), color-mix(in srgb, var(--mo-accent) 60%, #fff))`,
                      boxShadow: on ? '0 6px 14px -6px color-mix(in srgb, var(--mo-accent) 70%, transparent)' : 'none',
                    }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="ml-9 mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={d.label}
            className={`min-w-0 flex-1 truncate text-center text-[9px] font-bold ${
              act === i ? 'text-brand-700' : 'text-ink-soft/65'
            }`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------------- 折线图 ---------------- */

export function LineChart({ data, unit = '' }: { data: Point[]; unit?: string }) {
  const [act, setAct] = useState(-1)
  const gid = useId().replace(/:/g, '')
  const W = 320
  const H = 170
  if (data.length === 0) return null

  const padL = 30
  const padR = 8
  const padT = 14
  const padB = 24
  const vals = data.map((d) => d.value)
  const maxRaw = Math.max(...vals, 1)
  const top = niceMax(maxRaw)
  const step = data.length > 1 ? (W - padL - padR) / (data.length - 1) : 0
  const yOf = (v: number) => padT + (1 - v / top) * (H - padT - padB)
  const pts = data.map((d, i) => ({ x: padL + i * step, y: yOf(d.value), ...d }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - padB} L${pts[0].x.toFixed(1)},${H - padB} Z`
  const ticks = [top, (top * 2) / 3, top / 3, 0]
  const labelEvery = data.length > 7 ? Math.ceil(data.length / 6) : 1
  const cur = act >= 0 ? pts[act] : null

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--mo-accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--mo-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke={i === 3 ? '#dfe3ea' : '#e9ecf1'}
                strokeWidth="1"
                strokeDasharray={i === 3 ? undefined : '3 4'}
              />
              <text x={padL - 6} y={yOf(t) + 3} textAnchor="end" fontSize="8" fontWeight="700" fill="#a6acb6">
                {fmt(t)}
              </text>
            </g>
          ))}

          <path d={area} fill={`url(#g${gid})`} className="mo-area-in" />
          <path
            d={line}
            fill="none"
            stroke="var(--mo-accent)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mo-line-draw"
            pathLength={1}
          />

          {cur && <line x1={cur.x} x2={cur.x} y1={padT} y2={H - padB} stroke="var(--mo-accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />}

          {pts.map((p, i) => (
            <g key={p.label} onClick={() => setAct(act === i ? -1 : i)} style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r="11" fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={act === i ? 4.6 : 3.4}
                fill="#fff"
                stroke="var(--mo-accent)"
                strokeWidth="2.2"
                className="mo-dot-in"
                style={{ animationDelay: `${320 + i * 45}ms` }}
              />
            </g>
          ))}

          {pts.map((p, i) =>
            i % labelEvery === 0 || i === pts.length - 1 ? (
              <text
                key={`l${p.label}`}
                x={p.x}
                y={H - 8}
                textAnchor="middle"
                fontSize="8"
                fontWeight="700"
                fill={act === i ? '#3f4650' : '#a6acb6'}
              >
                {p.label}
              </text>
            ) : null,
          )}
        </svg>

        {cur && (
          <span
            className="mo-chart-bubble"
            style={{
              left: `${(cur.x / W) * 100}%`,
              top: `calc(${(cur.y / H) * 100}% - 26px)`,
            }}
          >
            {cur.value}
            {unit}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-center gap-3 text-[9.5px] font-bold text-ink-soft/60">
        <span>最高 {fmt(Math.max(...vals))}{unit}</span>
        <span>·</span>
        <span>最低 {fmt(Math.min(...vals))}{unit}</span>
        <span>·</span>
        <span>点一下看数值</span>
      </div>
    </div>
  )
}

/* ---------------- 圆环图 ---------------- */

export function DonutChart({ data, centerLabel, centerValue }: { data: Point[]; centerLabel: string; centerValue: string }) {
  const [act, setAct] = useState(-1)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const R = 52
  const C = 2 * Math.PI * R
  let acc = 0
  const seg = data.map((d) => {
    const len = (d.value / total) * C
    const o = { ...d, len, offset: acc }
    acc += len
    return o
  })
  const cur = act >= 0 ? seg[act] : null

  return (
    <div className="flex items-center gap-3">
      <div className="relative aspect-square w-[42vw] max-w-[148px] min-w-[104px] flex-none">
        <svg viewBox="0 0 140 140" className="block h-full w-full">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#eef1f5" strokeWidth="15" />
          {seg.map((d, i) => (
            <circle
              key={d.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={`color-mix(in srgb, var(--mo-accent) ${TONES[i % TONES.length]}%, #fff)`}
              strokeWidth={act === i ? 18 : 15}
              strokeDasharray={`${d.len} ${C - d.len}`}
              strokeDashoffset={-d.offset}
              transform="rotate(-90 70 70)"
              className="mo-arc cursor-pointer transition-[stroke-width] duration-200"
              style={
                {
                  '--circ': C,
                  '--len': d.len,
                  '--rest': C - d.len,
                  animationDelay: `${i * 110}ms`,
                } as React.CSSProperties
              }
              onClick={() => setAct(act === i ? -1 : i)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[21px] font-black leading-none text-ink">{cur ? cur.value : centerValue}</span>
          <span className="mt-1 max-w-[86px] truncate text-[9.5px] font-bold text-ink-soft/60">
            {cur ? (cur.label.length > 8 ? `${cur.label.slice(0, 8)}…` : cur.label) : centerLabel}
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {seg.map((d, i) => (
          <button
            key={d.label}
            type="button"
            className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors ${
              act === i ? 'bg-brand-50' : ''
            }`}
            onClick={() => setAct(act === i ? -1 : i)}
          >
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: `color-mix(in srgb, var(--mo-accent) ${TONES[i % TONES.length]}%, #fff)` }}
            />
            <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold text-ink-soft">{d.label}</span>
            <span className="text-[10.5px] font-extrabold text-ink">{d.value}</span>
            <span className="w-8 text-right text-[9.5px] font-bold text-ink-soft/55">
              {Math.round((d.value / total) * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
