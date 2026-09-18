import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAttendance, listTeacherAttendance } from '@/services/attendance'
import { listClasses } from '@/services/classes'
import { listStudentsByClass } from '@/services/students'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'
import type { AttendanceStatus } from '@/types'

const STATUS_KEYS: AttendanceStatus[] = ['present', 'absent', 'late', 'leave', 'permission']
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  leave: 'Leave',
  excused: 'Excused',
  permission: 'Permission',
}

export function ManagerAttendancePage() {
  const [tab, setTab] = useState<'student' | 'teacher'>('student')
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [historyStudent, setHistoryStudent] = useState('')
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })

  const classStudents = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  })

  const dayRecords = useQuery({
    queryKey: ['attendance-day', classId, date],
    queryFn: () => listAttendance({ classId: classId || undefined, from: date, to: date }),
  })

  const studentAtt = useQuery({
    queryKey: ['attendance', classId, from, to],
    queryFn: () => listAttendance({ classId: classId || undefined, from: from || undefined, to: to || undefined }),
  })

  const studentHistory = useQuery({
    queryKey: ['attendance-student-history', historyStudent],
    queryFn: () => listAttendance({ studentId: historyStudent }),
    enabled: !!historyStudent,
  })

  const teacherAtt = useQuery({
    queryKey: ['teacher-attendance', from, to],
    queryFn: () => listTeacherAttendance({ from: from || undefined, to: to || undefined }),
    enabled: tab === 'teacher',
  })

  const dayStatusById = useMemo(() => {
    const map = new Map<string, AttendanceStatus>()
    for (const r of dayRecords.data ?? []) map.set(r.student_id, r.status)
    return map
  }, [dayRecords.data])

  const dayTotals = useMemo(() => {
    const totals: Record<string, number> = { present: 0, absent: 0, late: 0, leave: 0, excused: 0, permission: 0 }
    for (const r of dayRecords.data ?? []) {
      if (r.status in totals) totals[r.status] += 1
    }
    return totals
  }, [dayRecords.data])

  const historyTotals = useMemo(() => {
    const totals: Record<string, number> = { present: 0, absent: 0, late: 0, leave: 0, excused: 0, permission: 0 }
    const records = studentHistory.data ?? []
    for (const r of records) {
      if (r.status in totals) totals[r.status] += 1
    }
    return { ...totals, total: records.length } as Record<string, number>
  }, [studentHistory.data])

  return (
    <div>
      <PageHeader title="Attendance" description="School-wide student and teacher attendance records." />
      <div className="mb-4 flex flex-wrap gap-2">
        <ButtonTab active={tab === 'student'} onClick={() => setTab('student')}>Students</ButtonTab>
        <ButtonTab active={tab === 'teacher'} onClick={() => setTab('teacher')}>Teachers</ButtonTab>
      </div>
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        {tab === 'student' && (
          <Select
            label="Class"
            placeholder="All classes"
            options={[{ value: '', label: 'All classes' }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
        )}
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Card>

      {tab === 'student' ? (
        <>
          {!classId ? (
            <EmptyState title="Select a class" description="Choose a class to build the daily attendance report." />
          ) : (
            <>
              <h3 className="mb-3 font-display text-lg font-semibold">Daily Report · {classId ? (classes.data?.find((c) => c.id === classId)?.name ?? '') : ''} · {formatDate(date)}</h3>
              <Card className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
                {STATUS_KEYS.map((k) => (
                  <span key={k} className="text-sm">
                    <span className="font-semibold text-ink-900 dark:text-white">{dayTotals[k]}</span>{' '}
                    <span className="text-ink-500">{STATUS_LABELS[k]}</span>
                  </span>
                ))}
                <span className="text-sm">
                  <span className="font-semibold text-ink-900 dark:text-white">{classStudents.data?.length ?? 0}</span>{' '}
                  <span className="text-ink-500">enrolled</span>
                </span>
              </Card>
              {classStudents.isLoading || dayRecords.isLoading ? (
                <TableSkeleton />
              ) : (
                <div className="mb-8 overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-700">
                  <table className="min-w-full divide-y divide-ink-200 text-left text-sm dark:divide-ink-700">
                    <thead className="bg-ink-50 dark:bg-ink-900">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-ink-500">Student Name</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-ink-500">Student ID</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-ink-500">Parent Phone</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase text-ink-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                      {(classStudents.data ?? []).map((s) => (
                        <tr key={s.id} className="hover:bg-ink-50 dark:hover:bg-ink-900">
                          <td className="px-4 py-3 font-medium">{s.profile?.full_name}</td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{s.student_id}</td>
                          <td className="px-4 py-3">{s.parent_phone || '—'}</td>
                          <td className="px-4 py-3">
                            {dayStatusById.has(s.id) ? (
                              <StatusBadge status={dayStatusById.get(s.id)!} label={STATUS_LABELS[dayStatusById.get(s.id)!]} />
                            ) : (
                              <span className="text-xs text-ink-400">Not marked</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <h3 className="mb-3 font-display text-lg font-semibold">Student attendance history</h3>
          <Card className="mb-4 grid gap-3 sm:grid-cols-3">
            <Select
              label="Student"
              placeholder="Select student"
              options={(classStudents.data ?? []).map((s) => ({
                value: s.id,
                label: `${s.profile?.full_name ?? ''} (${s.student_id})`,
              })).filter((o) => o.value)}
              value={historyStudent}
              onChange={(e) => setHistoryStudent(e.target.value)}
            />
          </Card>
          {historyStudent && historyTotals.total >= 0 && (
            <Card className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
              {STATUS_KEYS.map((k) => (
                <span key={k} className="text-sm">
                  <span className="font-semibold text-ink-900 dark:text-white">{historyTotals[k]}</span>{' '}
                  <span className="text-ink-500">{STATUS_LABELS[k]}</span>
                </span>
              ))}
              <span className="text-sm">
                <span className="font-semibold text-ink-900 dark:text-white">{historyTotals.total}</span>{' '}
                <span className="text-ink-500">total</span>
              </span>
            </Card>
          )}
          {historyStudent && (
            <div className="mb-8 max-h-72 space-y-2 overflow-y-auto">
              {studentHistory.isLoading ? <TableSkeleton rows={3} /> : !studentHistory.data?.length ? (
                <EmptyState title="No attendance records for this student" />
              ) : (
                studentHistory.data.map((r) => (
                  <Card key={r.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{(r.student?.profile?.full_name) ?? ''}</p>
                      <p className="text-xs text-ink-500">{formatDate(r.attendance_date)}</p>
                    </div>
                    <StatusBadge status={r.status} label={STATUS_LABELS[r.status as AttendanceStatus] ?? r.status} />
                  </Card>
                ))
              )}
            </div>
          )}

          <h3 className="mb-3 font-display text-lg font-semibold">All attendance records</h3>
          {studentAtt.isLoading ? <TableSkeleton /> : !studentAtt.data?.length ? <EmptyState title="No attendance records" /> : (
            <div className="space-y-2">
              {studentAtt.data.map((r) => (
                <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{r.student?.profile?.full_name ?? r.student_id}</p>
                    <p className="text-xs text-ink-500">{formatDate(r.attendance_date)}</p>
                  </div>
                  <StatusBadge status={r.status} label={STATUS_LABELS[r.status as AttendanceStatus] ?? r.status} />
                </Card>
              ))}
            </div>
          )}
        </>
      ) : teacherAtt.isLoading ? <TableSkeleton /> : !teacherAtt.data?.length ? <EmptyState title="No teacher attendance" /> : (
        <div className="space-y-2">
          {teacherAtt.data.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{(r.teacher as { profile?: { full_name?: string } })?.profile?.full_name ?? r.teacher_id}</p>
                <p className="text-xs text-ink-500">{formatDate(r.attendance_date)}</p>
              </div>
              <StatusBadge status={r.status} label={STATUS_LABELS[r.status as AttendanceStatus] ?? r.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ButtonTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium ${active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'}`}
    >
      {children}
    </button>
  )
}