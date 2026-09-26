import { FileText, Users, ClipboardCheck, Bell, BarChart3, User, Trees, MessageCircle } from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

const icon = 'h-4 w-4'

const nav: NavItem[] = [
  { to: '/supervisor/reports', label: 'Practice Reports', icon: <FileText className={icon} /> },
  { to: '/supervisor/somali-speaking', label: 'Somali Speaking Students', icon: <Users className={icon} /> },
  { to: '/supervisor/attendance-report', label: 'Student Attendance Report', icon: <ClipboardCheck className={icon} /> },
  { to: '/supervisor/lesson-monitoring', label: 'Lesson Monitoring', icon: <ClipboardCheck className={icon} /> },
  { to: '/supervisor/outside-activity-attendance', label: 'Outside Activity Attendance', icon: <Trees className={icon} /> },
  { to: '/supervisor/chat', label: 'Chat', icon: <MessageCircle className={icon} /> },
  { to: '/supervisor/notifications', label: 'Notifications', icon: <Bell className={icon} /> },
  { to: '/supervisor/reports-overview', label: 'Reports', icon: <BarChart3 className={icon} /> },
  { to: '/supervisor/profile', label: 'Profile', icon: <User className={icon} /> },
]

export function SupervisorLayout() {
  return <DashboardLayout title="Supervisor Dashboard" nav={nav} />
}
