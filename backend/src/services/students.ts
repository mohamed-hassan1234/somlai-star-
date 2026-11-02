import { collection } from '../db.ts'
import { ApiError } from '../errors.ts'
import { updatePassword } from '../auth.ts'
import { uuid, nowIso, randomPassword } from '../util.ts'
import type { RequestContext } from '../security.ts'

type Doc = Record<string, unknown>

/**
 * Somali Star Academy human-facing student IDs are fixed to SOMSTAR100-SOMSTAR700.
 * The prefix and format are part of the school's identity and must not change.
 */
export const STUDENT_ID_MIN = 100
export const STUDENT_ID_MAX = 700
export const STUDENT_ID_PREFIX = 'SOMSTAR'
const STUDENT_ID_RE = /^SOMSTAR([1-6][0-9]{2}|700)$/
const RANGE_LABEL = `${STUDENT_ID_PREFIX}${STUDENT_ID_MIN}-${STUDENT_ID_PREFIX}${STUDENT_ID_MAX}`

/** Returns the numeric part of a SOMSTAR ID, or null when the format is not valid. */
export function studentIdNumber(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = STUDENT_ID_RE.exec(value.trim().toUpperCase())
  if (!match) return null
  const num = Number(match[1])
  return num >= STUDENT_ID_MIN && num <= STUDENT_ID_MAX ? num : null
}

export function isValidStudentId(value: unknown): boolean {
  return studentIdNumber(value) !== null
}

export function canonicalStudentId(value: string): string {
  const num = studentIdNumber(value)
  if (num === null) throw new ApiError(400, `Student ID must use the ${RANGE_LABEL} format (for example ${STUDENT_ID_PREFIX}100)`)
  return `${STUDENT_ID_PREFIX}${num}`
}

/** True when no student row currently holds this SOMSTAR ID, so it can be assigned. */
export async function isStudentIdAvailable(studentId: string): Promise<boolean> {
  const canonical = canonicalStudentId(studentId)
  return (await collection('students').countDocuments({ student_id: canonical } as never)) === 0
}

/**
 * Returns the lowest unused ID in the range. IDs released by a deleted student are
 * picked up again here, so no other student is ever renumbered.
 */
export async function allocateStudentId(): Promise<string> {
  const rows = await collection('students').find({}, { projection: { student_id: 1 } }).toArray()
  const used = new Set<number>()
  for (const row of rows) {
    const num = studentIdNumber(row.student_id)
    if (num !== null) used.add(num)
  }
  for (let num = STUDENT_ID_MIN; num <= STUDENT_ID_MAX; num++) {
    if (!used.has(num)) return `${STUDENT_ID_PREFIX}${num}`
  }
  throw new ApiError(400, `No Student IDs are currently available. Every ID in ${RANGE_LABEL} is already assigned.`)
}

