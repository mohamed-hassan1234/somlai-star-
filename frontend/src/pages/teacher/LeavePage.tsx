import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { leaveRequestSchema } from '@/schemas'
import { createLeaveRequest, listLeaveRequests } from '@/services/audit'
import { useAuth } from '@/providers/AuthProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, getErrorMessage } from '@/lib/utils'

export function TeacherLeavePage() {
  const { user } = useAuth()
  const teacherId = user!.teacher!.id
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const leave = useQuery({ queryKey: ['leave', teacherId], queryFn: () => listLeaveRequests(teacherId) })
  const form = useForm({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: { startDate: '', endDate: '', reason: '' },
  })

  const create = useMutation({
    mutationFn: (v: { startDate: string; endDate: string; reason: string }) =>
      createLeaveRequest({
        teacher_id: teacherId,
        start_date: v.startDate,
        end_date: v.endDate,
        reason: v.reason,
      }),
    onSuccess: () => {
      toast.success('Leave request submitted')
      setOpen(false)
      form.reset()
      qc.invalidateQueries({ queryKey: ['leave', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Request leave for approval by school management."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Request leave</Button>}
      />
      {leave.isLoading ? <TableSkeleton /> : !leave.data?.length ? <EmptyState title="No leave requests" /> : (
        <div className="space-y-3">
          {leave.data.map((r) => (
            <Card key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{formatDate(r.start_date)} – {formatDate(r.end_date)}</p>
                <p className="text-sm text-ink-500">{r.reason}</p>
              </div>
              <StatusBadge status={r.status} />
            </Card>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Request leave">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Input label="Start date" type="date" {...form.register('startDate')} error={form.formState.errors.startDate?.message} />
          <Input label="End date" type="date" {...form.register('endDate')} error={form.formState.errors.endDate?.message} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason</label>
            <textarea className="min-h-24 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900" {...form.register('reason')} />
            {form.formState.errors.reason && <p className="text-xs text-danger">{form.formState.errors.reason.message}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
