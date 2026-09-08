import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createAcademicYear, listAcademicYears, updateAcademicYear } from '@/services/classes'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, getErrorMessage } from '@/lib/utils'
import type { AcademicYear } from '@/types'

export function ManagerAcademicYearsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears() })
  const form = useForm({ defaultValues: { name: '', start_date: '', end_date: '', is_active: true } })

  const create = useMutation({
    mutationFn: createAcademicYear,
    onSuccess: () => {
      toast.success('Academic year created')
      setOpen(false)
      form.reset()
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const activate = useMutation({
    mutationFn: (y: AcademicYear) => updateAcademicYear(y.id, { is_active: true, is_archived: false }),
    onSuccess: () => {
      toast.success('Year activated')
      qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Academic Years" description="Activate and archive school years." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add Year</Button>} />
      {years.isLoading ? <TableSkeleton /> : !years.data?.length ? <EmptyState title="No academic years" /> : (
        <div className="space-y-3">
          {years.data.map((y) => (
            <Card key={y.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg font-semibold">{y.name}</p>
                <p className="text-sm text-ink-500">{formatDate(y.start_date)} – {formatDate(y.end_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                {y.is_active && <StatusBadge status="active" label="Current" />}
                {y.is_archived && <StatusBadge status="disabled" label="Archived" />}
                {!y.is_active && (
                  <Button size="sm" variant="secondary" onClick={() => activate.mutate(y)}>Set active</Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    updateAcademicYear(y.id, { is_archived: !y.is_archived }).then(() => {
                      toast.success('Updated')
                      qc.invalidateQueries({ queryKey: ['academic-years'] })
                    })
                  }
                >
                  {y.is_archived ? 'Unarchive' : 'Archive'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Academic Year">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Input label="Name" placeholder="2026/2027" {...form.register('name', { required: true })} />
          <Input label="Start date" type="date" {...form.register('start_date', { required: true })} />
          <Input label="End date" type="date" {...form.register('end_date', { required: true })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('is_active')} /> Set as active year
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
