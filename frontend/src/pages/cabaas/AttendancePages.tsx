import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { listTeachers } from '@/services/teachers'
import { listTeacherAttendance, upsertTeacherAttendance } from '@/services/attendance'
import { listAttendance } from '@/services/attendance'
import { listClasses } from '@/services/classes'
import { listStudentsByClass } from '@/services/students'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, getErrorMessage } from '@/lib/utils'
import type { AttendanceStatus } from '@/types'

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'leave']

export function CabaasTeacherAttendancePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: () => listTeachers() })
  const history = useQuery({ queryKey: ['teacher-attendance'], queryFn: () => listTeacherAttendance() })

  const save = useMutation({
    mutationFn: () =>
      upsertTeacherAttendance(
        Object.entries(marks).map(([teacher_id, status]) => ({
          teacher_id,
          attendance_date: date,
          status,
          recorded_by: user!.profile.id,
        })),
      ),
    onSuccess: () => {
      toast.success('Saved')
      qc.invalidateQueries({ queryKey: ['teacher-attendance'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Teacher Attendance" description="Record and review teacher attendance." />
      <Card className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
      </Card>
      {teachers.isLoading ? <TableSkeleton /> : (
        <div className="mb-8 space-y-2">
          {(teachers.data ?? []).map((t) => (
            <Card key={t.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium">{t.profile?.full_name}</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${marks[t.id] === st ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800'}`}
                    onClick={() => setMarks((m) => ({ ...m, [t.id]: st }))}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      <h3 className="mb-3 font-display text-lg font-semibold">History</h3>
      {history.isLoading ? <TableSkeleton rows={3} /> : !history.data?.length ? <EmptyState title="No records" /> : (
        <div className="space-y-2">
          {history.data.slice(0, 50).map((r) => (
            <Card key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium">{(r.teacher as { profile?: { full_name?: string } })?.profile?.full_name}</p>
                <p className="text-xs text-ink-500">{formatDate(r.attendance_date)}</p>
              </div>
              <StatusBadge status={r.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function CabaasStudentAttendancePage() {
  const [classId, setClassId] = useState('')
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const records = useQuery({
    queryKey: ['cabaas-student-att', classId],
    queryFn: () => listAttendance({ classId: classId || undefined }),
  })

  return (
    <div>
      <PageHeader title="Student Attendance" description="View student attendance across classes." />
      <Card className="mb-4">
        <Select
          label="Class"
          options={[{ value: '', label: 'All' }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        />
      </Card>
      {records.isLoading ? <TableSkeleton /> : !records.data?.length ? <EmptyState title="No records" /> : (
        <div className="space-y-2">
          {records.data.slice(0, 80).map((r) => (
            <Card key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium">{r.student?.profile?.full_name}</p>
                <p className="text-xs text-ink-500">{formatDate(r.attendance_date)}</p>
              </div>
              <StatusBadge status={r.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function AttendanceManagerStudentPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const students = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  })
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: () => listTeachers() })

  const save = useMutation({
    mutationFn: async () => {
      const teacherId = teachers.data?.[0]?.id
      if (!teacherId) throw new Error('No teacher available to attribute attendance')
      const { upsertAttendance } = await import('@/services/attendance')
      await upsertAttendance(
        Object.entries(marks).map(([student_id, status]) => ({
          student_id,
          class_id: classId,
          teacher_id: teacherId,
          attendance_date: date,
          status,
        })),
      )
    },
    onSuccess: () => {
      toast.success('Saved')
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Student Attendance" description="Manage student attendance records." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select label="Class" placeholder="Select" options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={classId} onChange={(e) => setClassId(e.target.value)} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex items-end"><Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></div>
      </Card>
      {!classId ? <EmptyState title="Select a class" /> : (
        <div className="space-y-2">
          {(students.data ?? []).map((s) => (
            <Card key={s.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium">{s.profile?.full_name}</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((st) => (
                  <button key={st} type="button" className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${marks[s.id] === st ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800'}`} onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}>{st}</button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function AttendanceManagerOverviewPage() {
  return (
    <div>
      <PageHeader title="Overview" description="Manage student and teacher attendance." />
      <Card><p className="text-sm text-ink-500">Use the sidebar to open student or teacher attendance management.</p></Card>
    </div>
  )
}

export function AttendanceManagerTeacherPage() {
  return <CabaasTeacherAttendancePage />
}
