import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { listResultSubmissions, reviewSubmission } from '@/services/results'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { cn, formatDateTime, getErrorMessage } from '@/lib/utils'
import type { ResultStatus } from '@/types'

const FILTERS: { value: ResultStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
]

export function ManagerResultsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<ResultStatus | 'all'>('pending_review')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['result-submissions'],
    queryFn: () => listResultSubmissions(),
  })

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'publish' }) =>
      reviewSubmission(id, action, user!.profile.id, notes[id]),
    onSuccess: () => {
      toast.success('Updated')
      qc.invalidateQueries({ queryKey: ['result-submissions'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const rows = (data ?? []).filter((s) => filter === 'all' || s.status === filter)

  return (
    <div>
      <PageHeader title="Results" description="Review and publish result submissions from teachers." />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              filter === f.value
                ? 'bg-navy-600 text-gold-400'
                : 'bg-white text-ink-600 hover:bg-ink-100 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : !rows.length ? (
        <EmptyState title="No result submissions here" />
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold">{s.title}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-sm text-ink-500">
                    {(s.class as { name?: string } | null)?.name} ·{' '}
                    {(s.subject as { name?: string } | null)?.name ?? 'Subject'} ·{' '}
                    {(s.teacher as { profile?: { full_name?: string } } | null)?.profile?.full_name}
                  </p>
                  <p className="text-xs text-ink-400">
                    {s.submitted_at ? formatDateTime(s.submitted_at) : 'Not submitted'}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {(s.results as unknown[] | null)?.length ?? 0} students
                  </p>
                </div>
                <div className="min-w-[220px] space-y-2">
                  {(s.status === 'pending_review' || s.status === 'approved') && (
                    <>
                      <Input
                        label="Notes"
                        value={notes[s.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        {s.status === 'pending_review' && (
                          <>
                            <Button size="sm" onClick={() => review.mutate({ id: s.id, action: 'approve' })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => review.mutate({ id: s.id, action: 'reject' })}>
                              Reject
                            </Button>
                          </>
                        )}
                        {s.status === 'approved' && (
                          <Button size="sm" variant="gold" onClick={() => review.mutate({ id: s.id, action: 'publish' })}>
                            Publish
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
