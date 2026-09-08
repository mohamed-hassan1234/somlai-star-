import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { listNotices } from '@/services/audit'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/utils'

export function StudentNoticesPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['student-notices', user!.student?.class_id],
    queryFn: () => listNotices({ publishedOnly: true, classId: user!.student?.class_id }),
  })

  return (
    <div>
      <PageHeader title="Notice Board" description="Announcements from Somali Star Academy." />
      {isLoading ? <TableSkeleton /> : !data?.length ? <EmptyState title="No notices" /> : (
        <div className="space-y-3">
          {data.map((n) => (
            <Card key={n.id}>
              <p className="font-display text-lg font-semibold">{n.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600 dark:text-ink-300">{n.body}</p>
              <p className="mt-2 text-xs text-ink-500">{n.published_at ? formatDateTime(n.published_at) : ''}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
