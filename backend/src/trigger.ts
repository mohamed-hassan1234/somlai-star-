import { collection } from './db.ts'
import { uuid, nowIso } from './util.ts'
import type { RequestContext } from './security.ts'
import { ApiError } from './errors.ts'
import { emitToUser, emitToConv, emit, emitNotification } from './realtime.ts'

type Doc = Record<string, unknown>

const REALTIME_TABLES = new Set<string>([
  'chat_posts', 'chat_post_comments', 'chat_post_reactions', 'chat_messages',
  'chat_participants', 'chat_conversations', 'calls', 'notifications', 'follows',
  'outside_activities', 'result_submissions', 'results', 'result_approvals',
  'practice_students', 'lesson_monitoring', 'teacher_attendance', 'attendance',
  'quizzes', 'lessons', 'finance_records', 'exam_schedules', 'teacher_leave',
  'activity_logs', 'ai_conversations', 'ai_messages', 'outside_activity_attendance',
  'chat_posts_hidden', 'profiles',
])

async function find(table: string, filter: Record<string, unknown>): Promise<Doc[]> {
  const rows = await collection(table).find(filter as never).toArray()
  return rows as unknown as Doc[]
}

async function findOne(table: string, filter: Record<string, unknown>): Promise<Doc | null> {
  const row = await collection(table).findOne(filter as never)
  return row ? ({ ...row } as unknown as Doc) : null
}

async function count(table: string, filter: Record<string, unknown>): Promise<number> {
  return collection(table).countDocuments(filter as never)
}

/** System-generated notification (bypasses RLS — SECURITY DEFINER equivalent). */
export async function notifyUser(
  profileId: string,
  title: string,
  body: string,
  type: string,
  link?: string,
  metadata?: Record<string, unknown>,
): Promise<Doc> {
  const notif: Doc = {
    id: uuid(),
    profile_id: profileId,
    title,
    body,
    type,
    is_read: false,
    metadata: metadata ?? {},
    created_at: nowIso(),
  }
  if (link) notif.link = link
  await collection('notifications').insertOne(notif as never)
  emitNotification(profileId, notif)
  return notif
}

async function notifyRoles(
  roles: string[],
  title: string,
  body: string,
  type: string,
  link?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const targets = await find('profiles', { role: { $in: roles }, status: 'active', deleted_at: null })
  for (const p of targets) {
    await notifyUser(String(p.id), title, body, type, link, metadata)
  }
}

async function activityLog(
  user_id: string | null | undefined,
  action: string,
  entity_type: string,
  entity_id: string,
  description: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await collection('activity_logs').insertOne({
    id: uuid(),
    user_id,
    action,
    entity_type,
    entity_id,
    description,
    metadata,
    created_at: nowIso(),
  } as never)
}

// ---------------------------------------------------------------------------
// BEFORE INSERT validations (mirror CHECK constraints + BEFORE triggers)
// ---------------------------------------------------------------------------

const MEDIA_TYPES = new Set(['text', 'voice', 'image', 'video'])
const NORMAL_STATUSES = new Set(['present', 'absent', 'late', 'leave', 'excused', 'permission'])

