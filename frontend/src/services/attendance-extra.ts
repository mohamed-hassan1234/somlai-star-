import { api } from '@/services/api'
import type { AttendanceStatus } from '@/types'
import { serviceError } from './errors'

export async function listPracticeAttendance(filters?: { classId?: string; date?: string }) {
  let q = api
    .from('practice_attendance')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*))')
    .order('practice_date', { ascending: false })
  if (filters?.classId) q = q.eq('class_id', filters.classId)
  if (filters?.date) q = q.eq('practice_date', filters.date)
  const { data, error } = await q
  if (error) throw serviceError(error, 'Failed to load practice attendance')
  return data ?? []
}

export async function upsertPracticeAttendance(
  records: {
    student_id: string
    class_id: string
    recorded_by: string
    practice_date: string
    status: AttendanceStatus
    notes?: string | null
  }[],
) {
  const { error } = await api.from('practice_attendance').upsert(records, {
    onConflict: 'student_id,practice_date',
  })
  if (error) throw serviceError(error, 'Failed to save practice attendance')
}

export {
  listActivityAttendance,
  upsertActivityAttendance,
  type ActivityAttendanceEntry,
} from './outsideActivities'
