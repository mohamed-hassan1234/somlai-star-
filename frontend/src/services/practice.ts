import { api } from '@/services/api'
import type { PracticeStudent } from '@/types'
import { serviceError } from './errors'

export async function listPracticeStudents(filters?: {
  createdBy?: string
  status?: string
  practiceType?: string
  language?: string
}): Promise<PracticeStudent[]> {
  let query = api
    .from('practice_students')
    .select('*, class:classes(*), creator:created_by(id, full_name, login_id)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters?.createdBy) query = query.eq('created_by', filters.createdBy)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.practiceType) query = query.eq('practice_type', filters.practiceType)
  if (filters?.language) query = query.eq('language', filters.language)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load practice students')
  return (data ?? []) as PracticeStudent[]
}

export async function getPracticeStudent(id: string): Promise<PracticeStudent> {
  const { data, error } = await api
    .from('practice_students')
    .select('*, class:classes(*), creator:created_by(id, full_name, login_id)')
    .eq('id', id)
    .single()

  if (error) throw serviceError(error, 'Practice student not found')
  return data as PracticeStudent
}

export async function createPracticeStudent(input: {
  student_name: string
  student_id?: string | null
  class_id?: string | null
  practice_type: string
  language: string
  notes?: string | null
  status?: string
  created_by: string
}): Promise<PracticeStudent> {
  const submitted = input.status === 'submitted'
  const { data, error } = await api
    .from('practice_students')
    .insert({
      student_name: input.student_name,
      student_id: input.student_id ?? null,
      class_id: input.class_id ?? null,
      practice_type: input.practice_type,
      language: input.language,
      notes: input.notes ?? null,
      status: input.status ?? 'draft',
      created_by: input.created_by,
      submitted_by: submitted ? input.created_by : null,
      submitted_at: submitted ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) throw serviceError(error, 'Failed to create practice student')
  return data as PracticeStudent
}

export async function updatePracticeStudent(
  id: string,
  input: {
    student_name?: string
    student_id?: string | null
    class_id?: string | null
    notes?: string | null
    status?: string
    updated_by: string
  },
): Promise<PracticeStudent> {
  const patch: Record<string, unknown> = {
    updated_by: input.updated_by,
    updated_at: new Date().toISOString(),
  }
  if (input.student_name !== undefined) patch.student_name = input.student_name
  if (input.student_id !== undefined) patch.student_id = input.student_id
  if (input.class_id !== undefined) patch.class_id = input.class_id
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.status !== undefined) {
    patch.status = input.status
    if (input.status === 'submitted') {
      patch.submitted_at = new Date().toISOString()
      patch.submitted_by = input.updated_by
    }
  }

  const { data, error } = await api
    .from('practice_students')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw serviceError(error, 'Failed to update practice student')
  return data as PracticeStudent
}

export async function deletePracticeStudent(id: string): Promise<void> {
  const { error } = await api.from('practice_students').delete().eq('id', id)
  if (error) throw serviceError(error, 'Failed to delete practice student')
}

export async function listActivityLogs(filters?: {
  userId?: string
  entityType?: string
  limit?: number
}): Promise<import('@/types').ActivityLog[]> {
  let query = api
    .from('activity_logs')
    .select('*, user:user_id(id, full_name, login_id)')
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 100)

  if (filters?.userId) query = query.eq('user_id', filters.userId)
  if (filters?.entityType) query = query.eq('entity_type', filters.entityType)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load activity logs')
  return data ?? []
}
