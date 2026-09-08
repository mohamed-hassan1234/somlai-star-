import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createSubject, listSubjects, updateSubject } from '@/services/classes'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/utils'
import type { Subject } from '@/types'

export function ManagerSubjectsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Subject | null>(null)
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => listSubjects() })
  const form = useForm({ defaultValues: { name: '', code: '', description: '' } })

  const save = useMutation({
    mutationFn: async (v: { name: string; code: string; description: string }) => {
      if (edit) await updateSubject(edit.id, { name: v.name, code: v.code || null, description: v.description || null })
      else await createSubject({ name: v.name, code: v.code || undefined, description: v.description || undefined })
    },
    onSuccess: () => {
      toast.success('Saved')
      setOpen(false)
      setEdit(null)
      form.reset()
      qc.invalidateQueries({ queryKey: ['subjects'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Subjects" description="Curriculum subjects taught at the academy." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add Subject</Button>} />
      {subjects.isLoading ? <TableSkeleton /> : !subjects.data?.length ? <EmptyState title="No subjects" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.data.map((s) => (
            <Card key={s.id}>
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-brand-700">{s.code || '—'}</p>
                  <p className="font-display text-lg font-semibold">{s.name}</p>
                  <p className="text-sm text-ink-500">{s.description || 'No description'}</p>
                </div>
                <StatusBadge status={s.is_active ? 'active' : 'disabled'} />
              </div>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setEdit(s); form.reset({ name: s.name, code: s.code ?? '', description: s.description ?? '' }) }}>Edit</Button>
            </Card>
          ))}
        </div>
      )}
      <Modal open={open || !!edit} onClose={() => { setOpen(false); setEdit(null) }} title={edit ? 'Edit Subject' : 'Add Subject'}>
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <Input label="Name" {...form.register('name', { required: true })} />
          <Input label="Code" {...form.register('code')} />
          <Input label="Description" {...form.register('description')} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEdit(null) }}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
