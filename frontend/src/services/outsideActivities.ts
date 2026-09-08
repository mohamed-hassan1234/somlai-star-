import { api } from '@/services/api'
import type {
  AccountStatus,
  AttendanceStatus,
  ClassRecord,
  OutsideActivity,
  OutsideActivityAttendance,
  Profile,
} from '@/types'
import { serviceError } from './errors'
import { listClasses } from './classes'

export interface CommitteeMemberRecord {
  profile: Profile
  committeeIds: string[]
  committeeNames: string[]
  classes: ClassRecord[]
}

export interface CreateCommitteeMemberPayload {
  loginId: string
  password: string
  fullName: string
  phone?: string
  classIds: string[]
  status?: AccountStatus
}

// ---------------------------------------------------------------------------
// Manager: committee member management
// ---------------------------------------------------------------------------

export async function nextCommitteeMemberId(): Promise<string> {
  const { data, error } = await api.rpc('next_committee_id')
  if (error) throw serviceError(error, 'Failed to generate next committee member ID')
  return data as string
}

export async function listCommitteeMembers(): Promise<CommitteeMemberRecord[]> {
  const { data: profiles, error } = await api
    .from('profiles')
    .select('*')
    .eq('role', 'outside_activity_committee')
    .order('login_id', { ascending: true })

  if (error) throw serviceError(error, 'Failed to load committee members')

  const records: CommitteeMemberRecord[] = []
  for (const profile of profiles ?? []) {
    const { data: memberships, error: mErr } = await api
      .from('committee_members')
      .select('committee_id, committee:outside_activity_committees(name)')
      .eq('profile_id', profile.id)
    if (mErr) throw serviceError(mErr, 'Failed to load committee memberships')

    const committeeIds = (memberships ?? []).map((m) => m.committee_id as string)
    const committeeNames = (memberships ?? [])
      .map((m) => (m.committee as { name?: string } | null)?.name)
      .filter((n): n is string => !!n)

    const classIds = new Set<string>()
    if (committeeIds.length > 0) {
      const { data: links, error: cErr } = await api
        .from('committee_classes')
        .select('class:classes(*)')
        .in('committee_id', committeeIds)
      if (cErr) throw serviceError(cErr, 'Failed to load committee classes')
      for (const link of links ?? []) {
        const cls = link.class as unknown as ClassRecord
        if (cls) classIds.add(cls.id)
      }
    }

    let classes: ClassRecord[] = []
    if (classIds.size > 0) {
      const all = await listClasses()
      classes = all.filter((c) => classIds.has(c.id))
    }

    records.push({ profile: profile as Profile, committeeIds, committeeNames, classes })
  }

  return records
}

export async function createCommitteeMember(payload: CreateCommitteeMemberPayload) {
  const { data: manager } = await api.auth.getUser()
  const { data, error } = await api.functions.invoke('create-user', {
    body: {
      loginId: payload.loginId,
      password: payload.password,
      fullName: payload.fullName,
      role: 'outside_activity_committee',
      phone: payload.phone,
    },
  })

  if (error) throw serviceError(error, 'Failed to create committee member')
  if (data?.error) throw new Error(String(data.error))

  const userId = String(data.userId)

  const { data: committee, error: cErr } = await api
    .from('outside_activity_committees')
    .insert({
      name: `${payload.fullName} — Outside Activity Committee`,
      description: 'Supervises students during outside activities for assigned classes.',
      created_by: manager.user?.id ?? null,
    })
    .select()
    .single()
  if (cErr) throw serviceError(cErr, 'Failed to create committee record')

  const { error: mErr } = await api.from('committee_members').insert({
    committee_id: committee.id,
    profile_id: userId,
  })
  if (mErr) throw serviceError(mErr, 'Failed to assign committee membership')

  if (payload.classIds.length > 0) {
    const { error: ccErr } = await api
      .from('committee_classes')
      .insert(payload.classIds.map((class_id) => ({ committee_id: committee.id, class_id })))
    if (ccErr) throw serviceError(ccErr, 'Failed to assign classes')
  }

  if (payload.status && payload.status !== 'active') {
    await api.from('profiles').update({ status: payload.status }).eq('id', userId)
  }

  await api.rpc('write_audit', {
    p_action: 'committee_member_created',
    p_entity: 'profiles',
    p_entity_id: userId,
    p_metadata: { loginId: payload.loginId, fullName: payload.fullName, classIds: payload.classIds },
  })

  return { ...data, committeeId: committee.id }
}

