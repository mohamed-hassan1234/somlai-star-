import { verifyAccessToken } from './auth.ts'
import { collection } from './db.ts'
import { isInvalidDate } from './util.ts'

export interface ProfileDoc {
  id: string
  login_id: string
  full_name: string
  role: string
  phone?: string | null
  avatar_url?: string | null
  status: string
  permissions: Record<string, unknown>
  must_change_password: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  followers_count?: number
  following_count?: number
  email?: string
}

const ACTIVE_STAFF_ROLES = ['teacher', 'teacher_cabaas', 'practice_teacher', 'school_manager']
export const STAFF_NOTIFY_ROLES = [
  'teacher',
  'teacher_cabaas',
  'practice_teacher',
  'supervisor',
  'attendance_manager',
  'finance_officer',
  'finance_manager',
  'outside_activity_committee',
]

export class RequestContext {
  userId: string | null = null
  role: string | null = null
  profile: ProfileDoc | null = null

  private _teacherId: string | null | undefined
  private _studentId: string | null | undefined
  private _studentClassId: string | null | undefined
  private _parentStudentIds: string[] | undefined
  private _myCommitteeIds: string[] | undefined
  private _directMemberIds: string[] | undefined
  private _myTeacherClassIds: string[] | undefined
  private _mySeenActiveIds: Set<string> | undefined

  static async fromBearer(token?: string): Promise<RequestContext> {
    const ctx = new RequestContext()
    if (!token) return ctx
    const verified = await verifyAccessToken(token)
    if (!verified) return ctx
    ctx.userId = verified.userId
    const profile = await collection<ProfileDoc>('profiles').findOne({ id: verified.userId, deleted_at: null })
    if (profile && profile.status === 'active') {
      ctx.profile = profile
      ctx.role = profile.role
    }
    return ctx
  }

  isAuthenticated(): boolean {
    return !!this.profile
  }

  isActiveSelf(): boolean {
    return !!this.profile && this.profile.status === 'active' && !this.profile.deleted_at
  }

  isManager(): boolean {
    return !!this.profile && this.profile.role === 'school_manager' && this.isActiveSelf()
  }

  isTeacherCabaas(): boolean {
    return !!this.profile && this.profile.role === 'teacher_cabaas' && this.isActiveSelf()
  }

  isSupervisor(): boolean {
    return !!this.profile && this.profile.role === 'supervisor' && this.isActiveSelf()
  }

  isParent(): boolean {
    return !!this.profile && this.profile.role === 'parent' && this.isActiveSelf()
  }

  isPracticeTeacher(): boolean {
    return !!this.profile && this.profile.role === 'practice_teacher' && this.isActiveSelf()
  }

  hasSchoolWideSocial(): boolean {
    if (!this.profile || !this.isActiveSelf()) return false
    if (ACTIVE_STAFF_ROLES.includes(this.profile.role)) return true
    return this.profile.permissions?.school_wide_social === true
  }

  roleIn(roles: string[]): boolean {
    return !!this.role && roles.includes(this.role)
  }

  async teacherId(): Promise<string | null> {
    if (this._teacherId !== undefined) return this._teacherId
    if (!this.userId) return null
    const doc = await collection('teachers').findOne({ profile_id: this.userId }, { projection: { id: 1 } })
    this._teacherId = doc ? String(doc.id) : null
    return this._teacherId
  }

  async studentId(): Promise<string | null> {
    if (this._studentId !== undefined) return this._studentId
    if (!this.userId) return null
    const doc = await collection('students').findOne({ profile_id: this.userId }, { projection: { id: 1 } })
    this._studentId = doc ? String(doc.id) : null
    return this._studentId
  }

  async studentClassId(): Promise<string | null> {
    if (this._studentClassId !== undefined) return this._studentClassId
    if (!this.userId) return null
    const doc = await collection('students').findOne({ profile_id: this.userId }, { projection: { class_id: 1 } })
    this._studentClassId = doc?.class_id ? String(doc.class_id) : null
    return this._studentClassId
  }

  async parentStudentIds(): Promise<string[]> {
    if (this._parentStudentIds) return this._parentStudentIds
    if (!this.userId) return []
    const rows = await collection('student_parents').find({ parent_id: this.userId }).toArray()
    this._parentStudentIds = rows.map((r) => String(r.student_id))
    return this._parentStudentIds
  }

  async parentStudentIdsSet(): Promise<Set<string>> {
    return new Set(await this.parentStudentIds())
  }

  async myCommitteeIds(): Promise<string[]> {
    if (this._myCommitteeIds) return this._myCommitteeIds
    if (!this.userId) return []
    const rows = await collection('committee_members').find({ profile_id: this.userId }).toArray()
    this._myCommitteeIds = rows.map((r) => String(r.committee_id))
    this._directMemberIds = rows.map((r) => String(r.id))
    return this._myCommitteeIds
  }

  async directMemberIds(): Promise<string[]> {
    if (!this._directMemberIds) await this.myCommitteeIds()
    return this._directMemberIds ?? []
  }

  async committeeHasClass(classId: string | null | undefined): Promise<boolean> {
    if (!classId) return false
    await this.myCommitteeIds()
    if (this._myCommitteeIds && this._myCommitteeIds.length > 0) {
      const viaCommittees = await collection('committee_classes').countDocuments({
        committee_id: { $in: this._myCommitteeIds },
        class_id: classId,
      })
      if (viaCommittees > 0) return true
    }
    if (this._directMemberIds && this._directMemberIds.length > 0) {
      const viaDirect = await collection('committee_member_classes').countDocuments({
        committee_member_id: { $in: this._directMemberIds },
        class_id: classId,
      })
      return viaDirect > 0
    }
    return false
  }

  async teacherHasClass(classId: string | null | undefined): Promise<boolean> {
    if (!classId) return false
    const tid = await this.teacherId()
    if (!tid) return false
    const n = await collection('teacher_classes').countDocuments({ teacher_id: tid, class_id: classId })
    return n > 0
  }

  async myTeacherClassIds(): Promise<string[]> {
    if (this._myTeacherClassIds) return this._myTeacherClassIds
    const tid = await this.teacherId()
    if (!tid) return []
    const rows = await collection('teacher_classes').find({ teacher_id: tid }).toArray()
    this._myTeacherClassIds = rows.map((r) => String(r.class_id))
    return this._myTeacherClassIds
  }

  async isParticipant(conversationId: string): Promise<boolean> {
    if (!this.userId) return false
    const n = await collection('chat_participants').countDocuments({ conversation_id: conversationId, profile_id: this.userId })
    return n > 0
  }

  /** Whether the caller may view chat content authored by `authorId` (016 open-social model). */
  canViewChatContent(_authorId: string): boolean {
    return this.isManager() || this.isActiveSelf()
  }

  async isActiveProfile(profileId: string): Promise<boolean> {
    if (this._mySeenActiveIds?.has('all')) return true
    const doc = await collection('profiles').findOne(
      { id: profileId, status: 'active', deleted_at: null },
      { projection: { id: 1 } },
    )
    return !!doc
  }
}

/** A single row predicate (reader/writer gate) built from THIS call site context. */
export type RowPredicate = (row: Record<string, unknown>) => boolean | Promise<boolean>

export function activeStatusFilter(): Record<string, unknown> {
  return { status: 'active', deleted_at: null }
}

export function eqRows(rows: Array<Record<string, unknown>>, key: string, value: unknown): boolean {
  return rows.some((r) => r[key] === value || r.id === value)
}

export function normalizeDateString(v: unknown): string | null {
  if (v == null || v === '') return null
  if (isInvalidDate(v)) return null
  return String(v)
}