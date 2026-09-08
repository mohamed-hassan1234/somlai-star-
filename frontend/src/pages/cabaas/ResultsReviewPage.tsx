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
import { getErrorMessage } from '@/lib/utils'

export function CabaasResultsReviewPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const { data, isLoading } = useQuery({
    queryKey: ['cabaas-results'],
    queryFn: () => listResultSubmissions(),
  })

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'publish' }) =>
      reviewSubmission(id, action, user!.profile.id, notes[id]),
    onSuccess: () => {
      toast.success('Updated')
      qc.invalidateQueries({ queryKey: ['cabaas-results'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const queue = (data ?? []).filter((s) => ['pending_review', 'approved'].includes(s.status))

  return (
    <div>
      <PageHeader title="Results Review" description="Approve, reject, or publish official results." />
      {isLoading ? <TableSkeleton /> : !queue.length ? <EmptyState title="Nothing to review" /> : (
        <div className="space-y-3">
          {queue.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold">{s.title}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-sm text-ink-500">
                    {(s.class as { name?: string } | null)?.name} · {(s.teacher as { profile?: { full_name?: string } } | null)?.profile?.full_name}
                  </p>
                  <ul className="mt-2 text-sm">
                    {((s.results as { student_id: string; marks_obtained: number; max_marks: number }[]) ?? []).slice(0, 8).map((r) => (
                      <li key={r.student_id}>{r.marks_obtained}/{r.max_marks}</li>
                    ))}
                  </ul>
                </div>
                <div className="min-w-[220px] space-y-2">
                  <Input
                    label="Notes"
                    value={notes[s.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    {s.status === 'pending_review' && (
                      <>
                        <Button size="sm" onClick={() => review.mutate({ id: s.id, action: 'approve' })}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => review.mutate({ id: s.id, action: 'reject' })}>Reject</Button>
                      </>
                    )}
                    {s.status === 'approved' && (
                      <Button size="sm" variant="accent" onClick={() => review.mutate({ id: s.id, action: 'publish' })}>Publish</Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
