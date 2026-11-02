import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, KeyRound, UserX, UserCheck, MessagesSquare, Trash2, Eye, ImagePlus, X, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  createStudentSchema,
  type CreateStudentInput,
} from '@/schemas'
import {
  createStudent,
  deleteStudent,
  listStudents,
  nextStudentId,
  recoverStudentPassword,
  resetStudentPassword,
  setStudentStatus,
  updateStudent,
  uploadStudentImage,
  STUDENT_IMAGE_ACCEPT,
  type PasswordRecoveryResult,
} from '@/services/students'
import { listAcademicYears, listClasses } from '@/services/classes'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Avatar } from '@/pages/shared/chat/Avatar'
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
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [resetTarget, setResetTarget] = useState<Student | null>(null)
  const [recoverTarget, setRecoverTarget] = useState<Student | null>(null)
  const [recovered, setRecovered] = useState<PasswordRecoveryResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<string | null>(null)

  const students = useQuery({ queryKey: ['students'], queryFn: () => listStudents() })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears() })

  const form = useForm<CreateStudentInput>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      studentId: '',
      fullName: '',
      imageUrl: '',
      parentName: '',
      parentPhone: '',
      classId: '',
      password: '',
      confirmPassword: '',
      academicYearId: '',
      status: 'active',
    },
  })

  const clearSelectedImage = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setImageFile(null)
    setImagePreview(null)
    setImageError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const closeForm = () => {
    setOpen(false)
    setEdit(null)
    clearSelectedImage()
  }

  useEffect(() => {
    if (!open) return
    nextStudentId()
      .then((id) => form.setValue('studentId', id))
      .catch((e) => toast.error(getErrorMessage(e)))
    const activeYear = years.data?.find((y) => y.is_active)
    if (activeYear) form.setValue('academicYearId', activeYear.id)
  }, [open, years.data, form])

  const pickImage = (file: File | null) => {
    setImageError(null)
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setImageError('Student images must be JPG, JPEG, PNG or WebP')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Student images must be 5MB or smaller')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const preview = URL.createObjectURL(file)
    previewRef.current = preview
    setImageFile(file)
    setImagePreview(preview)
  }

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  const createMut = useMutation({
    mutationFn: async (payload: Parameters<typeof createStudent>[0]) => {
      // Upload the photo first so a storage failure never leaves a half-created login.
      const avatarUrl = imageFile ? await uploadStudentImage(imageFile) : null
      return createStudent({
        ...payload,
        student: { ...payload.student, avatarUrl },
      })
    },
    onSuccess: () => {
      toast.success('Student created')
      closeForm()
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

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return
      return deleteStudent(deleteTarget.id)
    },
    onSuccess: (result) => {
      toast.success(result?.message ?? 'Student deleted')
      setDeleteTarget(null)
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

  const recoverMut = useMutation({
    mutationFn: async () => {
      if (!recoverTarget) return
      return recoverStudentPassword(recoverTarget.student_id)
    },
    onSuccess: (result) => {
      if (result) setRecovered(result)
      setCopied(false)
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const openRecovery = (student: Student) => {
    setRecovered(null)
    setCopied(false)
    setRecoverTarget(student)
  }

  const openEdit = (s: Student) => {
    clearSelectedImage()
    setEdit(s)
    form.reset({
      studentId: s.student_id,
      fullName: s.profile?.full_name ?? '',
      imageUrl: '',
      parentName: s.parent_name,
      parentPhone: s.parent_phone,
      classId: s.class_id ?? '',
      academicYearId: s.academic_year_id ?? '',
      password: '********',
      confirmPassword: '********',
      status: (s.profile?.status as CreateStudentInput['status']) ?? 'active',
    })
  }

  // Class options come straight from the existing class records, so the school never
  // accumulates duplicate class names with different IDs.
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
                  <th className="pb-3 pr-3 font-semibold">Image</th>
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
                    <td className="py-3 pr-3">
                      <Avatar profile={s.profile} size="sm" />
                    </td>
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
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Reset password" onClick={() => setResetTarget(s)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Password recovery"
                          title="Password recovery"
                          onClick={() => openRecovery(s)}
                        >
                          <Eye className="h-4 w-4" />
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
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Delete"
                          title="Delete student"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
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
                  <div className="flex items-start gap-3">
                    <Avatar profile={s.profile} size="md" />
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
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => setResetTarget(s)}>Reset PW</Button>
                  <Button size="sm" variant="secondary" onClick={() => openRecovery(s)}>Recovery</Button>
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
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(s)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal open={open || !!edit} onClose={closeForm} title={edit ? 'Edit Student' : 'Create Student'} size="lg">
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

          {!edit && (
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-200">Student Image</span>
              <div className="flex items-center gap-3">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Student preview"
                    className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-ink-200 dark:ring-ink-700"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept={STUDENT_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileRef.current?.click()}
                    loading={createMut.isPending && !!imageFile}
                  >
                    {imagePreview ? 'Change image' : 'Choose image'}
                  </Button>
                  {imagePreview && (
                    <Button type="button" variant="ghost" onClick={clearSelectedImage}>
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                  <span className="text-xs text-ink-500">JPG, JPEG, PNG or WebP, up to 5MB</span>
                </div>
              </div>
              {imageError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{imageError}</p>}
            </div>
          )}

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
            <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete student?"
        message={`${deleteTarget?.profile?.full_name ?? 'This student'} (${deleteTarget?.student_id ?? ''}) will be permanently deleted. Their SOMSTAR ID will be released for reuse, attendance, results, finance and monitoring history will be preserved, and the student login will be removed.`}
        confirmLabel="Delete student"
        danger
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset password"
        size="sm"
      >
        <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
          <Button loading={resetMut.isPending} disabled={newPassword.length < 8} onClick={() => resetMut.mutate()}>
            Reset
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!recoverTarget}
        onClose={() => { setRecoverTarget(null); setRecovered(null) }}
        title="Password recovery"
        size="sm"
      >
        {!recovered ? (
          <>
            <p className="text-sm text-ink-600 dark:text-ink-300">
              Passwords cannot be viewed. {recoverTarget?.profile?.full_name ?? 'This student'} will receive a temporary
              password that must be changed at first sign-in.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRecoverTarget(null)}>Cancel</Button>
              <Button loading={recoverMut.isPending} onClick={() => recoverMut.mutate()}>
                Generate temporary password
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-600 dark:text-ink-300">{recovered.message}</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2 dark:bg-ink-800">
              <code className="flex-1 break-all font-mono text-sm">{recovered.temporaryPassword}</code>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Copy temporary password"
                onClick={() => {
                  void navigator.clipboard?.writeText(recovered.temporaryPassword)
                  setCopied(true)
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-ink-500">This password is shown once and cannot be retrieved again.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setRecoverTarget(null); setRecovered(null) }}>Done</Button>
              <Button onClick={() => { setRecovered(null); recoverMut.mutate() }}>Generate another</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
