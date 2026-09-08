import { TABLES } from './db.ts'

/** Tables that carry a `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` column. */
const CREATED_AT_TABLES = new Set<string>([
  'profiles', 'academic_years', 'classes', 'subjects', 'students', 'teachers',
  'lessons', 'lesson_files', 'teacher_attendance', 'teacher_leave', 'quizzes',
  'quiz_questions', 'quiz_attempts', 'result_submissions', 'results',
  'result_approvals', 'exam_schedules', 'notices', 'finance_records',
  'outside_activity_committees', 'outside_activity_attendance', 'follows',
  'chat_conversations', 'chat_messages', 'ai_conversations', 'ai_messages',
  'notifications', 'audit_logs', 'password_reset_requests', 'student_parents',
  'student_behavior', 'chat_posts', 'chat_post_comments', 'chat_post_reactions',
  'calls', 'outside_activities', 'practice_students', 'activity_logs',
  'lesson_monitoring', 'backups', 'backup_logs', 'import_jobs',
])

/** Tables that carry a `updated_at` column (bumped on UPDATE via trigger). */
const UPDATED_AT_TABLES = new Set<string>([
  'profiles', 'academic_years', 'classes', 'students', 'teachers', 'lessons',
  'attendance', 'teacher_leave', 'quizzes', 'result_submissions', 'exam_schedules',
  'finance_records', 'chat_conversations', 'ai_conversations', 'chat_posts',
  'chat_post_comments', 'outside_activities', 'outside_activity_attendance',
  'practice_students', 'app_settings', 'backup_logs', 'import_jobs',
])

/** Tables using `assigned_at`/`joined_at`/`started_at` style defaults instead of created_at. */
const CUSTOM_TIMESTAMP_TABLES: Record<string, string> = {
  teacher_classes: 'assigned_at',
  teacher_subjects: 'assigned_at',
  committee_member_classes: 'assigned_at',
  chat_participants: 'joined_at',
  quiz_attempts: 'started_at',
  attendance: 'recorded_at',
  teacher_attendance: 'created_at',
}

/**
 * Column defaults applied on INSERT when the payload omits them
 * (applies defaults from the application schema).
 */
const INSERT_DEFAULTS: Record<string, Record<string, unknown>> = {
  profiles: { status: 'active', permissions: {}, must_change_password: false, followers_count: 0, following_count: 0 },
  students: { password_set: true, registration_date: 'CURRENT_DATE' },
  teachers: { hire_date: 'CURRENT_DATE', is_practice: false },
  lessons: { lesson_date: 'CURRENT_DATE', is_published: false },
  quizzes: { total_marks: 0, is_published: false },
  quiz_questions: { marks: 1, sort_order: 0 },
  quiz_options: { is_correct: false, sort_order: 0 },
  notices: { notice_type: 'general', is_practice: false, is_late_notice: false, is_published: true },
  finance_records: { status: 'unpaid', currency: 'USD' },
  teacher_leave: { status: 'pending' },
  result_submissions: { status: 'draft' },
  results: { max_marks: 100 },
  chat_posts: { likes_count: 0, comments_count: 0, is_deleted: false, media_type: 'text' },
  chat_post_comments: { is_deleted: false },
  chat_post_reactions: { emoji: 'heart' },
  chat_messages: { is_deleted: false, media_type: 'text' },
  notifications: { is_read: false, type: 'system', metadata: {} },
  calls: { status: 'ringing' },
  teacher_attendance: { is_auto: false },
  academic_years: { is_active: false, is_archived: false },
  classes: { capacity: 40, is_active: true },
  subjects: { is_active: true },
  outside_activities: { is_cancelled: false },
  practice_students: { status: 'draft' },
  ai_messages: { metadata: {} },
  outside_activity_attendance: { edit_count: 0 },
  ai_conversations: { tool_type: 'chat' },
  lessons_hidden: {},
}

/** Column defaults that resolve to "today" at insert time. */
const DATE_DEFAULT_COLUMNS = new Set<string>(['registration_date', 'hire_date', 'lesson_date'])

export function applyInsertDefaults(table: string, row: Record<string, unknown>): void {
  if (row.id === undefined || row.id === null) row.id = crypto.randomUUID()

  const defaults = INSERT_DEFAULTS[table]
  if (defaults) {
    for (const [k, v] of Object.entries(defaults)) {
      if (v === 'CURRENT_DATE' && DATE_DEFAULT_COLUMNS.has(k)) {
        if (row[k] === undefined || row[k] === null || row[k] === '') row[k] = new Date().toISOString().slice(0, 10)
        continue
      }
      if (row[k] === undefined || row[k] === null) row[k] = v
    }
  }

  const customTs = CUSTOM_TIMESTAMP_TABLES[table]
  if (customTs && row[customTs] === undefined) row[customTs] = new Date().toISOString()

  if (CREATED_AT_TABLES.has(table) && row.created_at === undefined) row.created_at = new Date().toISOString()
  if (UPDATED_AT_TABLES.has(table) && row.updated_at === undefined) row.updated_at = new Date().toISOString()
}

