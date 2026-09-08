import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

/** Lightweight functional page shell for secondary role screens */
export function SimplePage({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">{title}</h2>
        {description && <p className="text-sm text-ink-500">{description}</p>}
      </div>
      <Card>{children ?? <p className="text-sm text-ink-500">Content loads from live school data.</p>}</Card>
    </div>
  )
}
