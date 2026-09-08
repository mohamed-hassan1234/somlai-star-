import {
  LayoutDashboard, Users, MessageCircle, Globe, FileText, ClipboardCheck, Bell, User,
} from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

const icon = 'h-4 w-4'

const nav: NavItem[] = [
  { to: '/practice-teacher', label: 'Dashboard', icon: <LayoutDashboard className={icon} />, end: true },
  { to: '/practice-teacher/students', label: 'Practice Students', icon: <Users className={icon} /> },
  { to: '/practice-teacher/somali-speaking', label: 'Somali Speaking Students', icon: <MessageCircle className={icon} /> },
  { to: '/practice-teacher/english-speaking', label: 'English Speaking Students', icon: <Globe className={icon} /> },
  { to: '/practice-teacher/submissions', label: 'Submissions', icon: <FileText className={icon} /> },
  { to: '/practice-teacher/attendance', label: 'Teacher Attendance', icon: <ClipboardCheck className={icon} /> },
  { to: '/practice-teacher/notifications', label: 'Notifications', icon: <Bell className={icon} /> },
  { to: '/practice-teacher/profile', label: 'Profile', icon: <User className={icon} /> },
]

export function PracticeTeacherLayout() {
  return <DashboardLayout title="Practice Teacher" nav={nav} />
}
