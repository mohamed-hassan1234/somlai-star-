import { TABLES } from './db.ts'

export interface ResolvedEmbed {
  type: 'toOne' | 'toMany'
  /** toOne: source[sourceCol] === target.id ; toMany: target[targetCol] === source.id */
  sourceCol?: string
  targetCol?: string
  inner: boolean
}

type Rel = Omit<ResolvedEmbed, 'inner'>

/** Alias -> foreign-key column on the source row (to-one joins). */
const ALIAS_COLUMNS: Record<string, string> = {
  profile: 'profile_id',
  class: 'class_id',
  subject: 'subject_id',
  teacher: 'teacher_id',
  student: 'student_id',
  academic_year: 'academic_year_id',
  author: 'author_id',
  sender: 'sender_id',
  publisher: 'published_by',
  creator: 'created_by',
  recorder: 'recorded_by',
  user: 'user_id',
  activity: 'activity_id',
  committee: 'committee_id',
  quiz: 'quiz_id',
  question: 'question_id',
  submission: 'submission_id',
  conversation: 'conversation_id',
  parent: 'parent_id',
  actor: 'actor_id',
}

/** Computed to-many aliases (reverse direction): source table -> target column. */
const REVERSE_TO_MANY: Record<string, string> = {
  'lessons|files': 'lesson_id',
  'profiles|children': 'parent_id',
  'quiz_questions|options': 'question_id',
  'quizzes|questions': 'quiz_id',
  'result_submissions|results': 'submission_id',
  'result_submissions|approvals': 'submission_id',
  'outside_activity_committees|members': 'committee_id',
  'outside_activity_committees|classes': 'committee_id',
  'outside_activities|attendance': 'activity_id',
}

/** FK-constraint-name hints, e.g. `profile:profiles!students_profile_id_fkey(*)`. */
const FK_HINT_MAP: Record<string, (source: string) => Rel | null> = {
  students_profile_id_fkey: (s) =>
    s === 'students' ? { type: 'toOne', sourceCol: 'profile_id' } : { type: 'toMany', targetCol: 'profile_id' },
  follows_following_id_fkey: (s) =>
    s === 'follows' ? { type: 'toOne', sourceCol: 'following_id' } : { type: 'toMany', targetCol: 'following_id' },
  follows_follower_id_fkey: (s) =>
    s === 'follows' ? { type: 'toOne', sourceCol: 'follower_id' } : { type: 'toMany', targetCol: 'follower_id' },
  student_parents_parent_id_fkey: (s) =>
    s === 'profiles' ? { type: 'toMany', targetCol: 'parent_id' } : { type: 'toOne', sourceCol: 'parent_id' },
  outside_activities_created_by_fkey: () => ({ type: 'toOne', sourceCol: 'created_by' }),
  backups_created_by_fkey: () => ({ type: 'toOne', sourceCol: 'created_by' }),
  backup_logs_actor_id_fkey: () => ({ type: 'toOne', sourceCol: 'actor_id' }),
  audit_logs_actor_id_fkey: () => ({ type: 'toOne', sourceCol: 'actor_id' }),
}

/**
 * Resolve an embedded relation for a source table.
 *
 * Supports the embed syntaxes used across the frontend:
 *   - `alias:table.hint(select)` with `!inner`, `!colName` or `!fk_constraint` hints
 *   - `alias:colName(...)` shorthand where `colName` is a source column -> profiles
 *   - computed to-many aliases (files, children, options, results, approvals, ...)
 */
export function resolveEmbed(
  sourceTable: string,
  alias: string,
  rawTarget: string,
  hints: string[],
): ResolvedEmbed | null {
  const inner = hints.includes('inner')

  // Sometimes the "target" position holds a source column name (e.g. sender:sender_user_id(...)).
  // A table would normally be required here; normalize to a column-hint join against
  // profiles (the only FK target for id/full_name/login_id/role lookups by these aliases).
  const knownTarget = rawTarget in TABLES
  if (!knownTarget) {
    return { type: 'toOne', sourceCol: rawTarget, inner }
  }

  const fkHint = hints.find((h) => h !== 'inner')

  // 1. Named FK-constraint hint (most precise).
  if (fkHint) {
    const mapped = FK_HINT_MAP[fkHint]
    if (mapped) {
      const rel = mapped(sourceTable)
      if (rel) return { ...rel, inner }
    }
    // Plain column hint on the source row (`!published_by`, `!created_by`, ...).
    return { type: 'toOne', sourceCol: fkHint, inner }
  }

  // 2. Computed reverse to-many aliases.
  const reverse = REVERSE_TO_MANY[`${sourceTable}|${alias}`]
  if (reverse) return { type: 'toMany', targetCol: reverse, inner }

  // 3. Alias -> FK column on the source (to-one).
  const col = ALIAS_COLUMNS[alias]
  if (col) return { type: 'toOne', sourceCol: col, inner }

  return null
}
