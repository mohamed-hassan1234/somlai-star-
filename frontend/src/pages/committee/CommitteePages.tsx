import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarDays, CheckCheck, ClipboardCheck, MapPin, Plus } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import {
  createOutsideActivity,
  getMyAssignedClasses,
  getMyCommitteeIds,
  listActivityAttendance,
  listOutsideActivities,
  summarizeActivityAttendance,
  upsertActivityAttendance,
} from '@/services/outsideActivities'
import { listStudentsByClass } from '@/services/students'
import { outsideActivitySchema, OUTSIDE_ACTIVITY_TYPES, type OutsideActivityInput } from '@/schemas'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatCard, Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, getErrorMessage } from '@/lib/utils'
import type { OutsideActivityStatus, Student } from '@/types'

const STATUSES: OutsideActivityStatus[] = ['present', 'absent', 'excused']

function activityTypeLabel(type: string) {
  return OUTSIDE_ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type.replaceAll('_', ' ')
}

function StudentRow({
  student,
  status,
  onChange,
}: {
  student: Student
  status?: OutsideActivityStatus
  onChange: (status: OutsideActivityStatus) => void
}) {
  return (
    <Card className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{student.profile?.full_name ?? 'Unknown'}</p>
        <p className="font-mono text-xs text-ink-500">{student.student_id}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
              status === st ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700'
            }`}
            onClick={() => onChange(st)}
          >
            {st}
          </button>
        ))}
      </div>
    </Card>
  )
}

export function CommitteeOverviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const assigned = useQuery({
    queryKey: ['my-assigned-classes', user!.profile.id],
    queryFn: () => getMyAssignedClasses(user!.profile.id),
  })
  const activities = useQuery({
    queryKey: ['my-activities', user!.profile.id],
    queryFn: () => listOutsideActivities({ createdBy: user!.profile.id }),
  })
  const history = useQuery({
    queryKey: ['my-activity-att', user!.profile.id],
    queryFn: () => listActivityAttendance({ committeeMemberId: user!.profile.id }),
    enabled: !!user?.profile.id,
  })

  const studentQueries = useMemo(
    () =>
      (assigned.data ?? []).map((cls) => ({
        classId: cls.id,
        query: () => listStudentsByClass(cls.id),
      })),
    [assigned.data],
  )

  const totalStudents = useQuery({
    queryKey: ['committee-total-students', studentQueries.map((s) => s.classId).join(',')],
    queryFn: async () => {
      let total = 0
      for (const q of studentQueries) {
        const students = await q.query()
        total += students.length
      }
      return total
    },
    enabled: studentQueries.length > 0,
  })

  const currentActivity = useMemo(() => {
    const rows = activities.data ?? []
    if (!rows.length) return null
    const today = new Date().toISOString().slice(0, 10)
    const todayActivity = rows.find((a) => a.activity_date === today) ?? rows[0]
    return todayActivity
  }, [activities.data])

  const todaySummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = history.data ?? []
    const todayRows = rows.filter((r) => r.activity_date === today)
    return summarizeActivityAttendance(todayRows)
  }, [history.data])

  const isLoading = assigned.isLoading || activities.isLoading

  return (
    <div>
      <PageHeader title="Outside Activity Committee" description="Supervise students during outside activities." />

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : !assigned.data?.length ? (
        <EmptyState
          title="No assigned class"
          description="Ask the school manager to assign you to a class before taking attendance."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Assigned Classes" value={assigned.data.length} hint={assigned.data.map((c) => c.name).join(', ')} icon={<CalendarDays className="h-5 w-5" />} />
            <StatCard label="Total Students" value={totalStudents.data ?? 0} hint="Across assigned classes" icon={<ClipboardCheck className="h-5 w-5" />} />
            <StatCard label="Present Today" value={todaySummary.present} hint="Outside activity" icon={<CheckCheck className="h-5 w-5" />} />
            <StatCard label="Absent Today" value={todaySummary.absent} hint={`Excused: ${todaySummary.excused}`} icon={<ClipboardCheck className="h-5 w-5" />} />
          </div>

          <Card className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">Current Activity</h3>
                {currentActivity ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="font-medium">{currentActivity.name}</p>
                    <p className="text-ink-500">
                      {activityTypeLabel(currentActivity.activity_type)} · {formatDate(currentActivity.activity_date)} · {currentActivity.class?.name}
                    </p>
                    {currentActivity.location && (
                      <p className="flex items-center gap-1 text-ink-500">
                        <MapPin className="h-3.5 w-3.5" /> {currentActivity.location}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-ink-500">No activity created yet.</p>
                )}
              </div>
              <Button
                leftIcon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => navigate('/committee/attendance')}
              >
                Take Outside Activity Attendance
              </Button>
            </div>
          </Card>

          <h3 className="mb-3 mt-8 font-display text-lg font-semibold">Attendance History</h3>
          {history.isLoading ? (
            <TableSkeleton rows={3} />
          ) : !history.data?.length ? (
            <EmptyState title="No attendance recorded yet" description="Saved attendance will appear here." />
          ) : (
            <div className="space-y-2">
              {history.data.slice(0, 30).map((r) => (
                <Card key={r.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{r.activity?.name ?? 'Outside activity'}</p>
                    <p className="text-xs text-ink-500">
                      {r.student?.profile?.full_name ?? 'Student'} · {formatDate(r.activity_date)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function CommitteeActivityAttendancePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selectedActivityId, setSelectedActivityId] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [marks, setMarks] = useState<Record<string, OutsideActivityStatus>>({})

  const assigned = useQuery({
    queryKey: ['my-assigned-classes', user!.profile.id],
    queryFn: () => getMyAssignedClasses(user!.profile.id),
  })
  const activities = useQuery({
    queryKey: ['my-activities', user!.profile.id],
    queryFn: () => listOutsideActivities({ createdBy: user!.profile.id }),
  })

  const activitiesForClasses = useMemo(() => {
    const classIds = new Set((assigned.data ?? []).map((c) => c.id))
    return (activities.data ?? []).filter((a) => classIds.has(a.class_id))
  }, [activities.data, assigned.data])

  const activity = useMemo(
    () => activitiesForClasses.find((a) => a.id === selectedActivityId) ?? null,
    [activitiesForClasses, selectedActivityId],
  )

  const students = useQuery({
    queryKey: ['class-students', activity?.class_id],
    queryFn: () => listStudentsByClass(activity!.class_id),
    enabled: !!activity,
  })

  const existing = useQuery({
    queryKey: ['activity-attendance', selectedActivityId],
    queryFn: () => listActivityAttendance({ activityId: selectedActivityId }),
    enabled: !!selectedActivityId,
  })

  useEffect(() => {
    if (!existing.data) return
    const seed: Record<string, OutsideActivityStatus> = {}
    for (const row of existing.data) {
      if (row.status === 'present' || row.status === 'absent' || row.status === 'excused') {
        seed[row.student_id] = row.status
      }
    }
    setMarks(seed)
  }, [existing.data])

  const activityForm = useForm<OutsideActivityInput>({
    resolver: zodResolver(outsideActivitySchema),
    defaultValues: {
      name: '',
      activityType: '',
      activityDate: new Date().toISOString().slice(0, 10),
      startTime: '',
      endTime: '',
      location: '',
      description: '',
      classId: assigned.data?.[0]?.id ?? '',
    },
  })

  useEffect(() => {
    if (assigned.data?.length && !activityForm.getValues('classId')) {
      activityForm.setValue('classId', assigned.data[0].id)
    }
  }, [assigned.data, activityForm])

  const createActivity = useMutation({
    mutationFn: async (values: OutsideActivityInput) => {
      const committeeIds = await getMyCommitteeIds(user!.profile.id)
      return createOutsideActivity({
        name: values.name,
        activity_type: values.activityType,
        activity_date: values.activityDate,
        start_time: values.startTime || null,
        end_time: values.endTime || null,
        location: values.location || null,
        description: values.description || null,
        class_id: values.classId,
        committee_id: committeeIds[0] ?? null,
        created_by: user!.profile.id,
      })
    },
    onSuccess: (data) => {
      toast.success('Activity created')
      setCreateOpen(false)
      activityForm.reset()
      setSelectedActivityId(data.id)
      qc.invalidateQueries({ queryKey: ['my-activities'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!activity) throw new Error('Select an activity first')
      const committeeIds = await getMyCommitteeIds(user!.profile.id)
      const committeeId = committeeIds[0]
      if (!committeeId) throw new Error('No committee assignment found. Contact the manager.')
      const entries = (students.data ?? []).map((s) => ({
        activity_id: activity.id,
        committee_id: committeeId,
        student_id: s.id,
        class_id: activity.class_id,
        activity_date: activity.activity_date,
        status: (marks[s.id] ?? 'absent') as OutsideActivityStatus,
        recorded_by: user!.profile.id,
      }))
      await upsertActivityAttendance(entries, activity.location)
    },
    onSuccess: () => {
      toast.success('Attendance saved')
      qc.invalidateQueries({ queryKey: ['activity-attendance'] })
      qc.invalidateQueries({ queryKey: ['my-activity-att'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Outside Activity Attendance"
        description="Select or create an approved activity, then mark attendance for your assigned class."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            New Activity
          </Button>
        }
      />

      {assigned.isLoading ? (
        <TableSkeleton />
      ) : !assigned.data?.length ? (
        <EmptyState title="No assigned class" description="Ask the school manager to assign you to a class." />
      ) : (
        <>
          <Card className="mb-4 grid gap-3 sm:grid-cols-2">
            <Select
              label="Activity"
              placeholder="Select an activity"
              options={activitiesForClasses.map((a) => ({
                value: a.id,
                label: `${a.name} — ${formatDate(a.activity_date)}${a.class?.name ? ` (${a.class.name})` : ''}`,
              }))}
              value={selectedActivityId}
              onChange={(e) => {
                setSelectedActivityId(e.target.value)
                setMarks({})
              }}
            />
            <div className="flex items-end">
              <Button variant="secondary" className="w-full" onClick={() => setCreateOpen(true)}>
                Create New Activity
              </Button>
            </div>
          </Card>

          {!activity ? (
            <EmptyState
              title="No activity selected"
              description="Select an activity above or create a new one to take attendance."
              action={
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                  New Activity
                </Button>
              }
            />
          ) : (
            <>
              <Card className="mb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold">{activity.name}</p>
                    <p className="mt-1 text-sm text-ink-500">
                      {activityTypeLabel(activity.activity_type)} · {formatDate(activity.activity_date)} · {activity.class?.name}
                    </p>
                    {(activity.start_time || activity.end_time) && (
                      <p className="text-sm text-ink-500">
                        {activity.start_time ? `${activity.start_time.slice(0, 5)}` : ''}
                        {activity.start_time && activity.end_time ? ' – ' : ''}
                        {activity.end_time ? `${activity.end_time.slice(0, 5)}` : ''}
                      </p>
                    )}
                    {activity.location && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
                        <MapPin className="h-3.5 w-3.5" /> {activity.location}
                      </p>
                    )}
                    {activity.description && <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{activity.description}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<CheckCheck className="h-3.5 w-3.5" />}
                      onClick={() => {
                        const all: Record<string, OutsideActivityStatus> = {}
                        for (const s of students.data ?? []) all[s.id] = 'present'
                        setMarks(all)
                      }}
                    >
                      Mark All Present
                    </Button>
                    <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
                      Save Attendance
                    </Button>
                  </div>
                </div>
              </Card>

              {students.isLoading ? (
                <TableSkeleton />
              ) : !students.data?.length ? (
                <EmptyState title="No students in this class" />
              ) : (
                <div className="space-y-2">
                  {students.data.map((s) => (
                    <StudentRow
                      key={s.id}
                      student={s}
                      status={marks[s.id]}
                      onChange={(status) => setMarks((m) => ({ ...m, [s.id]: status }))}
                    />
                  ))}
                </div>
              )}

              <Card className="mt-6">
                <h3 className="mb-3 font-display text-lg font-semibold">Saved Attendance</h3>
                {existing.isLoading ? (
                  <TableSkeleton rows={2} />
                ) : !existing.data?.length ? (
                  <p className="text-sm text-ink-500">No attendance saved for this activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {existing.data.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-900">
                        <span>{r.student?.profile?.full_name ?? 'Student'}</span>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Outside Activity" size="lg">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={activityForm.handleSubmit((v) => createActivity.mutate(v))}>
          <Input label="Activity Name" {...activityForm.register('name')} error={activityForm.formState.errors.name?.message} />
          <Select
            label="Activity Type"
            placeholder="Select type"
            options={OUTSIDE_ACTIVITY_TYPES}
            {...activityForm.register('activityType')}
          />
          <Input label="Date" type="date" {...activityForm.register('activityDate')} />
          <Select
            label="Assigned Class"
            options={(assigned.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            {...activityForm.register('classId')}
          />
          <Input label="Start Time" type="time" {...activityForm.register('startTime')} />
          <Input label="End Time" type="time" {...activityForm.register('endTime')} />
          <Input label="Location" {...activityForm.register('location')} />
          <Input label="Description" {...activityForm.register('description')} />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createActivity.isPending}>Create Activity</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
