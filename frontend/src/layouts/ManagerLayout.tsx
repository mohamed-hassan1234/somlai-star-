import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  BookOpen,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  Wallet,
  Trophy,
  Trees,
  Megaphone,
  ScrollText,
  Bell,
  Settings,
  CalendarOff,
  KeyRound,
  UserCheck,
  DatabaseBackup,
  FileInput,
  type LucideIcon,
} from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

function icon(Icon: LucideIcon) {
  return <Icon className="h-4 w-4" />
}

const nav: NavItem[] = [
  { to: '/manager', label: 'Overview', icon: icon(LayoutDashboard), end: true },
  { to: '/manager/students', label: 'Students', icon: icon(Users) },
  { to: '/manager/parents', label: 'Parents', icon: icon(UserCheck) },
  { to: '/manager/student-profile', label: 'Student Profile', icon: icon(UserCheck) },
  { to: '/manager/teachers', label: 'Teachers', icon: icon(GraduationCap) },
  { to: '/manager/classes', label: 'Classes', icon: icon(School) },
  { to: '/manager/subjects', label: 'Subjects', icon: icon(BookOpen) },
  { to: '/manager/academic-years', label: 'Academic Years', icon: icon(CalendarDays) },
  { to: '/manager/attendance', label: 'Attendance', icon: icon(ClipboardList) },
  { to: '/manager/lesson-monitoring', label: 'Lesson Monitoring', icon: icon(ClipboardCheck) },
  { to: '/manager/leave', label: 'Teacher Leave', icon: icon(CalendarOff) },
  { to: '/manager/password-resets', label: 'Password Resets', icon: icon(KeyRound) },
  { to: '/manager/finance', label: 'Finance Report', icon: icon(Wallet) },
  { to: '/manager/results', label: 'Results', icon: icon(Trophy) },
  { to: '/manager/outside-activities', label: 'Outside Activities', icon: icon(Trees) },
  { to: '/manager/outside-activity-committee', label: 'Outside Activity Committee', icon: icon(UserCheck) },
  { to: '/manager/notices', label: 'Notices', icon: icon(Megaphone) },
  { to: '/manager/audit', label: 'Audit Logs', icon: icon(ScrollText) },
  { to: '/manager/settings', label: 'Settings', icon: icon(Settings) },
  { to: '/manager/backup', label: 'Backup & Restore', icon: icon(DatabaseBackup) },
  { to: '/manager/import', label: 'Data Import', icon: icon(FileInput) },
  { to: '/manager/notifications', label: 'Notifications', icon: icon(Bell) },
]

export function ManagerLayout() {
  return <DashboardLayout title="School Manager" nav={nav} />
}
