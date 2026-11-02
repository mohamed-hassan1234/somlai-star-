import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { listOtherIncome, upsertOtherIncome } from '@/services/finance'
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

export function FinanceOtherIncomePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [incomeTitle, setIncomeTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [reference, setReference] = useState('')
  const [description, setDescription] = useState('')

  const categories = [
    { value: 'donation', label: 'Donation' },
    { value: 'registration_fee', label: 'Registration Fee' },
    { value: 'other_service', label: 'Other Service Income' },
    { value: 'other', label: 'Other' },
  ]

  const otherIncome = useQuery({
    queryKey: ['other_income', year, month],
    queryFn: () => listOtherIncome({ month, year }),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!incomeTitle || !category || !amount) throw new Error('All required fields are required')
      await upsertOtherIncome({
        income_title: incomeTitle,
        category,
        amount: Number(amount),
        month,
        year,
        payment_method: paymentMethod || null,
        reference: reference || null,
        description: description || null,
        recorded_by: user!.profile.id,
      })
      toast.success('Other income recorded')
      qc.invalidateQueries({ queryKey: ['other_income', year, month] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Other Income" description="Record non-fee income." />

      <Card className="mb-4">
        <div className="p-4 grid grid-cols-2 gap-2">
          <Select label="Category" options={categories} value={category} onChange={(e) => setCategory(e.target.value)} />
          <Input label="Income Title" value={incomeTitle} onChange={(e) => setIncomeTitle(e.target.value)} />
          <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
              Save income
            </Button>
          </div>
        </div>
      </Card>

      {/* Other Income Table */}
      <Card className="mt-4">
        <div className="p-4">
          {otherIncome.isLoading ? <TableSkeleton /> : !otherIncome.data?.length ? (
            <EmptyState title="No other income" description="No other income recorded for this month." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-ink-200">
                    <th className="p-2">Income Title</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Month</th>
                    <th className="p-2">Year</th>
                    <th className="p-2">Payment Method</th>
                    <th className="p-2">Reference</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {otherIncome.data.map((o) => (
                    <tr key={o.id} className="border-b border-ink-100 hover:bg-ink-50">
                      <td className="p-2">{o.income_title}</td>
                      <td className="p-2">{o.category}</td>
                      <td className="p-2">${o.amount?.toFixed(2) ?? '—'}</td>
                      <td className="p-2">{monthName(o.month)}</td>
                      <td className="p-2">{o.year}</td>
                      <td className="p-2">{o.payment_method ?? '—'}</td>
                      <td className="p-2">{o.reference ?? '—'}</td>
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