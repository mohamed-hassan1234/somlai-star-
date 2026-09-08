import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listLeaveRequests, reviewLeave } from '@/services/school'
import { api } from '@/services/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, getErrorMessage } from '@/lib/utils'

export function ManagerLeavePage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['all-leave'],
    queryFn: () => listLeaveRequests(),
  })

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { data: user } = await api.auth.getUser()
      await reviewLeave(id, status, user.user!.id)
    },
    onSuccess: () => {
      toast.success('Leave updated')
      void qc.invalidateQueries({ queryKey: ['all-leave'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Teacher Leave"
        description="Approve or reject leave. Approved leave overrides automatic absence after 3 days."
      />
      {isLoading ? (
        <TableSkeleton />
      ) : !data?.length ? (
        <EmptyState title="No leave requests" />
      ) : (
        <div className="space-y-3">
          {data.map((l: {
            id: string
            start_date: string
            end_date: string
            reason: string
            status: string
            teacher?: { teacher_id?: string; profile?: { full_name?: string } }
          }) => (
            <Card key={l.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">
                  {l.teacher?.teacher_id} — {l.teacher?.profile?.full_name}
                </p>
                <p className="text-sm text-ink-500">
                  {formatDate(l.start_date)} → {formatDate(l.end_date)}
                </p>
                <p className="mt-1 text-sm">{l.reason}</p>
                <div className="mt-2">
                  <StatusBadge status={l.status} />
                </div>
              </div>
              {l.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => review.mutate({ id: l.id, status: 'approved' })}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => review.mutate({ id: l.id, status: 'rejected' })}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function ManagerPasswordResetsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['password-resets'],
    queryFn: async () => {
      const { data, error } = await api
        .from('password_reset_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
  })

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { data: user } = await api.auth.getUser()
      const { error } = await api
        .from('password_reset_requests')
        .update({
          status: 'resolved',
          resolved_by: user.user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Marked resolved — reset the password from Students/Teachers if needed')
      void qc.invalidateQueries({ queryKey: ['password-resets'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Password Reset Requests"
        description="Users submit these from Forgot Password. Reset the account password, then mark resolved."
      />
      {isLoading ? (
        <TableSkeleton />
      ) : !data?.length ? (
        <EmptyState title="No reset requests" />
      ) : (
        <div className="space-y-3">
          {data.map((r: { id: string; login_id: string; requester_note: string | null; status: string; created_at: string }) => (
            <Card key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono font-semibold">{r.login_id}</p>
                <p className="text-sm text-ink-500">{r.requester_note || 'No note'}</p>
                <StatusBadge status={r.status} />
              </div>
              {r.status === 'pending' && (
                <Button size="sm" onClick={() => resolve.mutate(r.id)}>
                  Mark resolved
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
