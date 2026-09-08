import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, HelpCircle, School, CalendarOff, Upload, FileText, Video, Music, File, Image } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { getTeacherStats } from '@/services/dashboard'
import { uploadLessonFile } from '@/services/lessons'
import { getTeacherClasses } from '@/services/teachers'
import { api } from '@/services/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { getErrorMessage } from '@/lib/utils'
import type { ClassRecord } from '@/types'

const CONTENT_TYPES = [
  { value: 'pdf', label: 'PDF', icon: FileText, accept: '.pdf' },
  { value: 'video', label: 'Video', icon: Video, accept: '.mp4,.webm' },
  { value: 'audio', label: 'Audio / Sound', icon: Music, accept: '.mp3,.wav' },
  { value: 'doc', label: 'Word Document', icon: File, accept: '.doc,.docx' },
  { value: 'image', label: 'Picture / Image', icon: Image, accept: '.jpg,.jpeg,.png' },
] as const

type ContentType = (typeof CONTENT_TYPES)[number]['value']

export function TeacherOverviewPage() {
  const { user } = useAuth()
  const teacherId = user!.teacher!.id
  const qc = useQueryClient()

  const [classId, setClassId] = useState('')
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<ContentType | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-stats', teacherId],
    queryFn: () => getTeacherStats(teacherId),
  })

  const classes = useQuery({
    queryKey: ['teacher-classes', teacherId],
    queryFn: () => getTeacherClasses(teacherId),
  })

  const upload = useMutation({
    mutationFn: async () => {
      if (!classId || !title.trim() || !file || !contentType) return
      const tid = user!.teacher!.id
      const pid = user!.profile.id

      const { data: lesson, error } = await api
        .from('lessons')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          class_id: classId,
          teacher_id: tid,
          lesson_date: new Date().toISOString().slice(0, 10),
          is_published: true,
        })
        .select()
        .single()

      if (error || !lesson) {
        throw new Error(error?.message || 'Failed to create lesson')
      }

      await uploadLessonFile(lesson.id, file, pid)
      return lesson
    },
    onSuccess: (lesson) => {
      toast.success(`"${lesson.title}" uploaded successfully`)
      setClassId('')
      setTitle('')
      setContentType('')
      setFile(null)
      setDescription('')
      qc.invalidateQueries({ queryKey: ['teacher-stats', teacherId] })
      qc.invalidateQueries({ queryKey: ['lessons', teacherId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const selectedType = CONTENT_TYPES.find((t) => t.value === contentType)
  const canSubmit = classId && title.trim() && contentType && file

  return (
    <div>
      <PageHeader title="Overview" description={`Welcome, ${user!.profile.full_name}.`} />
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="My classes" value={data?.classes ?? 0} icon={<School className="h-5 w-5" />} />
          <StatCard label="Lessons" value={data?.lessons ?? 0} icon={<BookOpen className="h-5 w-5" />} />
          <StatCard label="Quizzes" value={data?.quizzes ?? 0} icon={<HelpCircle className="h-5 w-5" />} />
          <StatCard label="Pending leave" value={data?.pendingLeave ?? 0} icon={<CalendarOff className="h-5 w-5" />} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold mb-4">Upload Lesson</h2>
        <div className="rounded-2xl border border-ink-200 bg-white p-6 dark:border-ink-700 dark:bg-ink-900 space-y-4">
          <Select
            label="Select Class"
            placeholder="Choose a class"
            options={
              (classes.data as ClassRecord[] | undefined)?.map((c) => ({
                value: c.id,
                label: c.name,
              })) ?? []
            }
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-200">
              Lesson Title
            </label>
            <input
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 dark:placeholder:text-ink-500"
              placeholder="Enter lesson title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-200">
              Content Type
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {CONTENT_TYPES.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setContentType(t.value)
                      setFile(null)
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition ${
                      contentType === t.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                        : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {selectedType && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-200">
                Upload File
              </label>
              <input
                type="file"
                accept={selectedType.accept}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    if (f.size > 100 * 1024 * 1024) {
                      toast.error('File must be under 100MB')
                      return
                    }
                    setFile(f)
                  }
                }}
                className="w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/20 dark:file:text-brand-300"
              />
              <p className="text-xs text-ink-500">
                Max size: 100MB. Accepted: {selectedType.accept}
              </p>
              {file && (
                <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800">
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-ink-400">
                    ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-auto text-xs font-medium text-danger hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-200">
              Description
            </label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 dark:placeholder:text-ink-500"
              placeholder="Describe what this lesson is about"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button
              leftIcon={<Upload className="h-4 w-4" />}
              onClick={() => upload.mutate()}
              loading={upload.isPending}
              disabled={!canSubmit}
            >
              Post / Upload
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
