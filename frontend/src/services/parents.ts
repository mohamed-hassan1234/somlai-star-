import { api } from '@/services/api'
import type { AccountStatus, FinanceRecord, ParentChild, Profile, Student } from '@/types'
import { assertData, serviceError } from './errors'

export interface ParentWithChildren extends Profile {
  children?: ParentChild[]
}

export interface ParentRecord extends ParentChild {
  student?: Student
}

// -----------------------------------------------------------------------------
// Manager-side
// -----------------------------------------------------------------------------

export async function listParents(): Promise<ParentWithChildren[]> {
  const { data, error } = await api
    .from('profiles')
    .select('*, children:student_parents!student_parents_parent_id_fkey(*, student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*)))')
    .eq('role', 'parent')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw serviceError(error, 'Failed to load parents')
  return (data ?? []) as ParentWithChildren[]
}

export async function createParent(input: {
  loginId: string
  password: string
  fullName: string
  phone?: string
  childIds: string[]
}) {
  const { data, error } = await api.rpc('create_parent', {
    p_login_id: input.loginId,
    p_password: input.password,
    p_full_name: input.fullName,
    p_phone: input.phone || null,
    p_child_ids: input.childIds.length ? input.childIds : null,
  })

  if (error) throw serviceError(error, 'Failed to create parent account')
  return data as { success: boolean; userId?: string; loginId?: string }
}

export async function setParentChildren(parentId: string, childIds: string[]) {
  const { data, error } = await api.rpc('set_parent_children', {
    p_parent_id: parentId,
    p_child_ids: childIds,
  })

  if (error) throw serviceError(error, 'Failed to update parent links')
  return data as { success: boolean }
}

export async function nextParentId(): Promise<string> {
  const { data, error } = await api.rpc('next_parent_id')
  if (error) throw serviceError(error, 'Failed to generate next parent ID')
  return data as string
}

export async function setParentStatus(profileId: string, status: AccountStatus) {
  const { error } = await api.from('profiles').update({ status }).eq('id', profileId)
  if (error) throw serviceError(error, 'Failed to update parent status')
  await api.rpc('write_audit', {
    p_action: status === 'disabled' ? 'user_disabled' : 'user_status_changed',
    p_entity: 'profiles',
    p_entity_id: profileId,
    p_metadata: { role: 'parent', status },
  })
}

// -----------------------------------------------------------------------------
// Parent-side
// -----------------------------------------------------------------------------

export async function listMyChildren(parentProfileId: string): Promise<ParentRecord[]> {
  const { data, error } = await api
    .from('student_parents')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*))')
    .eq('parent_id', parentProfileId)
    .order('created_at', { ascending: true })

  if (error) throw serviceError(error, 'Failed to load your children')
  return (data ?? []) as ParentRecord[]
}

export async function listChildAttendance(studentIds: string[]) {
  if (!studentIds.length) return []
  const { data, error } = await api
    .from('attendance')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*)), class:classes(*), teacher:teachers(*, profile:profiles(*))')
    .in('student_id', studentIds)
    .order('attendance_date', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load attendance')
  return data ?? []
}

export async function listChildResults(studentIds: string[]) {
  if (!studentIds.length) return []
  const { data, error } = await api
    .from('results')
    .select('*, submission:result_submissions(*, subject:subjects(*), class:classes(*)), student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*))')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load results')
  return data ?? []
}

export async function listChildLessons(classIds: string[]) {
  if (!classIds.length) return []
  const { data, error } = await api
    .from('lessons')
    .select('*, class:classes(*), subject:subjects(*), teacher:teachers(*, profile:profiles(*))')
    .in('class_id', classIds)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('lesson_date', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load lessons')
  return data ?? []
}

export async function listChildBehavior(studentIds: string[]) {
  if (!studentIds.length) return []
  const { data, error } = await api
    .from('student_behavior')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*))')
    .in('student_id', studentIds)
    .order('behavior_date', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load behavior records')
  return data ?? []
}

export async function listChildFinance(studentIds: string[]): Promise<FinanceRecord[]> {
  if (!studentIds.length) return []
  const { data, error } = await api
    .from('finance_records')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*))')
    .in('student_id', studentIds)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load fee records')
  return (data ?? []) as FinanceRecord[]
}

export async function listPublishedNotices() {
  const { data, error } = await api
    .from('notices')
    .select('*, publisher:profiles!published_by(*)')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(50)

  if (error) throw serviceError(error, 'Failed to load notices')
  return data ?? []
}

export function assertParent(data: ParentRecord[], fallback: string) {
  return assertData(data, null, fallback)
}
