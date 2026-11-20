import type { ReactNode } from 'react'

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const tone =
    variant === 'primary'
      ? 'bg-brand-600 text-white shadow-soft hover:bg-brand-700'
      : variant === 'danger'
        ? 'bg-red-500 text-white shadow-soft hover:bg-red-600'
        : variant === 'soft'
          ? 'bg-brand-100 text-brand-800 hover:bg-brand-200'
          : 'border border-brand-200 bg-white text-ink-soft hover:bg-brand-50'
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn-press inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${tone} ${pad} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <div
      className={`rounded-3xl border border-brand-200/80 bg-white p-5 shadow-soft ${
        hover ? 'card-hover' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold text-ink-soft">
        {label}
        {hint && <span className="font-normal text-ink-soft/50">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-soft/40 focus:border-brand-400 focus:ring-4 focus:ring-brand-200/60'

export function Badge({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'ok' | 'err' | 'warn' | 'mute' }) {
  const map = {
    brand: 'border-brand-200 bg-brand-100 text-brand-800',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    err: 'border-red-200 bg-red-50 text-red-600',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    mute: 'border-ink-soft/15 bg-ink-soft/5 text-ink-soft',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>
      {children}
    </span>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-300 bg-brand-50/60 px-6 py-16 text-center">
      <div className="anim-float mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-500 shadow-soft">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="h-7 w-7">
          <path d="M8 17V9h8M40 17V9h-8M8 31v8h8M40 31v8h-8" />
          <path d="M14 24h20" />
        </svg>
      </div>
      <p className="text-sm font-bold text-ink">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-soft">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

export function SectionTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-bold tracking-wide text-ink">{children}</h2>
      {extra}
    </div>
  )
}
