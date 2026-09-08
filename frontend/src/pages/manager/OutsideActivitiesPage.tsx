import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createCommittee, listCommittees } from '@/services/audit'
import { listClasses } from '@/services/classes'
import { useAuth } from '@/providers/AuthProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/utils'

export function ManagerOutsideActivitiesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [classIds, setClassIds] = useState<string[]>([])
  const committees = useQuery({ queryKey: ['committees'], queryFn: () => listCommittees() })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const form = useForm({ defaultValues: { name: '', description: '' } })

  const create = useMutation({
    mutationFn: (v: { name: string; description: string }) =>
      createCommittee({
        name: v.name,
        description: v.description,
        created_by: user!.profile.id,
        classIds,
      }),
    onSuccess: () => {
      toast.success('Committee created')
      setOpen(false)
      form.reset()
      setClassIds([])
      qc.invalidateQueries({ queryKey: ['committees'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Outside Activities"
        description="Committees and class assignments for outside activities."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New Committee</Button>}
      />
      {committees.isLoading ? <TableSkeleton /> : !committees.data?.length ? <EmptyState title="No committees" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {committees.data.map((c) => (
            <Card key={c.id}>
              <p className="font-display text-lg font-semibold">{c.name}</p>
              <p className="text-sm text-ink-500">{c.description || 'No description'}</p>
              <p className="mt-3 text-xs text-ink-500">
                Classes:{' '}
                {(c.classes as { class?: { name?: string } }[] | null)?.map((x) => x.class?.name).filter(Boolean).join(', ') || 'None'}
              </p>
              <p className="text-xs text-ink-500">Members: {(c.members as unknown[] | null)?.length ?? 0}</p>
            </Card>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Create Committee">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Input label="Name" {...form.register('name', { required: true })} />
          <Input label="Description" {...form.register('description')} />
          <div>
            <p className="mb-2 text-sm font-medium">Assign classes</p>
            <div className="grid max-h-40 gap-2 overflow-y-auto">
              {(classes.data ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={classIds.includes(c.id)}
                    onChange={() => setClassIds((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