export async function validateInsert(
  table: string,
  row: Doc,
  ctx: RequestContext,
): Promise<void> {
  switch (table) {
    case 'chat_posts': {
      if (row.media_type && !MEDIA_TYPES.has(String(row.media_type))) throw badValue('media_type')
      const hasMedia = !!row.media_url && String(row.media_url) !== ''
      const body = row.body == null ? '' : String(row.body).trim()
      if (!hasMedia && body.length === 0) throw new ApiError(400, 'Post body cannot be empty', '23514')
      break
    }
    case 'chat_post_comments': {
      if (row.parent_id != null) {
        const parent = await findOne('chat_post_comments', { id: String(row.parent_id) })
        if (!parent || parent.post_id !== row.post_id || parent.is_deleted === true) {
          throw new ApiError(400, 'invalid comment parent (must be on the same post and not deleted)')
        }
      }
      const body = row.body == null ? '' : String(row.body).trim()
      if (body.length === 0) throw new ApiError(400, 'Comment body cannot be empty', '23514')
      break
    }
    case 'chat_messages': {
      if (row.media_type && !MEDIA_TYPES.has(String(row.media_type))) throw badValue('media_type')
      const hasMedia = !!row.media_url && String(row.media_url) !== ''
      const body = row.body == null ? '' : String(row.body).trim()
      if (!hasMedia && body.length === 0) throw new ApiError(400, 'Message body cannot be empty', '23514')
      break
    }
    case 'chat_post_reactions': {
      break
    }
    case 'chat_participants': {
      const conv = await findOne('chat_conversations', { id: String(row.conversation_id) })
      if (!conv) throw new ApiError(400, 'Conversation not found', '23503')
      if (!conv.is_group && conv.created_by && conv.created_by !== row.profile_id) {
        const creatorRole = (await findOne('profiles', { id: String(conv.created_by) }))?.role
        const participantRole = (await findOne('profiles', { id: String(row.profile_id) }))?.role
        if (creatorRole === 'student' && participantRole === 'student') {
          const mutual = await findOne('follows', {
            follower_id: conv.created_by,
            following_id: row.profile_id,
          }) && await findOne('follows', {
            follower_id: row.profile_id,
            following_id: conv.created_by,
          })
          if (!mutual) throw new ApiError(400, 'You can only message people who follow you back. Follow each other first.')
        }
      }
      break
    }
    case 'follows': {
      if (row.follower_id === row.following_id) {
        throw new ApiError(400, 'You cannot follow yourself', '23514')
      }
      break
    }
    case 'calls': {
      if (row.caller_id === row.callee_id) throw new ApiError(400, 'caller and callee must differ', '23514')
      const STATUSES = new Set(['ringing', 'active', 'ended', 'missed', 'declined'])
      if (row.status && !STATUSES.has(String(row.status))) throw badValue('status')
      break
    }
    case 'finance_records': {
      const month = Number(row.month)
      const year = Number(row.year)
      if (!Number.isInteger(month) || month < 1 || month > 12) throw badValue('month')
      if (!Number.isInteger(year) || year < 2020 || year > 2100) throw badValue('year')
      break
    }
    case 'teacher_leave': {
      if (row.end_date != null && row.start_date != null && String(row.end_date) < String(row.start_date)) {
        throw new ApiError(400, 'end date must be on or after start date', '23514')
      }
      break
    }
    case 'result_approvals': {
      const ACTIONS = new Set(['approve', 'reject', 'publish'])
      if (row.action && !ACTIONS.has(String(row.action))) throw badValue('action')
      break
    }
    case 'practice_students': {
      if (!['somali_speaking', 'english_speaking'].includes(String(row.practice_type))) throw badValue('practice_type')
      if (!['somali', 'english'].includes(String(row.language))) throw badValue('language')
      if (row.status && !['draft', 'submitted'].includes(String(row.status))) throw badValue('status')
      break
    }
    case 'outside_activity_attendance': {
      row.updated_at = nowIso()
      row.updated_by = ctx.userId
      if (row.edit_count == null) row.edit_count = 0
      break
    }
    case 'notifications': {
      row.is_read = row.is_read ?? false
      row.created_at = nowIso()
      break
    }
    case 'quiz_answers': {
      break
    }
    default:
      break
  }
}

function badValue(col: string): ApiError {
  return new ApiError(400, `invalid value for ${col}`, '22P02')
}

/** BEFORE UPDATE stamps (updated_at bumpers + outside_activity_attendance audit). */
export async function validateUpdate(
  table: string,
  oldRow: Doc,
  newRow: Doc,
  ctx: RequestContext,
): Promise<void> {
  if (table === 'outside_activity_attendance') {
    newRow.updated_at = nowIso()
    newRow.updated_by = ctx.userId
    newRow.edit_count = (Number(oldRow.edit_count ?? 0) || 0) + 1
  }
}

// ---------------------------------------------------------------------------
// AFTER triggers
// ---------------------------------------------------------------------------

