import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { createResultSubmission, listResultSubmissions, submitForReview } from '@/services/results'
import { getTeacherClasses } from '@/services/teachers'
import { listStudentsByClass } from '@/services/students'
import { listSubjects } from '@/services/classes'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/utils'
import type { ClassRecord } from '@/types'

export function TeacherResultsPage() {
  const { user } = useAuth()
  const teacherId = user!.teacher!.id
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [classId, setClassId] = useState('')
  const [marks, setMarks] = useState<Record<string, string>>({})

  const submissions = useQuery({
    queryKey: ['teacher-results', teacherId],
    queryFn: () => listResultSubmissions({ teacherId }),
  })
  const classes = useQuery({ queryKey: ['teacher-classes', teacherId], queryFn: () => getTeacherClasses(teacherId) })
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => listSubjects() })
  const students = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  })

  const form = useForm({ defaultValues: { title: '', subject_id: '', exam_type: 'exam', max_marks: 100 } })

  const create = useMutation({
    mutationFn: async (v: { title: string; subject_id: string; exam_type: string; max_marks: number }) => {
      const results = (students.data ?? [])
        .filter((s) => marks[s.id] !== undefined && marks[s.id] !== '')
        .map((s) => ({
          student_id: s.id,
          marks_obtained: Number(marks[s.id]),
          max_marks: Number(v.max_marks),
        }))
      if (!results.length) throw new Error('Enter marks for at least one student')
      return createResultSubmission({
        title: v.title,
        subject_id: v.subject_id || null,
        class_id: classId,
        teacher_id: teacherId,
        exam_type: v.exam_type,
        results,
      })
    },
    onSuccess: () => {
      toast.success('Draft saved — submit for review when ready')
      setOpen(false)
      setMarks({})
      form.reset()
      qc.invalidateQueries({ queryKey: ['teacher-results', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const submit = useMutation({
    mutationFn: submitForReview,
    onSuccess: () => {
      toast.success('Submitted for Cabaas review (cannot publish official results)')
      qc.invalidateQueries({ queryKey: ['teacher-results', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Results"
        description="Enter marks and submit for review. Official publishing is handled by Teacher Cabaas."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New submission</Button>}
      />
      {submissions.isLoading ? <TableSkeleton /> : !submissions.data?.length ? <EmptyState title="No submissions" /> : (
        <div className="space-y-3">
          {submissions.data.map((s) => (
            <Card key={s.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-lg font-semibold">{s.title}</p>
                <p className="text-sm text-ink-500">{(s.class as { name?: string } | null)?.name} · {(s.results as unknown[] | null)?.length ?? 0} students</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={s.status} />
                {s.status === 'draft' && (
                  <Button size="sm" onClick={() => submit.mutate(s.id)} loading={submit.isPending}>Submit for review</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create result submission" size="lg">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Input label="Title" {...form.register('title', { required: true })} />
          <Select
            label="Class"
            placeholder="Select"
            options={(classes.data as ClassRecord[] | undefined)?.map((c) => ({ value: c.id, label: c.name })) ?? []}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
          <Select
            label="Subject"
            options={[{ value: '', label: 'None' }, ...(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            {...form.register('subject_id')}
          />
          <Input label="Max marks" type="number" {...form.register('max_marks', { valueAsNumber: true })} />
          {classId && (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {(students.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{s.profile?.full_name}</span>
                  <Input
                    className="w-24"
                    type="number"
                    value={marks[s.id] ?? ''}
                    onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Save draft</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
