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
    p_limit: 2000,
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

/** Finance officer (or manager) summary for a specific month/year.
 *  Provides full dashboard data including income, expenses, salaries, and student stats. */
export async function financeSummary(year?: number, month?: number) {
  const y = year ?? new Date().getFullYear()
  const m = month ?? null

  // Active academic year: scopes the student denominator so a month is never compared
  // against students from a different cohort.
  const { data: years, error: yearError } = await api
    .from('academic_years')
    .select('id')
    .eq('is_active', true)
  if (yearError) throw serviceError(yearError, 'Failed to load academic year')
  const academicYearId = (years ?? [])[0]?.id ?? null

  // Finance records for the selected month/year
  let finQuery = api.from('finance_records').select('status, amount')
  finQuery = finQuery.eq('year', y)
  if (m) finQuery = finQuery.eq('month', m)
  const { data: finData, error: finError } = await finQuery
  if (finError) throw serviceError(finError, 'Failed to load finance summary')

  // Expenses for the selected month/year
  let expQuery = api.from('expenses').select('category, amount')
  expQuery = expQuery.eq('year', y)
  if (m) expQuery = expQuery.eq('month', m)
  const { data: expData, error: expError } = await expQuery
  if (expError) throw serviceError(expError, 'Failed to load expenses summary')

  // Salaries for the selected month/year
  let salQuery = api.from('salaries').select('salary_amount, payment_status')
  salQuery = salQuery.eq('year', y)
  if (m) salQuery = salQuery.eq('month', m)
  const { data: salData, error: salError } = await salQuery
  if (salError) throw serviceError(salError, 'Failed to load salaries summary')

  // Other income for the selected month/year
  let oiQuery = api.from('other_income').select('amount')
  oiQuery = oiQuery.eq('year', y)
  if (m) oiQuery = oiQuery.eq('month', m)
  const { data: oiData, error: oiError } = await oiQuery
  if (oiError) throw serviceError(oiError, 'Failed to load other income summary')

  // Compute finance record stats
  const byStatus = { paid: 0, unpaid: 0, scholarship_nb: 0 }
  let totalAmount = 0
  let collectedAmount = 0
  let studentFeeIncome = 0
  let outstandingFees = 0

  for (const r of finData ?? []) {
    const status = r.status as PaymentStatus
    byStatus[status] = (byStatus[status] ?? 0) + 1
    const amt = Number(r.amount ?? 0)
    totalAmount += amt
    if (status === 'paid') {
      collectedAmount += amt
    } else if (status === 'unpaid') {
      outstandingFees += amt
    }
  }

  studentFeeIncome = collectedAmount

  // Compute expense stats
  let totalExpenses = 0
  const expenseByCategory: Record<string, number> = {}
  for (const e of expData ?? []) {
    const cat = e.category ?? 'other'
    const amt = Number(e.amount ?? 0)
    totalExpenses += amt
    expenseByCategory[cat] = (expenseByCategory[cat] ?? 0) + amt
  }

  // Compute salary stats
  let totalSalaries = 0
  let totalStaffSalaries = 0
  const salaryByStatus: Record<string, number> = { paid: 0, unpaid: 0 }
  for (const s of salData ?? []) {
    const amt = Number(s.salary_amount ?? 0)
    totalSalaries += amt
    const ps = s.payment_status ?? 'paid'
    salaryByStatus[ps] = (salaryByStatus[ps] ?? 0) + 1
    if (ps === 'unpaid') {
      totalStaffSalaries += amt
    }
  }

  // Compute other income stats
  let otherIncome = 0
  for (const o of oiData ?? []) {
    otherIncome += Number(o.amount ?? 0)
  }

  const totalIncome = studentFeeIncome + otherIncome
  const netBalance = totalIncome - totalExpenses

  // Total enrolled students: this is the denominator for "paid X of Y", and it must be
  // scoped to the same year so a month is never compared against a different cohort.
  const { data: studentData, error: studentError } = await api
    .from('students')
    .select('id')
    .eq('academic_year_id', academicYearId)
  if (studentError) throw serviceError(studentError, 'Failed to load student count')
  const totalStudents = academicYearId ? (studentData ?? []).length : 0

  return {
    year: y,
    month: m ?? null,
    paid: byStatus.paid,
    unpaid: byStatus.unpaid,
    scholarship_nb: byStatus.scholarship_nb,
    totalStudents,
    totalAmount,
    collectedAmount,
    studentFeeIncome,
    otherIncome,
    totalIncome,
    totalExpenses,
    expenseByCategory,
    totalSalaries,
    totalStaffSalaries,
    salaryByStatus,
    netBalance,
    outstandingFees,
  }
}

