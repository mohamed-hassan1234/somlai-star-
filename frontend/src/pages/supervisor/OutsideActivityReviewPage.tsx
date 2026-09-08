import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trees, MapPin, Search, Eye } from 'lucide-react'
import {
  listOutsideActivities,
  summarizeActivityAttendance,
  type ActivityAttendanceSummary,
} from '@/services/outsideActivities'
import { listClasses } from '@/services/classes'
import { OUTSIDE_ACTIVITY_TYPES } from '@/schemas'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatCard, Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'
import type { OutsideActivity } from '@/types'

function activityTypeLabel(type: string) {
  return OUTSIDE_ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type.replaceAll('_', ' ')
}

function AttendanceCounts({ summary }: { summary: ActivityAttendanceSummary }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-lg bg-brand-50 px-2 py-0.5 font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
        {summary.present} present
      </span>
      <span className="rounded-lg bg-red-50 px-2 py-0.5 font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
        {summary.absent} absent
      </span>
      <span className="rounded-lg bg-blue-50 px-2 py-0.5 font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
        {summary.excused} excused
      </span>
      <span className="rounded-lg bg-ink-100 px-2 py-0.5 font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
        {summary.total} tracked
      </span>
    </div>
  )
}

export function SupervisorOutsideActivityReviewPage() {
  const [search, setSearch] = useState('')
  const [fClass, setFClass] = useState('')
  const [fType, setFType] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [view, setView] = useState<OutsideActivity | null>(null)

  const activities = useQuery({
    queryKey: ['supervisor-outside-activities'],
    queryFn: () => listOutsideActivities(),
  })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })

  const filtered = useMemo(() => {
    let items = (activities.data ?? []).filter((a) => !a.deleted_at)
    if (search) items = items.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    if (fClass) items = items.filter((a) => a.class_id === fClass)
    if (fType) items = items.filter((a) => a.activity_type === fType)
    if (fFrom) items = items.filter((a) => a.activity_date >= fFrom)
    if (fTo) items = items.filter((a) => a.activity_date <= fTo)
    return items
  }, [activities.data, search, fClass, fType, fFrom, fTo])

  const totals = useMemo(() => {
    const rows = (activities.data ?? []).flatMap((a) => a.attendance ?? [])
    return summarizeActivityAttendance(rows)
  }, [activities.data])

  const detailRows = useMemo(
    () =>
      (view?.attendance ?? []).slice().sort((a, b) => {
        const na = a.student?.profile?.full_name ?? ''
        const nb = b.student?.profile?.full_name ?? ''
        return na.localeCompare(nb)
      }),
    [view],
  )

  return (
    <div>
      <PageHeader
        title="Outside Activity Attendance"
        description="Review all outside activities and their attendance across the school."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Activities" value={filtered.length} hint="Across all classes" icon={<Trees className="h-5 w-5" />} />
        <StatCard label="Students Tracked" value={totals.total} hint="Attendance records" icon={<MapPin className="h-5 w-5" />} />
        <StatCard label="Present" value={totals.present} hint="Overall" />
        <StatCard label="Absent" value={totals.absent} hint={`Excused: ${totals.excused}`} />
      </div>

      <Card className="mt-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input className="pl-9" placeholder="Search activity..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Class"
            placeholder="All classes"
            options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={fClass}
            onChange={(e) => setFClass(e.target.value)}
          />
          <Select
            label="Activity Type"
            placeholder="All types"
            options={OUTSIDE_ACTIVITY_TYPES}
            value={fType}
            onChange={(e) => setFType(e.target.value)}
          />
          <Input label="From" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          <Input label="To" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </div>
      </Card>

      {activities.isLoading ? (
        <TableSkeleton rows={5} />
      ) : !filtered.length ? (
        <EmptyState
          icon={<Trees className="h-10 w-10" />}
          title="No outside activities"
          description="Activities created by the committee will appear here with their attendance stats."
        />
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((a) => {
            const summary = summarizeActivityAttendance(a.attendance ?? [])
            return (
              <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {activityTypeLabel(a.activity_type)} · {formatDate(a.activity_date)} · {a.class?.name ?? '—'}
                    {a.location ? ` · ${a.location}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    Committee member: {a.creator?.full_name ?? a.created_by}
                  </p>
                  <div className="mt-2">
                    <AttendanceCounts summary={summary} />
                  </div>
                </div>
                <Button size="sm" variant="secondary" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setView(a)}>
                  View Details
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={!!view} onClose={() => setView(null)} title="Activity Details" size="lg">
        {view && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><span className="text-xs font-semibold text-ink-500">Activity</span><p className="font-medium">{view.name}</p></div>
              <div><span className="text-xs font-semibold text-ink-500">Type</span><p>{activityTypeLabel(view.activity_type)}</p></div>
              <div><span className="text-xs font-semibold text-ink-500">Date</span><p>{formatDate(view.activity_date)}</p></div>
              <div><span className="text-xs font-semibold text-ink-500">Class</span><p>{view.class?.name ?? '—'}</p></div>
              {view.location && <div><span className="text-xs font-semibold text-ink-500">Location</span><p>{view.location}</p></div>}
              {view.description && <div className="sm:col-span-2"><span className="text-xs font-semibold text-ink-500">Description</span><p className="text-sm">{view.description}</p></div>}
            </div>
            <div>
              <h4 className="mb-2 font-display text-base font-semibold">Attendance</h4>
              {detailRows.length === 0 ? (
                <p className="text-sm text-ink-500">No attendance recorded for this activity.</p>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {detailRows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-900">
                      <span>{r.student?.profile?.full_name ?? 'Student'} · {r.student?.student_id ?? ''}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
