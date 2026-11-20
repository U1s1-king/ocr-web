import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon } from './icons'

export function PageHeader({
  title,
  desc,
  crumb,
  extra,
}: {
  title: string
  desc?: string
  crumb?: { label: string; to?: string }[]
  extra?: ReactNode
}) {
  return (
    <div className="anim-fade-up mb-6">
      {crumb && crumb.length > 0 && (
        <nav className="mb-3 flex items-center gap-1 text-[11px] font-medium text-ink-soft/60">
          {crumb.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRightIcon className="h-3 w-3 opacity-40" />}
              {c.to ? (
                <Link to={c.to} className="transition hover:text-brand-700">
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink-soft">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {desc && <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-soft">{desc}</p>}
          <div className="anim-underline mt-3 h-[3px] w-14 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
        </div>
        {extra && <div className="flex items-center gap-2">{extra}</div>}
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  unit,
  tone = 'brand',
  delay = 0,
}: {
  label: string
  value: ReactNode
  unit?: string
  tone?: 'brand' | 'ok' | 'warn' | 'err'
  delay?: number
}) {
  const map = {
    brand: 'from-brand-400/15 to-brand-200/5 text-brand-700',
    ok: 'from-emerald-300/20 to-emerald-100/5 text-emerald-700',
    warn: 'from-amber-300/20 to-amber-100/5 text-amber-700',
    err: 'from-red-300/20 to-red-100/5 text-red-600',
  }
  return (
    <div
      className="anim-lift card-hover rounded-2xl border border-brand-200/70 bg-white p-4 shadow-soft"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[11px] font-semibold text-ink-soft/70">{label}</p>
      <p className={`mt-1.5 flex items-baseline gap-1 text-2xl font-extrabold tabnum ${map[tone].split(' ').pop()}`}>
        {value}
        {unit && <span className="text-[11px] font-semibold text-ink-soft/50">{unit}</span>}
      </p>
      <div className={`mt-2 h-1 rounded-full bg-gradient-to-r ${map[tone]}`} />
    </div>
  )
}
