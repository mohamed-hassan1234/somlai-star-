import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { getMyAttempt, getQuiz, listQuizzes, startAttempt, submitAttempt } from '@/services/quizzes'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/utils'
import type { Quiz } from '@/types'

export function StudentQuizzesPage() {
  const { user } = useAuth()
  const student = user!.student!
  const qc = useQueryClient()
  const [active, setActive] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<Record<string, { answer_text?: string; selected_option_id?: string }>>({})
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null)

  const quizzes = useQuery({
    queryKey: ['student-quizzes', student.class_id],
    queryFn: () => listQuizzes({ classId: student.class_id!, publishedOnly: true }),
    enabled: !!student.class_id,
  })

  const openQuiz = useMutation({
    mutationFn: async (quizId: string) => {
      const quiz = await getQuiz(quizId)
      const attempt = await getMyAttempt(quizId, student.id)
      if (attempt?.submitted_at) {
        setResult({ score: Number(attempt.score), maxScore: Number(attempt.max_score) })
      } else {
        setResult(null)
        await startAttempt(quizId, student.id)
      }
      return quiz
    },
    onSuccess: (quiz) => setActive(quiz),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const submit = useMutation({
    mutationFn: async () => {
      if (!active) return
      const attempt = await getMyAttempt(active.id, student.id)
      if (!attempt) throw new Error('Attempt missing')
      if (attempt.submitted_at) throw new Error('Already submitted')
      const payload = Object.entries(answers).map(([question_id, a]) => ({
        question_id,
        answer_text: a.answer_text ?? null,
        selected_option_id: a.selected_option_id ?? null,
      }))
      return submitAttempt({
        attemptId: attempt.id,
        answers: payload.map((a) => ({
          questionId: a.question_id,
          answerText: a.answer_text,
          selectedOptionId: a.selected_option_id,
        })),
      })
    },
    onSuccess: (r) => {
      if (!r) return
      setResult(r)
      toast.success(`Score: ${r.score}/${r.maxScore}`)
      qc.invalidateQueries({ queryKey: ['student-quizzes'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Quiz" description="Take published quizzes for your class." />
      {quizzes.isLoading ? <TableSkeleton /> : !quizzes.data?.length ? <EmptyState title="No quizzes available" /> : (
        <div className="space-y-3">
          {quizzes.data.map((q) => (
            <Card key={q.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg font-semibold">{q.title}</p>
                <p className="text-sm text-ink-500">{q.questions?.length ?? 0} questions · {q.total_marks} marks</p>
              </div>
              <Button size="sm" onClick={() => openQuiz.mutate(q.id)} loading={openQuiz.isPending}>Open</Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!active} onClose={() => { setActive(null); setAnswers({}); setResult(null) }} title={active?.title ?? 'Quiz'} size="xl">
        {result ? (
          <div className="text-center">
            <p className="font-display text-3xl font-semibold">{result.score} / {result.maxScore}</p>
            <p className="mt-2 text-sm text-ink-500">Quiz submitted</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(active?.questions ?? []).map((q, i) => (
              <div key={q.id}>
                <p className="font-medium">{i + 1}. {q.question_text} <span className="text-xs text-ink-500">({q.marks} marks)</span></p>
                {q.question_type === 'short_answer' ? (
                  <Input
                    className="mt-2"
                    value={answers[q.id]?.answer_text ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: { answer_text: e.target.value } }))}
                  />
                ) : (
                  <div className="mt-2 space-y-2">
                    {(q.options ?? []).map((o) => (
                      <label key={o.id} className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-sm dark:border-ink-700">
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id]?.selected_option_id === o.id}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: { selected_option_id: o.id } }))}
                        />
                        {o.option_text}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <Button loading={submit.isPending} onClick={() => submit.mutate()}>Submit quiz</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
