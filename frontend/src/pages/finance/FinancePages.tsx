import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import {
  financeSummary,
  listFinanceRecords,
  upsertFinanceRecord,
  listExpenses,
  listOtherIncome,
  listSalaries,
} from '@/services/finance'
import { listClasses } from '@/services/classes'
import { listStudentsByClass } from '@/services/students'
import { monthName } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatCard, Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import type { PaymentStatus } from '@/types'

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))

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
  return (
    <Select
      label="Month"
      options={MONTHS}
      value={String(month)}
      onChange={(e) => onMonth(Number(e.target.value))}
    />
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
          <Input
            label="Year"
            type="number"
            value={String(year)}
            onChange={(e) => onYear(Number(e.target.value))}
            min={2020}
            max={2100}
          />
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
      <Card className="mb-4 grid gap-3 sm:grid-cols-4">
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

/** Read-only supervisor view over the same monthly dashboard. */
export function FinanceManagerOverviewPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  return (
    <div>
      <PageHeader title="Finance Overview" description="Read-only monthly financial summary." />
      <FinanceDashboard month={month} year={year} onMonth={setMonth} onYear={setYear} />
    </div>
  )
}

/** Monthly report: per-source income/expense breakdown with outstanding fees. */
export function FinanceManagerReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const summary = useQuery({
    queryKey: ['finance-summary', year, month],
    queryFn: () => financeSummary(year, month),
  })
  const expenses = useQuery({
    queryKey: ['expenses', year, month],
    queryFn: () => listExpenses({ year, month }),
  })
  const salaries = useQuery({
    queryKey: ['salaries', year, month],
    queryFn: () => listSalaries({ year, month }),
  })
  const otherIncome = useQuery({
    queryKey: ['other_income', year, month],
    queryFn: () => listOtherIncome({ year, month }),
  })

  return (
    <div>
      <PageHeader
        title="Monthly Report"
        description={`Income and expenses for ${monthName(month)} ${year}.`}
      />

      <Card className="mb-4">
        <div className="p-4 grid grid-cols-2 gap-2">
          <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
          <Input
            label="Year"
            type="number"
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2020}
            max={2100}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatCard label="Student Fees Collected" value={summary.data?.studentFeeIncome ?? 0} />
        <StatCard label="Other Income" value={summary.data?.otherIncome ?? 0} />
        <StatCard label="Total Income" value={summary.data?.totalIncome ?? 0} />
        <StatCard label="Total Expenses" value={summary.data?.totalExpenses ?? 0} />
        <StatCard label="Total Salaries" value={summary.data?.totalSalaries ?? 0} />
        <StatCard label="Outstanding Fees" value={summary.data?.outstandingFees ?? 0} />
        <StatCard label="Net Balance" value={summary.data?.netBalance ?? 0} />
        <StatCard
          label="Paid / Unpaid / Scholarship"
          value={`${summary.data?.paid ?? 0} / ${summary.data?.unpaid ?? 0} / ${summary.data?.scholarship_nb ?? 0}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="p-4">
            <h3 className="font-display font-semibold mb-3">Expenses by category</h3>
            {expenses.isLoading ? (
              <TableSkeleton />
            ) : !expenses.data?.length ? (
              <EmptyState title="No expenses" description="Nothing recorded this month." />
            ) : (
              <ul className="space-y-1 text-sm">
                {Object.entries(summary.data?.expenseByCategory ?? {}).map(([cat, amt]) => (
                  <li key={cat} className="flex justify-between">
                    <span className="capitalize">{cat.replaceAll('_', ' ')}</span>
                    <span className="font-semibold">${amt.toFixed(2)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-ink-200 pt-1 font-bold">
                  <span>Total</span>
                  <span>${(summary.data?.totalExpenses ?? 0).toFixed(2)}</span>
                </li>
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="font-display font-semibold mb-3">Salaries</h3>
            {salaries.isLoading ? (
              <TableSkeleton />
            ) : !salaries.data?.length ? (
              <EmptyState title="No salaries" description="Nothing recorded this month." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {salaries.data.map((s) => (
                      <tr key={s.id} className="border-b border-ink-100">
                        <td className="p-1">{s.employee_name}</td>
                        <td className="p-1"><StatusBadge status={s.payment_status} /></td>
                        <td className="p-1 text-right font-semibold">${s.salary_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="font-display font-semibold mb-3">Other income</h3>
            {otherIncome.isLoading ? (
              <TableSkeleton />
            ) : !otherIncome.data?.length ? (
              <EmptyState title="No other income" description="Nothing recorded this month." />
            ) : (
              <ul className="space-y-1 text-sm">
                {otherIncome.data.map((o) => (
                  <li key={o.id} className="flex justify-between">
                    <span>{o.income_title}</span>
                    <span className="font-semibold">${o.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export { PAYMENT_METHODS }