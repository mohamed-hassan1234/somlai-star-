import { request } from './httpClient'
import { api } from '@/services/api'
import type { QuestionType, Quiz, QuizOption, QuizQuestion } from '@/types'
import { assertData, serviceError } from './errors'

export interface QuestionInput {
  questionText: string
  questionType: QuestionType
  marks?: number
  correctAnswer?: string | null
  sortOrder?: number
  options?: Array<{ optionText: string; isCorrect: boolean; sortOrder?: number }>
}

export async function listQuizzes(filters?: {
  classId?: string
  teacherId?: string
  publishedOnly?: boolean
}): Promise<Quiz[]> {
  let query = api
    .from('quizzes')
    .select('*, class:classes(*), subject:subjects(*), questions:quiz_questions(*, options:quiz_options(*))')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters?.classId) query = query.eq('class_id', filters.classId)
  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.publishedOnly) query = query.eq('is_published', true)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load quizzes')
  return (data ?? []) as Quiz[]
}

export async function getQuiz(id: string): Promise<Quiz> {
  const { data, error } = await api
    .from('quizzes')
    .select('*, questions:quiz_questions(*, options:quiz_options(*))')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  return assertData(data as Quiz, error, 'Quiz not found')
}

export async function createQuiz(input: {
  title: string
  description?: string
  subjectId?: string | null
  classId: string
  teacherId: string
  timeLimitMinutes?: number | null
  startAt?: string | null
  endAt?: string | null
  isPublished?: boolean
  questions?: QuestionInput[]
}): Promise<Quiz> {
  const { data: quiz, error } = await api
    .from('quizzes')
    .insert({
      title: input.title,
      description: input.description ?? null,
      subject_id: input.subjectId || null,
      class_id: input.classId,
      teacher_id: input.teacherId,
      time_limit_minutes: input.timeLimitMinutes ?? null,
      start_at: input.startAt ?? null,
      end_at: input.endAt ?? null,
      is_published: input.isPublished ?? false,
      total_marks: 0,
    })
    .select('*')
    .single()

  if (error || !quiz) throw serviceError(error, 'Failed to create quiz')

  if (input.questions?.length) {
    await addQuestions(quiz.id, input.questions)
  }

  return getQuiz(quiz.id)
}

export async function updateQuiz(
  id: string,
  updates: {
    title?: string
    description?: string | null
    subjectId?: string | null
    classId?: string
    timeLimitMinutes?: number | null
    startAt?: string | null
    endAt?: string | null
    isPublished?: boolean
  },
): Promise<Quiz> {
  const patch: Record<string, unknown> = {}
  if (updates.title !== undefined) patch.title = updates.title
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.subjectId !== undefined) patch.subject_id = updates.subjectId || null
  if (updates.classId !== undefined) patch.class_id = updates.classId
  if (updates.timeLimitMinutes !== undefined) patch.time_limit_minutes = updates.timeLimitMinutes
  if (updates.startAt !== undefined) patch.start_at = updates.startAt
  if (updates.endAt !== undefined) patch.end_at = updates.endAt
  if (updates.isPublished !== undefined) patch.is_published = updates.isPublished

  const { error } = await api.from('quizzes').update(patch).eq('id', id)
  if (error) throw serviceError(error, 'Failed to update quiz')
  return getQuiz(id)
}

export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await api
    .from('quizzes')
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq('id', id)
  if (error) throw serviceError(error, 'Failed to delete quiz')
}

export async function addQuestions(quizId: string, questions: QuestionInput[]): Promise<QuizQuestion[]> {
  const created: QuizQuestion[] = []
  let totalMarks = 0

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const marks = q.marks ?? 1
    totalMarks += marks

    const { data: question, error } = await api
      .from('quiz_questions')
      .insert({
        quiz_id: quizId,
        question_text: q.questionText,
        question_type: q.questionType,
        marks,
        correct_answer: q.correctAnswer ?? null,
        sort_order: q.sortOrder ?? i,
      })
      .select('*')
      .single()

    if (error || !question) throw serviceError(error, 'Failed to add quiz question')

    let options: QuizOption[] = []
    if (q.options?.length) {
      const optionRows = q.options.map((o, idx) => ({
        question_id: question.id,
        option_text: o.optionText,
        is_correct: o.isCorrect,
        sort_order: o.sortOrder ?? idx,
      }))
      const { data: opts, error: optError } = await api
        .from('quiz_options')
        .insert(optionRows)
        .select('*')

      if (optError) throw serviceError(optError, 'Failed to add quiz options')
      options = (opts ?? []) as QuizOption[]
    }

    created.push({ ...(question as QuizQuestion), options })
  }

  const { data: existing } = await api.from('quizzes').select('total_marks').eq('id', quizId).single()
  await api
    .from('quizzes')
    .update({ total_marks: Number(existing?.total_marks ?? 0) + totalMarks })
    .eq('id', quizId)

  return created
}

export async function startAttempt(quizId: string, studentId: string) {
  const { data, error } = await api
    .from('quiz_attempts')
    .upsert(
      { quiz_id: quizId, student_id: studentId },
      { onConflict: 'quiz_id,student_id', ignoreDuplicates: true },
    )
    .select('*')
    .maybeSingle()

  if (error) throw serviceError(error, 'Failed to start quiz attempt')

  if (data) return data

  const { data: existing, error: fetchError } = await api
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)
    .single()

  return assertData(existing, fetchError, 'Failed to load quiz attempt')
}

export async function submitAttempt(input: {
  attemptId: string
  answers: Array<{
    questionId: string
    answerText?: string | null
    selectedOptionId?: string | null
  }>
}) {
  const result = await request<{score:number;max_score:number}>('/quizzes/attempts/'+input.attemptId+'/submit', { answers: input.answers })
  return {score:result.score,maxScore:result.max_score}
}

export async function listAttempts(filters: { quizId?: string; studentId?: string }) {
  let query = api
    .from('quiz_attempts')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*)), quiz:quizzes(title)')
    .order('started_at', { ascending: false })

  if (filters.quizId) query = query.eq('quiz_id', filters.quizId)
  if (filters.studentId) query = query.eq('student_id', filters.studentId)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load quiz attempts')
  return data ?? []
}

export async function addQuestion(
  quizId: string,
  question: {
    question_text: string
    question_type: QuestionType
    marks: number
    correct_answer?: string | null
    sort_order?: number
    options?: { option_text: string; is_correct: boolean; sort_order?: number }[]
  },
) {
  return addQuestions(quizId, [
    {
      questionText: question.question_text,
      questionType: question.question_type,
      marks: question.marks,
      correctAnswer: question.correct_answer,
      sortOrder: question.sort_order,
      options: question.options?.map((o) => ({
        optionText: o.option_text,
        isCorrect: o.is_correct,
        sortOrder: o.sort_order,
      })),
    },
  ])
}

export async function getMyAttempt(quizId: string, studentId: string) {
  const { data } = await api
    .from('quiz_attempts')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)
    .maybeSingle()
  return data
}
