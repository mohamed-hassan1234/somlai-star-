import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Search, FileText } from 'lucide-react'
import { listPracticeStudents, getPracticeStudent, listActivityLogs } from '@/services/practice'
import { listTeacherAttendance } from '@/services/attendance'
import { listNotifications } from '@/services/notifications'
import { listClasses } from '@/services/classes'
import { useAuth } from '@/providers/AuthProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { PracticeStudent } from '@/types'

function practiceTypeLabel(type: string) {
  return type.replace('_', ' ')
}

function SubmittedBy({ s }: { s: PracticeStudent }) {
  return <>{s.creator?.full_name ?? '—'}</>
}

function PracticeDetail({ s }: { s: PracticeStudent }) {
  return (
    <div className="space-y-3">
      <div><span className="text-xs font-semibold text-ink-500">Student Name</span><p className="font-medium">{s.student_name}</p></div>
      {s.student_id && <div><span className="text-xs font-semibold text-ink-500">Student ID</span><p>{s.student_id}</p></div>}
      <div><span className="text-xs font-semibold text-ink-500">Class</span><p>{s.class?.name ?? '—'}</p></div>
      <div><span className="text-xs font-semibold text-ink-500">Practice Type</span><p>{practiceTypeLabel(s.practice_type)}</p></div>
      <div><span className="text-xs font-semibold text-ink-500">Language</span><p>{s.language === 'somali' ? 'Somali Speaking' : 'English Speaking'}</p></div>
      <div><span className="text-xs font-semibold text-ink-500">Status</span><p><StatusBadge status={s.status} /></p></div>
      {s.notes && <div><span className="text-xs font-semibold text-ink-500">Notes</span><p className="whitespace-pre-wrap text-sm">{s.notes}</p></div>}
      <div><span className="text-xs font-semibold text-ink-500">Submitted By</span><p>{s.creator?.full_name ?? '—'}</p></div>
      <div><span className="text-xs font-semibold text-ink-500">Submitted At</span><p>{s.submitted_at ? formatDateTime(s.submitted_at) : '—'}</p></div>
      <div><span className="text-xs font-semibold text-ink-500">Created At</span><p>{formatDateTime(s.created_at)}</p></div>
      <div><span className="text-xs font-semibold text-ink-500">Last Updated</span><p>{formatDateTime(s.updated_at)}</p></div>
    </div>
  )
}

