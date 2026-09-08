import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-ink-50/50 px-6 py-14 text-center dark:border-ink-700 dark:bg-ink-900/40', className)}>
      {icon && <div className="mb-3 text-ink-400">{icon}</div>}
      <h3 className="font-display text-lg font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-500 dark:text-ink-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
