import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAttendance, listTeacherAttendance } from '@/services/attendance'
import { listClasses } from '@/services/classes'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'

export function ManagerAttendancePage() {
  const [tab, setTab] = useState<'student' | 'teacher'>('student')
  const [classId, setClassId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })

  const studentAtt = useQuery({
    queryKey: ['attendance', classId, from, to],
    queryFn: () => listAttendance({ classId: classId || undefined, from: from || undefined, to: to || undefined }),
  })

  const teacherAtt = useQuery({
    queryKey: ['teacher-attendance', from, to],
    queryFn: () => listTeacherAttendance({ from: from || undefined, to: to || undefined }),
    enabled: tab === 'teacher',
  })

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
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </Card>

      {tab === 'student' ? (
        studentAtt.isLoading ? <TableSkeleton /> : !studentAtt.data?.length ? <EmptyState title="No attendance records" /> : (
          <div className="space-y-2">
            {studentAtt.data.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{r.student?.profile?.full_name ?? r.student_id}</p>
                  <p className="text-xs text-ink-500">{formatDate(r.attendance_date)}</p>
                </div>
                <StatusBadge status={r.status} />
              </Card>
            ))}
          </div>
        )
      ) : teacherAtt.isLoading ? <TableSkeleton /> : !teacherAtt.data?.length ? <EmptyState title="No teacher attendance" /> : (
        <div className="space-y-2">
          {teacherAtt.data.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{(r.teacher as { profile?: { full_name?: string } })?.profile?.full_name ?? r.teacher_id}</p>
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

function ButtonTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
