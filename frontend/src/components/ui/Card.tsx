import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200/80 bg-surface-elevated p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900/80',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink-900 dark:text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
        </div>
        {icon && (
          <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
