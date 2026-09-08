import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createNotice, deleteNotice, listNotices } from '@/services/audit'
import { listClasses } from '@/services/classes'
import { useAuth } from '@/providers/AuthProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDateTime, getErrorMessage } from '@/lib/utils'

export function ManagerNoticesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const notices = useQuery({ queryKey: ['notices'], queryFn: () => listNotices() })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const form = useForm({
    defaultValues: { title: '', body: '', notice_type: 'general', target_class_id: '', is_practice: false, is_late_notice: false },
  })

  const create = useMutation({
    mutationFn: (v: {
      title: string
      body: string
      notice_type: string
      target_class_id: string
      is_practice: boolean
      is_late_notice: boolean
    }) =>
      createNotice({
        title: v.title,
        body: v.body,
        notice_type: v.notice_type,
        target_class_id: v.target_class_id || null,
        is_practice: v.is_practice,
        is_late_notice: v.is_late_notice,
        published_by: user!.profile.id,
      }),
    onSuccess: () => {
      toast.success('Notice published')
      setOpen(false)
      form.reset()
      qc.invalidateQueries({ queryKey: ['notices'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotice(id),
    onSuccess: () => {
      toast.success('Notice deleted')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['notices'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Notices" description="Publish school-wide or class notices." actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New Notice</Button>} />
      {notices.isLoading ? <TableSkeleton /> : !notices.data?.length ? <EmptyState title="No notices" /> : (
        <div className="space-y-3">
          {notices.data.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{n.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600 dark:text-ink-300">{n.body}</p>
                  <p className="mt-2 text-xs text-ink-500">
                    {(n.publisher as { full_name?: string } | null)?.full_name} · {n.published_at ? formatDateTime(n.published_at) : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => setDeleteId(n.id)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Publish Notice" size="lg">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Input label="Title" {...form.register('title', { required: true })} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Body</label>
            <textarea className="min-h-28 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900" {...form.register('body', { required: true })} />
          </div>
          <Select
            label="Class (optional)"
            options={[{ value: '', label: 'All classes' }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            {...form.register('target_class_id')}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" {...form.register('is_practice')} /> Practice notice</label>
            <label className="flex items-center gap-2"><input type="checkbox" {...form.register('is_late_notice')} /> Late notice</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Publish</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete notice?"
        message="This notice will be permanently removed."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onConfirm={async () => { if (deleteId) await remove.mutateAsync(deleteId) }}
      />
    </div>
  )
}
