import { api } from '@/services/api'
import { serviceError } from './errors'

export async function listNotices(filters?: {
  isPractice?: boolean
  isLate?: boolean
  classId?: string | null
  publishedOnly?: boolean
}) {
  let q = api
    .from('notices')
    .select('*, publisher:profiles(full_name), class:classes(name)')
    .order('published_at', { ascending: false })
  if (filters?.isPractice !== undefined) q = q.eq('is_practice', filters.isPractice)
  if (filters?.isLate !== undefined) q = q.eq('is_late_notice', filters.isLate)
  if (filters?.publishedOnly) q = q.eq('is_published', true)
  if (filters?.classId) q = q.or(`target_class_id.is.null,target_class_id.eq.${filters.classId}`)
  const { data, error } = await q
  if (error) throw serviceError(error, 'Failed to load notices')
  return data ?? []
}

export async function createNotice(input: {
  title: string
  body: string
  notice_type?: string
  target_role?: string | null
  target_class_id?: string | null
  is_practice?: boolean
  is_late_notice?: boolean
  published_by: string
  is_published?: boolean
  expires_at?: string | null
}) {
  const { data, error } = await api.from('notices').insert(input).select().single()
  if (error) throw serviceError(error, 'Failed to create notice')
  return data
}

export async function updateNotice(id: string, input: Record<string, unknown>) {
  const { error } = await api.from('notices').update(input).eq('id', id)
  if (error) throw serviceError(error, 'Failed to update notice')
}

export async function deleteNotice(id: string) {
  const { error } = await api.from('notices').delete().eq('id', id)
  if (error) throw serviceError(error, 'Failed to delete notice')
}

export async function listExamSchedules(classId?: string | null) {
  let q = api
    .from('exam_schedules')
    .select('*, subject:subjects(*), class:classes(*)')
    .order('exam_date')
  if (classId) q = q.or(`class_id.is.null,class_id.eq.${classId}`)
  const { data, error } = await q
  if (error) throw serviceError(error, 'Failed to load exams')
  return data ?? []
}

export async function createExamSchedule(input: Record<string, unknown>) {
  const { data, error } = await api.from('exam_schedules').insert(input).select().single()
  if (error) throw serviceError(error, 'Failed to create exam')
  return data
}

export async function listCommittees() {
  const { data, error } = await api
    .from('outside_activity_committees')
    .select('*, members:committee_members(*), classes:committee_classes(class:classes(*))')
    .order('created_at', { ascending: false })
  if (error) throw serviceError(error, 'Failed to load committees')
  return data ?? []
}

export async function createCommittee(input: {
  name: string
  description?: string
  created_by: string
  classIds?: string[]
  memberIds?: string[]
}) {
  const { data, error } = await api
    .from('outside_activity_committees')
    .insert({ name: input.name, description: input.description, created_by: input.created_by })
    .select()
    .single()
  if (error) throw serviceError(error, 'Failed to create committee')
  if (input.classIds?.length) {
    await api.from('committee_classes').insert(
      input.classIds.map((class_id) => ({ committee_id: data.id, class_id })),
    )
  }
  if (input.memberIds?.length) {
    await api.from('committee_members').insert(
      input.memberIds.map((profile_id) => ({ committee_id: data.id, profile_id })),
    )
  }
  return data
}

export async function getMyCommitteeClasses(profileId: string) {
  const { data, error } = await api
    .from('committee_members')
    .select('*, committee:outside_activity_committees(*, classes:committee_classes(class:classes(*)))')
    .eq('profile_id', profileId)
  if (error) throw serviceError(error, 'Failed to load committee classes')
  return data ?? []
}

export async function listLeaveRequests(teacherId?: string) {
  let q = api
    .from('teacher_leave')
    .select('*, teacher:teachers(*, profile:profiles(*))')
    .order('created_at', { ascending: false })
  if (teacherId) q = q.eq('teacher_id', teacherId)
  const { data, error } = await q
  if (error) throw serviceError(error, 'Failed to load leave requests')
  return data ?? []
}

export async function createLeaveRequest(input: {
  teacher_id: string
  start_date: string
  end_date: string
  reason: string
}) {
  const { data, error } = await api.from('teacher_leave').insert(input).select().single()
  if (error) throw serviceError(error, 'Failed to create leave request')
  return data
}

export async function reviewLeave(
  id: string,
  status: 'approved' | 'rejected',
  _reviewedBy: string,
  reviewNotes?: string,
) {
  const { error } = await api.rpc('review_teacher_leave', {
    p_leave_id: id,
    p_status: status,
    p_notes: reviewNotes ?? null,
  })
  if (error) {
    // Fallback direct update if migration 004 not applied yet
    const { data: user } = await api.auth.getUser()
    const { error: e2 } = await api
      .from('teacher_leave')
      .update({
        status,
        reviewed_by: user.user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes ?? null,
      })
      .eq('id', id)
    if (e2) throw serviceError(error, 'Failed to review leave')
  }
}

export async function setSchoolWideSocial(profileId: string, enabled: boolean) {
  const { error } = await api.rpc('set_school_wide_social', {
    p_profile_id: profileId,
    p_enabled: enabled,
  })
  if (error) {
    // Fallback if RPC missing
    const { data: profile } = await api.from('profiles').select('permissions').eq('id', profileId).single()
    const permissions = { ...(profile?.permissions as object | null), school_wide_social: enabled }
    const { error: e2 } = await api.from('profiles').update({ permissions }).eq('id', profileId)
    if (e2) throw serviceError(error, 'Failed to update social permission')
  }
}

export async function updateProfile(
  profileId: string,
  updates: { phone?: string | null; avatar_url?: string | null; full_name?: string },
) {
  const { error } = await api.from('profiles').update(updates).eq('id', profileId)
  if (error) throw serviceError(error, 'Failed to update profile')
}

export async function uploadAvatar(profileId: string, file: File) {
  const path = `${profileId}/${Date.now()}-${file.name}`
  const { error: upErr } = await api.storage.from('avatars').upload(path, file, { upsert: true })
  if (upErr) throw serviceError(upErr, 'Failed to upload avatar')
  const { data } = await api.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 365)
  await updateProfile(profileId, { avatar_url: data?.signedUrl ?? path })
  return data?.signedUrl ?? path
}

export async function changePassword(newPassword: string) {
  const { error } = await api.auth.updateUser({ password: newPassword })
  if (error) throw serviceError(error, 'Failed to change password')
  const { data: session } = await api.auth.getUser()
  if (session.user) {
    await api.from('profiles').update({ must_change_password: false }).eq('id', session.user.id)
  }
}
