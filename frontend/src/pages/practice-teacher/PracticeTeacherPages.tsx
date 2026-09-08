import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Send, Save, Eye, Edit3, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import {
  listPracticeStudents,
  createPracticeStudent,
  updatePracticeStudent,
  deletePracticeStudent,
} from '@/services/practice'
import { listClasses } from '@/services/classes'
import { listTeacherAttendance } from '@/services/attendance'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, formatDateTime, getErrorMessage } from '@/lib/utils'
import type { PracticeStudent } from '@/types'
import { useSearchParams } from 'react-router-dom'

export function PracticeTeacherDashboardPage() {
  const { user } = useAuth()
  const students = useQuery({
    queryKey: ['practice-students', user?.profile.id],
    queryFn: () => listPracticeStudents({ createdBy: user!.profile.id }),
  })
  const submitted = useMemo(
    () => (students.data ?? []).filter((s) => s.status === 'submitted').length,
    [students.data],
  )
  const drafts = useMemo(
    () => (students.data ?? []).filter((s) => s.status === 'draft').length,
    [students.data],
  )

  return (
    <div>
      <PageHeader title="Dashboard" description="Practice Teacher overview." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-2xl font-bold text-brand-600">{(students.data ?? []).length}</p>
          <p className="text-sm text-ink-500">Total Records</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-green-600">{submitted}</p>
          <p className="text-sm text-ink-500">Submitted</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-amber-600">{drafts}</p>
          <p className="text-sm text-ink-500">Drafts</p>
        </Card>
      </div>
      <Card className="mt-6">
        <h3 className="font-display text-lg font-semibold">Quick Actions</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => window.location.href = '/practice/somali-speaking'}>
            New Somali Speaking Student
          </Button>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => window.location.href = '/practice/english-speaking'}>
            New English Speaking Student
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function PracticeStudentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const filterType = searchParams.get('type') || ''
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const students = useQuery({
    queryKey: ['practice-students', user?.profile.id],
    queryFn: () => listPracticeStudents({ createdBy: user!.profile.id }),
  })

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })

  const form = useForm({
    defaultValues: { student_name: '', student_id: '', class_id: '', practice_type: 'somali_speaking', language: 'somali', notes: '' },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: { student_name: string; student_id: string; class_id: string; practice_type: string; language: string; notes: string; status?: string }) => {
      const status = values.status || 'draft'
      if (editId) {
        return updatePracticeStudent(editId, {
          student_name: values.student_name,
          student_id: values.student_id || null,
          class_id: values.class_id || null,
          notes: values.notes || null,
          status,
          updated_by: user!.profile.id,
        })
      }
      return createPracticeStudent({
        student_name: values.student_name,
        student_id: values.student_id || null,
        class_id: values.class_id || null,
        practice_type: values.practice_type,
        language: values.language,
        notes: values.notes || null,
        status,
        created_by: user!.profile.id,
      })
    },
    onSuccess: () => {
      toast.success('Successfully saved.')
      setOpen(false)
      setEditId(null)
      form.reset()
      qc.invalidateQueries({ queryKey: ['practice-students'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  function openEdit(s: PracticeStudent) {
    setEditId(s.id)
    form.reset({
      student_name: s.student_name,
      student_id: s.student_id || '',
      class_id: s.class_id || '',
      practice_type: s.practice_type,
      language: s.language,
      notes: s.notes || '',
    })
    setOpen(true)
  }

  function openCreate(type: string, language: string) {
    setEditId(null)
    form.reset({ student_name: '', student_id: '', class_id: '', practice_type: type, language, notes: '' })
    setOpen(true)
  }

  const filtered = useMemo(() => {
    if (!filterType) return students.data ?? []
    return (students.data ?? []).filter((s) => s.practice_type === filterType)
  }, [students.data, filterType])

  return (
    <div>
      <PageHeader
        title="Practice Students"
        description="Manage your practice student records."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => openCreate('somali_speaking', 'somali')}>
              <Plus className="mr-1 h-4 w-4" /> Somali Speaking
            </Button>
            <Button size="sm" onClick={() => openCreate('english_speaking', 'english')}>
              <Plus className="mr-1 h-4 w-4" /> English Speaking
            </Button>
          </div>
        }
      />
      {students.isLoading ? <TableSkeleton /> : !filtered.length ? (
        <EmptyState title="No records" description="Create a new practice student record to get started." />
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.student_name}</p>
                <p className="text-xs text-ink-500">
                  {s.student_id && `${s.student_id} · `}{s.practice_type.replace('_', ' ')} · {formatDate(s.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={s.status as 'draft' | 'submitted'} />
                {s.status === 'draft' && (
                  <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditId(null) }}
        title={editId ? 'Edit Record' : 'New Practice Student'}
      >
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => saveMutation.mutate({ ...v, status: editId ? undefined : 'draft' }))}>
          <Input label="Student Name" {...form.register('student_name', { required: true })} />
          <Input label="Student ID (optional)" {...form.register('student_id')} />
          <Select
            label="Class"
            placeholder="Select class"
            options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={form.watch('class_id')}
            onChange={(e) => form.setValue('class_id', e.target.value)}
          />
          <Input label="Notes / Comments" {...form.register('notes')} />
          {!editId && (
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" className="flex-1" leftIcon={<Save className="h-4 w-4" />}>
                Save Draft
              </Button>
              <Button
                type="button"
                className="flex-1"
                leftIcon={<Send className="h-4 w-4" />}
                onClick={() => {
                  form.handleSubmit((v) => saveMutation.mutate({ ...v, status: 'submitted' }))()
                }}
              >
                Submit
              </Button>
            </div>
          )}
          {editId && (
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" leftIcon={<Save className="h-4 w-4" />}>
                Update
              </Button>
              <Button
                type="button"
                className="flex-1"
                leftIcon={<Send className="h-4 w-4" />}
                onClick={() => {
                  form.handleSubmit((v) => saveMutation.mutate({ ...v, status: 'submitted' }))()
                }}
              >
                Submit
              </Button>
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}

export function SomaliSpeakingStudentsPage() {
  return <PracticeStudentsPageWithFilter type="somali_speaking" language="somali" title="Somali Speaking Students" />
}

export function EnglishSpeakingStudentsPage() {
  return <PracticeStudentsPageWithFilter type="english_speaking" language="english" title="English Speaking Students" submitOnly />
}

function PracticeStudentsPageWithFilter({ type, language, title, submitOnly }: { type: string; language: string; title: string; submitOnly?: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const students = useQuery({
    queryKey: ['practice-students', type, user?.profile.id],
    queryFn: () => listPracticeStudents({ createdBy: user!.profile.id, practiceType: type }),
  })

  const form = useForm({
    defaultValues: { student_name: '', student_id: '', class_id: '', notes: '' },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: { student_name: string; student_id: string; class_id: string; notes: string; status: string }) => {
      return createPracticeStudent({
        student_name: values.student_name,
        student_id: values.student_id || null,
        class_id: values.class_id || null,
        practice_type: type,
        language,
        notes: values.notes || null,
        status: values.status,
        created_by: user!.profile.id,
      })
    },
    onSuccess: (_, variables) => {
      if (variables.status === 'submitted') {
        toast.success('Report successfully submitted to Supervisor.')
      } else {
        toast.success('Successfully saved.')
      }
      form.reset()
      qc.invalidateQueries({ queryKey: ['practice-students'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title={title} description={`Register ${language} speaking practice students.`} />

      <Card className="mb-6">
        <h3 className="font-display text-lg font-semibold">New Record</h3>
        <div className="mt-3 space-y-3">
          <Input label="Student Name" {...form.register('student_name', { required: true })} />
          <Input label="Student ID (optional)" {...form.register('student_id')} />
          <Select
            label="Class"
            placeholder="Select class"
            options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={form.watch('class_id')}
            onChange={(e) => form.setValue('class_id', e.target.value)}
          />
          <Input label="Notes / Comments" {...form.register('notes')} />
          <div className="flex gap-2">
            {!submitOnly && (
              <Button
                variant="secondary"
                className="flex-1"
                leftIcon={<Save className="h-4 w-4" />}
                loading={saveMutation.isPending}
                onClick={() => form.handleSubmit((v) => saveMutation.mutate({ ...v, status: 'draft' }))()}
              >
                Save Draft
              </Button>
            )}
            <Button
              className={submitOnly ? 'w-full' : 'flex-1'}
              leftIcon={<Send className="h-4 w-4" />}
              loading={saveMutation.isPending}
              onClick={() => form.handleSubmit((v) => saveMutation.mutate({ ...v, status: 'submitted' }))()}
            >
              {submitOnly ? 'Save & Submit' : 'Submit'}
            </Button>
          </div>
        </div>
      </Card>

      <h3 className="font-display mb-3 text-lg font-semibold">My Records</h3>
      {students.isLoading ? <TableSkeleton /> : !students.data?.length ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} />
      ) : (
        <div className="space-y-2">
          {students.data.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{s.student_name}</p>
                <p className="text-xs text-ink-500">{s.student_id && `${s.student_id} · `}{formatDate(s.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={s.status as 'draft' | 'submitted'} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function PracticeSubmissionsPage() {
  const { user } = useAuth()
  const students = useQuery({
    queryKey: ['practice-students', 'submitted', user?.profile.id],
    queryFn: () => listPracticeStudents({ createdBy: user!.profile.id, status: 'submitted' }),
  })

  return (
    <div>
      <PageHeader title="Submissions" description="All your submitted practice reports." />
      {students.isLoading ? <TableSkeleton /> : !students.data?.length ? (
        <EmptyState title="No submissions yet" description="Submit a practice report to see it here." />
      ) : (
        <div className="space-y-3">
          {students.data.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.student_name}</p>
                <p className="text-xs text-ink-500">
                  {s.student_id && `${s.student_id} · `}{s.practice_type.replace('_', ' ')} · {s.submitted_at ? formatDateTime(s.submitted_at) : ''}
                </p>
              </div>
              <StatusBadge status="submitted" />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function PracticeTeacherAttendancePage() {
  const { user } = useAuth()
  const [fTeacherId, setFTeacherId] = useState('')
  const [fFrom, setFFrom] = useState(new Date().toISOString().slice(0, 7))

  const attendance = useQuery({
    queryKey: ['teacher-attendance', fTeacherId, fFrom],
    queryFn: () =>
      listTeacherAttendance({
        teacherId: fTeacherId || undefined,
        from: fFrom ? `${fFrom}-01` : undefined,
        to: fFrom ? new Date(new Date(fFrom + '-01').getFullYear(), new Date(fFrom + '-01').getMonth() + 1, 0).toISOString().slice(0, 10) : undefined,
      }),
  })

  return (
    <div>
      <PageHeader title="Teacher Attendance" description="View attendance records." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input label="Teacher ID" placeholder="Filter by teacher ID" value={fTeacherId} onChange={(e) => setFTeacherId(e.target.value)} />
        <Input label="Month" type="month" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
      </Card>
      {attendance.isLoading ? <TableSkeleton /> : !attendance.data?.length ? (
        <EmptyState title="No attendance records" />
      ) : (
        <div className="space-y-2">
          {(attendance.data as Array<{ id: string; attendance_date: string; status: string; notes: string | null; teacher?: { teacher_id?: string; profile?: { full_name?: string } } }>).map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{r.teacher?.profile?.full_name ?? '—'}</p>
                <p className="text-xs text-ink-500">{r.teacher?.teacher_id ?? ''} · {formatDate(r.attendance_date)}</p>
              </div>
              <StatusBadge status={r.status as 'present' | 'absent' | 'late' | 'leave'} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
