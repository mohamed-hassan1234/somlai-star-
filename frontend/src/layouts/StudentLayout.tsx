import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Trophy,
  HelpCircle,
  CalendarDays,
  Megaphone,
  Sparkles,
  MessageCircle,
  User,
  Settings,
} from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

const nav: NavItem[] = [
  { to: '/student', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/student/lessons', label: 'My Lessons', icon: <BookOpen className="h-4 w-4" /> },
  { to: '/student/attendance', label: 'My Attendance', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/student/results', label: 'My Results', icon: <Trophy className="h-4 w-4" /> },
  { to: '/student/quizzes', label: 'Quiz', icon: <HelpCircle className="h-4 w-4" /> },
  { to: '/student/exams', label: 'Exam Schedule', icon: <CalendarDays className="h-4 w-4" /> },
  { to: '/student/notices', label: 'Notice Board', icon: <Megaphone className="h-4 w-4" /> },
  { to: '/student/ai-tools', label: 'AI Tools', icon: <Sparkles className="h-4 w-4" /> },
  { to: '/student/chat', label: 'Chat', icon: <MessageCircle className="h-4 w-4" /> },
  { to: '/student/profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
  { to: '/student/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
]

export function StudentLayout() {
  return <DashboardLayout title="Student" nav={nav} />
}
