import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, KeyRound, UserX, UserCheck, MessagesSquare } from 'lucide-react'
import { toast } from 'sonner'
import {
  createStudentSchema,
  type CreateStudentInput,
} from '@/schemas'
import {
  createStudent,
  listStudents,
  nextStudentId,
  resetStudentPassword,
  setStudentStatus,
  updateStudent,
} from '@/services/students'
import { listAcademicYears, listClasses } from '@/services/classes'
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
import { formatDate, getErrorMessage } from '@/lib/utils'
import type { Student } from '@/types'

export function ManagerStudentsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Student | null>(null)
  const [disableTarget, setDisableTarget] = useState<Student | null>(null)
  const [resetTarget, setResetTarget] = useState<Student | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const students = useQuery({ queryKey: ['students'], queryFn: () => listStudents() })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears() })

  const form = useForm<CreateStudentInput>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      studentId: '',
      fullName: '',
      parentName: '',
      parentPhone: '',
      classId: '',
      password: '',
      confirmPassword: '',
      academicYearId: '',
      status: 'active',
    },
  })

  useEffect(() => {
    if (!open) return
    nextStudentId()
      .then((id) => form.setValue('studentId', id))
      .catch((e) => toast.error(getErrorMessage(e)))
    const activeYear = years.data?.find((y) => y.is_active)
    if (activeYear) form.setValue('academicYearId', activeYear.id)
  }, [open, years.data, form])

  const createMut = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      toast.success('Student created')
      setOpen(false)
      form.reset()
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!edit) return
      await updateStudent(edit.id, {
          parentName: form.getValues('parentName') || edit.parent_name,
          parentPhone: form.getValues('parentPhone') || edit.parent_phone,
          classId: form.getValues('classId') || edit.class_id,
          academicYearId: form.getValues('academicYearId') || edit.academic_year_id,
          fullName: form.getValues('fullName') || edit.profile?.full_name,
        })
    },
    onSuccess: () => {
      toast.success('Student updated')
      setEdit(null)
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const statusMut = useMutation({
    mutationFn: async () => {
      if (!disableTarget?.profile_id) return
      const next = disableTarget.profile?.status === 'disabled' ? 'active' : 'disabled'
      await setStudentStatus(disableTarget.profile_id, next)
    },
    onSuccess: () => {
      toast.success('Account status updated')
      setDisableTarget(null)
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!resetTarget) return
      await resetStudentPassword(resetTarget.student_id, newPassword)
    },
    onSuccess: () => {
      toast.success('Password reset')
      setResetTarget(null)
      setNewPassword('')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const classOptions = (classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))
  const yearOptions = (years.data ?? []).map((y) => ({ value: y.id, label: y.name }))

  return (
    <div>
      <PageHeader
        title="Student ID Management"
        description="Register students with SOMSTAR IDs, assign classes, and manage accounts."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Create Student
          </Button>
        }
      />

      {students.isLoading ? (
        <TableSkeleton />
      ) : !students.data?.length ? (
        <EmptyState title="No students yet" description="Create the first student account." action={<Button onClick={() => setOpen(true)}>Create Student</Button>} />
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700">
                  <th className="pb-3 pr-3 font-semibold">Student ID</th>
                  <th className="pb-3 pr-3 font-semibold">Full Name</th>
                  <th className="pb-3 pr-3 font-semibold">Parent Name</th>
                  <th className="pb-3 pr-3 font-semibold">Parent Phone</th>
                  <th className="pb-3 pr-3 font-semibold">Class</th>
                  <th className="pb-3 pr-3 font-semibold">Password</th>
                  <th className="pb-3 pr-3 font-semibold">Account</th>
                  <th className="pb-3 pr-3 font-semibold">Registered</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.data.map((s) => (
                  <tr key={s.id} className="border-b border-ink-100 dark:border-ink-800">
                    <td className="py-3 pr-3 font-mono text-xs font-semibold">{s.student_id}</td>
                    <td className="py-3 pr-3 font-medium">{s.profile?.full_name}</td>
                    <td className="py-3 pr-3">{s.parent_name}</td>
                    <td className="py-3 pr-3">{s.parent_phone}</td>
                    <td className="py-3 pr-3">{s.class?.name ?? '—'}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={s.password_set ? 'set' : 'unset'} label={s.password_set ? 'Set' : 'Unset'} />
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={s.profile?.status ?? 'pending'} />
                    </td>
                    <td className="py-3 pr-3">{formatDate(s.registration_date)}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Edit"
                          onClick={() => {
                            setEdit(s)
                            form.reset({
                              studentId: s.student_id,
                              fullName: s.profile?.full_name ?? '',
                              parentName: s.parent_name,
                              parentPhone: s.parent_phone,
                              classId: s.class_id ?? '',
                              academicYearId: s.academic_year_id ?? '',
                              password: '********',
                              confirmPassword: '********',
                              status: (s.profile?.status as CreateStudentInput['status']) ?? 'active',
                            })
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Reset password" onClick={() => setResetTarget(s)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={
                            (s.profile?.permissions as { school_wide_social?: boolean } | undefined)?.school_wide_social
                              ? 'Revoke school-wide chat'
                              : 'Grant school-wide chat'
                          }
                          title={
                            (s.profile?.permissions as { school_wide_social?: boolean } | undefined)?.school_wide_social
                              ? 'Revoke school-wide chat'
                              : 'Grant school-wide chat (e.g. Hilaal Yusuf)'
                          }
                          onClick={async () => {
                            try {
                              const { setSchoolWideSocial } = await import('@/services/school')
                              const enabled = !(s.profile?.permissions as { school_wide_social?: boolean } | undefined)
                                ?.school_wide_social
                              await setSchoolWideSocial(s.profile_id, enabled)
                              toast.success(enabled ? 'School-wide social enabled' : 'School-wide social disabled')
                              qc.invalidateQueries({ queryKey: ['students'] })
                            } catch (e) {
                              toast.error(getErrorMessage(e))
                            }
                          }}
                        >
                          <MessagesSquare
                            className={`h-4 w-4 ${
                              (s.profile?.permissions as { school_wide_social?: boolean } | undefined)?.school_wide_social
                                ? 'text-brand-600'
                                : ''
                            }`}
                          />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Toggle status" onClick={() => setDisableTarget(s)}>
                          {s.profile?.status === 'disabled' ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="space-y-3 md:hidden">
            {students.data.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-brand-700">{s.student_id}</p>
                    <p className="font-display text-lg font-semibold">{s.profile?.full_name}</p>
                    <p className="mt-1 text-sm text-ink-500">{s.class?.name ?? 'No class'}</p>
                    <p className="text-sm text-ink-600">{s.parent_name} · {s.parent_phone}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={s.password_set ? 'set' : 'unset'} label={s.password_set ? 'Password set' : 'Password unset'} />
                      <StatusBadge status={s.profile?.status ?? 'pending'} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEdit(s)}>Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => setResetTarget(s)}>Reset PW</Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const { setSchoolWideSocial } = await import('@/services/school')
                        const enabled = !(s.profile?.permissions as { school_wide_social?: boolean } | undefined)?.school_wide_social
                        await setSchoolWideSocial(s.profile_id, enabled)
                        toast.success(enabled ? 'School-wide social enabled' : 'School-wide social disabled')
                        qc.invalidateQueries({ queryKey: ['students'] })
                      } catch (e) {
                        toast.error(getErrorMessage(e))
                      }
                    }}
                  >
                    {(s.profile?.permissions as { school_wide_social?: boolean } | undefined)?.school_wide_social
                      ? 'Revoke school-wide chat'
                      : 'Grant school-wide chat'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDisableTarget(s)}>
                    {s.profile?.status === 'disabled' ? 'Enable' : 'Disable'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal open={open || !!edit} onClose={() => { setOpen(false); setEdit(null) }} title={edit ? 'Edit Student' : 'Create Student'} size="lg">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => {
            if (edit) updateMut.mutate()
            else createMut.mutate({
            loginId: values.studentId,
            password: values.password,
            fullName: values.fullName,
            student: {
              parentName: values.parentName,
              parentPhone: values.parentPhone,
              classId: values.classId,
              academicYearId: values.academicYearId,
              status: values.status,
            },
          })
          })}
        >
          <Input label="Student ID" {...form.register('studentId')} error={form.formState.errors.studentId?.message} disabled={!!edit} />
          <Input label="Full Name" {...form.register('fullName')} error={form.formState.errors.fullName?.message} />
          <Input label="Parent / Guardian Name" {...form.register('parentName')} error={form.formState.errors.parentName?.message} />
          <Input label="Parent Phone" {...form.register('parentPhone')} error={form.formState.errors.parentPhone?.message} />
          <Select label="Class" options={classOptions} placeholder="Select class" {...form.register('classId')} error={form.formState.errors.classId?.message} />
          <Select label="Academic Year" options={yearOptions} placeholder="Select year" {...form.register('academicYearId')} error={form.formState.errors.academicYearId?.message} />
          {!edit && (
            <>
              <Input label="Password" type="password" {...form.register('password')} error={form.formState.errors.password?.message} />
              <Input label="Confirm Password" type="password" {...form.register('confirmPassword')} error={form.formState.errors.confirmPassword?.message} />
              <Select
                label="Account Status"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'disabled', label: 'Disabled' },
                ]}
                {...form.register('status')}
              />
            </>
          )}
          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setEdit(null) }}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>{edit ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!disableTarget}
        onClose={() => setDisableTarget(null)}
        title={disableTarget?.profile?.status === 'disabled' ? 'Enable account?' : 'Disable account?'}
        message={`This will ${disableTarget?.profile?.status === 'disabled' ? 're-enable' : 'disable'} ${disableTarget?.profile?.full_name ?? 'this student'}.`}
        confirmLabel={disableTarget?.profile?.status === 'disabled' ? 'Enable' : 'Disable'}
        danger={disableTarget?.profile?.status !== 'disabled'}
        loading={statusMut.isPending}
        onConfirm={() => statusMut.mutate()}
      />

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset password" size="sm">
        <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
          <Button loading={resetMut.isPending} disabled={newPassword.length < 8} onClick={() => resetMut.mutate()}>
            Reset
          </Button>
        </div>
      </Modal>
    </div>
  )
}
