import { cn } from '@/lib/utils'

const tones: Record<string, string> = {
  active: 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200',
  disabled: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  pending: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  present: 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200',
  absent: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  late: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  leave: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
  excused: 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  paid: 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200',
  unpaid: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  scholarship_nb: 'bg-accent-400/20 text-ink-800 dark:text-accent-400',
  draft: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
  pending_review: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  approved: 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200',
  published: 'bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100',
  rejected: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  set: 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200',
  unset: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
}

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold capitalize',
        tones[status] ?? 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
        className,
      )}
    >
      {(label ?? status).replaceAll('_', ' ')}
    </span>
  )
}
