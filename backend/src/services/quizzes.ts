import { getModel } from '../models/index.ts'
import { collection } from '../db.ts'
import { ApiError } from '../errors.ts'
import type { RequestContext } from '../security.ts'

export async function submitQuiz(attemptId: string, answers: unknown, ctx: RequestContext) {
  if (!Array.isArray(answers) || answers.length > 500) throw new ApiError(400,'Invalid quiz answers')
  const attempt=await collection('quiz_attempts').findOne({id:attemptId})
  if (!attempt) throw new ApiError(404,'Attempt not found')
  if (attempt.student_id !== await ctx.studentId()) throw new ApiError(403,'This attempt belongs to another student')
  const quiz=await collection('quizzes').findOne({id:attempt.quiz_id})
  if (!quiz?.is_published || quiz.deleted_at) throw new ApiError(400,'Quiz is unavailable')
  if (quiz.end_at && Date.parse(String(quiz.end_at)) < Date.now()) throw new ApiError(400,'Quiz has ended')
  if (quiz.time_limit_minutes && Date.now()-Date.parse(String(attempt.started_at)) > Number(quiz.time_limit_minutes)*60000+5000) throw new ApiError(400,'Quiz time limit has expired')
  const questions=await collection('quiz_questions').find({quiz_id:quiz.id}).toArray()
  const questionIds=new Set(questions.map(q => q.id))
  const submittedIds=new Set()
  for (const answer of answers) {
    if (!answer || typeof answer !== 'object' || !questionIds.has(answer.questionId) || submittedIds.has(answer.questionId)) throw new ApiError(400,'Unknown or duplicate question')
    submittedIds.add(answer.questionId)
  }
  const lock=await getModel('quiz_attempts').findOneAndUpdate({id:attemptId,submitted_at:null,submitting:{$ne:true}},{$set:{submitting:true}}).lean()
  if (!lock) throw new ApiError(409,'This attempt has already been submitted or is being processed')
  try {
    let score=0,maxScore=0
    for (const q of questions) {
      const a=answers.find(a => a.questionId === q.id)
      let correct=false
      if (q.question_type === 'short_answer') correct=!!q.correct_answer && typeof a?.answerText === 'string' && a.answerText.trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase()
      else if (a?.selectedOptionId) {
        const option=await collection('quiz_options').findOne({id:a.selectedOptionId,question_id:q.id})
        if (!option) throw new ApiError(400,'Option does not belong to this question')
        correct=option.is_correct===true
      }
      const marks=Number(q.marks)
      maxScore+=marks
      if (correct) score+=marks
      await getModel('quiz_answers').updateOne({attempt_id:attemptId,question_id:q.id},{$set:{answer_text:a?.answerText ?? null,selected_option_id:a?.selectedOptionId ?? null,is_correct:correct,marks_awarded:correct?marks:0}},{upsert:true,runValidators:true})
    }
    return await getModel('quiz_attempts').findOneAndUpdate({id:attemptId},{$set:{score,max_score:maxScore,submitted_at:new Date().toISOString(),submitting:false}},{new:true,runValidators:true}).lean()
  } catch(error) {
    await getModel('quiz_attempts').updateOne({id:attemptId},{$set:{submitting:false}})
    throw error
  }
}
