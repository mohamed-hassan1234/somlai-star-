import { api } from '@/services/api'
import type { AccountStatus, Student } from '@/types'
import { assertData, serviceError } from './errors'

export interface CreateStudentPayload {
  loginId: string
  password: string
  fullName: string
  phone?: string
  student: {
    parentName: string
    parentPhone: string
    classId: string
    academicYearId: string
    status: AccountStatus
  }
}

export async function listStudents(filters?: {
  classId?: string
  status?: AccountStatus
  search?: string
}): Promise<Student[]> {
  let query = api
    .from('students')
    .select('*, profile:profiles!students_profile_id_fkey(*), class:classes(*)')
    .order('student_id', { ascending: true })

  if (filters?.classId) query = query.eq('class_id', filters.classId)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load students')

  let rows = (data ?? []) as Student[]

  if (filters?.status) {
    rows = rows.filter((s) => s.profile?.status === filters.status)
  }
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (s) =>
        s.student_id.toLowerCase().includes(q) ||
        s.profile?.full_name?.toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q),
    )
  }

  return rows
}

export async function getStudent(id: string): Promise<Student> {
  const { data, error } = await api
    .from('students')
    .select('*, profile:profiles!students_profile_id_fkey(*), class:classes(*), academic_year:academic_years(*)')
    .eq('id', id)
    .single()

  return assertData(data as Student, error, 'Student not found')
}

export async function getStudentByProfileId(profileId: string): Promise<Student | null> {
  const { data, error } = await api
    .from('students')
    .select('*, profile:profiles!students_profile_id_fkey(*), class:classes(*)')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) throw serviceError(error, 'Failed to load student')
  return data as Student | null
}

export async function nextStudentId(): Promise<string> {
  const { data, error } = await api.rpc('next_student_id')
  if (error) throw serviceError(error, 'Failed to generate next student ID')
  return data as string
}

export async function createStudent(payload: CreateStudentPayload) {
  const { data, error } = await api.functions.invoke('create-user', {
    body: {
      loginId: payload.loginId,
      password: payload.password,
      fullName: payload.fullName,
      role: 'student',
      phone: payload.phone,
      student: payload.student,
    },
  })

  if (error) throw serviceError(error, 'Failed to create student')
  if (data?.error) throw new Error(String(data.error))
  return data
}

export async function updateStudent(
  id: string,
  updates: {
    parentName?: string
    parentPhone?: string
    phone?: string | null
    classId?: string | null
    academicYearId?: string | null
    notes?: string | null
    fullName?: string
    status?: AccountStatus
  },
): Promise<Student> {
  const studentPatch: Record<string, unknown> = {}
  if (updates.parentName !== undefined) studentPatch.parent_name = updates.parentName
  if (updates.parentPhone !== undefined) studentPatch.parent_phone = updates.parentPhone
  if (updates.phone !== undefined) studentPatch.phone = updates.phone
  if (updates.classId !== undefined) studentPatch.class_id = updates.classId
  if (updates.academicYearId !== undefined) studentPatch.academic_year_id = updates.academicYearId
  if (updates.notes !== undefined) studentPatch.notes = updates.notes

  if (Object.keys(studentPatch).length > 0) {
    const { error } = await api.from('students').update(studentPatch).eq('id', id)
    if (error) throw serviceError(error, 'Failed to update student')
  }

  if (updates.fullName !== undefined || updates.status !== undefined || updates.phone !== undefined) {
    const { data: student } = await api.from('students').select('profile_id').eq('id', id).single()
    if (student?.profile_id) {
      const profilePatch: Record<string, unknown> = {}
      if (updates.fullName !== undefined) profilePatch.full_name = updates.fullName
      if (updates.status !== undefined) profilePatch.status = updates.status
      if (updates.phone !== undefined) profilePatch.phone = updates.phone
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await api.from('profiles').update(profilePatch).eq('id', student.profile_id)
        if (error) throw serviceError(error, 'Failed to update student profile')
      }
    }
  }

  await api.rpc('write_audit', {
    p_action: 'update_student',
    p_entity: 'students',
    p_entity_id: id,
    p_metadata: updates,
  })

  return getStudent(id)
}

export async function disableStudent(id: string): Promise<Student> {
  return updateStudent(id, { status: 'disabled' })
}

export async function resetStudentPassword(loginId: string, newPassword: string) {
  const { data, error } = await api.functions.invoke('reset-password', {
    body: { loginId, newPassword },
  })
  if (error) {
    const ctx = (error as { context?: unknown }).context
    if (ctx && typeof ctx === 'object' && ctx !== null && 'json' in ctx) {
      try {
        const body = await (ctx as Response).clone().json()
        if (body?.error) throw new Error(String(body.error))
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError)) throw e
      }
    }
    throw serviceError(error, 'Failed to reset password')
  }
  if (data?.error) throw new Error(String(data.error))
  return data
}

export async function listStudentsByClass(classId: string) {
  return listStudents({ classId })
}

export async function setStudentStatus(profileId: string, status: AccountStatus) {
  const { error } = await api.from('profiles').update({ status }).eq('id', profileId)
  if (error) throw serviceError(error, 'Failed to update student status')
  await api.rpc('write_audit', {
    p_action: status === 'disabled' ? 'user_disabled' : 'user_status_changed',
    p_entity: 'profiles',
    p_entity_id: profileId,
    p_metadata: { status },
  })
}
