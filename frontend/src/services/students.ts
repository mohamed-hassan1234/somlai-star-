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
    avatarUrl?: string | null
  }
}

const AVATAR_BUCKET = 'avatars'
const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
export const STUDENT_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp'
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** Uploads a student photo through the existing storage service and returns its public URL. */
export async function uploadStudentImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are supported')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('Student images must be 5MB or smaller')
  const extension = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : 'jpg'
  const path = `pending/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension}`
  const { error } = await api.storage.from(AVATAR_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw serviceError(error, 'Failed to upload student image')
  return api.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
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

  // Student Management lists active enrolment only: archived profiles belong to
  // deleted students, and "left" is no longer part of the student lifecycle.
  let rows = (data ?? []).filter((s) => s.profile?.status !== 'left').filter(
    (s) => (s.profile as { deleted_at?: string | null } | undefined)?.deleted_at == null,
  ) as Student[]

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
    avatar_url?: string | null
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

  if (updates.fullName !== undefined || updates.status !== undefined || updates.phone !== undefined || updates.avatar_url !== undefined) {
    const { data: student } = await api.from('students').select('profile_id').eq('id', id).single()
    if (student?.profile_id) {
      const profilePatch: Record<string, unknown> = {}
      if (updates.fullName !== undefined) profilePatch.full_name = updates.fullName
      if (updates.status !== undefined) profilePatch.status = updates.status
      if (updates.phone !== undefined) profilePatch.phone = updates.phone
      if (updates.avatar_url !== undefined) profilePatch.avatar_url = updates.avatar_url
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

export interface DeleteStudentResult {
  success: boolean
  studentId: string
  releasedStudentId: string
  profileArchived: boolean
  historicalRecordsPreserved: boolean
  message: string
}

/**
 * Deletes a student from Student Management. The SOMSTAR ID is released for reuse
 * and the student is created from scratch next time, while attendance, finance,
 * exam and practice records stay attached to the deleted record only.
 */
export async function deleteStudent(id: string): Promise<DeleteStudentResult> {
  const { data, error } = await api.functions.invoke('delete-student', { body: { id } })
  if (error) throw serviceError(error, 'Failed to delete student')
  if (!data?.success) throw new Error('Failed to delete student')
  return data as DeleteStudentResult
}

export interface PasswordRecoveryResult {
  success: boolean
  loginId: string
  temporaryPassword: string
  generated: boolean
  mustChangePassword: boolean
  message: string
}

/**
 * Passwords are stored as one-way hashes and are never readable, so recovery
 * returns a freshly generated temporary password that the student must change.
 */
export async function recoverStudentPassword(loginId: string): Promise<PasswordRecoveryResult> {
  const { data, error } = await api.functions.invoke('student-password-recovery', { body: { loginId } })
  if (error) throw serviceError(error, 'Failed to recover password')
  if (!data?.success || !data?.temporaryPassword) throw new Error('Failed to recover password')
  return data as PasswordRecoveryResult
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
