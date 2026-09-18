import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Pencil, Plus, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { createTeacherSchema, type CreateTeacherInput } from '@/schemas'
import {
  createTeacher,
  listTeachers,
  nextTeacherId,
  resetTeacherPassword,
  setTeacherStatus,
  updateTeacher,
} from '@/services/teachers'
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
import { getErrorMessage } from '@/lib/utils'
import type { Teacher } from '@/types'

export function ManagerTeachersPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Teacher | null>(null)
  const [disableTarget, setDisableTarget] = useState<Teacher | null>(null)
  const [resetTarget, setResetTarget] = useState<Teacher | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])

  const teachers = useQuery({ queryKey: ['teachers'], queryFn: () => listTeachers() })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })

  const form = useForm<CreateTeacherInput>({
    resolver: zodResolver(createTeacherSchema),
    defaultValues: {
      teacherId: '',
      fullName: '',
      phone: '',
      specialization: '',
      role: 'teacher',
      password: '',
      confirmPassword: '',
      classIds: [],
      status: 'active',
    },
  })

  useEffect(() => {
    if (!open) return
    nextTeacherId()
      .then((id) => form.setValue('teacherId', id))
      .catch((e) => toast.error(getErrorMessage(e)))
  }, [open, form])

  useEffect(() => {
    form.setValue('classIds', selectedClasses)
  }, [selectedClasses, form])

  const createMut = useMutation({
    mutationFn: createTeacher,
    onSuccess: () => {
      toast.success('Teacher created')
      setOpen(false)
      setSelectedClasses([])
      form.reset()
      qc.invalidateQueries({ queryKey: ['teachers'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!edit) return
      await updateTeacher(edit.id, {
          specialization: form.getValues('specialization') || null,
          fullName: form.getValues('fullName'),
          phone: form.getValues('phone') || null,
          classIds: selectedClasses,
        })
    },
    onSuccess: () => {
      toast.success('Teacher updated')
      setEdit(null)
      qc.invalidateQueries({ queryKey: ['teachers'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const statusMut = useMutation({
    mutationFn: async () => {
      if (!disableTarget?.profile_id) return
      await setTeacherStatus(
        disableTarget.profile_id,
        disableTarget.profile?.status === 'disabled' ? 'active' : 'disabled',
      )
    },
    onSuccess: () => {
      toast.success('Status updated')
      setDisableTarget(null)
      qc.invalidateQueries({ queryKey: ['teachers'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!resetTarget) return
      await resetTeacherPassword(resetTarget.teacher_id, newPassword)
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
        title="Teachers"
        description="Create teacher accounts, assign classes, and manage access."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setSelectedClasses([]); setOpen(true) }}>Add Teacher</Button>}
      />

      {teachers.isLoading ? (
        <TableSkeleton />
      ) : !teachers.data?.length ? (
        <EmptyState title="No teachers" description="Add your first teacher." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teachers.data.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-brand-700">{t.teacher_id}</p>
                  <p className="font-display text-lg font-semibold">{t.profile?.full_name}</p>
                  <p className="text-sm text-ink-500">{t.specialization || 'No specialization'}</p>
                </div>
                <StatusBadge status={t.profile?.status ?? 'pending'} />
              </div>
              <p className="mt-3 text-xs text-ink-500">
                Classes: {(t.classes ?? []).map((c) => c.name).join(', ') || 'None'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setEdit(t)
                    setSelectedClasses((t.classes ?? []).map((c) => c.id))
                    form.reset({
                      teacherId: t.teacher_id,
                      fullName: t.profile?.full_name ?? '',
                      phone: t.profile?.phone ?? '',
                      specialization: t.specialization ?? '',
                      role: (t.profile?.role as CreateTeacherInput['role']) ?? 'teacher',
                      password: '********',
                      confirmPassword: '********',
                      classIds: (t.classes ?? []).map((c) => c.id),
                      status: (t.profile?.status as CreateTeacherInput['status']) ?? 'active',
                    })
                  }}
                >
                  Edit
                </Button>
                <Button size="sm" variant="secondary" leftIcon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => setResetTarget(t)}>
                  Reset PW
                </Button>
                <Button size="sm" variant="danger" leftIcon={<UserX className="h-3.5 w-3.5" />} onClick={() => setDisableTarget(t)}>
                  {t.profile?.status === 'disabled' ? 'Enable' : 'Disable'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open || !!edit}
        onClose={() => { setOpen(false); setEdit(null) }}
        title={edit ? 'Edit Teacher' : 'Create Teacher'}
        size="lg"
      >
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => {
            if (edit) updateMut.mutate()
            else createMut.mutate({
              loginId: values.teacherId,
              password: values.password,
              fullName: values.fullName,
              phone: values.phone,
              role: values.role,
              teacher: {
                specialization: values.specialization,
                classIds: selectedClasses,
                isPractice: values.role === 'practice_teacher',
              },
            })
          })}
        >
          <Input label="Teacher ID" {...form.register('teacherId')} disabled={!!edit} error={form.formState.errors.teacherId?.message} />
          <Input label="Full Name" {...form.register('fullName')} error={form.formState.errors.fullName?.message} />
          <Input label="Phone" {...form.register('phone')} />
          <Input label="Specialization" {...form.register('specialization')} />
          <Select
            label="Role"
            options={[
              { value: 'teacher', label: 'Teacher' },
              { value: 'practice_teacher', label: 'Practice Teacher' },
              { value: 'supervisor', label: 'Supervisor' },
            ]}
            {...form.register('role')}
          />
          {!edit && (
            <>
              <Input label="Password" type="password" {...form.register('password')} error={form.formState.errors.password?.message} />
              <Input label="Confirm Password" type="password" {...form.register('confirmPassword')} error={form.formState.errors.confirmPassword?.message} />
            </>
          )}
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">Assign classes</p>
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
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEdit(null) }}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>{edit ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!disableTarget}
        onClose={() => setDisableTarget(null)}
        title="Change teacher status?"
        message={`Update account status for ${disableTarget?.profile?.full_name ?? 'this teacher'}.`}
        danger
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
