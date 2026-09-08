import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { getTeacherClasses } from '@/services/teachers'
import { listStudentsByClass } from '@/services/students'
import { listAttendance, monthlySummary, upsertAttendance } from '@/services/attendance'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, getErrorMessage, monthName } from '@/lib/utils'
import type { AttendanceStatus, ClassRecord } from '@/types'

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'leave']

export function TeacherAttendancePage() {
  const { user } = useAuth()
  const teacherId = user!.teacher!.id
  const qc = useQueryClient()
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [historyStudent, setHistoryStudent] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const classes = useQuery({
    queryKey: ['teacher-classes', teacherId],
    queryFn: () => getTeacherClasses(teacherId),
  })

  const students = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  })

  const history = useQuery({
    queryKey: ['attendance-history', classId],
    queryFn: () => listAttendance({ classId, teacherId }),
    enabled: !!classId,
  })

  const summary = useQuery({
    queryKey: ['attendance-summary', historyStudent, year, month],
    queryFn: () => monthlySummary(historyStudent, year, month),
    enabled: !!historyStudent,
  })

  const save = useMutation({
    mutationFn: async () => {
      const records = Object.entries(marks).map(([student_id, status]) => ({
        student_id,
        class_id: classId,
        teacher_id: teacherId,
        attendance_date: date,
        status,
      }))
      if (!records.length) throw new Error('Mark at least one student')
      await upsertAttendance(records)
    },
    onSuccess: () => {
      toast.success('Attendance saved')
      qc.invalidateQueries({ queryKey: ['attendance-history', classId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const classOptions = useMemo(
    () => (classes.data as ClassRecord[] | undefined)?.map((c) => ({ value: c.id, label: c.name })) ?? [],
    [classes.data],
  )

  return (
    <div>
      <PageHeader title="Attendance" description="Mark Present, Absent, Late, or Leave for your class." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select label="Class" placeholder="Select class" options={classOptions} value={classId} onChange={(e) => { setClassId(e.target.value); setMarks({}) }} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex items-end">
          <Button className="w-full" loading={save.isPending} disabled={!classId} onClick={() => save.mutate()}>
            Save attendance
          </Button>
        </div>
      </Card>

      {!classId ? (
        <EmptyState title="Select a class" description="Choose one of your assigned classes." />
      ) : students.isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="mb-8 space-y-2">
          {(students.data ?? []).map((s) => (
            <Card key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{s.profile?.full_name}</p>
                <p className="font-mono text-xs text-ink-500">{s.student_id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${marks[s.id] === st ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800'}`}
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
      {history.isLoading ? <TableSkeleton rows={3} /> : (
        <div className="mb-8 max-h-64 space-y-2 overflow-y-auto">
          {(history.data ?? []).slice(0, 40).map((r) => (
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

      <h3 className="mb-3 font-display text-lg font-semibold">Monthly summary</h3>
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select
          label="Student"
          placeholder="Select student"
          options={(students.data ?? []).map((s) => ({ value: s.id, label: s.profile?.full_name ?? s.student_id }))}
          value={historyStudent}
          onChange={(e) => setHistoryStudent(e.target.value)}
        />
        <Select
          label="Month"
          options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
        <Input label="Year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </Card>
      {summary.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(['present', 'absent', 'late', 'leave', 'total'] as const).map((k) => (
            <Card key={k} className="text-center">
              <p className="text-xs uppercase text-ink-500">{k}</p>
              <p className="font-display text-2xl font-semibold">{Array.isArray(summary.data) ? 0 : ((summary.data as Record<string, number>)?.[k] ?? 0)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
