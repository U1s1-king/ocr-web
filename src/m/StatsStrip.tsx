import type { ReactNode } from 'react'

/** 移动端统一的轻量数据条：让各页面都有信息密度 */
export function StatsStrip({
  items,
  className = '',
}: {
  items: Array<{ label: string; value: ReactNode; hint?: string }>
  className?: string
}) {
  return (
    <div className={`mo-stat-strip ${className}`}>
      {items.map((it) => (
        <div key={it.label} className="mo-stat-strip-item">
          <p className="mo-stat-strip-value">{it.value}</p>
          <p className="mo-stat-strip-label">{it.label}</p>
          {it.hint && <p className="mo-stat-strip-hint">{it.hint}</p>}
        </div>
      ))}
    </div>
  )
}