export async function afterInsert(table: string, row: Doc, ctx: RequestContext): Promise<void> {
  const id = String(row.id)

  if (REALTIME_TABLES.has(table)) emit(`table:${table}`, 'insert', row)

  switch (table) {
    case 'follows': {
      await bumpProfileCount(String(row.following_id), 'followers_count', +1)
      await bumpProfileCount(String(row.follower_id), 'following_count', +1)
      emitToUser(String(row.following_id), 'new_follower', {
        follower_id: row.follower_id,
        following_id: row.following_id,
        created_at: row.created_at ?? nowIso(),
      })
      break
    }
    case 'chat_post_comments': {
      await collection('chat_posts').updateOne(
        { id: String(row.post_id) },
        { $inc: { comments_count: 1 } },
      )
      emit('feed', 'comment', row)
      break
    }
    case 'chat_post_reactions': {
      await collection('chat_posts').updateOne({ id: String(row.post_id) }, { $inc: { likes_count: 1 } })
      emit('feed', 'reaction', row)
      break
    }
    case 'chat_messages': {
      emitToConv(String(row.conversation_id), 'message', row)
      break
    }
    case 'chat_participants': {
      emitToConv(String(row.conversation_id), 'participant_added', row)
      emitToUser(String(row.profile_id), 'conversation', { conversation_id: row.conversation_id })
      break
    }
    case 'chat_conversations': {
      emitToUser(String(row.created_by), 'conversation_created', row)
      break
    }
    case 'notifications': {
      emitNotification(String(row.profile_id), row)
      break
    }
    case 'teacher_leave': {
      if (row.status === 'pending' && row.teacher_id) {
        const t = await findOne('teachers', { id: String(row.teacher_id) })
        const profile = t ? await findOne('profiles', { id: String(t.profile_id) }) : null
        const name = profile?.full_name ? String(profile.full_name) : 'A teacher'
        await notifyRoles(
          ['school_manager'],
          'Teacher Leave Request',
          `${name} requested leave`,
          'leave',
          '/manager/teacher-leave',
          { leave_id: id },
        )
      }
      break
    }
    case 'password_reset_requests': {
      await notifyRoles(
        ['school_manager'],
        'Password Reset Request',
        `User ID ${String(row.login_id ?? '')} requested a password reset.`,
        'system',
        '/manager/students',
      )
      break
    }
    case 'finance_records': {
      await financeNotify(row)
      break
    }
    case 'lesson_monitoring': {
      await lessonMonitoringNotify(row)
      break
    }
    case 'attendance': {
      await attendanceNotify(row)
      break
    }
    case 'practice_students': {
      await practiceActivity(ctx, 'insert', row)
      await practiceNotify(row, row.status === 'submitted')
      break
    }
    case 'result_submissions': {
      if (row.status === 'published') await resultPublishNotify(row)
      break
    }
    case 'chat_posts': {
      emit('feed', 'post', row)
      break
    }
    case 'calls': {
      emitToUser(String(row.callee_id), 'call', row)
      emit('presence', 'call', row)
      break
    }
    default:
      break
  }
}

export async function afterUpdate(
  table: string,
  oldRow: Doc,
  newRow: Doc,
  ctx: RequestContext,
): Promise<void> {
  const id = String(newRow.id)

  if (REALTIME_TABLES.has(table)) emit(`table:${table}`, 'update', newRow)

  switch (table) {
    case 'lessons': {
      if (newRow.is_published === true && oldRow.is_published !== true) {
        await classStudentNotify(
          String(newRow.class_id),
          'New Lesson Published',
          String(newRow.title ?? ''),
          'lesson',
          `/student/lessons/${id}`,
        )
      }
      emit('feed', 'lesson', newRow)
      break
    }
    case 'quizzes': {
      if (newRow.is_published === true && oldRow.is_published !== true) {
        await classStudentNotify(
          String(newRow.class_id),
          'New Quiz Available',
          String(newRow.title ?? ''),
          'quiz',
          `/student/quizzes/${id}`,
        )
      }
      break
    }
    case 'result_submissions': {
      if (newRow.status === 'published' && oldRow.status !== 'published') await resultPublishNotify(newRow)
      break
    }
    case 'teacher_leave': {
      if (oldRow.status === 'pending' && ['approved', 'rejected'].includes(String(newRow.status))) {
        const t = await findOne('teachers', { id: String(newRow.teacher_id) })
        if (t) {
          await notifyUser(
            String(t.profile_id),
            `Leave Request ${String(newRow.status).replace(/^./, (c) => c.toUpperCase())}`,
            `Your leave request was ${String(newRow.status)}`,
            'leave',
            '/teacher/leave',
          )
        }
      }
      break
    }
    case 'practice_students': {
      await practiceActivity(ctx, 'update', { ...oldRow, ...newRow })
      if (newRow.status === 'submitted' && oldRow.status !== 'submitted') await practiceNotify(newRow, true)
      break
    }
    case 'finance_records': {
      await financeNotify(newRow)
      break
    }
    case 'lesson_monitoring': {
      await lessonMonitoringNotify(newRow)
      break
    }
    case 'attendance': {
      await attendanceNotify(newRow)
      break
    }
    case 'chat_messages': {
      emitToConv(String(newRow.conversation_id), 'message_updated', newRow)
      break
    }
    case 'notifications': {
      emitNotification(String(newRow.profile_id), newRow)
      break
    }
    case 'chat_posts': {
      emit('feed', 'post', newRow)
      break
    }
    case 'calls': {
      emitToUser(String(newRow.callee_id), 'call', newRow)
      emitToUser(String(newRow.caller_id), 'call', newRow)
      break
    }
    default:
      break
  }
}