/** Extracts the storage path from an avatar URL or bare path so the file can be removed. */
export function avatarStoragePath(avatarUrl: unknown): { bucket: string; path: string } | null {
  if (typeof avatarUrl !== 'string' || !avatarUrl.trim()) return null
  const raw = avatarUrl.trim()
  const withoutQuery = raw.split('?')[0]!
  const marker = withoutQuery.search(/\/(avatars|chat-media)\//)
  if (marker === -1) return null
  const bucket = withoutQuery.slice(marker + 1)!
  const rest = withoutQuery.slice(marker + 1 + bucket.length + 1)
  if (!rest) return null
  return { bucket, path: rest }
}

/**
 * Deletes a student from Student Management.
 *
 * The `students` row is removed so the SOMSTAR ID is released for reuse, and the
 * login is destroyed so the deleted account can no longer authenticate. Every
 * historical record (attendance, finance, exams, quiz attempts, practice, behaviour)
 * keeps pointing at the student's immutable UUID `students.id`, which is never
 * reused, so those records can never be attached to a future holder of the same
 * SOMSTAR ID. The profile row is archived rather than deleted so past records that
 * reference `profiles.id` still resolve a name; its `login_id` is tombstoned so the
 * SOMSTAR ID itself is free to be assigned to a brand new student.
 */
export async function deleteStudentAccount(
  input: { id?: unknown; studentId?: unknown },
  ctx: RequestContext,
): Promise<Doc> {
  if (!ctx.isManager()) throw new ApiError(403, 'Only School Manager can delete students')

  const filter: Doc = {}
  if (typeof input.id === 'string' && input.id.trim()) filter.id = input.id.trim()
  else if (typeof input.studentId === 'string' && input.studentId.trim()) filter.student_id = canonicalStudentId(input.studentId)
  else throw new ApiError(400, 'A student id or studentId is required')

  const student = (await collection('students').findOne(filter as never)) as Doc | null
  if (!student) throw new ApiError(404, 'Student not found')

  const studentRowId = String(student.id ?? '')
  const profileId = String(student.profile_id ?? '')
  const studentId = String(student.student_id ?? '')
  if (!studentRowId || !profileId) throw new ApiError(409, 'Student record is incomplete and cannot be deleted')
  if (profileId === ctx.userId) throw new ApiError(400, 'You cannot delete your own account from Student Management')

  const profile = (await collection('profiles').findOne({ id: profileId } as never)) as Doc | null
  const fullName = String(profile?.full_name ?? '')
  const loginId = String(profile?.login_id ?? studentId)
  const now = nowIso()

  // Parent links are access grants rather than history: drop them so a parent can
  // never resolve a future student that reuses this SOMSTAR ID.
  await collection('student_parents').deleteMany({ student_id: studentRowId } as never)

  // Removing the students row releases the SOMSTAR ID and removes the student from
  // the active Student Management list. History rows are intentionally untouched.
  await collection('students').deleteOne({ _id: (student as { _id: unknown })._id } as never)

  // Destroy the login, then archive the profile so existing tokens and logins stop working.
  // `profiles.login_id` carries a unique index, so the SOMSTAR ID itself has to be
  // released here or it could never be assigned again. The archived profile keeps the
  // original ID on `archived_login_id` for traceability and gets a tombstone login ID
  // that no longer matches any assignable ID and can no longer authenticate.
  const tombstoneLoginId = `deleted-${studentId}-${uuid().slice(0, 8)}`
  await collection('auth_sessions').deleteMany({ user_id: profileId } as never)
  await collection('auth_users').deleteMany({ user_id: profileId } as never)
  await collection('profiles').updateOne(
    { id: profileId } as never,
    {
      $set: {
        login_id: tombstoneLoginId,
        archived_login_id: studentId,
        status: 'disabled',
        deleted_at: now,
        avatar_url: null,
        must_change_password: true,
        updated_at: now,
      },
    } as never,
  )

  const avatar = avatarStoragePath(profile?.avatar_url)
  if (avatar) {
    try {
      const { removeFiles } = await import('../storage.ts')
      await removeFiles(avatar.bucket, [avatar.path])
    } catch {
      /* the stored file is already gone or unreadable; never block the delete on it */
    }
  }

  await collection('audit_logs').insertOne({
    id: uuid(),
    actor_id: ctx.userId,
    action: 'student_deleted',
    entity: 'students',
    entity_id: studentRowId,
    metadata: {
      studentId,
      profileId,
      loginId,
      fullName,
      class_id: student.class_id ?? null,
      academic_year_id: student.academic_year_id ?? null,
      releasedStudentId: studentId,
      historicalRecordsPreserved: true,
    },
    created_at: now,
  } as never)

  return {
    success: true,
    studentId,
    releasedStudentId: studentId,
    profileId,
    profileArchived: true,
    historicalRecordsPreserved: true,
    message: `${studentId} has been deleted and the ID is available again. Historical attendance, finance, exam and practice records were kept and remain attached to the deleted record only.`,
  }
}

/**
 * Passwords are stored as one-way bcrypt hashes and can never be read back, so
 * recovery works by issuing a new temporary password and returning it to the
 * manager exactly once. The student must change it at next sign-in.
 */
export async function recoverStudentPassword(
  input: { loginId?: unknown; newPassword?: unknown },
  ctx: RequestContext,
): Promise<Doc> {
  if (!ctx.isManager()) throw new ApiError(403, 'Only School Manager can recover passwords')

  const loginId = typeof input.loginId === 'string' ? input.loginId.trim().toUpperCase() : ''
  if (!loginId) throw new ApiError(400, 'loginId is required')

  const student = (await collection('students').findOne({ student_id: canonicalStudentId(loginId) } as never)) as Doc | null
  const profileId = student
    ? String(student.profile_id ?? '')
    : String(((await collection('profiles').findOne({ login_id: loginId, deleted_at: null } as never)) as Doc | null)?.id ?? '')
  if (!profileId) throw new ApiError(404, 'Student not found')

  const requested = typeof input.newPassword === 'string' ? input.newPassword : ''
  const generated = !(requested.length >= 8 && Buffer.byteLength(requested, 'utf8') <= 72)
  const password = generated ? `SomStar-${randomPassword(9)}` : requested

  const updated = await updatePassword(profileId, password)
  if (!updated) throw new ApiError(404, 'Student login account not found')

  await collection('profiles').updateOne(
    { id: profileId } as never,
    { $set: { must_change_password: true, updated_at: nowIso() } } as never,
  )
  await collection('audit_logs').insertOne({
    id: uuid(),
    actor_id: ctx.userId,
    action: 'password_recovered',
    entity: 'profiles',
    entity_id: profileId,
    metadata: { loginId, generated, mustChangePassword: true },
    created_at: nowIso(),
  } as never)

  return {
    success: true,
    loginId,
    temporaryPassword: password,
    generated,
    mustChangePassword: true,
    message: generated
      ? 'A new temporary password was generated. Share it with the student; they must change it at next sign-in.'
      : 'Password updated. The student must change it at next sign-in.',
  }
}
