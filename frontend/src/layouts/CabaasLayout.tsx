import { LayoutDashboard, Trophy, ClipboardList, ClipboardCheck, Bell, Trees } from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

const nav: NavItem[] = [
  { to: '/cabaas', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/cabaas/results-review', label: 'Results Review', icon: <Trophy className="h-4 w-4" /> },
  { to: '/cabaas/teacher-attendance', label: 'Teacher Attendance', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/cabaas/student-attendance', label: 'Student Attendance', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/cabaas/lesson-monitoring', label: 'Lesson Monitoring', icon: <ClipboardCheck className="h-4 w-4" /> },
  { to: '/cabaas/outside-activity-attendance', label: 'Outside Activity Attendance', icon: <Trees className="h-4 w-4" /> },
  { to: '/cabaas/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
]

export function CabaasLayout() {
  return <DashboardLayout title="Teacher Cabaas" nav={nav} />
}