export function SupervisorDashboardPage() {
  const { user } = useAuth()
  const [viewId, setViewId] = useState<string | null>(null)

  const submissions = useQuery({
    queryKey: ['supervisor-submissions'],
    queryFn: () => listPracticeStudents({ status: 'submitted' }),
  })
  const unreadNotifs = useQuery({
    queryKey: ['unread-notifs', user?.profile.id],
    queryFn: () => listNotifications(user!.profile.id, { unreadOnly: true }),
  })
  const activity = useQuery({
    queryKey: ['supervisor-activity'],
    queryFn: () => listActivityLogs({ limit: 10 }),
  })
  const viewRecord = useQuery({
    queryKey: ['practice-student', viewId],
    queryFn: () => getPracticeStudent(viewId!),
    enabled: !!viewId,
  })

  const recent = useMemo(() => (submissions.data ?? []).slice(0, 6), [submissions.data])
  const somaliCount = useMemo(
    () => (submissions.data ?? []).filter((s) => s.practice_type === 'somali_speaking').length,
    [submissions.data],
  )
  const englishCount = useMemo(
    () => (submissions.data ?? []).filter((s) => s.practice_type === 'english_speaking').length,
    [submissions.data],
  )

  return (
    <div>
      
      <PageHeader title="Supervisor Dashboard" description="Practice management overview." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-2xl font-bold text-brand-600">{(submissions.data ?? []).length}</p>
          <p className="text-sm text-ink-500">Total Submissions</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-green-600">{somaliCount}</p>
          <p className="text-sm text-ink-500">Somali Speaking</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-blue-600">{englishCount}</p>
          <p className="text-sm text-ink-500">English Speaking</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-amber-600">{(unreadNotifs.data ?? []).length}</p>
          <p className="text-sm text-ink-500">Unread Notifications</p>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Recent Submissions</h3>
          <Button size="sm" variant="secondary" onClick={() => (window.location.href = '/supervisor/reports')}>
            <FileText className="mr-1 h-3.5 w-3.5" /> View all
          </Button>
        </div>
        {submissions.isLoading ? <TableSkeleton /> : !recent.length ? (
          <EmptyState title="No submissions yet" description="Submissions from practice teachers will appear here." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-700">
            <table className="min-w-full divide-y divide-ink-200 dark:divide-ink-700">
              <thead className="bg-ink-50 dark:bg-ink-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Practice Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Submitted By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {recent.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50 dark:hover:bg-ink-900">
                    <td className="px-4 py-3 text-sm font-medium">{s.student_name}</td>
                    <td className="px-4 py-3 text-sm text-ink-500">{s.class?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">{practiceTypeLabel(s.practice_type)}</td>
                    <td className="px-4 py-3 text-sm text-ink-500"><SubmittedBy s={s} /></td>
                    <td className="px-4 py-3 text-sm text-ink-500">{s.submitted_at ? formatDate(s.submitted_at) : formatDate(s.created_at)}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => setViewId(s.id)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h3 className="font-display text-lg font-semibold">Recent Activity</h3>
        {activity.isLoading ? <TableSkeleton /> : !activity.data?.length ? (
          <EmptyState title="No recent activity" />
        ) : (
          <div className="mt-3 space-y-2">
            {activity.data.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-4 py-2.5 text-sm dark:bg-ink-900">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{a.description}</p>
                  <p className="text-xs text-ink-500">{a.user?.full_name ?? '—'} · {formatDateTime(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!viewId} onClose={() => setViewId(null)} title="Submission Details">
        {viewRecord.isLoading ? <TableSkeleton /> : viewRecord.data ? <PracticeDetail s={viewRecord.data} /> : null}
      </Modal>
    </div>
  )
}

export function SupervisorReportsPage() {
  const [search, setSearch] = useState('')
  const [fBy, setFBy] = useState('')
  const [fClass, setFClass] = useState('')
  const [fType, setFType] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [fStatus, setFStatus] = useState('submitted')
  const [viewId, setViewId] = useState<string | null>(null)

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const allSubmissions = useQuery({
    queryKey: ['supervisor-submissions'],
    queryFn: () => listPracticeStudents({ status: fStatus || undefined }),
  })

  const viewRecord = useQuery({
    queryKey: ['practice-student', viewId],
    queryFn: () => getPracticeStudent(viewId!),
    enabled: !!viewId,
  })

  const filtered = useMemo(() => {
    let items = allSubmissions.data ?? []
    if (search) items = items.filter((s) => s.student_name.toLowerCase().includes(search.toLowerCase()))
    if (fBy) items = items.filter((s) => (s.creator?.full_name ?? '').toLowerCase().includes(fBy.toLowerCase()))
    if (fClass) items = items.filter((s) => s.class_id === fClass)
    if (fType) items = items.filter((s) => s.practice_type === fType)
    if (fFrom) items = items.filter((s) => (s.submitted_at ?? s.created_at).slice(0, 10) >= fFrom)
    if (fTo) items = items.filter((s) => (s.submitted_at ?? s.created_at).slice(0, 10) <= fTo)
    return items
  }, [allSubmissions.data, search, fBy, fClass, fType, fFrom, fTo])

  return (
    <div>
      <PageHeader title="Practice Reports" description="View all practice student submissions." />

      <Card className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input className="pl-9" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Submitted By" placeholder="Search by teacher name..." value={fBy} onChange={(e) => setFBy(e.target.value)} />
          <Select
            label="Class"
            placeholder="All classes"
            options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={fClass}
            onChange={(e) => setFClass(e.target.value)}
          />
          <Select
            label="Practice Type"
            placeholder="All types"
            options={[
              { value: '', label: 'All types' },
              { value: 'somali_speaking', label: 'Somali Speaking' },
              { value: 'english_speaking', label: 'English Speaking' },
            ]}
            value={fType}
            onChange={(e) => setFType(e.target.value)}
          />
          <Select
            label="Status"
            options={[
              { value: 'submitted', label: 'Submitted' },
              { value: 'draft', label: 'Draft' },
              { value: '', label: 'All' },
            ]}
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
          />
          <Input label="From" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          <Input label="To" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </div>
      </Card>

      {allSubmissions.isLoading ? <TableSkeleton /> : !filtered.length ? (
        <EmptyState title="No submissions match your filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-700">
          <table className="min-w-full divide-y divide-ink-200 dark:divide-ink-700">
            <thead className="bg-ink-50 dark:bg-ink-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Class</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Practice Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Submitted By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50 dark:hover:bg-ink-900">
                  <td className="px-4 py-3 text-sm font-medium">{s.student_name}</td>
                  <td className="px-4 py-3 text-sm text-ink-500">{s.class?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">{practiceTypeLabel(s.practice_type)}</td>
                  <td className="px-4 py-3 text-sm text-ink-500"><SubmittedBy s={s} /></td>
                  <td className="px-4 py-3 text-sm text-ink-500">{s.submitted_at ? formatDate(s.submitted_at) : formatDate(s.created_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => setViewId(s.id)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!viewId} onClose={() => setViewId(null)} title="Submission Details">
        {viewRecord.isLoading ? <TableSkeleton /> : viewRecord.data ? <PracticeDetail s={viewRecord.data} /> : null}
      </Modal>
    </div>
  )
}

export function SupervisorSomaliSpeakingPage() {
  return <SupervisorLanguagePage type="somali_speaking" title="Somali Speaking Students" />
}

export function SupervisorEnglishSpeakingPage() {
  return <SupervisorLanguagePage type="english_speaking" title="English Speaking Students" />
}

function SupervisorLanguagePage({ type, title }: { type: string; title: string }) {
  const [search, setSearch] = useState('')
  const [fClass, setFClass] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const records = useQuery({
    queryKey: ['supervisor', type],
    queryFn: () => listPracticeStudents({ practiceType: type }),
  })

  const viewRecord = useQuery({
    queryKey: ['practice-student', viewId],
    queryFn: () => getPracticeStudent(viewId!),
    enabled: !!viewId,
  })

  const filtered = useMemo(() => {
    let items = records.data ?? []
    if (search) items = items.filter((s) => s.student_name.toLowerCase().includes(search.toLowerCase()))
    if (fClass) items = items.filter((s) => s.class_id === fClass)
    return items
  }, [records.data, search, fClass])

  return (
    <div>
      <PageHeader title={title} description={`View all ${title.toLowerCase()} records.`} />
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select label="Class" placeholder="All classes" options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={fClass} onChange={(e) => setFClass(e.target.value)} />
      </Card>
      {records.isLoading ? <TableSkeleton /> : !filtered.length ? (
        <EmptyState title={`No ${title.toLowerCase()} records`} />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{s.student_name}</p>
                <p className="text-xs text-ink-500">{s.class?.name ?? '—'} · {s.submitted_at ? formatDate(s.submitted_at) : formatDate(s.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={s.status} />
                <Button size="sm" variant="secondary" onClick={() => setViewId(s.id)}><Eye className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!viewId} onClose={() => setViewId(null)} title="Record Details">
        {viewRecord.isLoading ? <TableSkeleton /> : viewRecord.data ? <PracticeDetail s={viewRecord.data} /> : null}
      </Modal>
    </div>
  )
}

export function SupervisorActivityPage() {
  const [fUser, setFUser] = useState('')
  const logs = useQuery({
    queryKey: ['activity-logs', fUser],
    queryFn: () => listActivityLogs({ userId: fUser || undefined }),
  })

  return (
    <div>
      <PageHeader title="Practice Teacher Activity" description="Track all actions by practice teachers." />
      <Card className="mb-4">
        <Input placeholder="Filter by User ID..." value={fUser} onChange={(e) => setFUser(e.target.value)} />
      </Card>
      {logs.isLoading ? <TableSkeleton /> : !logs.data?.length ? (
        <EmptyState title="No activity logs" />
      ) : (
        <div className="space-y-2">
          {logs.data.map((log) => (
            <Card key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-ink-100 px-2 py-0.5 text-xs font-semibold capitalize text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                    {log.action}
                  </span>
                  <p className="font-medium">{log.description}</p>
                </div>
                <p className="text-xs text-ink-500">
                  {log.user?.full_name ?? '—'} · {formatDateTime(log.created_at)}
                  {log.entity_id ? ` · Record ID: ${log.entity_id.slice(0, 8)}` : ''}
                  {log.metadata && (log.metadata as Record<string, unknown>).student_name ? ` · Student: ${(log.metadata as Record<string, unknown>).student_name}` : ''}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

type AttendanceRow = {
  id: string
  teacher_id: string
  attendance_date: string
  status: string
  notes: string | null
  recorded_by: string | null
  is_auto: boolean
  created_at: string
  teacher?: { teacher_id?: string; profile?: { full_name?: string } }
  recorder?: { full_name?: string } | null
}

export function SupervisorTeacherAttendancePage() {
  const [search, setSearch] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [viewId, setViewId] = useState<string | null>(null)

  const attendance = useQuery({
    queryKey: ['supervisor-teacher-attendance', fFrom, fTo],
    queryFn: () =>
      listTeacherAttendance({
        from: fFrom || undefined,
        to: fTo || undefined,
      }),
  })

  const filtered = useMemo(() => {
    let items = (attendance.data ?? []) as AttendanceRow[]
    if (search) items = items.filter((r) => (r.teacher?.profile?.full_name ?? '').toLowerCase().includes(search.toLowerCase()))
    if (fStatus) items = items.filter((r) => r.status === fStatus)
    return items
  }, [attendance.data, search, fStatus])

  const viewRecord = useMemo(
    () => (attendance.data ?? []).find((r) => r.id === viewId) ?? null,
    [attendance.data, viewId],
  )
  const teacherHistory = useMemo(
    () => viewRecord
      ? (attendance.data ?? []).filter((r) => r.teacher_id === viewRecord.teacher_id)
      : [],
    [attendance.data, viewRecord],
  )

  return (
    <div>
      <PageHeader title="Teacher Attendance" description="View all teacher attendance records." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Search teacher..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input label="From" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        <Input label="To" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        <Select
          label="Status"
          placeholder="All statuses"
          options={[
            { value: '', label: 'All statuses' },
            { value: 'present', label: 'Present' },
            { value: 'late', label: 'Late' },
            { value: 'absent', label: 'Absent' },
            { value: 'leave', label: 'Leave' },
          ]}
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
        />
      </Card>
      {attendance.isLoading ? <TableSkeleton /> : !filtered.length ? (
        <EmptyState title="No attendance records" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-700">
          <table className="min-w-full divide-y divide-ink-200 dark:divide-ink-700">
            <thead className="bg-ink-50 dark:bg-ink-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Teacher</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Arrival Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Recorded By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Notes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-ink-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-ink-50 dark:hover:bg-ink-900">
                  <td className="px-4 py-3 text-sm font-medium">{r.teacher?.profile?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-ink-500">{formatDate(r.attendance_date)}</td>
                  <td className="px-4 py-3 text-sm text-ink-500">{r.created_at ? formatDateTime(r.created_at).split(', ')[1] : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-sm text-ink-500">{r.recorder?.full_name ?? r.recorded_by ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-ink-500">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => setViewId(r.id)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!viewRecord} onClose={() => setViewId(null)} title="Attendance Details">
        {viewRecord && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div><span className="text-xs font-semibold text-ink-500">Teacher</span><p className="font-medium">{viewRecord.teacher?.profile?.full_name ?? '—'}</p></div>
              <div><span className="text-xs font-semibold text-ink-500">Teacher ID</span><p>{viewRecord.teacher?.teacher_id ?? '—'}</p></div>
              <div><span className="text-xs font-semibold text-ink-500">Date</span><p>{formatDate(viewRecord.attendance_date)}</p></div>
              <div><span className="text-xs font-semibold text-ink-500">Status</span><p><StatusBadge status={viewRecord.status} /></p></div>
              <div><span className="text-xs font-semibold text-ink-500">Arrival Time</span><p>{viewRecord.created_at ? formatDateTime(viewRecord.created_at).split(', ')[1] : '—'}</p></div>
              <div><span className="text-xs font-semibold text-ink-500">Recorded By</span><p>{viewRecord.recorder?.full_name ?? viewRecord.recorded_by ?? '—'}</p></div>
              <div><span className="text-xs font-semibold text-ink-500">Notes</span><p>{viewRecord.notes ?? '—'}</p></div>
            </div>
            <div>
              <h4 className="font-display text-base font-semibold">Attendance History</h4>
              {teacherHistory.length === 0 ? (
                <p className="mt-2 text-sm text-ink-500">No history available.</p>
              ) : (
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                  {teacherHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-900">
                      <span>{formatDate(h.attendance_date)}</span>
                      <StatusBadge status={h.status} />
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

export function SupervisorReportsOverviewPage() {
  const submissions = useQuery({
    queryKey: ['supervisor-submissions'],
    queryFn: () => listPracticeStudents({ status: 'submitted' }),
  })

  const somaliCount = (submissions.data ?? []).filter(s => s.practice_type === 'somali_speaking').length
  const englishCount = (submissions.data ?? []).filter(s => s.practice_type === 'english_speaking').length
  const total = (submissions.data ?? []).length

  return (
    <div>
      <PageHeader title="Reports Overview" description="Summary of all practice submissions." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-2xl font-bold text-brand-600">{total}</p>
          <p className="text-sm text-ink-500">Total Submitted</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-green-600">{somaliCount}</p>
          <p className="text-sm text-ink-500">Somali Speaking</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-blue-600">{englishCount}</p>
          <p className="text-sm text-ink-500">English Speaking</p>
        </Card>
      </div>
    </div>
  )
}
