import { api } from '@/services/api'
import type { FinanceRecord, PaymentStatus } from '@/types'
import { assertData, serviceError } from './errors'

export async function listFinanceRecords(filters?: {
  studentId?: string
  classId?: string
  month?: number
  year?: number
  status?: PaymentStatus
}): Promise<FinanceRecord[]> {
  const { data, error } = await api.rpc('list_finance_records', {
    p_class_id: filters?.classId ?? null,
    p_month: filters?.month ?? null,
    p_year: filters?.year ?? null,
    p_student_id: filters?.studentId ?? null,
    p_limit: 200,
    p_offset: 0,
  })
  if (error) throw serviceError(error, 'Failed to load finance records')
  let records = (data ?? []) as FinanceRecord[]
  if (filters?.status) records = records.filter((r) => r.status === filters.status)
  return records
}

export async function getFinanceRecord(id: string): Promise<FinanceRecord> {
  const { data, error } = await api.rpc('list_finance_records', {
    p_class_id: null,
    p_month: null,
    p_year: null,
    p_student_id: null,
    p_limit: 1,
    p_offset: 0,
  })
  if (error) throw serviceError(error, 'Failed to load finance record')
  const records = (data ?? []) as FinanceRecord[]
  const record = records.find((r) => r.id === id)
  if (!record) throw new Error('Finance record not found')
  return record
}

/** Finance officer (or manager) create. */
export async function createFinanceRecord(input: {
  studentId: string
  classId?: string | null
  month: number
  year: number
  status: PaymentStatus
  amount?: number | null
  notes?: string
  recordedBy?: string
}): Promise<FinanceRecord> {
  const { data, error } = await api
    .from('finance_records')
    .insert({
      student_id: input.studentId,
      class_id: input.classId ?? null,
      month: input.month,
      year: input.year,
      status: input.status,
      amount: input.amount ?? null,
      notes: input.notes ?? null,
      recorded_by: input.recordedBy ?? null,
    })
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*))')
    .single()

  return assertData(data as FinanceRecord, error, 'Failed to create finance record')
}

export async function updateFinanceRecord(
  id: string,
  updates: {
    status?: PaymentStatus
    amount?: number | null
    notes?: string | null
    classId?: string | null
    month?: number
    year?: number
  },
): Promise<FinanceRecord> {
  const patch: Record<string, unknown> = {}
  if (updates.status !== undefined) patch.status = updates.status
  if (updates.amount !== undefined) patch.amount = updates.amount
  if (updates.notes !== undefined) patch.notes = updates.notes
  if (updates.classId !== undefined) patch.class_id = updates.classId
  if (updates.month !== undefined) patch.month = updates.month
  if (updates.year !== undefined) patch.year = updates.year

  const { data, error } = await api
    .from('finance_records')
    .update(patch)
    .eq('id', id)
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*))')
    .single()

  return assertData(data as FinanceRecord, error, 'Failed to update finance record')
}

export async function deleteFinanceRecord(id: string): Promise<void> {
  const { error } = await api.from('finance_records').delete().eq('id', id)
  if (error) throw serviceError(error, 'Failed to delete finance record')
}

/** Finance manager read-focused summary. */
export async function getFinanceSummary(year: number, month?: number) {
  let query = api.from('finance_records').select('status, amount, month, year')
  query = query.eq('year', year)
  if (month) query = query.eq('month', month)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load finance summary')

  const summary = {
    year,
    month: month ?? null,
    paid: 0,
    unpaid: 0,
    scholarship_nb: 0,
    totalAmount: 0,
    collectedAmount: 0,
  }

  for (const row of data ?? []) {
    if (row.status === 'paid') summary.paid++
    else if (row.status === 'unpaid') summary.unpaid++
    else if (row.status === 'scholarship_nb') summary.scholarship_nb++

    const amt = Number(row.amount ?? 0)
    summary.totalAmount += amt
    if (row.status === 'paid') summary.collectedAmount += amt
  }

  return summary
}

export async function financeSummary(year?: number) {
  const y = year ?? new Date().getFullYear()
  const { data, error } = await api.from('finance_records').select('status, amount, month').eq('year', y)
  if (error) throw serviceError(error, 'Failed to load finance summary')
  const rows = data ?? []
  const byStatus = { paid: 0, unpaid: 0, scholarship_nb: 0 }
  const byMonth: Record<number, { paid: number; unpaid: number; scholarship_nb: number }> = {}
  let revenue = 0
  for (const r of rows) {
    byStatus[r.status as PaymentStatus] += 1
    if (!byMonth[r.month]) byMonth[r.month] = { paid: 0, unpaid: 0, scholarship_nb: 0 }
    byMonth[r.month][r.status as PaymentStatus] += 1
    if (r.status === 'paid' && r.amount) revenue += Number(r.amount)
  }
  return { byStatus, byMonth, revenue, total: rows.length }
}

export async function upsertFinanceRecord(input: {
  student_id: string
  class_id?: string | null
  month: number
  year: number
  status: PaymentStatus
  amount?: number | null
  notes?: string | null
  recorded_by?: string
}) {
  const { data, error } = await api.rpc('upsert_finance_record', {
    p_student_id: input.student_id,
    p_class_id: input.class_id ?? null,
    p_month: input.month,
    p_year: input.year,
    p_status: input.status,
    p_amount: input.amount ?? null,
    p_notes: input.notes ?? null,
    p_recorded_by: input.recorded_by ?? null,
  })
  if (error) throw serviceError(error, 'Failed to upsert finance record')
  return data as FinanceRecord
}
