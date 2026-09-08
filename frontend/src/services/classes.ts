import { api } from '@/services/api'
import type { ClassRecord } from '@/types'
import { assertData, serviceError } from './errors'

export async function listClasses(filters?: {
  academicYearId?: string
  activeOnly?: boolean
}): Promise<ClassRecord[]> {
  let query = api.from('classes').select('*').order('schedule_slot').order('name')

  if (filters?.academicYearId) query = query.eq('academic_year_id', filters.academicYearId)
  if (filters?.activeOnly !== false) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load classes')
  return (data ?? []) as ClassRecord[]
}

export async function getClass(id: string): Promise<ClassRecord> {
  const { data, error } = await api.from('classes').select('*').eq('id', id).single()
  return assertData(data as ClassRecord, error, 'Class not found')
}

export async function createClass(input: {
  name: string
  scheduleSlot: string
  description?: string
  academicYearId?: string
  capacity?: number
}): Promise<ClassRecord> {
  const { data, error } = await api
    .from('classes')
    .insert({
      name: input.name,
      schedule_slot: input.scheduleSlot,
      description: input.description ?? null,
      academic_year_id: input.academicYearId ?? null,
      capacity: input.capacity ?? 40,
      is_active: true,
    })
    .select('*')
    .single()

  const row = assertData(data as ClassRecord, error, 'Failed to create class')
  await api.rpc('write_audit', {
    p_action: 'create_class',
    p_entity: 'classes',
    p_entity_id: row.id,
    p_metadata: input,
  })
  return row
}

export async function updateClass(
  id: string,
  updates: {
    name?: string
    scheduleSlot?: string
    description?: string | null
    academicYearId?: string | null
    capacity?: number
    isActive?: boolean
  },
): Promise<ClassRecord> {
  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined) patch.name = updates.name
  if (updates.scheduleSlot !== undefined) patch.schedule_slot = updates.scheduleSlot
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.academicYearId !== undefined) patch.academic_year_id = updates.academicYearId
  if (updates.capacity !== undefined) patch.capacity = updates.capacity
  if (updates.isActive !== undefined) patch.is_active = updates.isActive

  const { data, error } = await api.from('classes').update(patch).eq('id', id).select('*').single()
  return assertData(data as ClassRecord, error, 'Failed to update class')
}

/** Assign a teacher to a class (manager). */
export async function assignTeacherToClass(teacherId: string, classId: string): Promise<void> {
  const { error } = await api.from('teacher_classes').upsert(
    { teacher_id: teacherId, class_id: classId },
    { onConflict: 'teacher_id,class_id' },
  )
  if (error) throw serviceError(error, 'Failed to assign teacher to class')

  await api.rpc('write_audit', {
    p_action: 'assign_teacher_class',
    p_entity: 'teacher_classes',
    p_entity_id: `${teacherId}:${classId}`,
    p_metadata: { teacherId, classId },
  })
}

export async function unassignTeacherFromClass(teacherId: string, classId: string): Promise<void> {
  const { error } = await api
    .from('teacher_classes')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)

  if (error) throw serviceError(error, 'Failed to unassign teacher from class')
}

export async function listClassTeachers(classId: string) {
  const { data, error } = await api
    .from('teacher_classes')
    .select('*, teacher:teachers(*, profile:profiles(*))')
    .eq('class_id', classId)

  if (error) throw serviceError(error, 'Failed to load class teachers')
  return data ?? []
}

export {
  listSubjects,
  createSubject,
  updateSubject,
  listAcademicYears,
  createAcademicYear,
  updateAcademicYear,
} from './subjects'

export async function getClassStudents(classId: string) {
  const { data, error } = await api
    .from('students')
    .select('*, profile:profiles!students_profile_id_fkey(*)')
    .eq('class_id', classId)
    .order('student_id')
  if (error) throw serviceError(error, 'Failed to load class students')
  return data ?? []
}
