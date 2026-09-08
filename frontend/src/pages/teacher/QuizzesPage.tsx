import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { quizSchema } from '@/schemas'
import { addQuestion, createQuiz, deleteQuiz, listQuizzes, updateQuiz } from '@/services/quizzes'
import { getTeacherClasses } from '@/services/teachers'
import { listSubjects } from '@/services/classes'
import { useAuth } from '@/providers/AuthProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/utils'
import type { ClassRecord, QuestionType, Quiz } from '@/types'
import { z } from 'zod'

export function TeacherQuizzesPage() {
  const { user } = useAuth()
  const teacherId = user!.teacher!.id
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [questionFor, setQuestionFor] = useState<Quiz | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const quizzes = useQuery({ queryKey: ['quizzes', teacherId], queryFn: () => listQuizzes({ teacherId }) })
  const classes = useQuery({ queryKey: ['teacher-classes', teacherId], queryFn: () => getTeacherClasses(teacherId) })
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => listSubjects() })

  const form = useForm({
    resolver: zodResolver(quizSchema),
    defaultValues: {
      title: '',
      description: '',
      subjectId: '',
      classId: '',
      timeLimitMinutes: null as number | null,
      startAt: null as string | null,
      endAt: null as string | null,
      isPublished: false,
    },
  })

  const qForm = useForm({
    defaultValues: {
      question_text: '',
      question_type: 'multiple_choice' as QuestionType,
      marks: 1,
      correct_answer: '',
      optA: '',
      optB: '',
      optC: '',
      optD: '',
      correctOpt: 'A',
    },
  })

  const create = useMutation({
    mutationFn: (v: z.infer<typeof quizSchema>) =>
      createQuiz({
        title: v.title,
        description: v.description || undefined,
        subjectId: v.subjectId || undefined,
        classId: v.classId,
        teacherId,
        timeLimitMinutes: v.timeLimitMinutes ?? null,
        startAt: v.startAt || null,
        endAt: v.endAt || null,
        isPublished: v.isPublished,
      }),
    onSuccess: () => {
      toast.success('Quiz created')
      setOpen(false)
      form.reset()
      qc.invalidateQueries({ queryKey: ['quizzes', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const addQ = useMutation({
    mutationFn: async (v: {
      question_text: string
      question_type: QuestionType
      marks: number
      correct_answer: string
      optA: string
      optB: string
      optC: string
      optD: string
      correctOpt: string
    }) => {
      if (!questionFor) return
      const options =
        v.question_type === 'short_answer'
          ? undefined
          : v.question_type === 'true_false'
            ? [
                { option_text: 'True', is_correct: v.correctOpt === 'True' },
                { option_text: 'False', is_correct: v.correctOpt === 'False' },
              ]
            : [
                { option_text: v.optA, is_correct: v.correctOpt === 'A' },
                { option_text: v.optB, is_correct: v.correctOpt === 'B' },
                { option_text: v.optC, is_correct: v.correctOpt === 'C' },
                { option_text: v.optD, is_correct: v.correctOpt === 'D' },
              ]
      await addQuestion(questionFor.id, {
        question_text: v.question_text,
        question_type: v.question_type,
        marks: Number(v.marks),
        correct_answer: v.question_type === 'short_answer' ? v.correct_answer : null,
        options,
      })
    },
    onSuccess: () => {
      toast.success('Question added')
      qForm.reset()
      qc.invalidateQueries({ queryKey: ['quizzes', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: deleteQuiz,
    onSuccess: () => {
      toast.success('Quiz deleted')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['quizzes', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const qType = qForm.watch('question_type')

  return (
    <div>
      <PageHeader
        title="Quizzes"
        description="Build MCQ, true/false, and short-answer quizzes, then publish."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New Quiz</Button>}
      />
      {quizzes.isLoading ? <TableSkeleton /> : !quizzes.data?.length ? <EmptyState title="No quizzes" /> : (
        <div className="space-y-3">
          {quizzes.data.map((q) => (
            <Card key={q.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold">{q.title}</p>
                    <StatusBadge status={q.is_published ? 'published' : 'draft'} />
                  </div>
                  <p className="text-sm text-ink-500">
                    {(q as any).class?.name} · {q.questions?.length ?? 0} questions · {q.total_marks} marks
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setQuestionFor(q)}>Add question</Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      updateQuiz(q.id, { isPublished: !q.is_published }).then(() => {
                        toast.success(q.is_published ? 'Unpublished' : 'Published')
                        qc.invalidateQueries({ queryKey: ['quizzes', teacherId] })
                      })
                    }
                  >
                    {q.is_published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteId(q.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create Quiz">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Input label="Title" {...form.register('title')} error={form.formState.errors.title?.message} />
          <Select
            label="Class"
            placeholder="Select"
            options={(classes.data as ClassRecord[] | undefined)?.map((c) => ({ value: c.id, label: c.name })) ?? []}
            {...form.register('classId')}
          />
          <Select
            label="Subject"
            options={[{ value: '', label: 'None' }, ...(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            {...form.register('subjectId')}
          />
          <Input label="Time limit (minutes)" type="number" {...form.register('timeLimitMinutes')} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('isPublished')} /> Publish now</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!questionFor} onClose={() => setQuestionFor(null)} title={`Add question — ${questionFor?.title ?? ''}`} size="lg">
        <form className="space-y-3" onSubmit={qForm.handleSubmit((v) => addQ.mutate(v))}>
          <Input label="Question" {...qForm.register('question_text', { required: true })} />
          <Select
            label="Type"
            options={[
              { value: 'multiple_choice', label: 'Multiple choice' },
              { value: 'true_false', label: 'True / False' },
              { value: 'short_answer', label: 'Short answer' },
            ]}
            {...qForm.register('question_type')}
          />
          <Input label="Marks" type="number" {...qForm.register('marks', { valueAsNumber: true })} />
          {qType === 'multiple_choice' && (
            <>
              <Input label="Option A" {...qForm.register('optA', { required: true })} />
              <Input label="Option B" {...qForm.register('optB', { required: true })} />
              <Input label="Option C" {...qForm.register('optC', { required: true })} />
              <Input label="Option D" {...qForm.register('optD', { required: true })} />
              <Select label="Correct option" options={['A', 'B', 'C', 'D'].map((x) => ({ value: x, label: x }))} {...qForm.register('correctOpt')} />
            </>
          )}
          {qType === 'true_false' && (
            <Select label="Correct answer" options={[{ value: 'True', label: 'True' }, { value: 'False', label: 'False' }]} {...qForm.register('correctOpt')} />
          )}
          {qType === 'short_answer' && <Input label="Correct answer" {...qForm.register('correct_answer', { required: true })} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setQuestionFor(null)}>Close</Button>
            <Button type="submit" loading={addQ.isPending}>Add</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete quiz?" message="This cannot be undone." confirmLabel="Delete" danger loading={remove.isPending} onConfirm={async () => { if (deleteId) await remove.mutateAsync(deleteId) }} />
    </div>
  )
}
