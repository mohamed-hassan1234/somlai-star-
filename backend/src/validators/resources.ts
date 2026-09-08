import { ApiError } from '../errors.ts'
import { getModel, modelDefinitions } from '../models/index.ts'
import { collection } from '../db.ts'
import type { RequestContext } from '../security.ts'

export function validatePayload(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400,'A JSON object is required')
  for (const [key,child] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || ['__proto__','constructor','prototype','_id','__v'].includes(key)) throw new ApiError(400,'Invalid field')
    if (child && typeof child === 'object' && !Array.isArray(child)) validatePayload(child)
  }
}

export async function validateResource(table: string,row: Record<string,any>,ctx: RequestContext,old?: Record<string,any>) {
  if (!old && table==='password_reset_requests') {
    row.status='pending'; row.resolved_by=null; row.resolved_at=null
  }
  if (table==='result_submissions') {
    if (row.status==='published' && old?.status!=='published' && !ctx.isTeacherCabaas()) throw new ApiError(403,'Only Cabaas may publish official results')
    if (!ctx.isManager() && !ctx.isTeacherCabaas() && !['draft','pending_review'].includes(row.status)) throw new ApiError(403,'Teachers may draft or submit results for review')
  }
  if (old && !ctx.isManager()) {
    const immutable=['id','created_at','profile_id','author_id','sender_id','caller_id','callee_id','student_id','quiz_id','question_id','attempt_id','conversation_id','teacher_id','follower_id','following_id','created_by']
    for (const key of immutable) if (JSON.stringify(old[key])!==JSON.stringify(row[key])) throw new ApiError(403,`Cannot change ${key}`)
    if (table==='chat_posts' && (row.likes_count!==old.likes_count || row.comments_count!==old.comments_count)) throw new ApiError(403,'Reaction counts are managed by the server')
  }
  if (!ctx.isManager()) {
    if (table === 'profiles') {
      const permitted=new Set(['full_name','phone','avatar_url','must_change_password','updated_at'])
      for (const key of Object.keys(row)) if (old && JSON.stringify(old[key]) !== JSON.stringify(row[key]) && !permitted.has(key)) throw new ApiError(403,'This profile field can only be changed by the School Manager')
      if (row.must_change_password === false && old?.must_change_password === true) {
        // Password completion is updated by the authenticated password endpoint.
        throw new ApiError(403,'Change your password before clearing this flag')
      }
    }
    if (table === 'students') throw new ApiError(403,'Only the School Manager can edit student enrollment')
    if (table === 'quiz_answers' || (table === 'quiz_attempts' && old)) throw new ApiError(403,'Use the quiz submission endpoint')
    if (table === 'quiz_attempts' && ['score','max_score','submitted_at'].some(k=>row[k]!=null)) throw new ApiError(403,'Scores are assigned by the server')
  }
  const definition=modelDefinitions[table]
  for (const [field,d] of Object.entries(definition ?? {})) {
    if (!d.ref || row[field]==null || (old && old[field]===row[field])) continue
    if (!(await collection(d.ref).findOne({id:row[field]}))) throw new ApiError(400,`Invalid reference: ${field}`)
  }
  if (['attendance','practice_attendance','lesson_monitoring','outside_activity_attendance'].includes(table)) {
    const student=await collection('students').findOne({id:row.student_id})
    if (!student || student.class_id !== row.class_id) throw new ApiError(400,'Student does not belong to this class')
  }
  if (table==='quiz_attempts' && !old) {
    const quiz=await collection('quizzes').findOne({id:row.quiz_id})
    if (!quiz?.is_published || quiz.deleted_at || quiz.class_id !== await ctx.studentClassId()) throw new ApiError(403,'Quiz is unavailable for your class')
    const now=Date.now()
    if ((quiz.start_at && Date.parse(String(quiz.start_at))>now) || (quiz.end_at && Date.parse(String(quiz.end_at))<now)) throw new ApiError(400,'Quiz is outside its availability period')
    row.started_at=new Date().toISOString()
  }
  if (table==='results' && Number(row.marks_obtained)>Number(row.max_marks)) throw new ApiError(400,'Marks cannot exceed maximum marks')
  if (table==='academic_years' && String(row.end_date)<String(row.start_date)) throw new ApiError(400,'End date must follow start date')
  await new (getModel(table))(row).validate()
}
