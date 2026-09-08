import { api } from '@/services/api'
import type { AcademicYear, Subject } from '@/types'
import { assertData, serviceError } from './errors'

export async function listSubjects(): Promise<Subject[]> {
  const { data, error } = await api.from('subjects').select('*').order('name')
  if (error) throw serviceError(error, 'Failed to load subjects')
  return (data ?? []) as Subject[]
}

export async function createSubject(input: {
  name: string
  code?: string
  description?: string
}): Promise<Subject> {
  const { data, error } = await api
    .from('subjects')
    .insert({
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
    })
    .select('*')
    .single()
  return assertData(data as Subject, error, 'Failed to create subject')
}

export async function updateSubject(
  id: string,
  updates: Partial<{ name: string; code: string | null; description: string | null; is_active: boolean }>,
): Promise<Subject> {
  const { data, error } = await api.from('subjects').update(updates).eq('id', id).select('*').single()
  return assertData(data as Subject, error, 'Failed to update subject')
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const { data, error } = await api
    .from('academic_years')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) throw serviceError(error, 'Failed to load academic years')
  return (data ?? []) as AcademicYear[]
}

export async function createAcademicYear(input: {
  name: string
  start_date: string
  end_date: string
  is_active?: boolean
}): Promise<AcademicYear> {
  if (input.is_active) {
    await api.from('academic_years').update({ is_active: false }).eq('is_active', true)
  }
  const { data, error } = await api.from('academic_years').insert(input).select('*').single()
  return assertData(data as AcademicYear, error, 'Failed to create academic year')
}

export async function updateAcademicYear(
  id: string,
  updates: Partial<AcademicYear>,
): Promise<AcademicYear> {
  if (updates.is_active) {
    await api.from('academic_years').update({ is_active: false }).neq('id', id)
  }
  const { data, error } = await api.from('academic_years').update(updates).eq('id', id).select('*').single()
  return assertData(data as AcademicYear, error, 'Failed to update academic year')
}
