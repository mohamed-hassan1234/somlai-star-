import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { GuestRoute, ProtectedRoute } from './ProtectedRoute'
import { PageLoader } from '@/components/ui/PageLoader'
import { ROLE_HOME, type AppRole } from '@/types'

const PublicLayout = lazy(() => import('@/layouts/PublicLayout').then((m) => ({ default: m.PublicLayout })))
const HomePage = lazy(() => import('@/pages/public/HomePage').then((m) => ({ default: m.HomePage })))
const AboutPage = lazy(() => import('@/pages/public/AboutPage').then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import('@/pages/public/ContactPage').then((m) => ({ default: m.ContactPage })))

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
)

const ManagerLayout = lazy(() => import('@/layouts/ManagerLayout').then((m) => ({ default: m.ManagerLayout })))
const TeacherLayout = lazy(() => import('@/layouts/TeacherLayout').then((m) => ({ default: m.TeacherLayout })))
const StudentLayout = lazy(() => import('@/layouts/StudentLayout').then((m) => ({ default: m.StudentLayout })))
const ParentLayout = lazy(() => import('@/layouts/ParentLayout').then((m) => ({ default: m.ParentLayout })))
const CabaasLayout = lazy(() => import('@/layouts/CabaasLayout').then((m) => ({ default: m.CabaasLayout })))
const PracticeLayout = lazy(() => import('@/layouts/PracticeLayout').then((m) => ({ default: m.PracticeLayout })))
const PracticeTeacherLayout = lazy(() =>
  import('@/layouts/PracticeTeacherLayout').then((m) => ({ default: m.PracticeTeacherLayout })),
)
const SupervisorLayout = lazy(() => import('@/layouts/SupervisorLayout').then((m) => ({ default: m.SupervisorLayout })))
const FinanceLayout = lazy(() => import('@/layouts/FinanceLayout').then((m) => ({ default: m.FinanceLayout })))
const FinanceManagerLayout = lazy(() =>
  import('@/layouts/FinanceManagerLayout').then((m) => ({ default: m.FinanceManagerLayout })),
)
const CommitteeLayout = lazy(() => import('@/layouts/CommitteeLayout').then((m) => ({ default: m.CommitteeLayout })))
const AttendanceManagerLayout = lazy(() =>
  import('@/layouts/AttendanceManagerLayout').then((m) => ({ default: m.AttendanceManagerLayout })),
)

