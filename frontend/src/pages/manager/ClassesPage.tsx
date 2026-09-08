import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createClass, listAcademicYears, listClasses, updateClass } from '@/services/classes'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/utils'
import type { ClassRecord } from '@/types'

export function ManagerClassesPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<ClassRecord | null>(null)
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears() })
  const form = useForm({
    defaultValues: { name: '', scheduleSlot: '', description: '', academicYearId: '', capacity: 40 },
  })

  const save = useMutation({
    mutationFn: async (values: {
      name: string
      scheduleSlot: string
      description: string
      academicYearId: string
      capacity: number
    }) => {
      if (edit) {
        await updateClass(edit.id, {
          name: values.name,
          scheduleSlot: values.scheduleSlot,
          description: values.description || null,
          academicYearId: values.academicYearId || null,
          capacity: Number(values.capacity),
        })
      } else {
        await createClass({
          name: values.name,
          scheduleSlot: values.scheduleSlot,
          description: values.description || undefined,
          academicYearId: values.academicYearId || undefined,
          capacity: Number(values.capacity),
        })
      }
    },
    onSuccess: () => {
      toast.success(edit ? 'Class updated' : 'Class created')
      setOpen(false)
      setEdit(null)
      form.reset()
      qc.invalidateQueries({ queryKey: ['classes'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Manage the twelve academy class slots and capacity."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { form.reset(); setOpen(true) }}>Add Class</Button>}
      />
      {classes.isLoading ? (
        <TableSkeleton />
      ) : !classes.data?.length ? (
        <EmptyState title="No classes" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {classes.data.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{c.schedule_slot}</p>
                  <p className="font-display text-lg font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-ink-500">{c.description || 'No description'}</p>
                  <p className="mt-2 text-xs text-ink-500">Capacity {c.capacity}</p>
                </div>
                <StatusBadge status={c.is_active ? 'active' : 'disabled'} label={c.is_active ? 'Active' : 'Inactive'} />
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEdit(c)
                    form.reset({
                      name: c.name,
                      scheduleSlot: c.schedule_slot,
                      description: c.description ?? '',
                      academicYearId: c.academic_year_id ?? '',
                      capacity: c.capacity,
                    })
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    updateClass(c.id, { isActive: !c.is_active }).then(() => {
                      toast.success('Updated')
                      qc.invalidateQueries({ queryKey: ['classes'] })
                    })
                  }
                >
                  {c.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open || !!edit} onClose={() => { setOpen(false); setEdit(null) }} title={edit ? 'Edit Class' : 'Add Class'}>
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <Input label="Name" {...form.register('name', { required: true })} />
          <Input label="Schedule slot" {...form.register('scheduleSlot', { required: true })} hint="e.g. TRY 2:00" />
          <Input label="Description" {...form.register('description')} />
          <Select
            label="Academic year"
            placeholder="Select year"
            options={(years.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
            {...form.register('academicYearId')}
          />
          <Input label="Capacity" type="number" {...form.register('capacity', { valueAsNumber: true })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEdit(null) }}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
