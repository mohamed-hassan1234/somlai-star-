import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { listAttendance, monthlySummary } from '@/services/attendance'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, monthName } from '@/lib/utils'

export function StudentAttendancePage() {
  const { user } = useAuth()
  const studentId = user!.student!.id
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const history = useQuery({
    queryKey: ['my-attendance', studentId],
    queryFn: () => listAttendance({ studentId }),
  })
  const summary = useQuery({
    queryKey: ['my-attendance-summary', studentId, year, month],
    queryFn: () => monthlySummary(studentId, year, month),
  })

  return (
    <div>
      <PageHeader title="My Attendance" description="Your attendance history and monthly summary." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select
          label="Month"
          options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
        <Input label="Year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </Card>
      {summary.data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(['present', 'absent', 'late', 'leave', 'total'] as const).map((k) => (
            <Card key={k} className="text-center">
              <p className="text-xs uppercase text-ink-500">{k}</p>
              <p className="font-display text-2xl font-semibold">{Array.isArray(summary.data) ? 0 : ((summary.data as Record<string, number>)?.[k] ?? 0)}</p>
            </Card>
          ))}
        </div>
      )}
      {history.isLoading ? <TableSkeleton /> : !history.data?.length ? <EmptyState title="No attendance yet" /> : (
        <div className="space-y-2">
          {history.data.map((r) => (
            <Card key={r.id} className="flex items-center justify-between py-3">
              <p className="text-sm font-medium">{formatDate(r.attendance_date)}</p>
              <StatusBadge status={r.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
