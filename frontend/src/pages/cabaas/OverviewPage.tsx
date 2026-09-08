import { useQuery } from '@tanstack/react-query'
import { listResultSubmissions } from '@/services/results'
import { listTeacherAttendance, listAttendance } from '@/services/attendance'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard, Card } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Skeleton'

export function CabaasOverviewPage() {
  const pending = useQuery({
    queryKey: ['cabaas-pending'],
    queryFn: () => listResultSubmissions({ status: 'pending_review' }),
  })
  const teacherAtt = useQuery({ queryKey: ['cabaas-ta'], queryFn: () => listTeacherAttendance() })
  const studentAtt = useQuery({ queryKey: ['cabaas-sa'], queryFn: () => listAttendance({}) })

  return (
    <div>
      <PageHeader title="Overview" description="Results review and attendance oversight." />
      {pending.isLoading ? <TableSkeleton rows={3} /> : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Pending results" value={pending.data?.length ?? 0} />
          <StatCard label="Teacher attendance rows" value={teacherAtt.data?.length ?? 0} />
          <StatCard label="Student attendance rows" value={studentAtt.data?.length ?? 0} />
        </div>
      )}
      <Card className="mt-6">
        <p className="text-sm text-ink-500">Use Results Review to approve and publish official results. Teachers cannot publish official results themselves.</p>
      </Card>
    </div>
  )
}
