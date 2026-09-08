import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { getTeacherClasses } from '@/services/teachers'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import type { ClassRecord } from '@/types'

export function TeacherClassesPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-classes', user!.teacher!.id],
    queryFn: () => getTeacherClasses(user!.teacher!.id),
  })

  return (
    <div>
      <PageHeader title="My Classes" description="Only classes assigned to you." />
      {isLoading ? (
        <TableSkeleton />
      ) : !data?.length ? (
        <EmptyState title="No assigned classes" description="Ask the school manager to assign classes." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data as ClassRecord[]).map((c) => (
            <Card key={c.id}>
              <p className="text-xs font-semibold uppercase text-ink-500">{c.schedule_slot}</p>
              <p className="font-display text-xl font-semibold">{c.name}</p>
              <p className="mt-1 text-sm text-ink-500">{c.description || 'No description'}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
