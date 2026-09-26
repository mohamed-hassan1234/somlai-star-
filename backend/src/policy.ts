import type { RequestContext, RowPredicate } from './security.ts'
import { STAFF_NOTIFY_ROLES } from './security.ts'
import { collection } from './db.ts'
import type { WithId, Document } from 'mongodb'

type Doc = Record<string, unknown>

async function find(table: string, filter: Record<string, unknown>): Promise<Doc[]> {
  const rows = await collection(table).find(filter as Document).toArray()
  return rows as unknown as Doc[]
}

async function findOne(table: string, filter: Record<string, unknown>): Promise<Doc | null> {
  const row = await collection(table).findOne(filter as Document)
  return row ? ({ ...(row as WithId<Document>) }) as unknown as Doc : null
}

function memo<T>(loader: () => Promise<T>): () => Promise<T> {
  let value: T | undefined
  let loaded = false
  return async () => {
    if (!loaded) {
      value = await loader()
      loaded = true
    }
    return value as T
  }
}

type Op = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
export type PolicyResult = RowPredicate | [RowPredicate, RowPredicate]
export type PolicyResolver = (ctx: RequestContext, op: Op) => PolicyResult | null
const always = (): boolean => true

/**
 * Maps every public table to a row predicate encoding its RLS rules.
 * Returns null when the caller has no access at all for the given operation.
 */
