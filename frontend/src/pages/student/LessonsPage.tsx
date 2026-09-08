import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { listLessons } from '@/services/lessons'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'

export function StudentLessonsPage() {
  const { user } = useAuth()
  const classId = user!.student!.class_id
  const { data, isLoading } = useQuery({
    queryKey: ['student-lessons', classId],
    queryFn: () => listLessons({ classId: classId!, publishedOnly: true }),
    enabled: !!classId,
  })

  return (
    <div>
      <PageHeader title="My Lessons" description="Online viewing and streaming only — downloads are disabled." />
      {!classId ? (
        <EmptyState title="No class assigned" />
      ) : isLoading ? (
        <TableSkeleton />
      ) : !data?.length ? (
        <EmptyState title="No published lessons" />
      ) : (
        <div className="space-y-3">
          {data.map((l) => (
            <Card key={l.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg font-semibold">{l.title}</p>
                <p className="text-sm text-ink-500">
                  {l.subject?.name ?? 'Subject'} · {formatDate(l.lesson_date)} · {l.files?.length ?? 0} files
                </p>
              </div>
              <Link to={`/student/lessons/${l.id}`}>
                <Button size="sm">Open</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
