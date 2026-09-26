import { api } from '@/services/api'
import { serviceError } from './errors'

export interface ManagerDashboardStats {
  students: number
  teachers: number
  classes: number
  activeStudents: number
  disabledAccounts: number
  pendingResults: number
  unpaidFinance: number
  recentNotices: number
}

export interface TeacherDashboardStats {
  classes: number
  students: number
  lessons: number
  quizzes: number
  pendingLeave: number
  todayAttendanceRecorded: boolean
}

export interface StudentDashboardStats {
  attendancePercent: number
  publishedResults: number
  upcomingQuizzes: number
  unreadNotifications: number
  recentLessons: number
}

export async function getManagerDashboard(): Promise<ManagerDashboardStats> {
  const [
    studentsRes,
    teachersRes,
    classesRes,
    activeStudentsRes,
    disabledRes,
    pendingResultsRes,
    unpaidRes,
    noticesRes,
  ] = await Promise.all([
    api.from('students').select('*', { count: 'exact', head: true }),
    api.from('teachers').select('*', { count: 'exact', head: true }),
    api.from('classes').select('*', { count: 'exact', head: true }).eq('is_active', true),
    api
      .from('students')
      .select('id, profile:profiles!students_profile_id_fkey!inner(status)', { count: 'exact', head: true })
      .eq('profile.status', 'active'),
    api.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'disabled'),
    api
      .from('result_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    api.from('finance_records').select('*', { count: 'exact', head: true }).eq('status', 'unpaid'),
    api.from('notices').select('*', { count: 'exact', head: true }).eq('is_published', true),
  ])

  for (const res of [
    studentsRes,
    teachersRes,
    classesRes,
    activeStudentsRes,
    disabledRes,
    pendingResultsRes,
    unpaidRes,
    noticesRes,
  ]) {
    if (res.error) throw serviceError(res.error, 'Failed to load manager dashboard')
  }

  return {
    students: studentsRes.count ?? 0,
    teachers: teachersRes.count ?? 0,
    classes: classesRes.count ?? 0,
    activeStudents: activeStudentsRes.count ?? 0,
    disabledAccounts: disabledRes.count ?? 0,
    pendingResults: pendingResultsRes.count ?? 0,
    unpaidFinance: unpaidRes.count ?? 0,
    recentNotices: noticesRes.count ?? 0,
  }
}

export async function getTeacherDashboard(teacherId: string): Promise<TeacherDashboardStats> {
  const today = new Date().toISOString().slice(0, 10)

  const { count: classCount, error: classError } = await api
    .from('teacher_classes')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
  if (classError) throw serviceError(classError, 'Failed to count teacher classes')

  const { data: classRows, error: classRowsError } = await api
    .from('teacher_classes')
    .select('class_id')
    .eq('teacher_id', teacherId)
  if (classRowsError) throw serviceError(classRowsError, 'Failed to load teacher classes')

  const classIds = (classRows ?? []).map((r) => r.class_id)

  let students = 0
  if (classIds.length) {
    const { count, error } = await api
      .from('students')
      .select('*', { count: 'exact', head: true })
      .in('class_id', classIds)
    if (error) throw serviceError(error, 'Failed to count students')
    students = count ?? 0
  }

  const [lessonsRes, quizzesRes, leaveRes, attRes] = await Promise.all([
    api
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .is('deleted_at', null),
    api
      .from('quizzes')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .is('deleted_at', null),
    api
      .from('teacher_leave')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('status', 'pending'),
    api
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('attendance_date', today),
  ])

  for (const res of [lessonsRes, quizzesRes, leaveRes, attRes]) {
    if (res.error) throw serviceError(res.error, 'Failed to load teacher dashboard')
  }

  return {
    classes: classCount ?? 0,
    students,
    lessons: lessonsRes.count ?? 0,
    quizzes: quizzesRes.count ?? 0,
    pendingLeave: leaveRes.count ?? 0,
    todayAttendanceRecorded: (attRes.count ?? 0) > 0,
  }
}

export async function getStudentDashboard(input: {
  studentId: string
  profileId: string
  classId: string | null
}): Promise<StudentDashboardStats> {
  const { data: attendanceRows, error: attError } = await api
    .from('attendance')
    .select('status')
    .eq('student_id', input.studentId)

  if (attError) throw serviceError(attError, 'Failed to load attendance for dashboard')

  const total = attendanceRows?.length ?? 0
  const present =
    attendanceRows?.filter((r) => r.status === 'present' || r.status === 'late').length ?? 0
  const attendancePercent = total === 0 ? 0 : Math.round((present / total) * 1000) / 10

  const { count: publishedResults, error: resError } = await api
    .from('results')
    .select('*, submission:result_submissions!inner(status)', { count: 'exact', head: true })
    .eq('student_id', input.studentId)
    .eq('submission.status', 'published')
  if (resError) throw serviceError(resError, 'Failed to count published results')

  let upcomingQuizzes = 0
  let recentLessons = 0
  if (input.classId) {
    const [quizRes, lessonRes] = await Promise.all([
      api
        .from('quizzes')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', input.classId)
        .eq('is_published', true)
        .is('deleted_at', null),
      api
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', input.classId)
        .eq('is_published', true)
        .is('deleted_at', null),
    ])
    if (quizRes.error) throw serviceError(quizRes.error, 'Failed to count quizzes')
    if (lessonRes.error) throw serviceError(lessonRes.error, 'Failed to count lessons')
    upcomingQuizzes = quizRes.count ?? 0
    recentLessons = lessonRes.count ?? 0
  }

  const { count: unreadNotifications, error: notifError } = await api
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', input.profileId)
    .eq('is_read', false)
  if (notifError) throw serviceError(notifError, 'Failed to count notifications')

  return {
    attendancePercent,
    publishedResults: publishedResults ?? 0,
    upcomingQuizzes,
    unreadNotifications: unreadNotifications ?? 0,
    recentLessons,
  }
}

export async function getManagerStats() {
  const stats = await getManagerDashboard()
  const { data: recentAudit } = await api
    .from('audit_logs')
    .select('*, actor:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(12)
  const { data: attendanceTrend } = await api
    .from('attendance')
    .select('attendance_date, status')
    .gte('attendance_date', new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10))
    .order('attendance_date')
  return {
    students: stats.students,
    activeStudents: stats.activeStudents,
    disabledAccounts: stats.disabledAccounts,
    teachers: stats.teachers,
    classes: stats.classes,
    unpaid: stats.unpaidFinance,
    recentAudit: recentAudit ?? [],
    attendanceTrend: attendanceTrend ?? [],
  }
}

export async function getTeacherStats(teacherId: string) {
  const stats = await getTeacherDashboard(teacherId)
  return {
    classes: stats.classes,
    lessons: stats.lessons,
    quizzes: stats.quizzes,
    pendingLeave: stats.pendingLeave,
  }
}

export async function getStudentStats(studentId: string, classId: string | null) {
  const { data: session } = await api.auth.getUser()
  const stats = await getStudentDashboard({
    studentId,
    profileId: session.user?.id ?? '',
    classId,
  })
  return {
    attendancePct: stats.attendancePercent,
    publishedResults: stats.publishedResults,
    quizzes: stats.upcomingQuizzes,
    lessons: stats.recentLessons,
  }
}
