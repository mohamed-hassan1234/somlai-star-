import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Pencil, Plus, UserX, Trees } from 'lucide-react'
import { toast } from 'sonner'
import { createCommitteeMemberSchema, type CreateCommitteeMemberInput } from '@/schemas'
import {
  createCommitteeMember,
  listCommitteeMembers,
  nextCommitteeMemberId,
  resetCommitteeMemberPassword,
  setCommitteeMemberStatus,
  updateCommitteeMember,
} from '@/services/outsideActivities'
import { listClasses } from '@/services/classes'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage, formatDate } from '@/lib/utils'
import type { CommitteeMemberRecord } from '@/services/outsideActivities'

export function ManagerOutsideActivityCommitteePage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<CommitteeMemberRecord | null>(null)
  const [statusTarget, setStatusTarget] = useState<CommitteeMemberRecord | null>(null)
  const [resetTarget, setResetTarget] = useState<CommitteeMemberRecord | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])

  const members = useQuery({
    queryKey: ['committee-members'],
    queryFn: () => listCommitteeMembers(),
  })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })

  const form = useForm<CreateCommitteeMemberInput>({
    resolver: zodResolver(createCommitteeMemberSchema),
    defaultValues: {
      memberId: '',
      fullName: '',
      phone: '',
      password: '',
      confirmPassword: '',
      classIds: [],
      status: 'active',
    },
  })

  useEffect(() => {
    if (!open) return
    nextCommitteeMemberId()
      .then((id) => form.setValue('memberId', id))
      .catch((e) => toast.error(getErrorMessage(e)))
  }, [open, form])

  useEffect(() => {
    form.setValue('classIds', selectedClasses)
  }, [selectedClasses, form])

  const createMut = useMutation({
    mutationFn: (values: Omit<CreateCommitteeMemberInput, 'confirmPassword'>) =>
      createCommitteeMember({
        loginId: values.memberId,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone,
        classIds: values.classIds,
        status: values.status,
      }),
    onSuccess: () => {
      toast.success('Committee member created')
      setOpen(false)
      setSelectedClasses([])
      form.reset()
      qc.invalidateQueries({ queryKey: ['committee-members'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!edit) return
      await updateCommitteeMember(edit.profile.id, {
        fullName: form.getValues('fullName'),
        phone: form.getValues('phone') || null,
        status: form.getValues('status'),
        classIds: selectedClasses,
      })
    },
    onSuccess: () => {
      toast.success('Committee member updated')
      setEdit(null)
      qc.invalidateQueries({ queryKey: ['committee-members'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const statusMut = useMutation({
    mutationFn: async () => {
      if (!statusTarget) return
      await setCommitteeMemberStatus(
        statusTarget.profile.id,
        statusTarget.profile.status === 'disabled' ? 'active' : 'disabled',
      )
    },
    onSuccess: () => {
      toast.success('Status updated')
      setStatusTarget(null)
      qc.invalidateQueries({ queryKey: ['committee-members'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!resetTarget) return
      await resetCommitteeMemberPassword(resetTarget.profile.login_id, newPassword)
    },
    onSuccess: () => {
      toast.success('Password reset')
      setResetTarget(null)
      setNewPassword('')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const toggleClass = (id: string) => {
    setSelectedClasses((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div>
      <PageHeader
        title="Outside Activity Committee"
        description="Create committee member accounts, assign classes, and manage access."
        actions={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setSelectedClasses([])
              setOpen(true)
            }}
          >
            Add Committee Member
          </Button>
        }
      />

      {members.isLoading ? (
        <TableSkeleton />
      ) : !members.data?.length ? (
        <EmptyState
          icon={<Trees className="h-10 w-10" />}
          title="No committee members"
          description="Create an Outside Activity Committee member to start supervising students on outside activities."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.data.map((m) => (
            <Card key={m.profile.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-brand-700">{m.profile.login_id}</p>
                  <p className="font-display text-lg font-semibold">{m.profile.full_name}</p>
                  <p className="text-sm text-ink-500">{m.profile.phone || 'No phone'}</p>
                </div>
                <StatusBadge status={m.profile.status} />
              </div>
              <p className="mt-3 text-xs text-ink-500">
                Assigned classes:{' '}
                {m.classes.map((c) => c.name).join(', ') || 'None'}
              </p>
              <p className="mt-1 text-xs text-ink-500">Created {formatDate(m.profile.created_at)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setEdit(m)
                    setSelectedClasses(m.classes.map((c) => c.id))
                    form.reset({
                      memberId: m.profile.login_id,
                      fullName: m.profile.full_name,
                      phone: m.profile.phone ?? '',
                      password: '********',
                      confirmPassword: '********',
                      classIds: m.classes.map((c) => c.id),
                      status: m.profile.status,
                    })
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                  onClick={() => setResetTarget(m)}
                >
                  Reset PW
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  leftIcon={<UserX className="h-3.5 w-3.5" />}
                  onClick={() => setStatusTarget(m)}
                >
                  {m.profile.status === 'disabled' ? 'Enable' : 'Deactivate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open || !!edit}
        onClose={() => {
          setOpen(false)
          setEdit(null)
        }}
        title={edit ? 'Edit Committee Member' : 'Create Committee Member'}
        size="lg"
      >
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => {
            if (edit) updateMut.mutate()
            else
              createMut.mutate({
                memberId: values.memberId,
                password: values.password,
                fullName: values.fullName,
                phone: values.phone,
                classIds: values.classIds,
                status: values.status,
              })
          })}
        >
          <Input label="User ID" {...form.register('memberId')} disabled={!!edit} error={form.formState.errors.memberId?.message} />
          <Input label="Full Name" {...form.register('fullName')} error={form.formState.errors.fullName?.message} />
          <Input label="Phone" {...form.register('phone')} />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'disabled', label: 'Disabled' },
              { value: 'pending', label: 'Pending' },
            ]}
            {...form.register('status')}
          />
          {!edit && (
            <>
              <Input label="Password" type="password" {...form.register('password')} error={form.formState.errors.password?.message} />
              <Input label="Confirm Password" type="password" {...form.register('confirmPassword')} error={form.formState.errors.confirmPassword?.message} />
            </>
          )}
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">Assign class (the member can only see students in these classes)</p>
            {form.formState.errors.classIds && <p className="mb-2 text-xs text-danger">{form.formState.errors.classIds.message}</p>}
            <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {(classes.data ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-sm dark:border-ink-700">
                  <input type="checkbox" checked={selectedClasses.includes(c.id)} onChange={() => toggleClass(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEdit(null) }}>
              Cancel
            </Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {edit ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title="Change committee member status?"
        message={`${statusTarget?.profile.status === 'disabled' ? 'Enable' : 'Deactivate'} ${statusTarget?.profile.full_name ?? 'this member'}? Deactivated members cannot log in.`}
        danger={statusTarget?.profile.status !== 'disabled'}
        loading={statusMut.isPending}
        onConfirm={() => statusMut.mutate()}
      />

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset password" size="sm">
        <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
          <Button loading={resetMut.isPending} disabled={newPassword.length < 8} onClick={() => resetMut.mutate()}>Reset</Button>
        </div>
      </Modal>
    </div>
  )
}
