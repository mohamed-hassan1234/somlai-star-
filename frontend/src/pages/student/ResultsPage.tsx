import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { getStudentPublishedResults } from '@/services/results'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

function pct(obtained: number, max: number) {
  if (!max) return '0'
  return ((obtained / max) * 100).toFixed(2)
}

function verdict(obtained: number, max: number) {
  const ratio = max ? obtained / max : 0
  if (ratio < 0.5) {
    return { label: 'Failed', color: 'text-red-600 dark:text-red-400', chip: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' }
  }
  if (ratio >= 0.9) {
    return { label: 'Excellent', color: 'text-green-600 dark:text-green-400', chip: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' }
  }
  if (ratio >= 0.8) {
    return { label: 'Perfect', color: 'text-green-600 dark:text-green-400', chip: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' }
  }
  if (ratio >= 0.7) {
    return { label: 'Good', color: 'text-green-600 dark:text-green-400', chip: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' }
  }
  return { label: 'Passed', color: 'text-green-600 dark:text-green-400', chip: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' }
}

export function StudentResultsPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['student-results', user!.student!.id],
    queryFn: () => getStudentPublishedResults(user!.student!.id),
  })

  return (
    <div>
      <PageHeader title="My Results" description="Official published results only." />
      {isLoading ? <TableSkeleton /> : !data?.length ? <EmptyState title="No published results" /> : (
        <div className="space-y-3">
          {data.map((r) => {
            const sub = r.submission as { title?: string; subject?: { name?: string } } | null
            const v = verdict(r.marks_obtained, r.max_marks)
            return (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{sub?.title}</p>
                  <p className="text-sm text-ink-500">{sub?.subject?.name ?? 'Subject'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-right">
                  <div>
                    <p className={cn('font-display text-2xl font-semibold', v.color)}>
                      {r.marks_obtained}/{r.max_marks}
                    </p>
                    {r.grade && <p className="text-sm text-ink-500">Grade {r.grade}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn('inline-flex rounded-lg px-2 py-1 text-xs font-semibold', v.chip)}>
                      {v.label}
                    </span>
                    <span className={cn('text-xs font-medium', v.color)}>{pct(r.marks_obtained, r.max_marks)}%</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
