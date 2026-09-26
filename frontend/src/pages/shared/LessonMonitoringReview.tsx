import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listClasses } from '@/services/classes'
import { lessonMonitoringLabel, listLessonMonitoring } from '@/services/lesson-monitoring'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'

export function LessonMonitoringReviewPage() {
  const [classId, setClassId] = useState('')
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const records = useQuery({
    queryKey: ['lesson-monitoring-review', classId],
    queryFn: () => listLessonMonitoring({ classId: classId || undefined }),
  })

  return (
    <div>
      <PageHeader title="Lesson Monitoring" description="Review lesson attendance across classes." />
      <Card className="mb-4">
        <Select
          label="Class"
          options={[{ value: '', label: 'All' }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        />
      </Card>
      {records.isLoading ? (
        <TableSkeleton />
      ) : !records.data?.length ? (
        <EmptyState title="No records" />
      ) : (
        <div className="space-y-2">
          {records.data.slice(0, 80).map((r) => (
            <Card key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium">
                  {r.student?.profile?.full_name}
                  <span className="ml-2 font-mono text-xs text-ink-500">{r.student?.student_id}</span>
                </p>
                <p className="text-xs text-ink-500">
                  {formatDate(r.monitoring_date)} · {r.class?.name ?? r.student?.class?.name ?? 'Class'}
                </p>
              </div>
              <StatusBadge status={r.status} label={lessonMonitoringLabel(r.status)} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
