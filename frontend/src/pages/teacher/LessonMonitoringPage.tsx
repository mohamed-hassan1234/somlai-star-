import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { getTeacherClasses } from '@/services/teachers'
import { listStudentsByClass } from '@/services/students'
import { listLessonMonitoring, recordBulkLessonMonitoring, lessonMonitoringLabel, type LessonMonitoringStatusValue } from '@/services/lesson-monitoring'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, getErrorMessage } from '@/lib/utils'
import type { ClassRecord } from '@/types'

const STATUSES: LessonMonitoringStatusValue[] = ['kabaxay', 'kama_bixin']
const STATUS_LABELS: Record<string, string> = { kabaxay: 'Kabaxay', kama_bixin: 'Kama bixin' }

export function TeacherLessonMonitoringPage() {
  const { user } = useAuth()
  const teacherId = user!.teacher!.id
  const qc = useQueryClient()
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [marks, setMarks] = useState<Record<string, LessonMonitoringStatusValue>>({})

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
    queryKey: ['lesson-monitoring-history', classId],
    queryFn: () => listLessonMonitoring({ classId }),
    enabled: !!classId,
  })

  const save = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }))
      if (!entries.length) throw new Error('Mark at least one student')
      await recordBulkLessonMonitoring({ classId, teacherId, monitoringDate: date, entries })
    },
    onSuccess: () => {
      toast.success('Lesson monitoring saved')
      qc.invalidateQueries({ queryKey: ['lesson-monitoring-history', classId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const classOptions = useMemo(
    () => (classes.data as ClassRecord[] | undefined)?.map((c) => ({ value: c.id, label: c.name })) ?? [],
    [classes.data],
  )

  return (
    <div>
      <PageHeader title="Lesson Monitoring" description="Mark Kabaxay (attended) or Kama bixin (absent) for this lesson." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select
          label="Class"
          placeholder="Select class"
          options={classOptions}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value)
            setMarks({})
          }}
        />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex items-end">
          <Button className="w-full" loading={save.isPending} disabled={!classId} onClick={() => save.mutate()}>
            Save monitoring
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
                    {STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <h3 className="mb-3 font-display text-lg font-semibold">History</h3>
      {history.isLoading ? (
        <TableSkeleton rows={3} />
      ) : (
        <div className="mb-8 max-h-64 space-y-2 overflow-y-auto">
          {(history.data ?? []).slice(0, 40).map((r) => (
            <Card key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium">{r.student?.profile?.full_name}</p>
                <p className="text-xs text-ink-500">{formatDate(r.monitoring_date)}</p>
              </div>
              <StatusBadge status={r.status} label={lessonMonitoringLabel(r.status)} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
