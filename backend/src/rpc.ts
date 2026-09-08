import type { RequestContext } from './security.ts'
import { collection } from './db.ts'
import { uuid, nowIso, hashPassword } from './util.ts'
import { ApiError } from './errors.ts'

type Doc = Record<string, unknown>

function requireManager(ctx: RequestContext): void {
  if (!ctx.isManager()) throw new ApiError(403, 'Only School Manager can perform this action')
}

function requireFinance(ctx: RequestContext): void {
  if (!ctx.isManager() && !ctx.roleIn(['finance_officer', 'finance_manager'])) {
    throw new ApiError(403, 'Not authorized')
  }
}

function loginIdToEmail(loginId: string): string {
  return `${loginId.trim().toLowerCase()}@somalistar.internal`
}

function maxPadded(rows: Doc[], prefix: string, key: string, pad: number): string {
  const re = new RegExp(`^${prefix}[0-9]+$`)
  let max = 0
  for (const r of rows) {
    const v = String(r[key] ?? '')
    if (re.test(v)) {
      const n = Number(v.slice(prefix.length))
      if (Number.isInteger(n) && n > max) max = n
    }
  }
  return `${prefix}${String(max + 1).padStart(pad, '0')}`
}

const RPC_HANDLERS: Record<string, (args: Doc, ctx: RequestContext) => Promise<unknown>> = {
  async next_student_id(args, ctx): Promise<string> {
    requireManager(ctx)
    const rows = await collection('students').find({}).toArray()
    let max = 99
    for (const r of rows) {
      const v = String(r.student_id ?? '')
      if (/^SOMSTAR[0-9]+$/.test(v)) {
        const n = Number(v.slice(7))
        if (Number.isInteger(n) && n > max) max = n
      }
    }
    const next = max + 1
    if (next < 100) return 'SOMSTAR100'
    if (next > 600) throw new ApiError(400, 'Student ID range exhausted (SOMSTAR100–SOMSTAR600)')
    return `SOMSTAR${next}`
  },

  async next_teacher_id(args, ctx): Promise<string> {
    requireManager(ctx)
    const rows = await collection('teachers').find({}).toArray()
    return maxPadded(rows, 'TCH', 'teacher_id', 3)
  },

  async next_parent_id(args, ctx): Promise<string> {
    requireManager(ctx)
    const rows = await collection('profiles').find({ login_id: /^PAR[0-9]+$/ }).toArray()
    return maxPadded(rows, 'PAR', 'login_id', 3)
  },

  async next_committee_id(args, ctx): Promise<string> {
    requireManager(ctx)
    const rows = await collection('profiles')
      .find({ role: 'outside_activity_committee', login_id: { $regex: '^OAC[0-9]+$' } })
      .toArray()
    return maxPadded(rows, 'OAC', 'login_id', 3)
  },

  async next_committee_member_id(args, ctx): Promise<string> {
    requireManager(ctx)
    const rows = await collection('profiles').find({ login_id: /^OAC[0-9]+$/ }).toArray()
    return maxPadded(rows, 'OAC', 'login_id', 3)
  },

  async login_email_from_id(args, _ctx): Promise<string> {
    return loginIdToEmail(String(args.p_login_id ?? ''))
  },

  async write_audit(args, ctx): Promise<string> {
    if (!ctx.userId) throw new ApiError(401, 'Not authenticated')
    const id = uuid()
    await collection('audit_logs').insertOne({
      id,
      actor_id: ctx.userId,
      action: String(args.p_action ?? ''),
      entity: String(args.p_entity ?? ''),
      entity_id: args.p_entity_id != null ? String(args.p_entity_id) : null,
      metadata: (args.p_metadata ?? {}) as Doc,
      created_at: nowIso(),
    } as never)
    return id
  },

  async list_finance_records(args, ctx): Promise<Doc[]> {
    requireFinance(ctx)
    const filter: Doc = {}
    if (args.p_class_id) filter.class_id = String(args.p_class_id)
    if (args.p_month != null && args.p_month !== '') filter.month = Number(args.p_month)
    if (args.p_year != null && args.p_year !== '') filter.year = Number(args.p_year)
    if (args.p_student_id) filter.student_id = String(args.p_student_id)
    const limit = Number(args.p_limit ?? 200)
    const offset = Number(args.p_offset ?? 0)

    const records = await collection('finance_records')
      .find(filter)
      .sort({ updated_at: -1, created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    const studentIds = [...new Set(records.map((r) => String(r.student_id ?? '')).filter(Boolean))]
    const students = studentIds.length
      ? await collection('students').find({ id: { $in: studentIds } }).toArray()
      : []
    const profileIds = [...new Set(students.map((s) => String(s.profile_id ?? '')).filter(Boolean))]
    const profiles = profileIds.length
      ? await collection('profiles').find({ id: { $in: profileIds } }).toArray()
      : []
    const classIds = [...new Set(students.map((s) => String(s.class_id ?? '')).filter(Boolean))]
    const classes = classIds.length
      ? await collection('classes').find({ id: { $in: classIds } }).toArray()
      : []

    const studentById = new Map<string, Doc>()
    for (const s of students) studentById.set(String(s.id), s)
    const profileById = new Map<string, Doc>()
    for (const p of profiles) profileById.set(String(p.id), p)
    const classById = new Map<string, Doc>()
    for (const c of classes) classById.set(String(c.id), c)

    return records.map((fr) => {
      const st = fr.student_id ? studentById.get(String(fr.student_id)) : undefined
      const pl = st?.profile_id ? profileById.get(String(st.profile_id)) : undefined
      const cl = st?.class_id ? classById.get(String(st.class_id)) : undefined
      const frId = fr.class_id ? classById.get(String(fr.class_id)) : undefined
      const cls = cl ?? frId
      return {
        id: fr.id,
        student_id: fr.student_id,
        class_id: fr.class_id,
        month: fr.month,
        year: fr.year,
        status: fr.status,
        amount: fr.amount ?? null,
        notes: fr.notes ?? null,
        recorded_by: fr.recorded_by ?? null,
        created_at: fr.created_at,
        updated_at: fr.updated_at,
        student: st
          ? {
              id: st.id,
              student_id: st.student_id,
              profile_id: st.profile_id,
              class_id: st.class_id,
              profile: pl ? { id: pl.id, full_name: pl.full_name } : null,
              class: cls ? { id: cls.id, name: cls.name } : null,
            }
          : null,
      }
    })
  },

  async upsert_finance_record(args, ctx): Promise<Doc> {
    requireFinance(ctx)
    if (!ctx.isManager() && ctx.role !== 'finance_officer') throw new ApiError(403,'Finance Manager access is read-only')
    const studentId = args.p_student_id ? String(args.p_student_id) : null
    const month = Number(args.p_month)
    const year = Number(args.p_year)
    if (!studentId) throw new ApiError(400, 'p_student_id is required')
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new ApiError(400, 'invalid month')
    if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new ApiError(400, 'invalid year')

    const existing = await collection('finance_records').findOne({
      student_id: studentId,
      month,
      year,
    } as never)
    const now = nowIso()

    if (existing) {
      const patch: Doc = {
        status: String(args.p_status ?? existing.status),
        amount: args.p_amount != null ? args.p_amount : existing.amount,
        notes: args.p_notes !== undefined && args.p_notes !== null ? String(args.p_notes) : existing.notes,
        recorded_by: args.p_recorded_by ? String(args.p_recorded_by) : existing.recorded_by ?? null,
        class_id: args.p_class_id ? String(args.p_class_id) : existing.class_id ?? null,
        updated_at: now,
      }
      const merged: Doc = { ...(existing as unknown as Doc), ...patch }
      await collection('finance_records').replaceOne(
        { _id: (existing as unknown as { _id: unknown })._id } as never,
        merged as never,
      )
      return merged
    }

    const row: Doc = {
      id: uuid(),
      student_id: studentId,
      class_id: args.p_class_id ? String(args.p_class_id) : null,
      month,
      year,
      status: String(args.p_status ?? 'unpaid'),
      amount: args.p_amount != null ? args.p_amount : null,
      notes: args.p_notes !== undefined && args.p_notes !== null ? String(args.p_notes) : null,
      recorded_by: args.p_recorded_by ? String(args.p_recorded_by) : null,
      created_at: now,
      updated_at: now,
    }
    await collection('finance_records').insertOne(row as never)
    return row
  },

  async review_teacher_leave(args, ctx): Promise<null> {
    requireManager(ctx)
    const status = String(args.p_status ?? '')
    if (!['approved', 'rejected'].includes(status)) throw new ApiError(400, 'Invalid leave status')
    const leaveId = args.p_leave_id ? String(args.p_leave_id) : null
    if (!leaveId) throw new ApiError(400, 'p_leave_id is required')
    const res = await collection('teacher_leave').updateOne(
      { id: leaveId, status: 'pending' } as never,
      {
        $set: {
          status,
          reviewed_by: ctx.userId,
          reviewed_at: nowIso(),
          review_notes: args.p_notes != null ? String(args.p_notes) : null,
          updated_at: nowIso(),
        },
      } as never,
    )
    if (res.matchedCount === 0) {
      throw new ApiError(404, 'Pending leave request not found')
    }
    return null
  },

  async set_school_wide_social(args, ctx): Promise<null> {
    requireManager(ctx)
    const profileId = args.p_profile_id ? String(args.p_profile_id) : null
    if (!profileId) throw new ApiError(400, 'p_profile_id is required')
    const enabled = !!args.p_enabled
    const profile = await collection('profiles').findOne({ id: profileId } as never)
    if (!profile) throw new ApiError(404, 'Profile not found')
    const permissions = { ...((profile.permissions as Doc) ?? {}), school_wide_social: enabled }
    await collection('profiles').updateOne(
      { id: profileId } as never,
      { $set: { permissions, updated_at: nowIso() } } as never,
    )
    await collection('audit_logs').insertOne({
      id: uuid(),
      actor_id: ctx.userId,
      action: 'permission_changed',
      entity: 'profiles',
      entity_id: profileId,
      metadata: { school_wide_social: enabled },
      created_at: nowIso(),
    } as never)
    return null
  },

  async create_parent(args, ctx): Promise<Doc> {
    requireManager(ctx)
    const loginId = String(args.p_login_id ?? '').trim().toUpperCase()
    const password = String(args.p_password ?? '')
    const fullName = String(args.p_full_name ?? '').trim()
    const phone = args.p_phone ? String(args.p_phone) : null
    const childIds: string[] = Array.isArray(args.p_child_ids) ? args.p_child_ids.map(String) : []

    if (!loginId) throw new ApiError(400, 'Login ID is required')
    if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters')
    if (!fullName) throw new ApiError(400, 'Full name is required')

    const existing = await collection('profiles').findOne({ login_id: loginId, deleted_at: null } as never)
    if (existing) throw new ApiError(409, 'Login ID already in use')

    const email = loginIdToEmail(loginId)
    const dup = await collection('auth_users').findOne({ email } as never)
    if (dup) throw new ApiError(409, 'Email already in use')

    const userId = uuid()
    const now = nowIso()
    await collection('auth_users').insertOne({
      _id: uuid(),
      user_id: userId,
      email,
      login_id: loginId,
      password_hash: await hashPassword(password),
      status: 'active',
      created_at: now,
      updated_at: now,
    } as never)

    await collection('profiles').insertOne({
      id: userId,
      login_id: loginId,
      full_name: fullName,
      role: 'parent',
      phone,
      status: 'active',
      must_change_password: false,
      permissions: {},
      created_by: ctx.userId,
      created_at: now,
      updated_at: now,
      followers_count: 0,
      following_count: 0,
    } as never)

    for (const childId of childIds) {
      const exists = await collection('students').countDocuments({ id: childId } as never)
      if (exists > 0) {
        await collection('student_parents').insertOne({
          id: uuid(),
          parent_id: userId,
          student_id: childId,
          linked_by: ctx.userId,
          created_at: now,
        } as never)
      }
    }

    await collection('audit_logs').insertOne({
      id: uuid(),
      actor_id: ctx.userId,
      action: 'parent_created',
      entity: 'profiles',
      entity_id: userId,
      metadata: { loginId, role: 'parent', fullName, childCount: childIds.length },
      created_at: now,
    } as never)

    return { success: true, userId, loginId }
  },

  async set_parent_children(args, ctx): Promise<Doc> {
    requireManager(ctx)
    const parentId = args.p_parent_id ? String(args.p_parent_id) : null
    if (!parentId) throw new ApiError(400, 'p_parent_id is required')
    const parent = await collection('profiles').findOne({ id: parentId, role: 'parent', deleted_at: null } as never)
    if (!parent) throw new ApiError(404, 'Parent account not found')
    const childIds: string[] = Array.isArray(args.p_child_ids) ? args.p_child_ids.map(String) : []

    await collection('student_parents').deleteMany({ parent_id: parentId } as never)
    const now = nowIso()
    for (const childId of childIds) {
      const exists = await collection('students').countDocuments({ id: childId } as never)
      if (exists > 0) {
        await collection('student_parents').insertOne({
          id: uuid(),
          parent_id: parentId,
          student_id: childId,
          linked_by: ctx.userId,
          created_at: now,
        } as never)
      }
    }

    await collection('audit_logs').insertOne({
      id: uuid(),
      actor_id: ctx.userId,
      action: 'parent_children_updated',
      entity: 'profiles',
      entity_id: parentId,
      metadata: { childIds },
      created_at: now,
    } as never)

    return { success: true }
  },

  async register_backup(args, ctx): Promise<string> {
    requireManager(ctx)
    const id = uuid()
    await collection('backups').insertOne({
      id,
      file_name: String(args.p_file_name ?? ''),
      format: String(args.p_format ?? 'json'),
      backup_type: String(args.p_backup_type ?? 'manual'),
      file_size: Number(args.p_file_size ?? 0),
      checksum: String(args.p_checksum ?? ''),
      status: String(args.p_status ?? 'completed'),
      storage_path: args.p_storage_path ? String(args.p_storage_path) : null,
      created_by: args.p_created_by ? String(args.p_created_by) : null,
      created_at: nowIso(),
    } as never)
    return id
  },

  async write_backup_log(args, ctx): Promise<string> {
    if (!ctx.isManager()) throw new ApiError(403, 'Only School Manager can write backup logs')
    const id = uuid()
    await collection('backup_logs').insertOne({
      id,
      actor_id: args.p_actor_id ? String(args.p_actor_id) : null,
      action: String(args.p_action ?? ''),
      file_name: args.p_file_name ? String(args.p_file_name) : null,
      status: String(args.p_status ?? 'success'),
      metadata: (args.p_metadata ?? {}) as Doc,
      error: args.p_error ? String(args.p_error) : null,
      ip_address: args.p_ip ? String(args.p_ip) : null,
      created_at: nowIso(),
    } as never)
    return id
  },

  async update_backup_status(args, ctx): Promise<null> {
    requireManager(ctx)
    const backupId = args.p_backup_id ? String(args.p_backup_id) : null
    if (!backupId) throw new ApiError(400, 'p_backup_id is required')
    const status = String(args.p_status ?? '')
    const patch: Doc = { status }
    if (args.p_error != null) patch.error = String(args.p_error)
    if (['completed', 'failed'].includes(status)) {
      const cur = await collection('backups').findOne({ id: backupId } as never)
      if (cur && !cur.completed_at) patch.completed_at = nowIso()
    }
    await collection('backups').updateOne({ id: backupId } as never, { $set: patch } as never)
    return null
  },

  async cleanup_old_backups(args, ctx): Promise<number> {
    requireManager(ctx)
    const keep = Math.max(Number(args.p_keep ?? 1), 1)
    const backups = await collection('backups')
      .find({ backup_type: { $ne: 'pre_restore' }, status: 'completed' })
      .sort({ created_at: -1 })
      .toArray()
    const stale = backups.slice(keep)
    let removed = 0
    for (const b of stale) {
      if (b.storage_path) {
        try {
          const { deleteBackupFile } = await import('./storage.ts')
          deleteBackupFile(String(b.storage_path))
        } catch {
          /* non-fatal */
        }
      }
      await collection('backups').deleteOne({ id: String(b.id) } as never)
      await collection('backup_logs').insertOne({
        id: uuid(),
        actor_id: null,
        action: 'BACKUP_AUTODELETED',
        file_name: b.file_name,
        status: 'success',
        metadata: { reason: 'retention_cleanup' },
        created_at: nowIso(),
      } as never)
      removed++
    }
    return removed
  },
}

export async function runRpc(name: string, args: Doc, ctx: RequestContext): Promise<{ data: unknown }> {
  const handler = RPC_HANDLERS[name]
  if (!handler) throw new ApiError(404, `RPC function not found: ${name}`)
  const data = await handler(args, ctx)
  return { data }
}
