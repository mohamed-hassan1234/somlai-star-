import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { listExamSchedules } from '@/services/audit'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'

export function StudentExamsPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['exams', user!.student?.class_id],
    queryFn: () => listExamSchedules(user!.student?.class_id),
  })

  return (
    <div>
      <PageHeader title="Exam Schedule" description="Upcoming exams for your class." />
      {isLoading ? <TableSkeleton /> : !data?.length ? <EmptyState title="No exams scheduled" /> : (
        <div className="space-y-3">
          {data.map((e) => (
            <Card key={e.id}>
              <p className="font-display text-lg font-semibold">{e.title}</p>
              <p className="text-sm text-ink-500">
                {(e.subject as { name?: string } | null)?.name ?? 'Subject'} · {formatDate(e.exam_date)}
                {e.start_time ? ` · ${e.start_time}` : ''}
                {e.venue ? ` · ${e.venue}` : ''}
              </p>
              {e.description && <p className="mt-2 text-sm">{e.description}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