export function touchUpdatedAt(table: string, row: Record<string, unknown>, force = false): void {
  if (UPDATED_AT_TABLES.has(table)) {
    row.updated_at = new Date().toISOString()
  } else if (force && row.updated_at !== undefined) {
    row.updated_at = new Date().toISOString()
  }
}

export function hasColumn(table: string, column: string): boolean {
  // Conservative: assume yes unless it's a known custom-timestamp table lacking created_at.
  return true
}

/** Relationships that cascade when their parent is deleted. */
export const DELETE_CASCADES: Record<string, Array<[childTable: string, fkColumn: string]>> = {
  lessons: [['lesson_files', 'lesson_id']],
  quizzes: [['quiz_questions', 'quiz_id']],
  quiz_questions: [['quiz_options', 'question_id']],
  quiz_attempts: [['quiz_answers', 'attempt_id']],
  result_submissions: [
    ['results', 'submission_id'],
    ['result_approvals', 'submission_id'],
  ],
  chat_posts: [
    ['chat_post_comments', 'post_id'],
    ['chat_post_reactions', 'post_id'],
  ],
  chat_conversations: [
    ['chat_participants', 'conversation_id'],
    ['chat_messages', 'conversation_id'],
  ],
  chat_post_comments: [['chat_post_comments', 'parent_id']],
  ai_conversations: [['ai_messages', 'conversation_id']],
  outside_activity_committees: [
    ['committee_members', 'committee_id'],
    ['committee_classes', 'committee_id'],
    ['outside_activity_attendance', 'committee_id'],
  ],
  committee_members: [['committee_member_classes', 'committee_member_id']],
  outside_activities: [['outside_activity_attendance', 'activity_id']],
  profiles: [
    ['students', 'profile_id'],
    ['teachers', 'profile_id'],
    ['chat_posts', 'author_id'],
    ['chat_post_comments', 'author_id'],
    ['chat_post_reactions', 'user_id'],
    ['chat_participants', 'profile_id'],
    ['chat_messages', 'sender_id'],
    ['notifications', 'profile_id'],
    ['student_parents', 'parent_id'],
    ['calls', 'caller_id'],
    ['calls', 'callee_id'],
    ['ai_conversations', 'profile_id'],
    ['follows', 'follower_id'],
    ['follows', 'following_id'],
    ['audit_logs', 'actor_id'],
    ['result_approvals', 'reviewer_id'],
    ['password_reset_requests', 'resolved_by'],
    ['teacher_leave', 'reviewed_by'],
    ['teacher_attendance', 'recorded_by'],
    ['practice_attendance', 'recorded_by'],
    ['outside_activity_attendance', 'recorded_by'],
    ['exam_schedules', 'created_by'],
    ['outside_activity_committees', 'created_by'],
    ['outside_activities', 'created_by'],
    ['lesson_monitoring', 'recorded_by'],
    ['chat_conversations', 'created_by'],
    ['practice_students', 'created_by'],
    ['practice_students', 'updated_by'],
    ['notices', 'published_by'],
    ['backups', 'created_by'],
    ['backup_logs', 'actor_id'],
    ['import_jobs', 'created_by'],
  ],
  students: [
    ['attendance', 'student_id'],
    ['results', 'student_id'],
    ['quiz_attempts', 'student_id'],
    ['lesson_monitoring', 'student_id'],
    ['outside_activity_attendance', 'student_id'],
    ['student_parents', 'student_id'],
    ['student_behavior', 'student_id'],
    ['practice_attendance', 'student_id'],
  ],
  teachers: [
    ['teacher_classes', 'teacher_id'],
    ['teacher_subjects', 'teacher_id'],
    ['teacher_attendance', 'teacher_id'],
    ['teacher_leave', 'teacher_id'],
    ['lessons', 'teacher_id'],
    ['quizzes', 'teacher_id'],
    ['attendance', 'teacher_id'],
    ['result_submissions', 'teacher_id'],
    ['lesson_monitoring', 'teacher_id'],
  ],
}

/** Relationships cleared when their referenced record is deleted. */
export const DELETE_SET_NULL: Record<string, Array<[childTable: string, fkColumn: string]>> = {
  classes: [
    ['practice_students', 'class_id'],
    ['outside_activities', 'class_id'],
  ],
  outside_activity_committees: [['outside_activities', 'committee_id']],
  subjects: [['lessons', 'subject_id'], ['result_submissions', 'subject_id']],
}
