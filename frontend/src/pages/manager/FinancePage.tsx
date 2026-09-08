import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listFinanceRecords, upsertFinanceRecord } from '@/services/finance'
import { listStudentsByClass } from '@/services/students'
import { listClasses } from '@/services/classes'
import { useAuth } from '@/providers/AuthProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { monthName } from '@/lib/utils'
import type { PaymentStatus } from '@/types'

const STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'scholarship_nb', label: 'Scholarship / NB' },
] as const

export function ManagerFinancePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const year = new Date().getFullYear()
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
    queryKey: ['finance', year, month, classId],
    queryFn: () => listFinanceRecords({ year, month, classId }),
    enabled: !!classId,
  })

  const merged = useMemo(() => {
    if (!students.data) return []
    const recordByStudentId: Record<string, { status: string; amount: number | null }> = {}
    for (const r of records.data ?? []) {
      if (r.student_id) recordByStudentId[r.student_id] = { status: r.status, amount: r.amount }
    }
    return students.data.map((s) => ({
      id: s.id,
      studentId: s.student_id,
      name: s.profile?.full_name ?? '—',
      existingStatus: (recordByStudentId[s.id]?.status ?? '') as '' | PaymentStatus,
      existingAmount: recordByStudentId[s.id]?.amount ?? null,
    }))
  }, [students.data, records.data])

  const handleStatusChange = useCallback((studentId: string, value: string) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: value as '' | PaymentStatus }))
  }, [])

  const hasChanges = useMemo(() => {
    for (const row of merged) {
      const current = statusMap[row.id] ?? row.existingStatus
      if (current !== row.existingStatus) return true
    }
    return false
  }, [merged, statusMap])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const recordedBy = user?.profile?.id
      const paidAmount = Number(amount) || null
      const ops = []
      for (const row of merged) {
        const status = statusMap[row.id] ?? row.existingStatus
        if (!status) continue
        ops.push(
          upsertFinanceRecord({
            student_id: row.id,
            class_id: classId,
            month,
            year,
            status: status as PaymentStatus,
            amount: paidAmount,
            recorded_by: recordedBy,
          }),
        )
      }
      if (!ops.length) return
      await Promise.all(ops)
    },
    onSuccess: () => {
      setStatusMap({})
      queryClient.invalidateQueries({ queryKey: ['finance'] })
      toast.success('Saved')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    },
  })

  return (
    <div>
      <PageHeader title="Finance" description="Record student fee status by class and month." />
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
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
        <Select
          label="Month"
          options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))}
          value={String(month)}
          onChange={(e) => {
            setMonth(Number(e.target.value))
            setStatusMap({})
          }}
        />
        <Input
          label="Monthly Fee ($)"
          type="number"
          placeholder="e.g. 5"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Card>

      {!classId ? (
        <EmptyState title="Select a class" description="Pick a class and month to record payments." />
      ) : students.isLoading || records.isLoading ? (
        <TableSkeleton />
      ) : !merged.length ? (
        <EmptyState title="No students" description="This class has no students." />
      ) : (
        <>
          <div className="space-y-2">
            {merged.map((row) => {
              const value = statusMap[row.id] ?? row.existingStatus
              return (
                <Card key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{row.name}</p>
                    <p className="text-xs text-ink-500">{row.studentId}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {row.existingAmount != null ? `$${row.existingAmount}` : amount ? `$${amount}` : '—'}
                    </span>
                    <select
                      value={value}
                      onChange={(e) => handleStatusChange(row.id, e.target.value)}
                      className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-sm dark:border-ink-600 dark:bg-ink-800"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </Card>
              )
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!hasChanges}>
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
