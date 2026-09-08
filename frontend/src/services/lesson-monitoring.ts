import { api } from '@/services/api'
import type { AttendanceStatus } from '@/types'
import { serviceError } from './errors'

export interface LessonMonitoringRecord {
  id: string
  student_id: string
  class_id: string
  teacher_id: string
  monitoring_date: string
  status: AttendanceStatus
  notes: string | null
  recorded_by: string | null
  created_at: string
  student?: {
    id: string
    student_id: string
    profile?: { full_name?: string }
    class?: { id: string; name?: string }
  } | null
  class?: { id: string; name?: string } | null
}

export interface LessonMonitoringEntry {
  studentId: string
  status: AttendanceStatus
  notes?: string
}

export async function recordBulkLessonMonitoring(input: {
  classId: string
  teacherId: string
  monitoringDate: string
  entries: LessonMonitoringEntry[]
}): Promise<LessonMonitoringRecord[]> {
  if (!input.entries.length) throw new Error('No lesson monitoring entries provided')

  const rows = input.entries.map((e) => ({
    student_id: e.studentId,
    class_id: input.classId,
    teacher_id: input.teacherId,
    monitoring_date: input.monitoringDate,
    status: e.status,
    notes: e.notes ?? null,
  }))

  const { data, error } = await api
    .from('lesson_monitoring')
    .upsert(rows, { onConflict: 'student_id,class_id,monitoring_date' })
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*))')

  if (error) throw serviceError(error, 'Failed to record lesson monitoring')
  return (data ?? []) as LessonMonitoringRecord[]
}

export async function listLessonMonitoring(filters: {
  classId?: string
  teacherId?: string
  monitoringDate?: string
  fromDate?: string
  toDate?: string
}): Promise<LessonMonitoringRecord[]> {
  let query = api
    .from('lesson_monitoring')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*)), class:classes(*)')
    .order('monitoring_date', { ascending: false })

  if (filters.classId) query = query.eq('class_id', filters.classId)
  if (filters.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters.monitoringDate) query = query.eq('monitoring_date', filters.monitoringDate)
  if (filters.fromDate) query = query.gte('monitoring_date', filters.fromDate)
  if (filters.toDate) query = query.lte('monitoring_date', filters.toDate)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load lesson monitoring')
  return (data ?? []) as LessonMonitoringRecord[]
}

export async function listChildLessonMonitoring(studentIds: string[]): Promise<LessonMonitoringRecord[]> {
  if (!studentIds.length) return []
  const { data, error } = await api
    .from('lesson_monitoring')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*), class:classes(*))')
    .in('student_id', studentIds)
    .order('monitoring_date', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load lesson monitoring')
  return (data ?? []) as LessonMonitoringRecord[]
}
