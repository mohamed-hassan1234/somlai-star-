import { api } from '@/services/api'
import type { AccountStatus, AppRole, ClassRecord, Teacher } from '@/types'
import { assertData, serviceError } from './errors'

export interface CreateTeacherPayload {
  loginId: string
  password: string
  fullName: string
  phone?: string
  role: Extract<AppRole, 'teacher' | 'teacher_cabaas' | 'practice_teacher' | 'supervisor'>
  teacher: {
    specialization?: string
    classIds: string[]
    isPractice?: boolean
  }
}

export async function listTeachers(filters?: {
  search?: string
  status?: AccountStatus
}): Promise<Teacher[]> {
  const { data, error } = await api
    .from('teachers')
    .select('*, profile:profiles(*)')
    .order('teacher_id', { ascending: true })

  if (error) throw serviceError(error, 'Failed to load teachers')

  let rows = (data ?? []) as Teacher[]

  // Attach classes
  const teacherIds = rows.map((t) => t.id)
  if (teacherIds.length > 0) {
    const { data: assignments } = await api
      .from('teacher_classes')
      .select('teacher_id, class:classes(*)')
      .in('teacher_id', teacherIds)

    const byTeacher = new Map<string, ClassRecord[]>()
    for (const row of assignments ?? []) {
      const list = byTeacher.get(row.teacher_id) ?? []
      if (row.class) list.push(row.class as unknown as ClassRecord)
      byTeacher.set(row.teacher_id, list)
    }
    rows = rows.map((t) => ({ ...t, classes: byTeacher.get(t.id) ?? [] }))
  }

  if (filters?.status) {
    rows = rows.filter((t) => t.profile?.status === filters.status)
  }
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (t) =>
        t.teacher_id.toLowerCase().includes(q) ||
        t.profile?.full_name?.toLowerCase().includes(q) ||
        t.specialization?.toLowerCase().includes(q),
    )
  }

  return rows
}

export async function getTeacher(id: string): Promise<Teacher> {
  const { data, error } = await api
    .from('teachers')
    .select('*, profile:profiles(*)')
    .eq('id', id)
    .single()

  const teacher = assertData(data as Teacher, error, 'Teacher not found')

  const { data: assignments } = await api
    .from('teacher_classes')
    .select('class:classes(*)')
    .eq('teacher_id', id)

  return {
    ...teacher,
    classes: (assignments ?? []).map((a) => a.class as unknown as ClassRecord).filter(Boolean),
  }
}

export async function nextTeacherId(): Promise<string> {
  const { data, error } = await api.rpc('next_teacher_id')
  if (error) throw serviceError(error, 'Failed to generate next teacher ID')
  return data as string
}

export async function createTeacher(payload: CreateTeacherPayload) {
  const { data, error } = await api.functions.invoke('create-user', {
    body: {
      loginId: payload.loginId,
      password: payload.password,
      fullName: payload.fullName,
      role: payload.role,
      phone: payload.phone,
      teacher: payload.teacher,
    },
  })

  if (error) throw serviceError(error, 'Failed to create teacher')
  if (data?.error) throw new Error(String(data.error))
  return data
}

export async function updateTeacher(
  id: string,
  updates: {
    specialization?: string | null
    notes?: string | null
    isPractice?: boolean
    fullName?: string
    phone?: string | null
    status?: AccountStatus
    classIds?: string[]
  },
): Promise<Teacher> {
  const teacherPatch: Record<string, unknown> = {}
  if (updates.specialization !== undefined) teacherPatch.specialization = updates.specialization
  if (updates.notes !== undefined) teacherPatch.notes = updates.notes
  if (updates.isPractice !== undefined) teacherPatch.is_practice = updates.isPractice

  if (Object.keys(teacherPatch).length > 0) {
    const { error } = await api.from('teachers').update(teacherPatch).eq('id', id)
    if (error) throw serviceError(error, 'Failed to update teacher')
  }

  if (updates.fullName !== undefined || updates.status !== undefined || updates.phone !== undefined) {
    const { data: teacher } = await api.from('teachers').select('profile_id').eq('id', id).single()
    if (teacher?.profile_id) {
      const profilePatch: Record<string, unknown> = {}
      if (updates.fullName !== undefined) profilePatch.full_name = updates.fullName
      if (updates.status !== undefined) profilePatch.status = updates.status
      if (updates.phone !== undefined) profilePatch.phone = updates.phone
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await api.from('profiles').update(profilePatch).eq('id', teacher.profile_id)
        if (error) throw serviceError(error, 'Failed to update teacher profile')
      }
    }
  }

  if (updates.classIds) {
    const { error: delError } = await api.from('teacher_classes').delete().eq('teacher_id', id)
    if (delError) throw serviceError(delError, 'Failed to clear class assignments')

    if (updates.classIds.length > 0) {
      const rows = updates.classIds.map((classId) => ({ teacher_id: id, class_id: classId }))
      const { error: insError } = await api.from('teacher_classes').insert(rows)
      if (insError) throw serviceError(insError, 'Failed to assign classes')
    }
  }

  await api.rpc('write_audit', {
    p_action: 'update_teacher',
    p_entity: 'teachers',
    p_entity_id: id,
    p_metadata: updates,
  })

  return getTeacher(id)
}

export async function disableTeacher(id: string): Promise<Teacher> {
  return updateTeacher(id, { status: 'disabled' })
}

export async function resetTeacherPassword(loginId: string, newPassword: string) {
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

export async function getTeacherClasses(teacherId: string): Promise<ClassRecord[]> {
  const teacher = await getTeacher(teacherId)
  return teacher.classes ?? []
}

export async function setTeacherStatus(profileId: string, status: AccountStatus) {
  const { error } = await api.from('profiles').update({ status }).eq('id', profileId)
  if (error) throw serviceError(error, 'Failed to update teacher status')
}

export async function getMyTeacherClasses(profileId: string) {
  const { data: teacher } = await api.from('teachers').select('id').eq('profile_id', profileId).maybeSingle()
  if (!teacher) return []
  const { data, error } = await api
    .from('teacher_classes')
    .select('class:classes(*)')
    .eq('teacher_id', teacher.id)
  if (error) throw serviceError(error, 'Failed to load teacher classes')
  return (data ?? []).map((r: { class: unknown }) => r.class).filter(Boolean)
}
