import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { financeSummary, listFinanceRecords, upsertFinanceRecord } from '@/services/finance'
import { listClasses } from '@/services/classes'
import { listStudents, listStudentsByClass } from '@/services/students'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatCard, Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage, monthName } from '@/lib/utils'
import type { FinanceRecord, PaymentStatus } from '@/types'

export function FinanceOverviewPage() {
  const year = new Date().getFullYear()
  const summary = useQuery({ queryKey: ['finance-summary', year], queryFn: () => financeSummary(year) })
  return (
    <div>
      <PageHeader title="Overview" description="Fee collection snapshot." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid" value={summary.data?.byStatus.paid ?? 0} />
        <StatCard label="Unpaid" value={summary.data?.byStatus.unpaid ?? 0} />
        <StatCard label="Revenue (USD)" value={summary.data?.revenue ?? 0} />
      </div>
    </div>
  )
}

export function FinancePaymentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const year = new Date().getFullYear()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [status, setStatus] = useState<PaymentStatus>('paid')
  const [amount, setAmount] = useState('')

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const students = useQuery({
    queryKey: ['finance-students', classId],
    queryFn: () => (classId ? listStudentsByClass(classId) : listStudents()),
  })
  const records = useQuery({
    queryKey: ['finance-records', year, month, classId, studentId],
    queryFn: () =>
      listFinanceRecords({
        year,
        month,
        classId: classId || undefined,
        studentId: studentId || undefined,
      }),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error('Select a student')
      await upsertFinanceRecord({
        student_id: studentId,
        class_id: classId || null,
        month,
        year,
        status,
        amount: amount ? Number(amount) : null,
        recorded_by: user!.profile.id,
      })
    },
    onSuccess: () => {
      toast.success('Payment recorded')
      qc.invalidateQueries({ queryKey: ['finance-records'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Record Payments" description="Filter by month, class, and student. Statuses: paid, unpaid, scholarship_nb." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="Month" options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))} value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} />
        <Select label="Class" options={[{ value: '', label: 'All / none' }, ...(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId('') }} />
        <Select label="Student" placeholder="Select student" options={(students.data ?? []).map((s) => ({ value: s.id, label: `${s.student_id} — ${s.profile?.full_name ?? ''}` }))} value={studentId} onChange={(e) => setStudentId(e.target.value)} />
        <Select
          label="Status"
          options={[
            { value: 'paid', label: 'Paid' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'scholarship_nb', label: 'Scholarship / NB' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value as PaymentStatus)}
        />
        <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="flex items-end"><Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>Save record</Button></div>
      </Card>
      {records.isLoading ? <TableSkeleton /> : !records.data?.length ? <EmptyState title="No records for filters" /> : (
        <div className="space-y-2">
          {records.data.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{r.student?.profile?.full_name}</p>
                <p className="text-xs text-ink-500">{r.student?.student_id} · {monthName(r.month)} {r.year}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{r.amount != null ? `$${r.amount}` : '—'}</span>
                <StatusBadge status={r.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function FinanceManagerOverviewPage() {
  const year = new Date().getFullYear()
  const summary = useQuery({ queryKey: ['finance-summary', year], queryFn: () => financeSummary(year) })

  const latestRecords = useQuery({
    queryKey: ['finance-latest'],
    queryFn: () => listFinanceRecords({}),
  })

  const grouped = useMemo(() => {
    if (!latestRecords.data?.length) return []
    const map = new Map<string, { classId: string; className: string; month: number; year: number; records: FinanceRecord[] }>()
    for (const r of latestRecords.data) {
      const key = `${r.class_id ?? 'none'}-${r.month}-${r.year}`
      if (!map.has(key)) {
        map.set(key, {
          classId: r.class_id ?? '',
          className: r.student?.class?.name ?? 'Unknown Class',
          month: r.month,
          year: r.year,
          records: [],
        })
      }
      map.get(key)!.records.push(r)
    }
    return Array.from(map.values()).slice(0, 5)
  }, [latestRecords.data])

  return (
    <div>
      <PageHeader title="Overview" description="Fee collection snapshot — latest class records below." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid" value={summary.data?.byStatus.paid ?? 0} />
        <StatCard label="Unpaid" value={summary.data?.byStatus.unpaid ?? 0} />
        <StatCard label="Scholarship / NB" value={summary.data?.byStatus.scholarship_nb ?? 0} />
      </div>

      <h3 className="font-display mb-3 text-lg font-semibold">Latest Updates</h3>
      {latestRecords.isLoading ? <TableSkeleton /> : !grouped.length ? (
        <EmptyState title="No finance records yet" description="Records will appear here once the manager saves them." />
      ) : (
        grouped.map((g) => (
          <Card key={`${g.classId}-${g.month}-${g.year}`} className="mb-3">
            <h4 className="font-display font-semibold">{g.className} — {monthName(g.month)} {g.year}</h4>
            <div className="mt-2 space-y-1">
              {g.records.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded bg-ink-50 px-3 py-2 text-sm dark:bg-ink-900">
                  <span className="min-w-0 flex-1 truncate">{r.student?.profile?.full_name ?? '—'} ({r.student?.student_id ?? '—'})</span>
                  <span className="mx-3 text-xs font-semibold">{r.amount != null ? `$${r.amount}` : '—'}</span>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

export function FinanceManagerReportsPage() {
  const year = new Date().getFullYear()
  const [fClassId, setFClassId] = useState('')
  const [fMonth, setFMonth] = useState(new Date().getMonth() + 1)
  const summary = useQuery({ queryKey: ['finance-summary', year], queryFn: () => financeSummary(year) })
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })
  const records = useQuery({
    queryKey: ['finance-records', year, fMonth, fClassId],
    queryFn: () => listFinanceRecords({ year, month: fMonth, classId: fClassId || undefined }),
    enabled: !!fClassId,
  })
  const chartData = Object.entries(summary.data?.byMonth ?? {}).map(([m, v]) => ({
    month: monthName(Number(m)).slice(0, 3),
    ...v,
  }))

  return (
    <div>
      <PageHeader title="Reports" description="Read-only finance analytics." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid" value={summary.data?.byStatus.paid ?? 0} />
        <StatCard label="Unpaid" value={summary.data?.byStatus.unpaid ?? 0} />
        <StatCard label="Scholarship / NB" value={summary.data?.byStatus.scholarship_nb ?? 0} />
      </div>
      <Card>
        <h3 className="font-display text-lg font-semibold">{year} monthly breakdown</h3>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="paid" fill="#1a7051" radius={[4, 4, 0, 0]} />
              <Bar dataKey="unpaid" fill="#c0392b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="scholarship_nb" fill="#d4a017" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-4">
        <h3 className="font-display text-lg font-semibold">Class Records</h3>
        <p className="mt-1 text-sm text-ink-500">Select a class and month to view student payment statuses.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Select
            label="Class"
            placeholder="Select class..."
            options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={fClassId}
            onChange={(e) => setFClassId(e.target.value)}
          />
          <Select
            label="Month"
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))}
            value={String(fMonth)}
            onChange={(e) => setFMonth(Number(e.target.value))}
          />
        </div>
        {records.isLoading ? <TableSkeleton /> : !records.data?.length ? (
          <EmptyState title="No records" description="No finance records for this class and month." />
        ) : (
          <div className="mt-3 space-y-2">
            {records.data.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.student?.profile?.full_name ?? '—'}</p>
                  <p className="text-xs text-ink-500">{r.student?.student_id ?? '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{r.amount != null ? `$${r.amount}` : '—'}</span>
                  <StatusBadge status={r.status} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
