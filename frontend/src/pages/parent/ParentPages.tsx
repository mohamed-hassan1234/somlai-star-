import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import {
  listChildAttendance,
  listChildBehavior,
  listChildFinance,
  listChildLessons,
  listChildResults,
  listMyChildren,
  listPublishedNotices,
  type ParentRecord,
} from '@/services/parents'
import { listChildLessonMonitoring } from '@/services/lesson-monitoring'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, StatCard } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Users, ClipboardList, Trophy, BookOpen, Banknote, CheckCircle2, AlertCircle, CalendarDays } from 'lucide-react'
import type { FinanceRecord } from '@/types'

const SOMALI_MONTHS = [
  'Jannaayo',
  'Febraayo',
  'Maarso',
  'Abriil',
  'Maajo',
  'Juun',
  'Luuliyo',
  'Agoosto',
  'Sebtembar',
  'Oktoobar',
  'Nofembar',
  'Disembar',
]

const SO_ATTENDANCE_STATUS: Record<string, string> = {
  present: 'Wuu yimid',
  absent: 'Ma iman',
  late: 'Wuu ku daahay',
  leave: 'Fasax',
  excused: 'Cudurdaar',
}

const SO_BEHAVIOR_STATUS: Record<string, string> = {
  positive: 'Wanaagsan',
  negative: 'Xun',
  warning: 'Digniin',
  achievement: 'Guul',
}

const SO_MONITORING_STATUS: Record<string, string> = {
  present: 'Kabaxay',
  absent: 'Kama bixin',
  late: 'Wuu ku daahay',
  leave: 'Fasax',
  excused: 'Cudurdaar',
}

const SO_PAYMENT_STATUS: Record<string, string> = {
  paid: 'Bixiyey',
  unpaid: 'Ma bixin',
  scholarship_nb: 'Scolarship',
}

function formatSomaliDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('so-SO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ChildPicker({
  items,
  value,
  onChange,
  label = 'Ilmaha',
}: {
  items: ParentRecord[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  return (
    <Select
      label={label}
      options={items.map((c) => ({
        value: c.student_id,
        label: `${c.student?.profile?.full_name ?? 'Qof aan la garanayn'} (${c.student?.student_id ?? ''})`,
      }))}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function useChildren() {
  const { user } = useAuth()
  const profileId = user!.profile.id
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-children', profileId],
    queryFn: () => listMyChildren(profileId),
  })
  return { children: data ?? [], isLoading, error }
}

export function ParentOverviewPage() {
  const { children, isLoading } = useChildren()

  const childIds = useMemo(() => children.map((c) => c.student_id), [children])
  const classIds = useMemo(
    () => Array.from(new Set(children.map((c) => c.student?.class_id).filter(Boolean))) as string[],
    [children],
  )

  const attendance = useQuery({
    queryKey: ['parent-attendance', childIds.join(',')],
    queryFn: () => listChildAttendance(childIds),
    enabled: childIds.length > 0,
  })
  const results = useQuery({
    queryKey: ['parent-results', childIds.join(',')],
    queryFn: () => listChildResults(childIds),
    enabled: childIds.length > 0,
  })
  const behavior = useQuery({
    queryKey: ['parent-behavior', childIds.join(',')],
    queryFn: () => listChildBehavior(childIds),
    enabled: childIds.length > 0,
  })
  const lessons = useQuery({
    queryKey: ['parent-lessons', classIds.join(',')],
    queryFn: () => listChildLessons(classIds),
    enabled: classIds.length > 0,
  })

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  if (isLoading) return <TableSkeleton />

  return (
    <div>
      <PageHeader title="Soo dhawoow, Waalid" description="Muuqaal toos ah oo ah horumarka iskuulka ee ilmahaaga." />
      {!children.length ? (
        <EmptyState
          title="Wali ilmaha laguma xirin"
          description="Waxaad ka codsan kartaa Maareeyaha Iskuulka inuu ilmo ku xiro xisaabtaan."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Carruur" value={children.length} icon={<Users className="h-5 w-5" />} />
            <StatCard
              label="Xaadiritaan (30 c)"
              value={
                attendance.data?.length
                  ? `${Math.round(
                      ((attendance.data.filter((r: { status: string; attendance_date: string }) => r.attendance_date >= cutoff && (r.status === 'present' || r.status === 'late')).length) /
                        attendance.data.filter((r: { attendance_date: string }) => r.attendance_date >= cutoff).length) *
                        100,
                    )}%`
                  : '—'
              }
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <StatCard label="Natiijooyin la Daabacay" value={results.data?.length ?? 0} icon={<Trophy className="h-5 w-5" />} />
            <StatCard label="Casharro" value={lessons.data?.length ?? 0} icon={<BookOpen className="h-5 w-5" />} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {children.map((c) => {
              const sid = c.student_id
              const mine = (attendance.data ?? []).filter((r: { student_id: string }) => r.student_id === sid)
              const recent = mine.filter((r: { attendance_date: string }) => r.attendance_date >= cutoff)
              const present = recent.filter((r: { status: string }) => r.status === 'present' || r.status === 'late').length
              const pct = recent.length ? Math.round((present / recent.length) * 100) : null
              const lastResult = (results.data ?? []).find((r: { student_id: string }) => r.student_id === sid)
              const lastBehavior = (behavior.data ?? []).find((r: { student_id: string }) => r.student_id === sid)

              return (
                <Card key={sid} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold">{c.student?.profile?.full_name ?? 'Ilmo'}</p>
                      <p className="text-xs text-ink-500">{c.student?.student_id}</p>
                    </div>
                    <StatusBadge status="present" label={pct === null ? 'Wax qoraal ah ma jiro' : `${pct}%`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p className="text-ink-500">Fasalka:</p>
                    <p className="text-right">{c.student?.class?.name ?? '—'}</p>
                    <p className="text-ink-500">Natiijadii ugu dambaysay:</p>
                    <p className="text-right">
                      {lastResult ? `${lastResult.marks_obtained}/${lastResult.max_marks}` : '—'}
                    </p>
                    <p className="text-ink-500">Dhaankii ugu dambeeyey:</p>
                    <p className="text-right">
                      {lastBehavior ? <StatusBadge status={lastBehavior.category} label={SO_BEHAVIOR_STATUS[lastBehavior.category]} /> : '—'}
                    </p>
                    <p className="text-ink-500">Taleefanka Waalidka:</p>
                    <p className="text-right">{c.student?.parent_phone || '—'}</p>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function ParentAttendancePage() {
  const { children } = useChildren()
  const [childId, setChildId] = useState('')
  const activeId = childId || children[0]?.student_id || ''
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const attendance = useQuery({
    queryKey: ['parent-attendance-single', activeId],
    queryFn: () => listChildAttendance(activeId ? [activeId] : []),
    enabled: !!activeId,
  })

  const records = (attendance.data ?? []).filter((r: { attendance_date: string }) => {
    const d = new Date(r.attendance_date)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
  const totals: Record<string, number> = { present: 0, absent: 0, late: 0, leave: 0, excused: 0, total: records.length }
  for (const r of records as { status: string }[]) {
    if (r.status in totals) totals[r.status] += 1
  }

  return (
    <div>
      <PageHeader title="Xaadiritaanka" description="Xaadiritaanka bishii ee ilmaha la doortay." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        <ChildPicker items={children} value={activeId} onChange={setChildId} />
        <Select
          label="Bisha"
          options={SOMALI_MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
        <Input label="Sannadka" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </Card>

      {attendance.isLoading ? (
        <TableSkeleton />
      ) : !records.length ? (
        <EmptyState title="Ma jiro xaadiritaan bishan" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { key: 'present', label: 'Wuu yimid' },
              { key: 'absent', label: 'Ma iman' },
              { key: 'late', label: 'Daahay' },
              { key: 'leave', label: 'Fasax' },
              { key: 'total', label: 'Wadar' },
            ].map(({ key, label }) => (
              <Card key={key} className="text-center">
                <p className="text-xs uppercase text-ink-500">{label}</p>
                <p className="font-display text-2xl font-semibold">{totals[key] ?? 0}</p>
              </Card>
            ))}
          </div>
          <div className="space-y-2">
            {records.map((r: { id: string; attendance_date: string; status: string }) => (
              <Card key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{formatSomaliDate(r.attendance_date)}</p>
                </div>
                <StatusBadge status={r.status} label={SO_ATTENDANCE_STATUS[r.status]} />
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ParentResultsPage() {
  const { children } = useChildren()
  const [childId, setChildId] = useState('')
  const activeId = childId || children[0]?.student_id || ''

  const results = useQuery({
    queryKey: ['parent-results-single', activeId],
    queryFn: () => listChildResults(activeId ? [activeId] : []),
    enabled: !!activeId,
  })

  return (
    <div>
      <PageHeader title="Natiijooyinka" description="Natiijooyinka rasmiga ah ee la daabacay ee ilmaha la doortay." />
      <Card className="mb-4 max-w-sm">
        <ChildPicker items={children} value={activeId} onChange={setChildId} />
      </Card>
      {results.isLoading ? (
        <TableSkeleton />
      ) : !results.data?.length ? (
        <EmptyState title="Ma jiro natiijo la daabacay" />
      ) : (
        <div className="space-y-3">
          {(results.data as Array<{
            id: string
            marks_obtained: number
            max_marks: number
            grade?: string
            submission?: { title?: string; subject?: { name?: string } }
          }>).map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">{r.submission?.title}</p>
                <p className="text-sm text-ink-500">{r.submission?.subject?.name ?? 'Maaddada'}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold">
                  {r.marks_obtained}/{r.max_marks}
                </p>
                {r.grade && <p className="text-sm text-ink-500">Darajo {r.grade}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function ParentLessonsPage() {
  const { children } = useChildren()
  const [childId, setChildId] = useState('')
  const activeId = childId || children[0]?.student_id || ''
  const activeClassId = children.find((c) => c.student_id === activeId)?.student?.class_id

  const lessons = useQuery({
    queryKey: ['parent-lessons-single', activeClassId ?? 'none'],
    queryFn: () => listChildLessons(activeClassId ? [activeClassId] : []),
    enabled: !!activeClassId,
  })

  return (
    <div>
      <PageHeader title="Casharrada" description="Casharrada la daabacay ee fasalka ilmaha la doortay." />
      <Card className="mb-4 max-w-sm">
        <ChildPicker items={children} value={activeId} onChange={setChildId} />
      </Card>
      {lessons.isLoading ? (
        <TableSkeleton />
      ) : !lessons.data?.length ? (
        <EmptyState title="Wali wax cashar ah lama daabacin" />
      ) : (
        <div className="space-y-3">
          {(lessons.data as Array<{
            id: string
            title: string
            description?: string
            lesson_date: string
            subject?: { name?: string }
          }>).map((l) => (
            <Card key={l.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-semibold">{l.title}</p>
                <p className="text-sm text-ink-500">{formatSomaliDate(l.lesson_date)}</p>
              </div>
              <p className="mt-1 text-sm text-ink-500">{l.subject?.name ?? 'Maaddada'}</p>
              {l.description && <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{l.description}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function ParentBehaviorPage() {
  const { children } = useChildren()
  const [childId, setChildId] = useState('')
  const activeId = childId || children[0]?.student_id || ''

  const behavior = useQuery({
    queryKey: ['parent-behavior-single', activeId],
    queryFn: () => listChildBehavior(activeId ? [activeId] : []),
    enabled: !!activeId,
  })

  return (
    <div>
      <PageHeader title="Dhaanka" description="Qoraalada dhaanka iyo edbinta ee ilmaha la doortay." />
      <Card className="mb-4 max-w-sm">
        <ChildPicker items={children} value={activeId} onChange={setChildId} />
      </Card>
      {behavior.isLoading ? (
        <TableSkeleton />
      ) : !behavior.data?.length ? (
        <EmptyState title="Ma jiro qoraal dhaan" />
      ) : (
        <div className="space-y-3">
          {(behavior.data as Array<{
            id: string
            behavior_date: string
            category: string
            description: string
            action_taken?: string
          }>).map((b) => (
            <Card key={b.id} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge status={b.category} label={SO_BEHAVIOR_STATUS[b.category]} />
                <p className="text-sm text-ink-500">{formatSomaliDate(b.behavior_date)}</p>
              </div>
              <p className="text-sm">{b.description}</p>
              {b.action_taken && <p className="text-xs text-ink-500">Ficil: {b.action_taken}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function ParentNoticesPage() {
  const notices = useQuery({
    queryKey: ['parent-notices'],
    queryFn: listPublishedNotices,
  })

  return (
    <div>
      <PageHeader title="Ogaysiinta" description="Wacyigelinada iskuulka." />
      {notices.isLoading ? (
        <TableSkeleton />
      ) : !notices.data?.length ? (
        <EmptyState title="Ma jiro wacyigelin" />
      ) : (
        <div className="space-y-3">
          {(notices.data as Array<{
            id: string
            title: string
            body: string
            notice_type?: string
            published_at?: string
          }>).map((n) => (
            <Card key={n.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-semibold">{n.title}</p>
                {n.published_at && <p className="text-sm text-ink-500">{formatSomaliDate(n.published_at)}</p>}
              </div>
              <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{n.body}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function ParentLessonMonitoringPage() {
  const { children } = useChildren()
  const [childId, setChildId] = useState('')
  const activeId = childId || children[0]?.student_id || ''

  const monitoring = useQuery({
    queryKey: ['parent-lesson-monitoring-single', activeId],
    queryFn: () => listChildLessonMonitoring(activeId ? [activeId] : []),
    enabled: !!activeId,
  })

  const records = monitoring.data ?? []
  const totals: Record<string, number> = { present: 0, absent: 0, late: 0, leave: 0, total: records.length }
  for (const r of records) {
    if (r.status in totals) totals[r.status] += 1
  }

  return (
    <div>
      <PageHeader title="Kormeerka Casharka" description="Warbixin xaadiritaanka casharrada ee ilmahaaga." />
      <Card className="mb-4 max-w-sm">
        <ChildPicker items={children} value={activeId} onChange={setChildId} label="Ilmaha" />
      </Card>
      {monitoring.isLoading ? (
        <TableSkeleton />
      ) : !records.length ? (
        <EmptyState title="Wali wax qoraal ah ma jiro" description="Macallinku casharka wali kama uu buuxin xaadiritaanka." />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { key: 'present', label: 'Kabaxay' },
              { key: 'absent', label: 'Kama bixin' },
              { key: 'late', label: 'Daahay' },
              { key: 'leave', label: 'Fasax' },
              { key: 'total', label: 'Wadar' },
            ].map(({ key, label }) => (
              <Card key={key} className="text-center">
                <p className="text-xs uppercase text-ink-500">{label}</p>
                <p className="font-display text-2xl font-semibold">{totals[key] ?? 0}</p>
              </Card>
            ))}
          </div>
          <div className="space-y-2">
            {records.map((r) => (
              <Card key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{formatSomaliDate(r.monitoring_date)}</p>
                  <p className="text-xs text-ink-500">{r.student?.profile?.full_name}</p>
                </div>
                <StatusBadge status={r.status} label={SO_MONITORING_STATUS[r.status]} />
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ParentFinancePage() {
  const { children } = useChildren()
  const [childId, setChildId] = useState('')
  const activeId = childId || children[0]?.student_id || ''
  const [year, setYear] = useState(new Date().getFullYear())

  const finance = useQuery({
    queryKey: ['parent-finance-single', activeId, year],
    queryFn: () => listChildFinance(activeId ? [activeId] : []),
    enabled: !!activeId,
  })

  const records = (finance.data ?? []).filter((r: FinanceRecord) => r.year === year)
  const byMonth = new Map<number, FinanceRecord>()
  for (const r of records) byMonth.set(r.month, r)

  const paidCount = records.filter((r: FinanceRecord) => r.status === 'paid').length
  const owedCount = records.filter((r: FinanceRecord) => r.status !== 'paid').length
  const paidAmount = records
    .filter((r: FinanceRecord) => r.status === 'paid')
    .reduce((sum, r: FinanceRecord) => sum + Number(r.amount ?? 0), 0)

  return (
    <div>
      <PageHeader title="Lacagta Bisha" description="Lacagta bishii ee ilmaha la doortay — wixii bixiyey iyo wixii hadhay." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-2">
        <ChildPicker items={children} value={activeId} onChange={setChildId} />
        <Input label="Sannadka" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </Card>

      {finance.isLoading ? (
        <TableSkeleton />
      ) : !records.length ? (
        <EmptyState
          title="Ma jiro lacag diiwaan ah"
          description="Maareeyaha Iskuulku wali lama qorin lacagta sannadkan."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Bilood la Bixiyey" value={paidCount} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Bilood Hadhay" value={owedCount} icon={<AlertCircle className="h-5 w-5" />} />
            <StatCard label="Wadarta La Bixiyey" value={`${paidAmount} USD`} icon={<Banknote className="h-5 w-5" />} />
            <StatCard label="Sannad" value={year} icon={<CalendarDays className="h-5 w-5" />} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOMALI_MONTHS.map((m, i) => {
              const monthNum = i + 1
              const rec = byMonth.get(monthNum)
              return (
                <Card key={monthNum} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold">{m}</p>
                    {rec ? (
                      <StatusBadge status={rec.status} label={SO_PAYMENT_STATUS[rec.status]} />
                    ) : (
                      <StatusBadge status="draft" label="Lama qorin" />
                    )}
                  </div>
                  {rec && (
                    <div className="text-xs text-ink-500">
                      <p>Lacagta: {rec.amount != null ? `${Number(rec.amount)} USD` : '—'}</p>
                      {rec.notes && <p>Xusuus: {rec.notes}</p>}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
