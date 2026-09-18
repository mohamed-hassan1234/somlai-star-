import { api } from '@/services/api'
import type { AttendanceRecord, AttendanceStatus } from '@/types'
import { serviceError } from './errors'
import {
  getAttendanceHistory,
  getMonthlyAttendanceSummary,
  recordBulkAttendance,
} from './attendance-core'

export * from './attendance-core'
export * from './attendance-extra'

/** Alias used by UI pages */
export async function listAttendance(filters: {
  classId?: string
  studentId?: string
  teacherId?: string
  from?: string
  to?: string
  fromDate?: string
  toDate?: string
  month?: number
  year?: number
} = {}) {
  let fromDate = filters.from ?? filters.fromDate
  let toDate = filters.to ?? filters.toDate
  if (filters.month && filters.year) {
    fromDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
    toDate = new Date(filters.year, filters.month, 0).toISOString().slice(0, 10)
  }
  return getAttendanceHistory({
    classId: filters.classId,
    studentId: filters.studentId,
    teacherId: filters.teacherId,
    fromDate,
    toDate,
  })
}

export async function listTeacherAttendance(filters?: {
  teacherId?: string
  from?: string
  to?: string
}) {
  let query = api
    .from('teacher_attendance')
    .select('*, teacher:teachers(*, profile:profiles(*)), recorder:recorded_by(id, full_name, login_id, role)')
    .order('attendance_date', { ascending: false })
    .limit(500)
  if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId)
  if (filters?.from) query = query.gte('attendance_date', filters.from)
  if (filters?.to) query = query.lte('attendance_date', filters.to)
  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load teacher attendance')
  return data ?? []
}

export async function upsertTeacherAttendance(
  input:
    | {
        teacherId: string
        attendanceDate: string
        status: AttendanceStatus
        notes?: string
      }
    | {
        teacher_id: string
        attendance_date: string
        status: AttendanceStatus
        notes?: string | null
        recorded_by?: string
      }[],
) {
  if (Array.isArray(input)) {
    const { error } = await api.from('teacher_attendance').upsert(input, {
      onConflict: 'teacher_id,attendance_date',
    })
    if (error) throw serviceError(error, 'Failed to save teacher attendance')
    return
  }
  const { data: user } = await api.auth.getUser()
  const { data, error } = await api
    .from('teacher_attendance')
    .upsert(
      {
        teacher_id: input.teacherId,
        attendance_date: input.attendanceDate,
        status: input.status,
        notes: input.notes ?? null,
        recorded_by: user.user?.id ?? null,
        is_auto: false,
      },
      { onConflict: 'teacher_id,attendance_date' },
    )
    .select()
    .single()
  if (error) throw serviceError(error, 'Failed to save teacher attendance')
  return data
}

export async function upsertAttendance(
  input:
    | {
        classId: string
        teacherId: string
        attendanceDate: string
        entries: { studentId: string; status: AttendanceStatus; notes?: string }[]
      }
    | {
        student_id: string
        class_id: string
        teacher_id: string
        attendance_date: string
        status: AttendanceStatus
        notes?: string | null
      }[],
) {
  if (Array.isArray(input)) {
    if (!input.length) return []
    const first = input[0]
    return recordBulkAttendance({
      classId: first.class_id,
      teacherId: first.teacher_id,
      attendanceDate: first.attendance_date,
      entries: input.map((r) => ({
        studentId: r.student_id,
        status: r.status,
        notes: r.notes ?? undefined,
      })),
    })
  }
  return recordBulkAttendance(input)
}

export async function monthlySummary(
  studentIdOrInput: string | { classId: string; year: number; month: number },
  year?: number,
  month?: number,
): Promise<
  | Awaited<ReturnType<typeof getMonthlyAttendanceSummary>>
  | { present: number; absent: number; late: number; leave: number; permission: number; total: number; percentage?: number }
> {
  if (typeof studentIdOrInput === 'object') {
    return getMonthlyAttendanceSummary(studentIdOrInput)
  }
  const y = year!
  const m = month!
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const endDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
  const records = await listAttendance({
    studentId: studentIdOrInput,
    from: start,
    to: end,
  })
  const totals = { present: 0, absent: 0, late: 0, leave: 0, permission: 0, total: records.length, percentage: 0 }
  for (const r of records) {
    if (r.status in totals) totals[r.status as 'present' | 'absent' | 'late' | 'leave' | 'permission'] += 1
  }
  totals.percentage =
    totals.total === 0 ? 0 : Math.round(((totals.present + totals.late) / totals.total) * 1000) / 10
  return totals
}

export type { AttendanceRecord }
