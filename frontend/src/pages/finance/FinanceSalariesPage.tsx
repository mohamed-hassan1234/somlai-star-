import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { listSalaries, upsertSalary } from '@/services/finance'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage, monthName } from '@/lib/utils'
import type { PaymentStatus } from '@/types'

const PAYMENT_STATUSES = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
]

const PAYMENT_METHODS = [
  { value: '', label: 'Select method' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card' },
]

export function FinanceSalariesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [employeeName, setEmployeeName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [position, setPosition] = useState('')
  const [salaryAmount, setSalaryAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')

  const salaries = useQuery({
    queryKey: ['salaries', year, month],
    queryFn: () => listSalaries({ month, year }),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!employeeName || !position || !salaryAmount) throw new Error('All required fields are required')
      await upsertSalary({
        employee_name: employeeName,
        employee_id: employeeId || null,
        position,
        salary_amount: Number(salaryAmount),
        month,
        year,
        payment_date: paymentDate,
        payment_status: paymentStatus as 'paid' | 'unpaid',
        payment_method: paymentMethod || null,
        notes: notes || null,
        recorded_by: user!.profile.id,
      })
      toast.success('Salary record saved')
      qc.invalidateQueries({ queryKey: ['salaries', year, month] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Salary Management" description="Record teacher and staff salaries." />

      <Card className="mb-4">
        <div className="p-4 grid grid-cols-2 gap-2">
          <Input label="Employee Name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
          <Input label="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
          <Input label="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
          <Input label="Salary Amount" type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} />
          <Input label="Payment Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <Select
            label="Payment Status"
            options={PAYMENT_STATUSES}
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
          />
          <Select
            label="Payment Method"
            options={PAYMENT_METHODS}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-end">
            <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
              Save salary
            </Button>
          </div>
        </div>
      </Card>

      {/* Salaries Table */}
      <Card className="mt-4">
        <div className="p-4">
          {salaries.isLoading ? <TableSkeleton /> : !salaries.data?.length ? (
            <EmptyState title="No salary records" description="No salary records for this month." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-ink-200">
                    <th className="p-2">Employee Name</th>
                    <th className="p-2">Employee ID</th>
                    <th className="p-2">Position</th>
                    <th className="p-2">Salary Amount</th>
                    <th className="p-2">Month</th>
                    <th className="p-2">Year</th>
                    <th className="p-2">Payment Status</th>
                    <th className="p-2">Payment Method</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.data.map((s) => (
                    <tr key={s.id} className="border-b border-ink-100 hover:bg-ink-50">
                      <td className="p-2">{s.employee_name}</td>
                      <td className="p-2">{s.employee_id ?? '—'}</td>
                      <td className="p-2">{s.position}</td>
                      <td className="p-2">${s.salary_amount?.toFixed(2) ?? '—'}</td>
                      <td className="p-2">{monthName(s.month)}</td>
                      <td className="p-2">{s.year}</td>
<td className="p-2">
                          <StatusBadge status={s.payment_status} />
                        </td>
                        <td className="p-2">{s.payment_method ?? '—'}</td>
                        <td className="p-2">
                          <span className="text-xs text-ink-500">Managed by Admin</span>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}