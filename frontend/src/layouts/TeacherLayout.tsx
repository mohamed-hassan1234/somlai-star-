import {
  LayoutDashboard,
  School,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  HelpCircle,
  Trophy,
  CalendarOff,
  MessageCircle,
  Bell,
  User,
} from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

const nav: NavItem[] = [
  { to: '/teacher', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/teacher/classes', label: 'My Classes', icon: <School className="h-4 w-4" /> },
  { to: '/teacher/lessons', label: 'Lessons', icon: <BookOpen className="h-4 w-4" /> },
  { to: '/teacher/attendance', label: 'Attendance', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/teacher/lesson-monitoring', label: 'Lesson Monitoring', icon: <ClipboardCheck className="h-4 w-4" /> },
  { to: '/teacher/quizzes', label: 'Quizzes', icon: <HelpCircle className="h-4 w-4" /> },
  { to: '/teacher/results', label: 'Results', icon: <Trophy className="h-4 w-4" /> },
  { to: '/teacher/leave', label: 'Leave', icon: <CalendarOff className="h-4 w-4" /> },
  { to: '/teacher/chat', label: 'Chat', icon: <MessageCircle className="h-4 w-4" /> },
  { to: '/teacher/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { to: '/teacher/profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
]

export function TeacherLayout() {
  return <DashboardLayout title="Teacher" nav={nav} />
}
