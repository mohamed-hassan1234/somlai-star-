import { api } from '@/services/api'
import type { Lesson, LessonFile } from '@/types'
import { assertData, serviceError } from './errors'

const BUCKET = 'lesson-files'

export async function listLessons(filters?: {
  classId?: string
  teacherId?: string
  publishedOnly?: boolean
}): Promise<Lesson[]> {
  let query = api
    .from('lessons')
    .select('*, files:lesson_files(*), subject:subjects(*), class:classes(*)')
    .is('deleted_at', null)
    .order('lesson_date', { ascending: false })

  if (filters?.classId) query = query.eq('class_id', filters.classId)
  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.publishedOnly) query = query.eq('is_published', true)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load lessons')
  return (data ?? []) as Lesson[]
}

export async function getLesson(id: string): Promise<Lesson> {
  const { data, error } = await api
    .from('lessons')
    .select('*, files:lesson_files(*), subject:subjects(*), class:classes(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  return assertData(data as Lesson, error, 'Lesson not found')
}

export async function createLesson(input: {
  title: string
  description?: string
  subjectId?: string | null
  classId: string
  teacherId: string
  lessonDate: string
  isPublished?: boolean
}): Promise<Lesson> {
  const { data, error } = await api
    .from('lessons')
    .insert({
      title: input.title,
      description: input.description ?? null,
      subject_id: input.subjectId || null,
      class_id: input.classId,
      teacher_id: input.teacherId,
      lesson_date: input.lessonDate,
      is_published: input.isPublished ?? false,
    })
    .select('*, files:lesson_files(*), subject:subjects(*), class:classes(*)')
    .single()

  return assertData(data as Lesson, error, 'Failed to create lesson')
}

export async function updateLesson(
  id: string,
  updates: {
    title?: string
    description?: string | null
    subjectId?: string | null
    classId?: string
    lessonDate?: string
    isPublished?: boolean
  },
): Promise<Lesson> {
  const patch: Record<string, unknown> = {}
  if (updates.title !== undefined) patch.title = updates.title
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.subjectId !== undefined) patch.subject_id = updates.subjectId || null
  if (updates.classId !== undefined) patch.class_id = updates.classId
  if (updates.lessonDate !== undefined) patch.lesson_date = updates.lessonDate
  if (updates.isPublished !== undefined) patch.is_published = updates.isPublished

  const { data, error } = await api
    .from('lessons')
    .update(patch)
    .eq('id', id)
    .select('*, files:lesson_files(*), subject:subjects(*), class:classes(*)')
    .single()

  return assertData(data as Lesson, error, 'Failed to update lesson')
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await api
    .from('lessons')
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq('id', id)

  if (error) throw serviceError(error, 'Failed to delete lesson')
}

export async function uploadLessonFile(
  lessonId: string,
  file: File,
  teacherProfileId: string,
): Promise<LessonFile> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${teacherProfileId}/${lessonId}/${Date.now()}_${safeName}`

  const { error: uploadError } = await api.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (uploadError) throw serviceError(uploadError, 'Failed to upload lesson file')

  const ext = safeName.split('.').pop()?.toLowerCase() ?? 'file'
  const { data, error } = await api
    .from('lesson_files')
    .insert({
      lesson_id: lessonId,
      file_name: file.name,
      file_path: path,
      file_type: ext,
      mime_type: file.type || null,
      file_size: file.size,
    })
    .select('*')
    .single()

  if (error) {
    await api.storage.from(BUCKET).remove([path])
    throw serviceError(error, 'Failed to save lesson file metadata')
  }

  return data as LessonFile
}

/** Signed URL for private viewing — never use public URLs. */
export async function getLessonFileSignedUrl(
  filePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await api.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw serviceError(error, 'Failed to create signed URL for lesson file')
  }
  return data.signedUrl
}

export async function deleteLessonFile(fileId: string): Promise<void> {
  const { data: file, error: fetchError } = await api
    .from('lesson_files')
    .select('*')
    .eq('id', fileId)
    .single()

  if (fetchError || !file) throw serviceError(fetchError, 'Lesson file not found')

  await api.storage.from(BUCKET).remove([file.file_path])
  const { error } = await api.from('lesson_files').delete().eq('id', fileId)
  if (error) throw serviceError(error, 'Failed to delete lesson file')
}

export async function uploadLessonFiles(lessonId: string, userId: string, files: File[]) {
  const out: LessonFile[] = []
  for (const file of files) {
    out.push(await uploadLessonFile(lessonId, file, userId))
  }
  return out
}

export async function removeLessonFile(file: LessonFile | string) {
  const id = typeof file === 'string' ? file : file.id
  return deleteLessonFile(id)
}