export async function updateCommitteeMember(
  profileId: string,
  updates: {
    fullName?: string
    phone?: string | null
    status?: AccountStatus
    classIds?: string[]
  },
): Promise<void> {
  const { data: memberships, error: mErr } = await api
    .from('committee_members')
    .select('committee_id')
    .eq('profile_id', profileId)
  if (mErr) throw serviceError(mErr, 'Failed to load committee memberships')

  const committeeIds = (memberships ?? []).map((m) => m.committee_id as string)

  if (updates.classIds) {
    for (const committeeId of committeeIds) {
      const { error: delErr } = await api
        .from('committee_classes')
        .delete()
        .eq('committee_id', committeeId)
      if (delErr) throw serviceError(delErr, 'Failed to clear class assignments')

      if (updates.classIds.length > 0) {
        const { error: insErr } = await api
          .from('committee_classes')
          .insert(updates.classIds.map((class_id) => ({ committee_id: committeeId, class_id })))
        if (insErr) throw serviceError(insErr, 'Failed to assign classes')
      }
    }
  }

  const profilePatch: Record<string, unknown> = {}
  if (updates.fullName !== undefined) profilePatch.full_name = updates.fullName
  if (updates.phone !== undefined) profilePatch.phone = updates.phone
  if (updates.status !== undefined) profilePatch.status = updates.status

  if (Object.keys(profilePatch).length > 0) {
    const { error: pErr } = await api.from('profiles').update(profilePatch).eq('id', profileId)
    if (pErr) throw serviceError(pErr, 'Failed to update committee member')
  }

  await api.rpc('write_audit', {
    p_action: 'committee_member_updated',
    p_entity: 'profiles',
    p_entity_id: profileId,
    p_metadata: updates,
  })
}