export async function afterDelete(table: string, row: Doc, ctx: RequestContext): Promise<void> {
  if (REALTIME_TABLES.has(table)) emit(`table:${table}`, 'delete', { id: row.id })

  switch (table) {
    case 'follows': {
      await bumpProfileCount(String(row.following_id), 'followers_count', -1)
      await bumpProfileCount(String(row.follower_id), 'following_count', -1)
      break
    }
    case 'chat_post_comments': {
      await collection('chat_posts').updateOne(
        { id: String(row.post_id) },
        { $inc: { comments_count: -1 } },
      )
      emit('feed', 'comment_deleted', { id: row.id, post_id: row.post_id })
      break
    }
    case 'chat_post_reactions': {
      await collection('chat_posts').updateOne({ id: String(row.post_id) }, { $inc: { likes_count: -1 } })
      emit('feed', 'reaction_deleted', { id: row.id, post_id: row.post_id })
      break
    }
    case 'chat_participants': {
      emitToConv(String(row.conversation_id), 'participant_removed', row)
      break
    }
    case 'chat_messages': {
      emitToConv(String(row.conversation_id), 'message_deleted', { id: row.id })
      break
    }
    default:
      break
  }
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

async function bumpProfileCount(profileId: string, field: string, delta: number): Promise<void> {
  if (!profileId) return
  await collection('profiles').updateOne(
    { id: profileId },
    { $set: { updated_at: nowIso() }, $inc: { [field]: delta } },
  )
  const updated = await findOne('profiles', { id: profileId })
  if (updated) emit(`table:profiles`, 'update', updated)
}

async function classStudentNotify(
  classId: string,
  title: string,
  body: string,
  type: string,
  link: string,
): Promise<void> {
  const students = await find('students', { class_id: classId })
  for (const s of students) {
    if (s.profile_id) await notifyUser(String(s.profile_id), title, body, type, link)
  }
}

async function resultPublishNotify(row: Doc): Promise<void> {
  const results = await find('results', { submission_id: String(row.id) })
  const students = await find('students', {
    id: { $in: results.map((r) => String(r.student_id)).filter(Boolean) },
  })
  for (const s of students) {
    if (s.profile_id) await notifyUser(String(s.profile_id), 'Official Result Published', String(row.title ?? ''), 'result', '/student/results')
  }
}

async function financeNotify(row: Doc): Promise<void> {
  const cls = await findOne('classes', { id: String(row.class_id) })
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const month = Number(row.month)
  const className = cls?.name ? String(cls.name) : 'Class'
  const monthName = Number.isInteger(month) && month >= 1 && month <= 12 ? monthNames[month - 1] : String(month)
  const title = `${className} — ${monthName} ${String(row.year ?? '')}`
  const status = String(row.status ?? 'unpaid')
  await notifyRoles(
    ['finance_manager'],
    title,
    `Status updated to ${status} by a manager.`,
    'finance',
    '/finance-manager/reports',
  )
}

async function lessonMonitoringNotify(row: Doc): Promise<void> {
  const stu = await findOne('students', { id: String(row.student_id) })
  const profile = stu?.profile_id ? await findOne('profiles', { id: String(stu.profile_id) }) : null
  const label = `${String(stu?.student_id ?? '?')} — ${String(profile?.full_name ?? '')}`.trim()
  const status = String(row.status ?? 'present')
  const map: Record<string, { en: string; so: string }> = {
    present: { en: ' wuxuu Kabaxay casharkii.', so: ' wuxuu Kabaxay casharkii.' },
    absent: { en: ' kama bixin casharkii.', so: ' kama bixin casharkii.' },
    kabaxay: { en: ' wuxuu Kabaxay casharkii.', so: ' wuxuu Kabaxay casharkii.' },
    kama_bixin: { en: ' kama bixin casharkii.', so: ' kama bixin casharkii.' },
    late: { en: ' arrived late to the lesson.', so: ' wuxuu ku daahay casharkii.' },
    leave: { en: ' was on leave for the lesson.', so: ' fasax buu u ahaa casharkii.' },
    excused: { en: ' was excused from the lesson.', so: ' cudurdaar buu lahaa casharkii.' },
    permission: { en: ' was on permission for the lesson.', so: ' ruqsad buu u ahaa casharkii.' },
  }
  const m = map[status] ?? { en: ' has a lesson monitoring update.', so: ' waa la cusboonaysiiyay.' }
  const bodyEn = `${label}${m.en}`
  const bodySo = `${label}${m.so}`

  await notifyRoles(['school_manager'], 'Lesson Monitoring', bodyEn, 'lesson', '/manager/lesson-monitoring')
  await notifyRoles(['supervisor'], 'Lesson Monitoring', bodyEn, 'lesson', '/supervisor/lesson-monitoring')
  await notifyRoles(['teacher_cabaas'], 'Lesson Monitoring', bodyEn, 'lesson', '/cabaas/lesson-monitoring')

  const links = await find('student_parents', { student_id: String(row.student_id) })
  for (const link of links) {
    if (link.parent_id) await notifyUser(String(link.parent_id), 'Kormeerka Casharka', bodySo, 'lesson', '/parent/lesson-monitoring')
  }
}

async function attendanceNotify(row: Doc): Promise<void> {
  const attendanceDate = String(row.attendance_date ?? '')
  const classId = String(row.class_id ?? '')
  const teacherId = String(row.teacher_id ?? '')
  const marker = `${classId}|${attendanceDate}`
  const teacher = await findOne('teachers', { id: teacherId })
  const teacherProfile = teacher?.profile_id ? await findOne('profiles', { id: String(teacher.profile_id) }) : null
  const teacherName = teacherProfile?.full_name ? String(teacherProfile.full_name) : 'A teacher'
  const cls = await findOne('classes', { id: classId })
  const className = cls?.name ? String(cls.name) : 'the class'
  const status = String(row.status ?? '')
  const body = `${teacherName} marked ${className} attendance as ${status} for ${attendanceDate}.`
  const targets = await find('profiles', { role: 'supervisor', status: 'active', deleted_at: null })
  for (const p of targets) {
    // One notification per class+date save, not one per student row.
    const already = await findOne('notifications', {
      profile_id: String(p.id),
      type: 'attendance',
      'metadata.marker': marker,
    })
    if (already) continue
    await notifyUser(
      String(p.id),
      'Attendance Saved',
      body,
      'attendance',
      '/supervisor/attendance-report',
      { marker, class_id: classId, attendance_date: attendanceDate },
    )
  }
}

async function practiceNotify(row: Doc, submitted: boolean): Promise<void> {
  const creator = await findOne('profiles', { id: String(row.created_by) })
  const name = creator?.full_name ? String(creator.full_name) : 'A practice teacher'
  const languageLabel = row.language === 'somali' ? 'Somali Speaking' : 'English Speaking'
  const body = `${name} ${submitted ? 'submitted' : 'saved'} a ${languageLabel} ${submitted ? 'report' : 'record'} for ${String(row.student_name ?? '')}.`
  await notifyRoles(
    ['supervisor'],
    submitted ? 'New Practice Submission' : 'New Practice Record',
    body,
    'practice',
    '/supervisor/reports',
    {
      practice_student_id: row.id,
      submitted_by: row.created_by,
      student_name: row.student_name,
      practice_type: row.practice_type,
    },
  )
}

async function practiceActivity(ctx: RequestContext, op: 'insert' | 'update', row: Doc): Promise<void> {
  const actor = ctx.userId ?? (row.updated_by ? String(row.updated_by) : row.created_by ? String(row.created_by) : null)
  if (op === 'insert') {
    await activityLog(
      actor,
      'created',
      'practice_student',
      String(row.id),
      `Created ${String(row.practice_type ?? '')} record for ${String(row.student_name ?? '')}`,
      { student_name: row.student_name, practice_type: row.practice_type, status: row.status },
    )
    return
  }
  const submitted = row.status === 'submitted'
  await activityLog(
    actor,
    submitted ? 'submitted' : 'updated',
    'practice_student',
    String(row.id),
    submitted
      ? `Submitted ${String(row.practice_type ?? '')} report for ${String(row.student_name ?? '')}`
      : `Updated ${String(row.practice_type ?? '')} record for ${String(row.student_name ?? '')}`,
    { student_name: row.student_name, practice_type: row.practice_type, status: row.status },
  )
}