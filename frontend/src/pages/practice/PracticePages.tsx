import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Send, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { createNotice, listNotices } from '@/services/audit'
import { listStudentsByClass } from '@/services/students'
import { getTeacherClasses } from '@/services/teachers'
import { listPracticeAttendance, upsertPracticeAttendance } from '@/services/attendance'
import { addBehavior } from '@/services/behavior'
import { api } from '@/services/api'
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
import type { AttendanceStatus } from '@/types'

export function PracticeOverviewPage() {
  const notices = useQuery({ queryKey: ['practice-notices'], queryFn: () => listNotices({ isPractice: true }) })
  return (
    <div>
      <PageHeader title="Overview" description="Practice notices and attendance." />
      <Card>
        <p className="text-sm text-ink-500">{notices.data?.length ?? 0} practice notices published.</p>
      </Card>
    </div>
  )
}

function PracticeNoticesBase({ late }: { late?: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const notices = useQuery({
    queryKey: ['practice-notices', late],
    queryFn: () => listNotices({ isPractice: true, isLate: late ?? false }),
  })
  const form = useForm({ defaultValues: { title: '', body: '' } })
  const create = useMutation({
    mutationFn: (v: { title: string; body: string }) =>
      createNotice({
        title: v.title,
        body: v.body,
        is_practice: true,
        is_late_notice: !!late,
        published_by: user!.profile.id,
      }),
    onSuccess: () => {
      toast.success('Published')
      setOpen(false)
      form.reset()
      qc.invalidateQueries({ queryKey: ['practice-notices'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title={late ? 'Late Notices' : 'Practice Notices'}
        description={late ? 'Notices about lateness.' : 'Practice-related announcements.'}
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New</Button>}
      />
      {notices.isLoading ? <TableSkeleton /> : !notices.data?.length ? <EmptyState title="No notices" /> : (
        <div className="space-y-3">
          {notices.data.map((n) => (
            <Card key={n.id}>
              <p className="font-display text-lg font-semibold">{n.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
              <p className="mt-2 text-xs text-ink-500">{n.published_at ? formatDateTime(n.published_at) : ''}</p>
            </Card>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Publish notice">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Input label="Title" {...form.register('title', { required: true })} />
          <textarea className="min-h-28 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900" {...form.register('body', { required: true })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Publish</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export function PracticeNoticesPage() {
  return <PracticeNoticesBase />
}

export function PracticeLateNoticesPage() {
  return <PracticeNoticesBase late />
}

export function PracticeAttendancePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const classes = useQuery({
    queryKey: ['practice-classes', user?.teacher?.id],
    queryFn: () => getTeacherClasses(user!.teacher!.id),
    enabled: !!user?.teacher?.id,
  })
  const students = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  })
  const history = useQuery({
    queryKey: ['practice-att', classId],
    queryFn: () => listPracticeAttendance({ classId: classId || undefined }),
  })

  const save = useMutation({
    mutationFn: () =>
      upsertPracticeAttendance(
        Object.entries(marks).map(([student_id, status]) => ({
          student_id,
          class_id: classId,
          recorded_by: user!.profile.id,
          practice_date: date,
          status,
        })),
      ),
    onSuccess: () => {
      toast.success('Saved')
      qc.invalidateQueries({ queryKey: ['practice-att'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Practice Attendance" description="Mark practice session attendance." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select label="Class" placeholder="Select" options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={classId} onChange={(e) => setClassId(e.target.value)} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex items-end"><Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></div>
      </Card>
      {!classId ? <EmptyState title="Select a class" /> : (
        <div className="mb-6 space-y-2">
          {(students.data ?? []).map((s) => (
            <Card key={s.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium">{s.profile?.full_name}</p>
              <div className="flex flex-wrap gap-2">
                {(['present', 'absent', 'late', 'leave'] as AttendanceStatus[]).map((st) => (
                  <button key={st} type="button" className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${marks[s.id] === st ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800'}`} onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}>{st}</button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      <h3 className="mb-3 font-display text-lg font-semibold">History</h3>
      {(history.data ?? []).slice(0, 40).map((r) => (
        <Card key={r.id} className="mb-2 flex items-center justify-between py-2.5">
          <div>
            <p className="text-sm font-medium">{(r.student as { profile?: { full_name?: string } })?.profile?.full_name}</p>
            <p className="text-xs text-ink-500">{formatDate(r.practice_date)}</p>
          </div>
          <StatusBadge status={r.status} />
        </Card>
      ))}
    </div>
  )
}

export function PracticeBehaviorPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [classId, setClassId] = useState('')

  const classes = useQuery({
    queryKey: ['practice-classes', user?.teacher?.id],
    queryFn: () => getTeacherClasses(user!.teacher!.id),
    enabled: !!user?.teacher?.id,
  })
  const students = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  })

  async function notifyCabaas(studentName: string, message: string) {
    const { data: cabaasList } = await api
      .from('profiles')
      .select('id')
      .eq('role', 'teacher_cabaas')
      .eq('status', 'active')
    if (!cabaasList?.length) return
    await api.from('notifications').insert(
      cabaasList.map((p) => ({
        profile_id: p.id,
        title: `Arday: ${studentName}`,
        body: message,
        type: 'system',
        link: '/cabaas/student-attendance',
      })),
    )
  }

  const behaviorMut = useMutation({
    mutationFn: async (values: { student_id: string; description: string }) => {
      const rec = await addBehavior({
        student_id: values.student_id,
        category: 'negative',
        description: values.description,
        recorded_by: user!.profile.id,
      })
      const s = students.data?.find((st) => st.id === values.student_id)
      await notifyCabaas(
        s?.profile?.full_name ?? 'Arday',
        `${s?.profile?.full_name ?? 'Arday'} — ${values.description}`,
      )
      return rec
    },
    onSuccess: () => {
      toast.success('Waa la diray — Cabaas waa la og yahay')
      qc.invalidateQueries({ queryKey: ['student-behavior'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const lateMut = useMutation({
    mutationFn: async (values: { student_id: string; arrival_time: string }) => {
      const rec = await addBehavior({
        student_id: values.student_id,
        category: 'negative',
        description: `Waa soo daahay — yimid: ${values.arrival_time}`,
        recorded_by: user!.profile.id,
      })
      const s = students.data?.find((st) => st.id === values.student_id)
      await notifyCabaas(
        s?.profile?.full_name ?? 'Arday',
        `${s?.profile?.full_name ?? 'Arday'} waa soo daahay — yimid ${values.arrival_time}`,
      )
      return rec
    },
    onSuccess: () => {
      toast.success('Daahista waa la diray — Cabaas waa la og yahay')
      qc.invalidateQueries({ queryKey: ['student-behavior'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const [behaviorStudent, setBehaviorStudent] = useState('')
  const [behaviorDesc, setBehaviorDesc] = useState('')

  const [lateStudent, setLateStudent] = useState('')
  const [lateTime, setLateTime] = useState(new Date().toTimeString().slice(0, 5))

  return (
    <div>
      <PageHeader title="Anshaxa & Daahista" description="Ku soo gudbi ardayda anshax-darro ama daahista. Cabaas wuu ogaan doonaa." />

      <Card className="mb-6">
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">Fasalka</label>
        <Select
          placeholder="Dooro fasalka"
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setBehaviorStudent(''); setLateStudent('') }}
        />
      </Card>

      {classId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Anshax-darro
            </div>
            <Select
              label="Ardayga"
              placeholder="Dooro arday"
              options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.profile?.full_name} (${s.student_id})` }))}
              value={behaviorStudent}
              onChange={(e) => setBehaviorStudent(e.target.value)}
            />
            <textarea
              placeholder="Qor waxa uu sameeyay (dambiga)..."
              className="mt-3 min-h-28 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900"
              value={behaviorDesc}
              onChange={(e) => setBehaviorDesc(e.target.value)}
            />
            <Button
              className="mt-3 w-full"
              leftIcon={<Send className="h-4 w-4" />}
              loading={behaviorMut.isPending}
              disabled={!behaviorStudent || !behaviorDesc.trim()}
              onClick={() => behaviorMut.mutate({ student_id: behaviorStudent, description: behaviorDesc.trim() })}
            >
              U dir Cabaas
            </Button>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-amber-500" />
              Daahid
            </div>
            <Select
              label="Ardayga"
              placeholder="Dooro arday"
              options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.profile?.full_name} (${s.student_id})` }))}
              value={lateStudent}
              onChange={(e) => setLateStudent(e.target.value)}
            />
            <Input
              label="Waqtiga uu yimid"
              type="time"
              value={lateTime}
              onChange={(e) => setLateTime(e.target.value)}
            />
            <Button
              className="mt-3 w-full"
              leftIcon={<Send className="h-4 w-4" />}
              loading={lateMut.isPending}
              disabled={!lateStudent || !lateTime}
              onClick={() => lateMut.mutate({ student_id: lateStudent, arrival_time: lateTime })}
            >
              U dir Cabaas
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