export async function resetCommitteeMemberPassword(loginId: string, newPassword: string) {
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

export async function setCommitteeMemberStatus(profileId: string, status: AccountStatus) {
  const { error } = await api.from('profiles').update({ status }).eq('id', profileId)
  if (error) throw serviceError(error, 'Failed to update committee member status')
  await api.rpc('write_audit', {
    p_action: status === 'disabled' ? 'committee_member_disabled' : 'committee_member_enabled',
    p_entity: 'profiles',
    p_entity_id: profileId,
    p_metadata: { status },
  })
}

// ---------------------------------------------------------------------------
// Committee member: assigned classes
// ---------------------------------------------------------------------------

export async function getMyCommitteeIds(profileId: string): Promise<string[]> {
  const { data, error } = await api
    .from('committee_members')
    .select('committee_id')
    .eq('profile_id', profileId)

  if (error) throw serviceError(error, 'Failed to load committee membership')
  return (data ?? []).map((m) => m.committee_id as string)
}

export async function getMyAssignedClasses(profileId: string): Promise<ClassRecord[]> {
  const { data, error } = await api
    .from('committee_members')
    .select('committee_id, committee:outside_activity_committees(classes:committee_classes(class:classes(*)))')
    .eq('profile_id', profileId)

  if (error) throw serviceError(error, 'Failed to load assigned classes')

  const classes = new Map<string, ClassRecord>()
  for (const row of data ?? []) {
    const committee = row.committee as { classes?: { class?: ClassRecord }[] } | null
    for (const link of committee?.classes ?? []) {
      if (link.class) classes.set(link.class.id, link.class)
    }
  }
  return [...classes.values()]
}

// ---------------------------------------------------------------------------
// Outside activities
// ---------------------------------------------------------------------------

export async function listOutsideActivities(filters?: {
  classId?: string
  createdBy?: string
}): Promise<OutsideActivity[]> {
  let q = api
    .from('outside_activities')
    .select(
      '*, class:classes(*), creator:profiles!outside_activities_created_by_fkey(id, login_id, full_name, role), attendance:outside_activity_attendance(id, student_id, status, student:students(*, profile:profiles!students_profile_id_fkey(*)))',
    )
    .order('activity_date', { ascending: false })

  if (filters?.classId) q = q.eq('class_id', filters.classId)
  if (filters?.createdBy) q = q.eq('created_by', filters.createdBy)

  const { data, error } = await q
  if (error) throw serviceError(error, 'Failed to load outside activities')
  return (data ?? []) as OutsideActivity[]
}

export async function getOutsideActivity(id: string): Promise<OutsideActivity> {
  const { data, error } = await api
    .from('outside_activities')
    .select(
      '*, class:classes(*), creator:profiles!outside_activities_created_by_fkey(id, login_id, full_name, role), attendance:outside_activity_attendance(id, student_id, status, student:students(*, profile:profiles!students_profile_id_fkey(*)))',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw serviceError(error, 'Failed to load activity')
  if (!data) throw new Error('Activity not found')
  return data as OutsideActivity
}

export async function createOutsideActivity(input: {
  name: string
  activity_type: string
  activity_date: string
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  description?: string | null
  class_id: string
  committee_id?: string | null
  created_by: string
}): Promise<OutsideActivity> {
  const { data, error } = await api
    .from('outside_activities')
    .insert({
      name: input.name,
      activity_type: input.activity_type,
      activity_date: input.activity_date,
      start_time: input.start_time || null,
      end_time: input.end_time || null,
      location: input.location || null,
      description: input.description || null,
      class_id: input.class_id,
      committee_id: input.committee_id || null,
      created_by: input.created_by,
    })
    .select('*, class:classes(*), creator:profiles!outside_activities_created_by_fkey(id, login_id, full_name, role)')
    .single()

  if (error) throw serviceError(error, 'Failed to create activity')
  return data as OutsideActivity
}

export async function updateOutsideActivity(id: string, input: Record<string, unknown>) {
  const { error } = await api.from('outside_activities').update(input).eq('id', id)
  if (error) throw serviceError(error, 'Failed to update activity')
}

export async function deleteOutsideActivity(id: string) {
  const { error } = await api.from('outside_activities').delete().eq('id', id)
  if (error) throw serviceError(error, 'Failed to delete activity')
}

// ---------------------------------------------------------------------------
// Outside activity attendance
// ---------------------------------------------------------------------------

export async function listActivityAttendance(filters?: {
  activityId?: string
  classId?: string
  date?: string
  committeeMemberId?: string
}): Promise<OutsideActivityAttendance[]> {
  let q = api
    .from('outside_activity_attendance')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*)), activity:outside_activities(*)')
    .order('activity_date', { ascending: false })

  if (filters?.activityId) q = q.eq('activity_id', filters.activityId)
  if (filters?.classId) q = q.eq('class_id', filters.classId)
  if (filters?.date) q = q.eq('activity_date', filters.date)
  if (filters?.committeeMemberId) q = q.eq('recorded_by', filters.committeeMemberId)

  const { data, error } = await q
  if (error) throw serviceError(error, 'Failed to load activity attendance')
  return (data ?? []) as OutsideActivityAttendance[]
}

export interface ActivityAttendanceEntry {
  activity_id: string
  committee_id: string
  student_id: string
  class_id: string
  activity_date: string
  status: AttendanceStatus
  recorded_by: string
  notes?: string | null
}

export async function upsertActivityAttendance(
  entries: ActivityAttendanceEntry[],
  activityLocation?: string | null,
): Promise<void> {
  if (!entries.length) return
  const now = new Date().toISOString()
  const rows = entries.map((e) => ({
    activity_id: e.activity_id,
    committee_id: e.committee_id,
    student_id: e.student_id,
    class_id: e.class_id,
    activity_date: e.activity_date,
    status: e.status,
    recorded_by: e.recorded_by,
    notes: e.notes ?? null,
    location: activityLocation ?? null,
    recorded_at: now,
    updated_by: e.recorded_by,
    updated_at: now,
  }))

  const { error } = await api.from('outside_activity_attendance').upsert(rows, {
    onConflict: 'activity_id,student_id',
  })
  if (error) throw serviceError(error, 'Failed to save activity attendance')
}

export interface ActivityAttendanceSummary {
  total: number
  present: number
  absent: number
  excused: number
}

export function summarizeActivityAttendance(attendance: { status: string }[]): ActivityAttendanceSummary {
  const summary: ActivityAttendanceSummary = { total: 0, present: 0, absent: 0, excused: 0 }
  for (const row of attendance) {
    summary.total += 1
    if (row.status === 'present') summary.present += 1
    else if (row.status === 'absent') summary.absent += 1
    else if (row.status === 'excused') summary.excused += 1
  }
  return summary
}
