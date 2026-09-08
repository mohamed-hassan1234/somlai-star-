import { api } from '@/services/api'
import type { ResultStatus } from '@/types'
import { assertData, serviceError } from './errors'

export interface ResultRowInput {
  studentId: string
  marksObtained: number
  maxMarks?: number
  grade?: string
  remarks?: string
}

export async function listSubmissions(filters?: {
  classId?: string
  teacherId?: string
  status?: ResultStatus
}) {
  let query = api
    .from('result_submissions')
    .select('*, subject:subjects(*), class:classes(*), teacher:teachers(*, profile:profiles(*)), results(*)')
    .order('created_at', { ascending: false })

  if (filters?.classId) query = query.eq('class_id', filters.classId)
  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load result submissions')
  return data ?? []
}

export async function getSubmission(id: string) {
  const { data, error } = await api
    .from('result_submissions')
    .select(
      '*, subject:subjects(*), class:classes(*), teacher:teachers(*, profile:profiles(*)), results(*, student:students(*, profile:profiles!students_profile_id_fkey(*))), approvals:result_approvals(*)',
    )
    .eq('id', id)
    .single()

  return assertData(data, error, 'Result submission not found')
}

/** Teacher submits results for Cabaas review. */
export async function submitResults(input: {
  title: string
  subjectId?: string | null
  classId: string
  teacherId: string
  academicYearId?: string | null
  examType?: string
  results: ResultRowInput[]
  asDraft?: boolean
}) {
  const status: ResultStatus = input.asDraft ? 'draft' : 'pending_review'

  const { data: submission, error } = await api
    .from('result_submissions')
    .insert({
      title: input.title,
      subject_id: input.subjectId || null,
      class_id: input.classId,
      teacher_id: input.teacherId,
      academic_year_id: input.academicYearId ?? null,
      exam_type: input.examType ?? null,
      status,
      submitted_at: input.asDraft ? null : new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !submission) throw serviceError(error, 'Failed to create result submission')

  if (input.results.length) {
    const rows = input.results.map((r) => ({
      submission_id: submission.id,
      student_id: r.studentId,
      marks_obtained: r.marksObtained,
      max_marks: r.maxMarks ?? 100,
      grade: r.grade ?? null,
      remarks: r.remarks ?? null,
    }))

    const { error: resultsError } = await api.from('results').insert(rows)
    if (resultsError) throw serviceError(resultsError, 'Failed to save result rows')
  }

  return getSubmission(submission.id)
}

/** Teacher Cabaas reviews a pending submission. */
export async function reviewResults(input: {
  submissionId: string
  action: 'approve' | 'reject'
  notes?: string
  reviewerId: string
}) {
  const nextStatus: ResultStatus = input.action === 'approve' ? 'approved' : 'rejected'

  const { error } = await api
    .from('result_submissions')
    .update({
      status: nextStatus,
      reviewed_by: input.reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.notes ?? null,
    })
    .eq('id', input.submissionId)
    .eq('status', 'pending_review')

  if (error) throw serviceError(error, 'Failed to review results')

  const { error: approvalError } = await api.from('result_approvals').insert({
    submission_id: input.submissionId,
    reviewer_id: input.reviewerId,
    action: input.action,
    notes: input.notes ?? null,
  })

  if (approvalError) throw serviceError(approvalError, 'Failed to record approval')

  return getSubmission(input.submissionId)
}

/** Publish approved results (Cabaas or manager). */
export async function publishResults(input: {
  submissionId: string
  publisherId: string
  notes?: string
}) {
  const { data: current, error: fetchError } = await api
    .from('result_submissions')
    .select('status')
    .eq('id', input.submissionId)
    .single()

  if (fetchError || !current) throw serviceError(fetchError, 'Submission not found')
  if (current.status !== 'approved' && current.status !== 'pending_review') {
    throw new Error('Only approved (or manager-escalated) results can be published')
  }

  const { error } = await api
    .from('result_submissions')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', input.submissionId)

  if (error) throw serviceError(error, 'Failed to publish results')

  await api.from('result_approvals').insert({
    submission_id: input.submissionId,
    reviewer_id: input.publisherId,
    action: 'publish',
    notes: input.notes ?? null,
  })

  return getSubmission(input.submissionId)
}

export async function getPublishedResultsForStudent(studentId: string) {
  const { data, error } = await api
    .from('results')
    .select('*, submission:result_submissions!inner(*, subject:subjects(*), class:classes(*))')
    .eq('student_id', studentId)
    .eq('submission.status', 'published')
    .order('created_at', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load published results')
  return data ?? []
}

export const listResultSubmissions = listSubmissions
export const getStudentPublishedResults = getPublishedResultsForStudent

export async function createResultSubmission(input: {
  title: string
  subject_id?: string | null
  class_id: string
  teacher_id: string
  academic_year_id?: string | null
  exam_type?: string | null
  results: { student_id: string; marks_obtained: number; max_marks: number; grade?: string; remarks?: string }[]
}) {
  return submitResults({
    title: input.title,
    subjectId: input.subject_id,
    classId: input.class_id,
    teacherId: input.teacher_id,
    academicYearId: input.academic_year_id,
    examType: input.exam_type ?? undefined,
    asDraft: true,
    results: input.results.map((r) => ({
      studentId: r.student_id,
      marksObtained: r.marks_obtained,
      maxMarks: r.max_marks,
      grade: r.grade,
      remarks: r.remarks,
    })),
  })
}

export async function submitForReview(submissionId: string) {
  const { error } = await api
    .from('result_submissions')
    .update({ status: 'pending_review', submitted_at: new Date().toISOString() })
    .eq('id', submissionId)
  if (error) throw serviceError(error, 'Failed to submit for review')
}

export async function reviewSubmission(
  submissionId: string,
  action: 'approve' | 'reject' | 'publish',
  reviewerId: string,
  notes?: string,
) {
  if (action === 'publish') {
    return publishResults({ submissionId, publisherId: reviewerId, notes })
  }
  return reviewResults({ submissionId, action, reviewerId, notes })
}