export const TABLE_POLICIES: Record<string, PolicyResolver> = {
  // ------ simplest: manager-only writes, all-authenticated reads ------
  academic_years: (ctx, op) => (op === 'SELECT' ? () => ctx.isAuthenticated() : ctx.isManager() ? always : null),
  classes: (ctx, op) => (op === 'SELECT' ? () => ctx.isAuthenticated() : ctx.isManager() ? always : null),
  subjects: (ctx, op) => (op === 'SELECT' ? () => ctx.isAuthenticated() : ctx.isManager() ? always : null),
  teacher_subjects: (ctx, op) => (op === 'SELECT' ? () => ctx.isAuthenticated() : ctx.isManager() ? always : null),
  class_subjects: (ctx, op) => (op === 'SELECT' ? () => ctx.isAuthenticated() : ctx.isManager() ? always : null),
  exam_schedules: (ctx, op) =>
    op === 'SELECT'
      ? () => ctx.isAuthenticated()
      : ctx.isManager() || ctx.roleIn(['teacher', 'teacher_cabaas'])
        ? always
        : null,
  app_settings: (ctx, op) => (op === 'DELETE' ? null : ctx.isManager() ? always : null),

  // ------ profiles ------
  profiles: (ctx, op) => {
    if (op === 'INSERT') return ctx.isManager() ? always : null
    if (op === 'UPDATE') {
      return ctx.isManager() || ctx.userId
        ? (row) => ctx.isManager() || row.id === ctx.userId || row.profile_id === ctx.userId
        : null
    }
    if (op === 'DELETE') return null
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || row.id === ctx.userId) return true
      if (ctx.isActiveSelf()) return row.status === 'active' && row.deleted_at == null
      if (ctx.isParent()) {
        const ids = await ctx.parentStudentIdsSet()
        return ids.has(String(row.id))
      }
      return false
    }
  },

  // ------ students ------
  students: (ctx, op) => {
    if (op === 'INSERT' || op === 'DELETE') return ctx.isManager() ? always : null
    if (op === 'UPDATE') {
      return ctx.isManager() || ctx.userId ? (row) => ctx.isManager() || row.profile_id === ctx.userId : null
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (row.profile_id === ctx.userId) return true
      if (ctx.isManager()) return true
      if (ctx.roleIn(['teacher_cabaas', 'supervisor', 'finance_officer', 'finance_manager', 'attendance_manager'])) return true
      if (ctx.roleIn(['teacher', 'practice_teacher']) && row.class_id && (await ctx.teacherHasClass(row.class_id as string))) return true
      if (ctx.role === 'outside_activity_committee' && row.class_id && (await ctx.committeeHasClass(row.class_id as string))) return true
      if (ctx.isParent()) {
        const ids = await ctx.parentStudentIdsSet()
        return ids.has(String(row.id))
      }
      return false
    }
  },

  // ------ teachers (directory: everyone can read) ------
  teachers: (ctx, op) => op === 'SELECT' ? () => ctx.isActiveSelf() : ctx.isManager() ? always : null,
  contact_messages: (ctx) => ctx.isManager() ? always : null,

  teacher_classes: (ctx, op) => {
    if (op !== 'SELECT') return ctx.isManager() ? always : null
    if (!ctx.isAuthenticated()) return null
    const myTeacherId = memo(async () => (await ctx.teacherId()) ?? '')
    return async (row) => {
      if (ctx.isManager() || ctx.isTeacherCabaas()) return true
      const tid = await myTeacherId()
      return !!tid && row.teacher_id === tid
    }
  },

  // ------ lessons ------
  lessons: (ctx, op) => {
    const ownTeacher = memo(async () => (await ctx.teacherId()) ?? '')
    const parentClassIds = memo(async () => {
      if (!ctx.isParent()) return new Set<string>()
      const kids = await ctx.parentStudentIds()
      if (!kids.length) return new Set<string>()
      const rows = await find('students', { id: { $in: kids } })
      return new Set(rows.map((r) => String(r.class_id)).filter(Boolean))
    })
    if (op === 'INSERT' || op === 'DELETE') {
      if (ctx.isManager()) return always
      return async (row) => {
        const tid = await ownTeacher()
        return !!(tid && row.teacher_id === tid && row.class_id && (await ctx.teacherHasClass(row.class_id as string)))
      }
    }
    if (op === 'UPDATE') {
      if (ctx.isManager()) return always
      return [
        async (row: Doc) => {
          const tid = await ownTeacher()
          return !!(tid && row.teacher_id === tid)
        },
        async (row: Doc) => {
          const tid = await ownTeacher()
          return !!(tid && row.teacher_id === tid && row.class_id && (await ctx.teacherHasClass(row.class_id as string)))
        },
      ]
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager()) return true
      const tid = await ownTeacher()
      if (tid && row.teacher_id === tid) return true
      if (row.is_published && row.deleted_at == null) {
        if (ctx.role === 'student') {
          const myClass = await ctx.studentClassId()
          if (myClass && row.class_id === myClass) return true
        }
        if (ctx.isParent()) {
          const pc = await parentClassIds()
          if (pc.has(String(row.class_id))) return true
        }
      }
      return false
    }
  },

  // ------ lesson_files (depends on parent lesson) ------
  lesson_files: (ctx, op) => {
    const lessonsMap = memo(async () => {
      const rows = await find('lessons', {})
      return new Map(rows.map((r) => [String(r.id), r] as const))
    })
    if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') {
      if (ctx.isManager()) return always
      return async (row) => {
        const lesson = (await lessonsMap()).get(String(row.lesson_id))
        const tid = await ctx.teacherId()
        return !!(lesson && tid && lesson.teacher_id === tid)
      }
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      const lesson = (await lessonsMap()).get(String(row.lesson_id))
      if (!lesson) return false
      if (ctx.isManager()) return true
      const tid = await ctx.teacherId()
      if (tid && lesson.teacher_id === tid) return true
      if (lesson.is_published && lesson.deleted_at == null) {
        if (ctx.role === 'student') {
          const myClass = await ctx.studentClassId()
          return !!(myClass && lesson.class_id === myClass)
        }
        if (ctx.isParent()) {
          const kids = await ctx.parentStudentIds()
          const rows = await find('students', { id: { $in: kids } })
          return rows.some((s) => s.class_id === lesson.class_id)
        }
      }
      return false
    }
  },

  // ------ attendance ------
  attendance: (ctx, op) => {
    const ownTeacher = memo(async () => (await ctx.teacherId()) ?? '')
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    if (op === 'INSERT') {
      if (ctx.isManager() || ctx.roleIn(['attendance_manager'])) return always
      return async (row) => {
        const tid = await ownTeacher()
        return !!(tid && row.teacher_id === tid && row.class_id && (await ctx.teacherHasClass(row.class_id as string)))
      }
    }
    if (op === 'UPDATE') {
      if (ctx.isManager() || ctx.roleIn(['attendance_manager'])) return always
      return async (row) => {
        const tid = await ownTeacher()
        return !!(tid && row.teacher_id === tid && row.class_id && (await ctx.teacherHasClass(row.class_id as string)))
      }
    }
    if (op === 'DELETE') return null
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager()) return true
      if (ctx.isTeacherCabaas() || ctx.isSupervisor() || ctx.roleIn(['attendance_manager'])) return true
      const tid = await ownTeacher()
      if (tid && row.teacher_id === tid) return true
      const sid = await ownStudent()
      if (sid && row.student_id === sid) return true
      if (ctx.isParent()) {
        const ids = await ctx.parentStudentIdsSet()
        return ids.has(String(row.student_id))
      }
      return false
    }
  },

  // ------ teacher_attendance ------
  teacher_attendance: (ctx, op) => {
    const ownTeacher = memo(async () => (await ctx.teacherId()) ?? '')
    if (op === 'SELECT') {
      if (!ctx.isAuthenticated()) return null
      return async (row) => {
        if (ctx.isManager() || ctx.isTeacherCabaas() || ctx.roleIn(['attendance_manager', 'supervisor'])) return true
        return (await ownTeacher()) === row.teacher_id
      }
    }
    return ctx.isManager() || ctx.isTeacherCabaas() || ctx.roleIn(['attendance_manager']) ? always : null
  },

  // ------ teacher_leave ------
  teacher_leave: (ctx, op) => {
    const ownTeacher = memo(async () => (await ctx.teacherId()) ?? '')
    if (op === 'DELETE') return null
    if (op === 'INSERT') return async (row) => (await ownTeacher()) === row.teacher_id
    if (op === 'UPDATE') {
      if (ctx.isManager()) return always
      return [
        async (row: Doc) => (await ownTeacher()) === row.teacher_id && row.status === 'pending',
        async (row: Doc) => (await ownTeacher()) === row.teacher_id,
      ]
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager()) return true
      return (await ownTeacher()) === row.teacher_id
    }
  },

  // ------ quizzes ------
  quizzes: (ctx, op) => {
    const ownTeacher = memo(async () => (await ctx.teacherId()) ?? '')
    const canWrite = async (row: Doc) => {
      const tid = await ownTeacher()
      return !!(tid && row.teacher_id === tid && row.class_id && (await ctx.teacherHasClass(row.class_id as string)))
    }
    if (op === 'INSERT') return ctx.isManager() ? always : canWrite
    if (op === 'UPDATE') return ctx.isManager() ? always : canWrite
    if (op === 'DELETE') return ctx.isManager() ? always : canWrite
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager()) return true
      const tid = await ownTeacher()
      if (tid && row.teacher_id === tid) return true
      if (ctx.role === 'student' && row.is_published && row.deleted_at == null) {
        const myClass = await ctx.studentClassId()
        return !!(myClass && row.class_id === myClass)
      }
      return false
    }
  },

  // ------ quiz_questions ------
  quiz_questions: (ctx, op) => {
    const quizzesMap = memo(async () => {
      const rows = await find('quizzes', {})
      return new Map(rows.map((r) => [String(r.id), r] as const))
    })
    if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') {
      if (ctx.isManager()) return always
      return async (row) => {
        const quiz = (await quizzesMap()).get(String(row.quiz_id))
        const tid = await ctx.teacherId()
        return !!(quiz && tid && quiz.teacher_id === tid)
      }
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      const quiz = (await quizzesMap()).get(String(row.quiz_id))
      if (!quiz) return false
      if (ctx.isManager()) return true
      const tid = await ctx.teacherId()
      if (tid && quiz.teacher_id === tid) return true
      if (ctx.role === 'student' && quiz.is_published && quiz.deleted_at == null) {
        const myClass = await ctx.studentClassId()
        return !!(myClass && quiz.class_id === myClass)
      }
      return false
    }
  },

  // ------ quiz_options ------
  quiz_options: (ctx, op) => {
    const loader = memo(async () => {
      const questions = await find('quiz_questions', {})
      const quizzes = await find('quizzes', {})
      const quizMap = new Map(quizzes.map((q) => [String(q.id), q] as const))
      const qByOption = new Map<string, Doc>()
      for (const question of questions) {
        qByOption.set(String(question.id), question)
      }
      return { quizMap, qByOption }
    })
    const quizOfOption = async (questionId: unknown) => {
      const { quizMap, qByOption } = await loader()
      const q = qByOption.get(String(questionId))
      return q ? quizMap.get(String(q.quiz_id)) ?? null : null
    }
    if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') {
      if (ctx.isManager()) return always
      return async (row) => {
        const quiz = await quizOfOption(row.question_id)
        const tid = await ctx.teacherId()
        return !!(quiz && tid && quiz.teacher_id === tid)
      }
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      const quiz = await quizOfOption(row.question_id)
      if (!quiz) return false
      if (ctx.isManager()) return true
      const tid = await ctx.teacherId()
      if (tid && quiz.teacher_id === tid) return true
      if (ctx.role === 'student' && quiz.is_published && quiz.deleted_at == null) {
        const myClass = await ctx.studentClassId()
        return !!(myClass && quiz.class_id === myClass)
      }
      return false
    }
  },

  // ------ quiz_attempts / quiz_answers ------
  quiz_attempts: (ctx, op) => {
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    if (op === 'DELETE') return null
    if (op === 'INSERT') return async (row) => (await ownStudent()) === row.student_id
    if (op === 'UPDATE') return async (row) => ctx.isManager() || String(row.student_id) === (await ownStudent())
    if (!ctx.isAuthenticated()) return null
    const quizOwner = memo(async () => {
      const rows = await find('quizzes', {})
      return new Map(rows.map((r) => [String(r.id), String(r.teacher_id ?? '')] as const))
    })
    return async (row) => {
      if (ctx.isManager()) return true
      if (String(row.student_id) === (await ownStudent())) return true
      const tid = await ctx.teacherId()
      if (tid && (await quizOwner()).get(String(row.quiz_id)) === tid) return true
      return false
    }
  },

  quiz_answers: (ctx, op) => {
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') {
      return async (row) => {
        if (ctx.isManager()) return true
        const attempt = await findOne('quiz_attempts', { id: String(row.attempt_id) })
        return !!(attempt && attempt.student_id === (await ownStudent()))
      }
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager()) return true
      const attempt = await findOne('quiz_attempts', { id: String(row.attempt_id) })
      if (!attempt) return false
      if (attempt.student_id === (await ownStudent())) return true
      const tid = await ctx.teacherId()
      if (tid) {
        const quiz = await findOne('quizzes', { id: String(attempt.quiz_id) })
        if (quiz && quiz.teacher_id === tid) return true
      }
      return false
    }
  },

  // ------ result_submissions / results / result_approvals ------
  result_submissions: (ctx, op) => {
    const ownTeacher = memo(async () => (await ctx.teacherId()) ?? '')
    const parentClassIds = memo(async () => {
      const kids = await ctx.parentStudentIds()
      if (!kids.length) return new Set<string>()
      const rows = await find('students', { id: { $in: kids } })
      return new Set(rows.map((r) => String(r.class_id)).filter(Boolean))
    })
    if (op === 'DELETE') return null
    if (op === 'INSERT') {
      if (ctx.isManager()) return always
      return async (row) => {
        const tid = await ownTeacher()
        return !!(tid && row.teacher_id === tid && row.class_id && (await ctx.teacherHasClass(row.class_id as string)))
      }
    }
    if (op === 'UPDATE') {
      if (ctx.isManager() || ctx.isTeacherCabaas()) return always
      return [
        async (row: Doc) => {
          const tid = await ownTeacher()
          return !!tid && row.teacher_id === tid && (row.status === 'draft' || row.status === 'rejected')
        },
        async (row: Doc) => {
          const tid = await ownTeacher()
          return !!tid && row.teacher_id === tid
        },
      ]
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isTeacherCabaas()) return true
      const tid = await ownTeacher()
      if (tid && row.teacher_id === tid) return true
      if (row.status === 'published') {
        if (ctx.role === 'student') {
          const myClass = await ctx.studentClassId()
          if (myClass && row.class_id === myClass) return true
        }
        if (ctx.isParent()) {
          const pc = await parentClassIds()
          if (pc.has(String(row.class_id))) return true
        }
      }
      return false
    }
  },

  results: (ctx, op) => {
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    const ownTeacher = memo(async () => (await ctx.teacherId()) ?? '')
    if (op === 'INSERT' || op === 'DELETE') {
      if (ctx.isManager() || ctx.isTeacherCabaas()) return always
      return async (row) => {
        const sub = await findOne('result_submissions', { id: String(row.submission_id) })
        if (!sub) return false
        const tid = await ownTeacher()
        return !!(tid && sub.teacher_id === tid && (sub.status === 'draft' || sub.status === 'rejected'))
      }
    }
    if (op === 'UPDATE') {
      if (ctx.isManager() || ctx.isTeacherCabaas()) return always
      return [
        async (row: Doc) => {
          const sub = await findOne('result_submissions', { id: String(row.submission_id) })
          if (!sub) return false
          const tid = await ownTeacher()
          return !!(tid && sub.teacher_id === tid && (sub.status === 'draft' || sub.status === 'rejected'))
        },
        async (row: Doc) => {
          if (!row.submission_id) return false
          const sub = await findOne('result_submissions', { id: String(row.submission_id) })
          if (!sub) return false
          const tid = await ownTeacher()
          return !!(tid && sub.teacher_id === tid)
        },
      ]
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isTeacherCabaas()) return true
      if (String(row.student_id) === (await ownStudent())) return true
      const tid = await ownTeacher()
      if (tid && row.submission_id) {
        const sub = await findOne('result_submissions', { id: String(row.submission_id) })
        if (sub && sub.teacher_id === tid) return true
      }
      if (ctx.isParent()) {
        const set = await ctx.parentStudentIdsSet()
        if (set.has(String(row.student_id)) && row.submission_id) {
          const sub = await findOne('result_submissions', { id: String(row.submission_id) })
          if (sub && sub.status === 'published') return true
        }
      }
      return false
    }
  },

  result_approvals: (ctx, op) => {
    if (op === 'INSERT') return ctx.isManager() || ctx.isTeacherCabaas() ? always : null
    if (op !== 'SELECT') return null
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || ctx.isTeacherCabaas() || row.reviewer_id === ctx.userId
  },

  // ------ notices ------
  notices: (ctx, op) => {
    if (op === 'DELETE') return null
    if (op === 'INSERT') return ctx.isManager() || ctx.roleIn(['teacher', 'teacher_cabaas', 'practice_teacher']) ? always : null
    if (op === 'UPDATE') return ctx.isManager() || ctx.userId ? (row) => ctx.isManager() || row.published_by === ctx.userId : null
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || row.is_published === true || row.published_by === ctx.userId
  },

  // ------ finance_records ------
  finance_records: (ctx, op) => {
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    if (op === 'DELETE') return ctx.isManager() ? always : null
    if (op === 'INSERT' || op === 'UPDATE') return ctx.isManager() || ctx.roleIn(['finance_officer']) ? always : null
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.roleIn(['finance_officer', 'finance_manager'])) return true
      if (String(row.student_id) === (await ownStudent())) return true
      if (ctx.isParent()) {
        const set = await ctx.parentStudentIdsSet()
        return set.has(String(row.student_id))
      }
      return false
    }
  },

  // ------ outside activities ------
  outside_activity_committees: (ctx, op) => {
    if (op !== 'SELECT') return ctx.isManager() ? always : null
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isSupervisor() || ctx.isTeacherCabaas()) return true
      const committeeIds = await ctx.myCommitteeIds()
      return committeeIds.includes(String(row.id))
    }
  },

  committee_members: (ctx, op) => {
    if (op !== 'SELECT') return ctx.isManager() ? always : null
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || ctx.isSupervisor() || row.profile_id === ctx.userId
  },

  committee_classes: (ctx, op) => {
    if (op !== 'SELECT') return ctx.isManager() ? always : null
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isSupervisor()) return true
      const committeeIds = await ctx.myCommitteeIds()
      return committeeIds.includes(String(row.committee_id))
    }
  },

  committee_member_classes: (ctx, op) => {
    if (op !== 'SELECT') return ctx.isManager() ? always : null
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isSupervisor() || ctx.isTeacherCabaas()) return true
      const direct = await ctx.directMemberIds()
      return direct.includes(String(row.committee_member_id))
    }
  },

  outside_activities: (ctx, op) => {
    const oacWrite = (row: Doc): Promise<boolean> => ctx.committeeHasClass(row.class_id as string)
    if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') {
      if (ctx.isManager()) return always
      if (ctx.role !== 'outside_activity_committee') return null
      return (row) => oacWrite(row)
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isSupervisor() || ctx.isTeacherCabaas()) return true
      const committeeIds = await ctx.myCommitteeIds()
      if (row.committee_id && committeeIds.includes(String(row.committee_id))) return true
      return ctx.committeeHasClass(row.class_id as string)
    }
  },

  outside_activity_attendance: (ctx, op) => {
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    if (op !== 'SELECT') {
      if (ctx.isManager()) return always
      if (ctx.role !== 'outside_activity_committee') return null
      return (row) => ctx.committeeHasClass(row.class_id as string)
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isSupervisor() || ctx.isTeacherCabaas()) return true
      if (row.recorded_by === ctx.userId) return true
      if (String(row.student_id) === (await ownStudent())) return true
      return ctx.committeeHasClass(row.class_id as string)
    }
  },

  // ------ follows (open social) ------
  follows: (ctx, op) => {
    if (op === 'UPDATE') return null
    if (op === 'DELETE') return ctx.isManager() || ctx.userId ? (row) => ctx.isManager() || row.follower_id === ctx.userId : null
    if (op === 'INSERT') {
      return async (row) => {
        if (row.follower_id !== ctx.userId) return false
        if (!ctx.isActiveSelf()) return false
        return ctx.isActiveProfile(String(row.following_id) || '')
      }
    }
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || ctx.isActiveSelf()
  },

  // ------ chat ------
  chat_conversations: (ctx, op) => {
    if (op === 'INSERT') return ctx.userId ? (row) => row.created_by === ctx.userId : null
    if (op !== 'SELECT') return null
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || row.created_by === ctx.userId) return true
      return ctx.isParticipant(String(row.id))
    }
  },

  chat_participants: (ctx, op) => {
    if (op === 'INSERT') {
      if (!ctx.isAuthenticated()) return null
      return async (row) => {
        if (row.profile_id === ctx.userId) return true
        const conv = await findOne('chat_conversations', { id: String(row.conversation_id) })
        return !!(conv && conv.created_by === ctx.userId)
      }
    }
    if (op !== 'SELECT') return null
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || row.profile_id === ctx.userId) return true
      return ctx.isParticipant(String(row.conversation_id))
    }
  },

  chat_messages: (ctx, op) => {
    if (op === 'DELETE') return null
    if (op === 'INSERT') {
      return async (row) => {
        if (row.sender_id !== ctx.userId) return false
        return ctx.isParticipant(String(row.conversation_id))
      }
    }
    if (op === 'UPDATE') return ctx.userId ? (row) => ctx.isManager() || row.sender_id === ctx.userId : null
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isParticipant(String(row.conversation_id))
  },

  ai_conversations: (ctx, op) => {
    if (op === 'INSERT') return ctx.userId ? (row) => row.profile_id === ctx.userId : null
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || row.profile_id === ctx.userId
  },

  ai_messages: (ctx, op) => {
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager()) return true
      const conv = await findOne('ai_conversations', { id: String(row.conversation_id) })
      return !!(conv && conv.profile_id === ctx.userId)
    }
  },

  notifications: (ctx, op) => {
    if (op === 'DELETE') return null
    if (op === 'UPDATE') return ctx.userId ? (row) => row.profile_id === ctx.userId : null
    if (op === 'INSERT') {
      if (!ctx.isAuthenticated()) return null
      return (row) =>
        ctx.isManager() ||
        (ctx.roleIn(STAFF_NOTIFY_ROLES) && row.profile_id !== ctx.userId) ||
        (row.sender_user_id === ctx.userId && row.profile_id !== ctx.userId)
    }
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || row.profile_id === ctx.userId
  },

  audit_logs: (ctx, op) => {
    if (op !== 'SELECT' && op !== 'INSERT') return null
    if (op === 'INSERT') return ctx.userId ? (row) => ctx.isManager() || row.actor_id === ctx.userId : null
    return ctx.isManager() ? always : null
  },

  // ------ practice ------
  practice_attendance: (ctx, op) => {
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    if (op !== 'SELECT') return ctx.isManager() || ctx.isPracticeTeacher() ? always : null
    return async (row) => {
      if (ctx.isManager() || ctx.isPracticeTeacher()) return true
      if (row.recorded_by === ctx.userId) return true
      return String(row.student_id) === (await ownStudent())
    }
  },

  practice_students: (ctx, op) => {
    if (op === 'DELETE') return ctx.userId ? (row) => row.created_by === ctx.userId : null
    if (op === 'INSERT') return ctx.isPracticeTeacher() ? (row) => row.created_by === ctx.userId : null
    if (op === 'UPDATE') return ctx.userId ? (row) => row.created_by === ctx.userId : null
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || ctx.isSupervisor() || row.created_by === ctx.userId
  },

  activity_logs: (ctx, op) => {
    if (op !== 'SELECT' && op !== 'INSERT') return null
    if (op === 'INSERT') return ctx.userId ? (row) => row.user_id === ctx.userId : null
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isSupervisor() || ctx.isManager() || row.user_id === ctx.userId
  },

  // ------ chat feed / social ------
  chat_posts: (ctx, op) => {
    if (op === 'INSERT') return ctx.userId ? (row) => row.author_id === ctx.userId && ctx.isActiveSelf() : null
    if (op === 'UPDATE' || op === 'DELETE')
      return ctx.isManager() || ctx.userId ? (row) => ctx.isManager() || row.author_id === ctx.userId : null
    if (!ctx.isAuthenticated()) return null
    return (row) => row.is_deleted === false && ctx.canViewChatContent(String(row.author_id))
  },

  chat_post_comments: (ctx, op) => {
    if (op === 'UPDATE' || op === 'DELETE')
      return ctx.isManager() || ctx.userId ? (row) => ctx.isManager() || row.author_id === ctx.userId : null
    if (op === 'INSERT') {
      return async (row) => {
        if (row.author_id !== ctx.userId || !ctx.isActiveSelf()) return false
        const post = await findOne('chat_posts', { id: String(row.post_id) })
        return !!(post && ctx.canViewChatContent(String(post.author_id)))
      }
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (row.is_deleted === true) return false
      const post = await findOne('chat_posts', { id: String(row.post_id) })
      return !!(post && ctx.canViewChatContent(String(post.author_id)))
    }
  },

  chat_post_reactions: (ctx, op) => {
    if (op === 'UPDATE' || op === 'DELETE')
      return ctx.isManager() || ctx.userId ? (row) => ctx.isManager() || row.user_id === ctx.userId : null
    if (op === 'INSERT') {
      return async (row) => {
        if (row.user_id !== ctx.userId) return false
        const post = await findOne('chat_posts', { id: String(row.post_id) })
        return !!(post && ctx.canViewChatContent(String(post.author_id)))
      }
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isActiveSelf()) return true
      const post = await findOne('chat_posts', { id: String(row.post_id) })
      return !!(post && ctx.canViewChatContent(String(post.author_id)))
    }
  },

  // ------ student_behavior ------
  student_behavior: (ctx, op) => {
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    const callerTeachesStudent = async (studentId: unknown) => {
      if (!ctx.roleIn(['teacher', 'practice_teacher', 'teacher_cabaas'])) return false
      const stu = await findOne('students', { id: String(studentId) })
      return !!(stu && stu.class_id && (await ctx.teacherHasClass(stu.class_id as string)))
    }
    if (op === 'INSERT' || op === 'UPDATE' || op === 'DELETE') {
      return async (row) => {
        if (ctx.isManager()) return true
        return callerTeachesStudent(row.student_id)
      }
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager()) return true
      if (String(row.student_id) === (await ownStudent())) return true
      if (await callerTeachesStudent(row.student_id)) return true
      if (ctx.isParent()) {
        const set = await ctx.parentStudentIdsSet()
        return set.has(String(row.student_id))
      }
      return false
    }
  },

  student_parents: (ctx, op) => {
    if (op === 'INSERT') return ctx.isManager() ? always : null
    if (op === 'DELETE') return ctx.isManager() ? always : null
    if (op !== 'SELECT') return null
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || row.parent_id === ctx.userId
  },

  // ------ calls ------
  calls: (ctx, op) => {
    if (op === 'INSERT') {
      return async (row) => {
        if (row.caller_id !== ctx.userId) return false
        return ctx.isActiveProfile(String(row.callee_id))
      }
    }
    if (!ctx.isAuthenticated()) return null
    return (row) => ctx.isManager() || row.caller_id === ctx.userId || row.callee_id === ctx.userId
  },

  // ------ lesson_monitoring ------
  lesson_monitoring: (ctx, op) => {
    const ownStudent = memo(async () => (await ctx.studentId()) ?? '')
    const studentInClass = async (studentId: unknown, classId: unknown) => {
      const stu = await findOne('students', { id: String(studentId) })
      return !!(stu && stu.class_id === classId)
    }
    if (op === 'DELETE') return ctx.isManager() ? always : null
    const teacherOfClass = (row: Doc) =>
      !!row.class_id && ctx.teacherHasClass(row.class_id as string)
    if (op === 'UPDATE') {
      if (ctx.isManager()) return always
      return (row) => teacherOfClass(row)
    }
    if (op === 'INSERT') {
      if (ctx.isManager()) return always
      return async (row) => {
        if (!(await teacherOfClass(row))) return false
        return studentInClass(row.student_id, row.class_id)
      }
    }
    if (!ctx.isAuthenticated()) return null
    return async (row) => {
      if (ctx.isManager() || ctx.isSupervisor() || ctx.isTeacherCabaas()) return true
      if (await teacherOfClass(row)) return true
      if (String(row.student_id) === (await ownStudent())) return true
      if (ctx.isParent()) {
        const set = await ctx.parentStudentIdsSet()
        return set.has(String(row.student_id))
      }
      return false
    }
  },

  // ------ password_reset_requests / backup system ------
  password_reset_requests: (ctx, op) => {
    if (op === 'INSERT') return () => true
    if (op !== 'SELECT' && op !== 'UPDATE') return null
    return ctx.isManager() ? always : null
  },

  backups: (ctx, op) => (op === 'SELECT' || op === 'DELETE' ? (ctx.isManager() ? always : null) : null),
  backup_logs: (ctx, op) => (op === 'SELECT' ? (ctx.isManager() ? always : null) : null),
  import_jobs: (ctx, op) => (op === 'SELECT' ? (ctx.isManager() ? always : null) : null),
}
