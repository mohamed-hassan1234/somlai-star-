import { api } from '@/services/api'
import type { AttendanceRecord, AttendanceStatus } from '@/types'
import { serviceError } from './errors'

export interface AttendanceEntry {
  studentId: string
  status: AttendanceStatus
  notes?: string
}

export async function recordBulkAttendance(input: {
  classId: string
  teacherId: string
  attendanceDate: string
  entries: AttendanceEntry[]
}): Promise<AttendanceRecord[]> {
  if (!input.entries.length) throw new Error('No attendance entries provided')

  const rows = input.entries.map((e) => ({
    student_id: e.studentId,
    class_id: input.classId,
    teacher_id: input.teacherId,
    attendance_date: input.attendanceDate,
    status: e.status,
    notes: e.notes ?? null,
  }))

  const { data, error } = await api
    .from('attendance')
    .upsert(rows, { onConflict: 'student_id,class_id,attendance_date' })
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*))')

  if (error) throw serviceError(error, 'Failed to record attendance')
  return (data ?? []) as AttendanceRecord[]
}

export async function getAttendanceHistory(filters: {
  classId?: string
  studentId?: string
  teacherId?: string
  fromDate?: string
  toDate?: string
}): Promise<AttendanceRecord[]> {
  let query = api
    .from('attendance')
    .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*))')
    .order('attendance_date', { ascending: false })

  if (filters.classId) query = query.eq('class_id', filters.classId)
  if (filters.studentId) query = query.eq('student_id', filters.studentId)
  if (filters.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters.fromDate) query = query.gte('attendance_date', filters.fromDate)
  if (filters.toDate) query = query.lte('attendance_date', filters.toDate)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load attendance history')
  return (data ?? []) as AttendanceRecord[]
}

export interface MonthlyAttendanceSummary {
  studentId: string
  studentName: string
  studentCode: string
  present: number
  absent: number
  late: number
  leave: number
  permission: number
  total: number
  percentPresent: number
}

export async function getMonthlyAttendanceSummary(input: {
  classId: string
  year: number
  month: number
}): Promise<MonthlyAttendanceSummary[]> {
  const start = `${input.year}-${String(input.month).padStart(2, '0')}-01`
  const endDate = new Date(input.year, input.month, 0)
  const end = `${input.year}-${String(input.month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  const { data: students, error: studentsError } = await api
    .from('students')
    .select('id, student_id, profile:profiles!students_profile_id_fkey(full_name)')
    .eq('class_id', input.classId)

  if (studentsError) throw serviceError(studentsError, 'Failed to load class students')

  const { data: records, error } = await api
    .from('attendance')
    .select('student_id, status')
    .eq('class_id', input.classId)
    .gte('attendance_date', start)
    .lte('attendance_date', end)

  if (error) throw serviceError(error, 'Failed to load monthly attendance')

  const byStudent = new Map<string, { present: number; absent: number; late: number; leave: number; permission: number }>()

  for (const r of records ?? []) {
    const cur = byStudent.get(r.student_id) ?? { present: 0, absent: 0, late: 0, leave: 0, permission: 0 }
    if (r.status === 'present') cur.present++
    else if (r.status === 'absent') cur.absent++
    else if (r.status === 'late') cur.late++
    else if (r.status === 'leave') cur.leave++
    else if (r.status === 'permission') cur.permission++
    byStudent.set(r.student_id, cur)
  }

  return (students ?? []).map((s) => {
    const counts = byStudent.get(s.id) ?? { present: 0, absent: 0, late: 0, leave: 0, permission: 0 }
    const total = counts.present + counts.absent + counts.late + counts.leave + counts.permission
    const attended = counts.present + counts.late
    const profile = s.profile as { full_name?: string } | { full_name?: string }[] | null
    const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name

    return {
      studentId: s.id,
      studentName: name ?? 'Unknown',
      studentCode: s.student_id,
      ...counts,
      total,
      percentPresent: total === 0 ? 0 : Math.round((attended / total) * 1000) / 10,
    }
  })
}