export interface Expense {
  id: string
  expense_title: string
  category: string
  amount: number
  date: string
  month: number
  year: number
  paid_to: string | null
  payment_method: string | null
  reference: string | null
  description: string | null
  recorded_by: string | null
}

export interface Salary {
  id: string
  employee_name: string
  employee_id: string | null
  position: string
  salary_amount: number
  month: number
  year: number
  payment_date: string
  payment_status: 'paid' | 'unpaid'
  payment_method: string | null
  notes: string | null
  recorded_by: string | null
}

export interface OtherIncome {
  id: string
  income_title: string
  category: string
  amount: number
  date: string
  month: number
  year: number
  payment_method: string | null
  reference: string | null
  description: string | null
  recorded_by: string | null
}

async function listByMonth<T>(table: string, year: number, month: number): Promise<T[]> {
  const { data, error } = await api
    .from(table)
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .order('id', { ascending: true })
  if (error) throw serviceError(error, `Failed to load ${table}`)
  return (data ?? []) as T[]
}

export async function listExpenses(filters: { year: number; month: number }): Promise<Expense[]> {
  return listByMonth<Expense>('expenses', filters.year, filters.month)
}

export async function listSalaries(filters: { year: number; month: number }): Promise<Salary[]> {
  return listByMonth<Salary>('salaries', filters.year, filters.month)
}

export async function listOtherIncome(filters: { year: number; month: number }): Promise<OtherIncome[]> {
  return listByMonth<OtherIncome>('other_income', filters.year, filters.month)
}

/** Each entry is its own transaction row, so these insert rather than upsert:
 *  expenses/salaries/other_income intentionally allow many rows per month+year. */
async function insertRow<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await api.from(table).insert(row)
  if (error) throw serviceError(error, `Failed to save ${table}`)
  return data as T
}

export async function upsertExpense(input: {
  expense_title: string
  category: string
  amount: number
  month: number
  year: number
  date?: string | null
  paid_to?: string | null
  payment_method?: string | null
  reference?: string | null
  description?: string | null
  recorded_by?: string | null
}): Promise<Expense> {
  return insertRow<Expense>('expenses', {
    ...input,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    paid_to: input.paid_to ?? null,
    payment_method: input.payment_method ?? null,
    reference: input.reference ?? null,
    description: input.description ?? null,
    recorded_by: input.recorded_by ?? null,
  })
}

export async function upsertSalary(input: {
  employee_name: string
  position: string
  salary_amount: number
  month: number
  year: number
  payment_date: string
  payment_status: 'paid' | 'unpaid'
  employee_id?: string | null
  payment_method?: string | null
  notes?: string | null
  recorded_by?: string | null
}): Promise<Salary> {
  return insertRow<Salary>('salaries', {
    ...input,
    employee_id: input.employee_id ?? null,
    payment_method: input.payment_method ?? null,
    notes: input.notes ?? null,
    recorded_by: input.recorded_by ?? null,
  })
}

export async function upsertOtherIncome(input: {
  income_title: string
  category: string
  amount: number
  month: number
  year: number
  date?: string | null
  payment_method?: string | null
  reference?: string | null
  description?: string | null
  recorded_by?: string | null
}): Promise<OtherIncome> {
  return insertRow<OtherIncome>('other_income', {
    ...input,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    payment_method: input.payment_method ?? null,
    reference: input.reference ?? null,
    description: input.description ?? null,
    recorded_by: input.recorded_by ?? null,
  })
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