import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { listExpenses, upsertExpense } from '@/services/finance'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage, monthName } from '@/lib/utils'

const PAYMENT_METHODS = [
  { value: '', label: 'Select method' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card' },
]

export function FinanceExpensesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [category, setCategory] = useState('')
  const [expenseTitle, setExpenseTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidTo, setPaidTo] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')

  const categories = [
    { value: 'teacher_salary', label: 'Teacher Salary' },
    { value: 'staff_salary', label: 'Staff Salary' },
    { value: 'rent', label: 'Rent' },
    { value: 'electricity', label: 'Electricity' },
    { value: 'water', label: 'Water' },
    { value: 'internet', label: 'Internet' },
    { value: 'transport', label: 'Transport' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'supplies', label: 'Supplies' },
    { value: 'other', label: 'Other' },
  ]

  const expenses = useQuery({
    queryKey: ['expenses', year, month],
    queryFn: () => listExpenses({ month, year }),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!expenseTitle || !category || !amount) throw new Error('All fields are required')
      await upsertExpense({
        expense_title: expenseTitle,
        category,
        amount: Number(amount),
        month,
        year,
        paid_to: paidTo || null,
        payment_method: paymentMethod || null,
        reference: reference || null,
        description: description || null,
        recorded_by: user!.profile.id,
      })
      toast.success('Expense recorded')
      qc.invalidateQueries({ queryKey: ['expenses', year, month] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Expenses" description="Record school expenses." />

      <Card className="mb-4">
        <div className="p-4 grid grid-cols-2 gap-2">
          <Select label="Category" options={categories} value={category} onChange={(e) => setCategory(e.target.value)} />
          <Input label="Expense Title" value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} />
          <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Paid To" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} />
          <Select
            label="Payment Method"
            options={PAYMENT_METHODS}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex items-end">
            <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>
              Save expense
            </Button>
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card className="mt-4">
        <div className="p-4">
          {expenses.isLoading ? <TableSkeleton /> : !expenses.data?.length ? (
            <EmptyState title="No expenses" description="No expenses recorded for this month." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-ink-200">
                    <th className="p-2">Title</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Month</th>
                    <th className="p-2">Year</th>
                    <th className="p-2">Paid To</th>
                    <th className="p-2">Payment Method</th>
                    <th className="p-2">Reference</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.data.map((e) => (
                    <tr key={e.id} className="border-b border-ink-100 hover:bg-ink-50">
                      <td className="p-2">{e.expense_title}</td>
                      <td className="p-2">{e.category}</td>
                      <td className="p-2">${e.amount?.toFixed(2) ?? '—'}</td>
                      <td className="p-2">{monthName(e.month)}</td>
                      <td className="p-2">{e.year}</td>
                      <td className="p-2">{e.paid_to ?? '—'}</td>
                      <td className="p-2">{e.payment_method ?? '—'}</td>
                      <td className="p-2">{e.reference ?? '—'}</td>
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