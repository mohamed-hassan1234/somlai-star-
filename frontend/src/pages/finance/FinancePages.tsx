import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import {
  financeSummary,
  listFinanceRecords,
  upsertFinanceRecord,
} from '@/services/finance'
import { listClasses } from '@/services/classes'
import { getStudent, listStudentsByClass } from '@/services/students'
import { monthName } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatCard, Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import type { FinanceRecord, PaymentStatus } from '@/types'

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear()
  const start = Math.min(2025, current - 1)
  const end = Math.max(2027, current + 2)
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const y = start + i
    return { value: String(y), label: String(y) }
  })
})()

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'scholarship_nb', label: 'Scholarship / NB' },
]

function formatMoney(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  return `$${Number(amount).toFixed(2)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value.slice(0, 10)
  return d.toLocaleDateString()
}

function statusLabel(status: PaymentStatus | string) {
  if (status === 'scholarship_nb') return 'NB / Scholarship'
  if (status === 'paid') return 'Paid'
  if (status === 'unpaid') return 'Unpaid'
  return String(status).replaceAll('_', ' ')
}

function MonthYearPicker({
  month,
  year,
  onMonth,
  onYear,
}: {
  month: number
  year: number
  onMonth: (m: number) => void
  onYear: (y: number) => void
}) {
  const years = YEAR_OPTIONS.some((y) => y.value === String(year))
    ? YEAR_OPTIONS
    : [...YEAR_OPTIONS, { value: String(year), label: String(year) }].sort(
        (a, b) => Number(a.value) - Number(b.value),
      )

  return (
    <>
      <Select
        label="Select Month"
        options={MONTHS}
        value={String(month)}
        onChange={(e) => onMonth(Number(e.target.value))}
      />
      <Select
        label="Select Year"
        options={years}
        value={String(year)}
        onChange={(e) => onYear(Number(e.target.value))}
      />
    </>
  )
}

/** Shared monthly dashboard: income, expenses, salaries, other income and net balance. */
function FinanceDashboard({ month, year, onMonth, onYear }: { month: number; year: number; onMonth: (m: number) => void; onYear: (y: number) => void }) {
  const summary = useQuery({
    queryKey: ['finance-summary', year, month],
    queryFn: () => financeSummary(year, month),
  })

  const records = useQuery({
    queryKey: ['finance-records', year, month],
    queryFn: () => listFinanceRecords({ year, month }),
  })

  return (
    <>
      <Card className="mb-4">
        <div className="p-4 grid grid-cols-2 gap-2">
          <MonthYearPicker month={month} year={year} onMonth={onMonth} onYear={onYear} />
        </div>
      </Card>

      {summary.isLoading ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatCard label="Total Income" value={0} />
          <StatCard label="Total Expenses" value={0} />
          <StatCard label="Net Balance" value={0} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <StatCard label="Total Income" value={summary.data?.totalIncome ?? 0} />
          <StatCard label="Student Fee Income" value={summary.data?.studentFeeIncome ?? 0} />
          <StatCard label="Other Income" value={summary.data?.otherIncome ?? 0} />
          <StatCard label="Total Expenses" value={summary.data?.totalExpenses ?? 0} />
          <StatCard label="Total Salaries" value={summary.data?.totalSalaries ?? 0} />
          <StatCard label="Rent" value={summary.data?.expenseByCategory?.rent ?? 0} />
          <StatCard label="Electricity" value={summary.data?.expenseByCategory?.electricity ?? 0} />
          <StatCard label="Water" value={summary.data?.expenseByCategory?.water ?? 0} />
          <StatCard label="Internet" value={summary.data?.expenseByCategory?.internet ?? 0} />
          <StatCard label="Other Expenses" value={summary.data?.expenseByCategory?.other ?? 0} />
          <StatCard label="Net Balance" value={summary.data?.netBalance ?? 0} />
        </div>
      )}

      <Card className="mt-4">
        <div className="p-4">
          <h3 className="font-display font-semibold mb-3">Student Payment Statistics</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Card className="p-3">
              <p className="font-medium text-lg">Paid Students</p>
              <p className="text-2xl font-bold">{summary.data?.paid ?? 0}</p>
              <p className="text-sm text-ink-500">of {summary.data?.totalStudents ?? 0} students</p>
            </Card>
            <Card className="p-3">
              <p className="font-medium text-lg">Unpaid Students</p>
              <p className="text-2xl font-bold text-red-600">{summary.data?.unpaid ?? 0}</p>
              <p className="text-sm text-ink-500">Outstanding: ${(summary.data?.outstandingFees ?? 0).toFixed(2)}</p>
            </Card>
            <Card className="p-3">
              <p className="font-medium text-lg">Scholarship Students</p>
              <p className="text-2xl font-bold text-orange-600">{summary.data?.scholarship_nb ?? 0}</p>
              <p className="text-sm text-ink-500">Excluded from totals</p>
            </Card>
            <Card className="p-3">
              <p className="font-medium text-lg">Total Students</p>
              <p className="text-2xl font-bold">{summary.data?.totalStudents ?? 0}</p>
            </Card>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="p-4">
          <h3 className="font-display font-semibold mb-3">Payments — {monthName(month)} {year}</h3>
          {records.isLoading ? (
            <TableSkeleton />
          ) : !records.data?.length ? (
            <EmptyState title="No payments" description="No payments recorded for the selected month." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-ink-200">
                    <th className="p-2 w-24">Student Name</th>
                    <th className="p-2">Student ID</th>
                    <th className="p-2">Month</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {records.data.map((r) => (
                    <tr key={r.id} className="border-b border-ink-100 hover:bg-ink-50">
                      <td className="p-2">{r.student?.profile?.full_name ?? '—'}</td>
                      <td className="p-2">{r.student?.student_id ?? '—'}</td>
                      <td className="p-2">{monthName(r.month)} {r.year}</td>
                      <td className="p-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="p-2">${r.amount != null ? r.amount.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </>
  )
}

export function FinanceOverviewPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  return (
    <div>
      <PageHeader title="Finance Overview" description="Monthly financial dashboard." />
      <FinanceDashboard month={month} year={year} onMonth={setMonth} onYear={setYear} />
    </div>
  )
}

/** Per-class, per-student payment recorder for a single month. */
export function FinancePaymentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [classId, setClassId] = useState('')
  const [amount, setAmount] = useState('')
  const [statusMap, setStatusMap] = useState<Record<string, '' | PaymentStatus>>({})

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })

  const students = useQuery({
    queryKey: ['students-by-class', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  })

  const records = useQuery({
    queryKey: ['finance-records', year, month, classId],
    queryFn: () => listFinanceRecords({ year, month, classId }),
    enabled: !!classId,
  })

  const merged = useMemo(() => {
    if (!students.data) return []
    const byStudent: Record<string, { status: string; amount: number | null }> = {}
    for (const r of records.data ?? []) {
      if (r.student_id) byStudent[r.student_id] = { status: r.status, amount: r.amount }
    }
    return students.data.map((s) => ({
      id: s.id,
      studentId: s.student_id,
      name: s.profile?.full_name ?? '—',
      existingStatus: (byStudent[s.id]?.status ?? '') as '' | PaymentStatus,
      existingAmount: byStudent[s.id]?.amount ?? null,
    }))
  }, [students.data, records.data])

  const hasChanges = useMemo(
    () => merged.some((row) => (statusMap[row.id] ?? row.existingStatus) !== row.existingStatus),
    [merged, statusMap],
  )

  const save = useMutation({
    mutationFn: async () => {
      const recordedBy = user?.profile?.id
      const paidAmount = amount ? Number(amount) : null
      const ops = merged
        .filter((row) => (statusMap[row.id] ?? row.existingStatus))
        .map((row) =>
          upsertFinanceRecord({
            student_id: row.id,
            class_id: classId,
            month,
            year,
            status: (statusMap[row.id] ?? row.existingStatus) as PaymentStatus,
            amount: paidAmount,
            recorded_by: recordedBy,
          }),
        )
      if (!ops.length) return
      await Promise.all(ops)
    },
    onSuccess: () => {
      setStatusMap({})
      qc.invalidateQueries({ queryKey: ['finance-records'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
      toast.success('Payments saved')
    },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div>
      <PageHeader title="Record Payments" description="Set each student's status for the selected month." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Class"
          placeholder="Select class..."
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value)
            setStatusMap({})
          }}
        />
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <Input
          label="Monthly Fee ($)"
          type="number"
          placeholder="e.g. 5"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex items-end">
          <Button className="w-full" loading={save.isPending} disabled={!hasChanges} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      </Card>

      {!classId ? (
        <EmptyState title="Select a class" description="Pick a class and month to record payments." />
      ) : students.isLoading || records.isLoading ? (
        <TableSkeleton />
      ) : !merged.length ? (
        <EmptyState title="No students" description="This class has no students." />
      ) : (
        <div className="space-y-2">
          {merged.map((row) => (
            <Card key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{row.name}</p>
                <p className="text-xs text-ink-500">{row.studentId}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">
                  {row.existingAmount != null
                    ? `$${row.existingAmount.toFixed(2)}`
                    : amount
                      ? `$${amount}`
                      : '—'}
                </span>
                <StatusBadge
                  status={(statusMap[row.id] ?? row.existingStatus) || 'unset'}
                  label={(statusMap[row.id] ?? row.existingStatus) || 'Not set'}
                />
                <Select
                  options={STATUS_OPTIONS}
                  value={statusMap[row.id] ?? row.existingStatus}
                  onChange={(e) =>
                    setStatusMap((prev) => ({ ...prev, [row.id]: e.target.value as '' | PaymentStatus }))
                  }
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function groupSavedRecords(records: FinanceRecord[]) {
  const paid = records.filter((r) => r.status === 'paid')
  const unpaid = records.filter((r) => r.status === 'unpaid')
  const scholarshipNb = records.filter((r) => r.status === 'scholarship_nb')
  const paidTotal = paid.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  return { paid, unpaid, scholarshipNb, paidTotal }
}

function StudentNameLink({ record }: { record: FinanceRecord }) {
  const name = record.student?.profile?.full_name ?? '—'
  const studentId = record.student_id
  return (
    <Link
      to={`/finance-manager/students/${studentId}`}
      className="font-medium text-brand-700 hover:underline dark:text-brand-300"
    >
      {name}
    </Link>
  )
}

function SavedStudentsTable({
  records,
  columns,
  emptyTitle,
}: {
  records: FinanceRecord[]
  columns: 'paid' | 'unpaid' | 'scholarship_nb'
  emptyTitle: string
}) {
  if (!records.length) {
    return <EmptyState title={emptyTitle} description="No saved records for this period." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left">
            <th className="p-2">Student ID</th>
            <th className="p-2">Full Name</th>
            {columns === 'paid' && (
              <>
                <th className="p-2">Amount Paid</th>
                <th className="p-2">Payment Date</th>
              </>
            )}
            {columns === 'unpaid' && <th className="p-2">Saved payment status</th>}
            {columns === 'scholarship_nb' && <th className="p-2">Scholarship/NB status</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-ink-100 hover:bg-ink-50 dark:hover:bg-ink-900/40">
              <td className="p-2 font-mono text-xs">{r.student?.student_id ?? '—'}</td>
              <td className="p-2">
                <StudentNameLink record={r} />
              </td>
              {columns === 'paid' && (
                <>
                  <td className="p-2">{formatMoney(r.amount)}</td>
                  <td className="p-2">{formatDate(r.updated_at ?? r.created_at)}</td>
                </>
              )}
              {columns === 'unpaid' && (
                <td className="p-2">
                  <StatusBadge status={r.status} label={statusLabel(r.status)} />
                </td>
              )}
              {columns === 'scholarship_nb' && (
                <td className="p-2">
                  <StatusBadge status={r.status} label={statusLabel(r.status)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Read-only financial overview: saved Paid / Unpaid / NB-Scholarship records only. */
export function FinanceManagerOverviewPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const records = useQuery({
    queryKey: ['finance-manager-overview', year, month],
    queryFn: () => listFinanceRecords({ year, month }),
  })

  const grouped = useMemo(() => groupSavedRecords(records.data ?? []), [records.data])

  return (
    <div>
      <PageHeader
        title="Finance Overview"
        description="Read-only view of payment statuses saved by administration."
      />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 p-4">
          <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        </div>
      </Card>

      {records.isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm font-medium text-ink-500">PAID</p>
              <p className="mt-1 text-3xl font-bold">{grouped.paid.length}</p>
              <p className="mt-1 text-sm text-ink-500">
                Collected: {formatMoney(grouped.paidTotal)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-medium text-ink-500">UNPAID</p>
              <p className="mt-1 text-3xl font-bold text-red-600">{grouped.unpaid.length}</p>
              <p className="mt-1 text-sm text-ink-500">Saved unpaid status only</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-medium text-ink-500">NB / SCHOLARSHIP</p>
              <p className="mt-1 text-3xl font-bold text-amber-700">{grouped.scholarshipNb.length}</p>
              <p className="mt-1 text-sm text-ink-500">Saved NB/Scholarship status</p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="p-4">
                <h3 className="mb-3 font-display font-semibold">Paid students</h3>
                <SavedStudentsTable
                  records={grouped.paid}
                  columns="paid"
                  emptyTitle="No paid students"
                />
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <h3 className="mb-3 font-display font-semibold">Unpaid students</h3>
                <SavedStudentsTable
                  records={grouped.unpaid}
                  columns="unpaid"
                  emptyTitle="No unpaid students"
                />
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <h3 className="mb-3 font-display font-semibold">NB / Scholarship</h3>
                <SavedStudentsTable
                  records={grouped.scholarshipNb}
                  columns="scholarship_nb"
                  emptyTitle="No NB / Scholarship students"
                />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

/** Read-only class financial report from saved administration records. */
export function FinanceManagerClassReportPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [classId, setClassId] = useState('')

  const classes = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() })

  const records = useQuery({
    queryKey: ['finance-manager-class-report', year, month, classId],
    queryFn: () => listFinanceRecords({ year, month, classId }),
    enabled: !!classId,
  })

  const grouped = useMemo(() => groupSavedRecords(records.data ?? []), [records.data])

  return (
    <div>
      <PageHeader
        title="Class Financial Report"
        description="Saved payment statuses for students in the selected class and period."
      />

      <Card className="mb-4">
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Select
            label="Select Class"
            placeholder="Select class..."
            options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
          <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        </div>
      </Card>

      {!classId ? (
        <EmptyState title="Select a class" description="Choose class, month, and year to view the report." />
      ) : records.isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-ink-500">Paid students</p>
              <p className="text-2xl font-bold">{grouped.paid.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-ink-500">Unpaid students</p>
              <p className="text-2xl font-bold text-red-600">{grouped.unpaid.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-ink-500">NB / Scholarship</p>
              <p className="text-2xl font-bold text-amber-700">{grouped.scholarshipNb.length}</p>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="mb-3 font-display font-semibold">1. Paid Students</h3>
                <SavedStudentsTable
                  records={grouped.paid}
                  columns="paid"
                  emptyTitle="No paid students"
                />
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <h3 className="mb-3 font-display font-semibold">2. Unpaid Students</h3>
                <SavedStudentsTable
                  records={grouped.unpaid}
                  columns="unpaid"
                  emptyTitle="No unpaid students"
                />
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <h3 className="mb-3 font-display font-semibold">3. NB / Scholarship Students</h3>
                <SavedStudentsTable
                  records={grouped.scholarshipNb}
                  columns="scholarship_nb"
                  emptyTitle="No NB / Scholarship students"
                />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

/** View-only student financial details for Finance Manager. */
export function FinanceManagerStudentPage() {
  const { studentId = '' } = useParams()

  const student = useQuery({
    queryKey: ['finance-manager-student', studentId],
    queryFn: () => getStudent(studentId),
    enabled: !!studentId,
  })

  const history = useQuery({
    queryKey: ['finance-manager-student-history', studentId],
    queryFn: () => listFinanceRecords({ studentId }),
    enabled: !!studentId,
  })

  const sortedHistory = useMemo(() => {
    const rows = [...(history.data ?? [])]
    rows.sort((a, b) => b.year - a.year || b.month - a.month)
    return rows
  }, [history.data])

  if (!studentId) {
    return <EmptyState title="Student not found" description="Missing student id." />
  }

  return (
    <div>
      <PageHeader
        title="Student Financial Details"
        description="View-only. No edits or status changes are allowed."
        actions={
          <Link
            to="/finance-manager"
            className="inline-flex h-11 items-center rounded-xl border border-ink-200 bg-white px-4 text-sm font-medium text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
          >
            Back to Overview
          </Link>
        }
      />

      {student.isLoading ? (
        <TableSkeleton />
      ) : !student.data ? (
        <EmptyState title="Student not found" description="This student record could not be loaded." />
      ) : (
        <>
          <Card className="mb-4">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-ink-500">Student Name</p>
                <p className="font-semibold">{student.data.profile?.full_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Student ID</p>
                <p className="font-mono font-semibold">{student.data.student_id}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Class</p>
                <p className="font-semibold">{student.data.class?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">Latest saved status</p>
                {sortedHistory[0] ? (
                  <StatusBadge
                    status={sortedHistory[0].status}
                    label={statusLabel(sortedHistory[0].status)}
                  />
                ) : (
                  <p className="text-sm text-ink-500">No saved records</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h3 className="mb-3 font-display font-semibold">Payment history</h3>
              {history.isLoading ? (
                <TableSkeleton />
              ) : !sortedHistory.length ? (
                <EmptyState
                  title="No payment history"
                  description="Administration has not saved any finance records for this student."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-left">
                        <th className="p-2">Month</th>
                        <th className="p-2">Year</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Recorded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedHistory.map((r) => (
                        <tr key={r.id} className="border-b border-ink-100">
                          <td className="p-2">{monthName(r.month)}</td>
                          <td className="p-2">{r.year}</td>
                          <td className="p-2">
                            <StatusBadge status={r.status} label={statusLabel(r.status)} />
                          </td>
                          <td className="p-2">{formatMoney(r.amount)}</td>
                          <td className="p-2">{formatDate(r.updated_at ?? r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

/** @deprecated Prefer FinanceManagerClassReportPage */
export function FinanceManagerReportsPage() {
  return <FinanceManagerClassReportPage />
}

export { PAYMENT_METHODS }