const NotificationsPage = lazy(() =>
  import('@/pages/shared/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
)
const ChatPage = lazy(() => import('@/pages/shared/ChatPage').then((m) => ({ default: m.ChatPage })))
const SettingsPage = lazy(() => import('@/pages/shared/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const TeacherProfilePage = lazy(() =>
  import('@/pages/shared/ProfilePage').then((m) => ({ default: m.TeacherProfilePage })),
)
const StudentProfilePage = lazy(() =>
  import('@/pages/shared/ProfilePage').then((m) => ({ default: m.StudentProfilePage })),
)

const ManagerOverviewPage = lazy(() =>
  import('@/pages/manager/OverviewPage').then((m) => ({ default: m.ManagerOverviewPage })),
)
const ManagerStudentsPage = lazy(() =>
  import('@/pages/manager/StudentsPage').then((m) => ({ default: m.ManagerStudentsPage })),
)
const ManagerParentsPage = lazy(() =>
  import('@/pages/manager/ParentsPage').then((m) => ({ default: m.ManagerParentsPage })),
)
const ManagerTeachersPage = lazy(() =>
  import('@/pages/manager/TeachersPage').then((m) => ({ default: m.ManagerTeachersPage })),
)
const ManagerClassesPage = lazy(() =>
  import('@/pages/manager/ClassesPage').then((m) => ({ default: m.ManagerClassesPage })),
)
const ManagerSubjectsPage = lazy(() =>
  import('@/pages/manager/SubjectsPage').then((m) => ({ default: m.ManagerSubjectsPage })),
)
const ManagerAcademicYearsPage = lazy(() =>
  import('@/pages/manager/AcademicYearsPage').then((m) => ({ default: m.ManagerAcademicYearsPage })),
)
const ManagerAttendancePage = lazy(() =>
  import('@/pages/manager/AttendancePage').then((m) => ({ default: m.ManagerAttendancePage })),
)
const ManagerFinancePage = lazy(() =>
  import('@/pages/manager/FinancePage').then((m) => ({ default: m.ManagerFinancePage })),
)
const ManagerResultsPage = lazy(() =>
  import('@/pages/manager/ResultsPage').then((m) => ({ default: m.ManagerResultsPage })),
)
const ManagerOutsideActivitiesPage = lazy(() =>
  import('@/pages/manager/OutsideActivitiesPage').then((m) => ({ default: m.ManagerOutsideActivitiesPage })),
)
const ManagerOutsideActivityCommitteePage = lazy(() =>
  import('@/pages/manager/OutsideActivityCommitteePage').then((m) => ({
    default: m.ManagerOutsideActivityCommitteePage,
  })),
)
const ManagerAuditLogsPage = lazy(() =>
  import('@/pages/manager/AuditLogsPage').then((m) => ({ default: m.ManagerAuditLogsPage })),
)
const ManagerStudentProfilePage = lazy(() =>
  import('@/pages/manager/StudentProfilePage').then((m) => ({ default: m.ManagerStudentProfilePage })),
)
const ManagerLeavePage = lazy(() =>
  import('@/pages/manager/LeaveAndResetsPage').then((m) => ({ default: m.ManagerLeavePage })),
)
const ManagerPasswordResetsPage = lazy(() =>
  import('@/pages/manager/LeaveAndResetsPage').then((m) => ({ default: m.ManagerPasswordResetsPage })),
)
const ManagerNoticesPage = lazy(() =>
  import('@/pages/manager/NoticesPage').then((m) => ({ default: m.ManagerNoticesPage })),
)
const ManagerBackupPage = lazy(() =>
  import('@/pages/manager/BackupPage').then((m) => ({ default: m.ManagerBackupPage })),
)
const ManagerDataImportPage = lazy(() =>
  import('@/pages/manager/DataImportPage').then((m) => ({ default: m.ManagerDataImportPage })),
)

const TeacherOverviewPage = lazy(() =>
  import('@/pages/teacher/OverviewPage').then((m) => ({ default: m.TeacherOverviewPage })),
)
const TeacherClassesPage = lazy(() =>
  import('@/pages/teacher/ClassesPage').then((m) => ({ default: m.TeacherClassesPage })),
)
const TeacherLessonsPage = lazy(() =>
  import('@/pages/teacher/LessonsPage').then((m) => ({ default: m.TeacherLessonsPage })),
)
const TeacherAttendancePage = lazy(() =>
  import('@/pages/teacher/AttendancePage').then((m) => ({ default: m.TeacherAttendancePage })),
)
const TeacherLessonMonitoringPage = lazy(() =>
  import('@/pages/teacher/LessonMonitoringPage').then((m) => ({ default: m.TeacherLessonMonitoringPage })),
)
const TeacherQuizzesPage = lazy(() =>
  import('@/pages/teacher/QuizzesPage').then((m) => ({ default: m.TeacherQuizzesPage })),
)
const TeacherResultsPage = lazy(() =>
  import('@/pages/teacher/ResultsPage').then((m) => ({ default: m.TeacherResultsPage })),
)
const TeacherLeavePage = lazy(() =>
  import('@/pages/teacher/LeavePage').then((m) => ({ default: m.TeacherLeavePage })),
)

const StudentOverviewPage = lazy(() =>
  import('@/pages/student/OverviewPage').then((m) => ({ default: m.StudentOverviewPage })),
)
const StudentLessonsPage = lazy(() =>
  import('@/pages/student/LessonsPage').then((m) => ({ default: m.StudentLessonsPage })),
)
const StudentLessonViewerPage = lazy(() =>
  import('@/pages/student/LessonViewerPage').then((m) => ({ default: m.StudentLessonViewerPage })),
)
const StudentAttendancePage = lazy(() =>
  import('@/pages/student/AttendancePage').then((m) => ({ default: m.StudentAttendancePage })),
)
const StudentResultsPage = lazy(() =>
  import('@/pages/student/ResultsPage').then((m) => ({ default: m.StudentResultsPage })),
)
const StudentQuizzesPage = lazy(() =>
  import('@/pages/student/QuizzesPage').then((m) => ({ default: m.StudentQuizzesPage })),
)
const StudentExamsPage = lazy(() =>
  import('@/pages/student/ExamsPage').then((m) => ({ default: m.StudentExamsPage })),
)
const StudentNoticesPage = lazy(() =>
  import('@/pages/student/NoticesPage').then((m) => ({ default: m.StudentNoticesPage })),
)
const StudentAiToolsPage = lazy(() =>
  import('@/pages/student/AiToolsPage').then((m) => ({ default: m.StudentAiToolsPage })),
)

const ParentOverviewPage = lazy(() =>
  import('@/pages/parent/ParentPages').then((m) => ({ default: m.ParentOverviewPage })),
)
const ParentAttendancePage = lazy(() =>
  import('@/pages/parent/ParentPages').then((m) => ({ default: m.ParentAttendancePage })),
)
const ParentResultsPage = lazy(() =>
  import('@/pages/parent/ParentPages').then((m) => ({ default: m.ParentResultsPage })),
)
const ParentLessonsPage = lazy(() =>
  import('@/pages/parent/ParentPages').then((m) => ({ default: m.ParentLessonsPage })),
)
const ParentBehaviorPage = lazy(() =>
  import('@/pages/parent/ParentPages').then((m) => ({ default: m.ParentBehaviorPage })),
)
const ParentNoticesPage = lazy(() =>
  import('@/pages/parent/ParentPages').then((m) => ({ default: m.ParentNoticesPage })),
)
const ParentLessonMonitoringPage = lazy(() =>
  import('@/pages/parent/ParentPages').then((m) => ({ default: m.ParentLessonMonitoringPage })),
)
const ParentFinancePage = lazy(() =>
  import('@/pages/parent/ParentPages').then((m) => ({ default: m.ParentFinancePage })),
)

const LessonMonitoringReviewPage = lazy(() =>
  import('@/pages/shared/LessonMonitoringReview').then((m) => ({ default: m.LessonMonitoringReviewPage })),
)

const CabaasOverviewPage = lazy(() =>
  import('@/pages/cabaas/OverviewPage').then((m) => ({ default: m.CabaasOverviewPage })),
)
const CabaasResultsReviewPage = lazy(() =>
  import('@/pages/cabaas/ResultsReviewPage').then((m) => ({ default: m.CabaasResultsReviewPage })),
)
const CabaasTeacherAttendancePage = lazy(() =>
  import('@/pages/cabaas/AttendancePages').then((m) => ({ default: m.CabaasTeacherAttendancePage })),
)
const CabaasStudentAttendancePage = lazy(() =>
  import('@/pages/cabaas/AttendancePages').then((m) => ({ default: m.CabaasStudentAttendancePage })),
)
const AttendanceManagerOverviewPage = lazy(() =>
  import('@/pages/cabaas/AttendancePages').then((m) => ({ default: m.AttendanceManagerOverviewPage })),
)
const AttendanceManagerStudentPage = lazy(() =>
  import('@/pages/cabaas/AttendancePages').then((m) => ({ default: m.AttendanceManagerStudentPage })),
)
const AttendanceManagerTeacherPage = lazy(() =>
  import('@/pages/cabaas/AttendancePages').then((m) => ({ default: m.AttendanceManagerTeacherPage })),
)

const PracticeOverviewPage = lazy(() =>
  import('@/pages/practice/PracticePages').then((m) => ({ default: m.PracticeOverviewPage })),
)
const PracticeNoticesPage = lazy(() =>
  import('@/pages/practice/PracticePages').then((m) => ({ default: m.PracticeNoticesPage })),
)
const PracticeLateNoticesPage = lazy(() =>
  import('@/pages/practice/PracticePages').then((m) => ({ default: m.PracticeLateNoticesPage })),
)
const PracticeAttendancePage = lazy(() =>
  import('@/pages/practice/PracticePages').then((m) => ({ default: m.PracticeAttendancePage })),
)

const PracticeTeacherDashboardPage = lazy(() =>
  import('@/pages/practice-teacher/PracticeTeacherPages').then((m) => ({ default: m.PracticeTeacherDashboardPage })),
)
const PracticeStudentsPage = lazy(() =>
  import('@/pages/practice-teacher/PracticeTeacherPages').then((m) => ({ default: m.PracticeStudentsPage })),
)
const SomaliSpeakingStudentsPage = lazy(() =>
  import('@/pages/practice-teacher/PracticeTeacherPages').then((m) => ({ default: m.SomaliSpeakingStudentsPage })),
)
const EnglishSpeakingStudentsPage = lazy(() =>
  import('@/pages/practice-teacher/PracticeTeacherPages').then((m) => ({ default: m.EnglishSpeakingStudentsPage })),
)
const PracticeSubmissionsPage = lazy(() =>
  import('@/pages/practice-teacher/PracticeTeacherPages').then((m) => ({ default: m.PracticeSubmissionsPage })),
)
const PracticeTeacherAttendancePage = lazy(() =>
  import('@/pages/practice-teacher/PracticeTeacherPages').then((m) => ({ default: m.PracticeTeacherAttendancePage })),
)

const SupervisorDashboardPage = lazy(() =>
  import('@/pages/supervisor/SupervisorPages').then((m) => ({ default: m.SupervisorDashboardPage })),
)
const SupervisorReportsPage = lazy(() =>
  import('@/pages/supervisor/SupervisorPages').then((m) => ({ default: m.SupervisorReportsPage })),
)
const SupervisorSomaliSpeakingPage = lazy(() =>
  import('@/pages/supervisor/SupervisorPages').then((m) => ({ default: m.SupervisorSomaliSpeakingPage })),
)
const SupervisorEnglishSpeakingPage = lazy(() =>
  import('@/pages/supervisor/SupervisorPages').then((m) => ({ default: m.SupervisorEnglishSpeakingPage })),
)
const SupervisorActivityPage = lazy(() =>
  import('@/pages/supervisor/SupervisorPages').then((m) => ({ default: m.SupervisorActivityPage })),
)
const SupervisorTeacherAttPage = lazy(() =>
  import('@/pages/supervisor/SupervisorPages').then((m) => ({ default: m.SupervisorTeacherAttendancePage })),
)
const SupervisorReportsOverviewPage = lazy(() =>
  import('@/pages/supervisor/SupervisorPages').then((m) => ({ default: m.SupervisorReportsOverviewPage })),
)
const SupervisorOutsideActivityReviewPage = lazy(() =>
  import('@/pages/supervisor/OutsideActivityReviewPage').then((m) => ({
    default: m.SupervisorOutsideActivityReviewPage,
  })),
)
const SupervisorAttendanceReportPage = lazy(() =>
  import('@/pages/supervisor/SupervisorPages').then((m) => ({ default: m.SupervisorAttendanceReportPage })),
)

const FinanceOverviewPage = lazy(() =>
  import('@/pages/finance/FinancePages').then((m) => ({ default: m.FinanceOverviewPage })),
)
const FinancePaymentsPage = lazy(() =>
  import('@/pages/finance/FinancePages').then((m) => ({ default: m.FinancePaymentsPage })),
)
const FinanceManagerOverviewPage = lazy(() =>
  import('@/pages/finance/FinancePages').then((m) => ({ default: m.FinanceManagerOverviewPage })),
)
const FinanceManagerReportsPage = lazy(() =>
  import('@/pages/finance/FinancePages').then((m) => ({ default: m.FinanceManagerReportsPage })),
)

const CommitteeOverviewPage = lazy(() =>
  import('@/pages/committee/CommitteePages').then((m) => ({ default: m.CommitteeOverviewPage })),
)
const CommitteeActivityAttendancePage = lazy(() =>
  import('@/pages/committee/CommitteePages').then((m) => ({ default: m.CommitteeActivityAttendancePage })),
)

function roleGuard(roles: AppRole[]) {
  return <ProtectedRoute roles={roles} />
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export function AppRoutes() {
  return (
    <Lazy>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={roleGuard(['school_manager'])}>
          <Route path="/manager" element={<ManagerLayout />}>
            <Route index element={<ManagerOverviewPage />} />
            <Route path="students" element={<ManagerStudentsPage />} />
            <Route path="parents" element={<ManagerParentsPage />} />
            <Route path="teachers" element={<ManagerTeachersPage />} />
            <Route path="classes" element={<ManagerClassesPage />} />
            <Route path="subjects" element={<ManagerSubjectsPage />} />
            <Route path="academic-years" element={<ManagerAcademicYearsPage />} />
            <Route path="attendance" element={<ManagerAttendancePage />} />
            <Route path="lesson-monitoring" element={<LessonMonitoringReviewPage />} />
            <Route path="finance" element={<ManagerFinancePage />} />
            <Route path="results" element={<ManagerResultsPage />} />
            <Route path="outside-activities" element={<ManagerOutsideActivitiesPage />} />
            <Route path="outside-activity-committee" element={<ManagerOutsideActivityCommitteePage />} />
            <Route path="student-profile" element={<ManagerStudentProfilePage />} />
            <Route path="leave" element={<ManagerLeavePage />} />
            <Route path="password-resets" element={<ManagerPasswordResetsPage />} />
            <Route path="notices" element={<ManagerNoticesPage />} />
            <Route path="audit" element={<ManagerAuditLogsPage />} />
            <Route path="audit-logs" element={<ManagerAuditLogsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="backup" element={<ManagerBackupPage />} />
            <Route path="import" element={<ManagerDataImportPage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['teacher'])}>
          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<TeacherOverviewPage />} />
            <Route path="classes" element={<TeacherClassesPage />} />
            <Route path="lessons" element={<TeacherLessonsPage />} />
            <Route path="attendance" element={<TeacherAttendancePage />} />
            <Route path="lesson-monitoring" element={<TeacherLessonMonitoringPage />} />
            <Route path="quizzes" element={<TeacherQuizzesPage />} />
            <Route path="results" element={<TeacherResultsPage />} />
            <Route path="leave" element={<TeacherLeavePage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<TeacherProfilePage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['student'])}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentOverviewPage />} />
            <Route path="lessons" element={<StudentLessonsPage />} />
            <Route path="lessons/:id" element={<StudentLessonViewerPage />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="results" element={<StudentResultsPage />} />
            <Route path="quizzes" element={<StudentQuizzesPage />} />
            <Route path="exams" element={<StudentExamsPage />} />
            <Route path="notices" element={<StudentNoticesPage />} />
            <Route path="ai-tools" element={<StudentAiToolsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="profile" element={<StudentProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['parent'])}>
          <Route path="/parent" element={<ParentLayout />}>
            <Route index element={<ParentOverviewPage />} />
            <Route path="attendance" element={<ParentAttendancePage />} />
            <Route path="lesson-monitoring" element={<ParentLessonMonitoringPage />} />
            <Route path="results" element={<ParentResultsPage />} />
            <Route path="lessons" element={<ParentLessonsPage />} />
            <Route path="behavior" element={<ParentBehaviorPage />} />
            <Route path="fees" element={<ParentFinancePage />} />
            <Route path="notices" element={<ParentNoticesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['teacher_cabaas'])}>
          <Route path="/cabaas" element={<CabaasLayout />}>
            <Route index element={<CabaasOverviewPage />} />
            <Route path="results-review" element={<CabaasResultsReviewPage />} />
            <Route path="teacher-attendance" element={<CabaasTeacherAttendancePage />} />
            <Route path="student-attendance" element={<CabaasStudentAttendancePage />} />
            <Route path="lesson-monitoring" element={<LessonMonitoringReviewPage />} />
            <Route path="outside-activity-attendance" element={<SupervisorOutsideActivityReviewPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['practice_teacher'])}>
          <Route path="/practice-teacher" element={<PracticeTeacherLayout />}>
            <Route index element={<PracticeTeacherDashboardPage />} />
            <Route path="students" element={<PracticeStudentsPage />} />
            <Route path="somali-speaking" element={<SomaliSpeakingStudentsPage />} />
            <Route path="english-speaking" element={<EnglishSpeakingStudentsPage />} />
            <Route path="submissions" element={<PracticeSubmissionsPage />} />
            <Route path="attendance" element={<PracticeTeacherAttendancePage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<TeacherProfilePage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['supervisor'])}>
          <Route path="/supervisor" element={<SupervisorLayout />}>
            <Route index element={<SupervisorDashboardPage />} />
            <Route path="reports" element={<SupervisorReportsPage />} />
            <Route path="somali-speaking" element={<SupervisorSomaliSpeakingPage />} />
            <Route path="english-speaking" element={<SupervisorEnglishSpeakingPage />} />
            <Route path="activity" element={<SupervisorActivityPage />} />
            <Route path="teacher-attendance" element={<SupervisorTeacherAttPage />} />
            <Route path="attendance-report" element={<SupervisorAttendanceReportPage />} />
            <Route path="lesson-monitoring" element={<LessonMonitoringReviewPage />} />
            <Route path="outside-activity-attendance" element={<SupervisorOutsideActivityReviewPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="reports-overview" element={<SupervisorReportsOverviewPage />} />
            <Route path="profile" element={<TeacherProfilePage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['finance_officer'])}>
          <Route path="/finance" element={<FinanceLayout />}>
            <Route index element={<FinanceOverviewPage />} />
            <Route path="payments" element={<FinancePaymentsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['finance_manager'])}>
          <Route path="/finance-manager" element={<FinanceManagerLayout />}>
            <Route index element={<FinanceManagerOverviewPage />} />
            <Route path="reports" element={<FinanceManagerReportsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['outside_activity_committee'])}>
          <Route path="/committee" element={<CommitteeLayout />}>
            <Route index element={<CommitteeOverviewPage />} />
            <Route path="attendance" element={<CommitteeActivityAttendancePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route element={roleGuard(['attendance_manager'])}>
          <Route path="/attendance" element={<AttendanceManagerLayout />}>
            <Route index element={<AttendanceManagerOverviewPage />} />
            <Route path="students" element={<AttendanceManagerStudentPage />} />
            <Route path="teachers" element={<AttendanceManagerTeacherPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Lazy>
  )
}

export { ROLE_HOME }
