import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { lessonSchema, type LessonInput } from '@/schemas'
import {
  createLesson,
  deleteLesson,
  deleteLessonFile,
  listLessons,
  updateLesson,
  uploadLessonFiles,
} from '@/services/lessons'
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
import { formatDate, getErrorMessage } from '@/lib/utils'
import type { ClassRecord, Lesson } from '@/types'

export function TeacherLessonsPage() {
  const { user } = useAuth()
  const teacherId = user!.teacher!.id
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Lesson | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploadFor, setUploadFor] = useState<Lesson | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const lessons = useQuery({
    queryKey: ['lessons', teacherId],
    queryFn: () => listLessons({ teacherId }),
  })
  const classes = useQuery({
    queryKey: ['teacher-classes', teacherId],
    queryFn: () => getTeacherClasses(teacherId),
  })
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => listSubjects() })

  const form = useForm<LessonInput>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: '',
      description: '',
      subjectId: '',
      classId: '',
      lessonDate: new Date().toISOString().slice(0, 10),
      isPublished: false,
    },
  })

  const save = useMutation({
    mutationFn: async (v: LessonInput) => {
      const payload = {
        title: v.title,
        description: v.description || undefined,
        subjectId: v.subjectId || null,
        classId: v.classId,
        teacherId,
        lessonDate: v.lessonDate,
        isPublished: v.isPublished,
      }
      if (edit) await updateLesson(edit.id, payload)
      else await createLesson(payload)
    },
    onSuccess: () => {
      toast.success('Lesson saved')
      setOpen(false)
      setEdit(null)
      form.reset()
      qc.invalidateQueries({ queryKey: ['lessons', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteLesson(id),
    onSuccess: () => {
      toast.success('Lesson deleted')
      setDeleteId(null)
      qc.invalidateQueries({ queryKey: ['lessons', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      if (!uploadFor) return
      await uploadLessonFiles(uploadFor.id, user!.profile.id, [...files])
    },
    onSuccess: () => {
      toast.success('Files uploaded')
      setUploadFor(null)
      qc.invalidateQueries({ queryKey: ['lessons', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Lessons"
        description="Create, publish, and attach media. Students can view online only — no downloads."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEdit(null); form.reset(); setOpen(true) }}>
            New Lesson
          </Button>
        }
      />
      {lessons.isLoading ? (
        <TableSkeleton />
      ) : !lessons.data?.length ? (
        <EmptyState title="No lessons yet" />
      ) : (
        <div className="space-y-3">
          {lessons.data.map((l) => (
            <Card key={l.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold">{l.title}</p>
                    <StatusBadge status={l.is_published ? 'published' : 'draft'} />
                  </div>
                  <p className="text-sm text-ink-500">
                    {l.class?.name} · {l.subject?.name ?? 'No subject'} · {formatDate(l.lesson_date)}
                  </p>
                  {l.description && <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{l.description}</p>}
                  {(l.files?.length ?? 0) > 0 && (
                    <ul className="mt-3 space-y-1">
                      {l.files!.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-2 text-xs text-ink-600 dark:text-ink-300">
                          <span>{f.file_name} ({f.file_type})</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              deleteLessonFile(f.id).then(() => {
                                toast.success('File removed')
                                qc.invalidateQueries({ queryKey: ['lessons', teacherId] })
                              })
                            }
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEdit(l)
                      form.reset({
                        title: l.title,
                        description: l.description ?? '',
                        subjectId: l.subject_id ?? '',
                        classId: l.class_id,
                        lessonDate: l.lesson_date,
                        isPublished: l.is_published,
                      })
                      setOpen(true)
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" leftIcon={<Upload className="h-3.5 w-3.5" />} onClick={() => setUploadFor(l)}>
                    Files
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      updateLesson(l.id, { isPublished: !l.is_published }).then(() => {
                        toast.success(l.is_published ? 'Unpublished' : 'Published')
                        qc.invalidateQueries({ queryKey: ['lessons', teacherId] })
                      })
                    }
                  >
                    {l.is_published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteId(l.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? 'Edit Lesson' : 'New Lesson'} size="lg">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <Input label="Title" className="sm:col-span-2" {...form.register('title')} error={form.formState.errors.title?.message} />
          <Select
            label="Class"
            placeholder="Select class"
            options={(classes.data as ClassRecord[] | undefined)?.map((c) => ({ value: c.id, label: c.name })) ?? []}
            {...form.register('classId')}
            error={form.formState.errors.classId?.message}
          />
          <Select
            label="Subject"
            placeholder="Optional"
            options={[{ value: '', label: 'None' }, ...(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            {...form.register('subjectId')}
          />
          <Input label="Lesson date" type="date" {...form.register('lessonDate')} />
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" {...form.register('isPublished')} /> Publish now
          </label>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea className="min-h-24 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900" {...form.register('description')} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!uploadFor} onClose={() => setUploadFor(null)} title="Upload lesson files" size="sm">
        <p className="mb-3 text-sm text-ink-500">Allowed: pdf, doc, docx, mp4, webm, mp3, wav, jpg, jpeg, png</p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.mp4,.webm,.mp3,.wav,.jpg,.jpeg,.png"
          onChange={(e) => {
            if (e.target.files?.length) upload.mutate(e.target.files)
          }}
        />
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setUploadFor(null)}>Close</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete lesson?"
        message="Students will no longer see this lesson."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onConfirm={async () => { if (deleteId) await remove.mutateAsync(deleteId) }}
      />
    </div>
  )
}
