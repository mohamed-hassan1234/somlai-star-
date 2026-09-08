import {
  LayoutDashboard,
  ClipboardList,
  ClipboardCheck,
  Trophy,
  BookOpen,
  ShieldAlert,
  Megaphone,
  Banknote,
  Settings,
} from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

const nav: NavItem[] = [
  { to: '/parent', label: 'Muuqaal Guud', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/parent/attendance', label: 'Xaadiritaan', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/parent/lesson-monitoring', label: 'Kormeerka Casharka', icon: <ClipboardCheck className="h-4 w-4" /> },
  { to: '/parent/results', label: 'Natiijooyin', icon: <Trophy className="h-4 w-4" /> },
  { to: '/parent/lessons', label: 'Casharro', icon: <BookOpen className="h-4 w-4" /> },
  { to: '/parent/behavior', label: 'Dhaan', icon: <ShieldAlert className="h-4 w-4" /> },
  { to: '/parent/fees', label: 'Lacagta Bisha', icon: <Banknote className="h-4 w-4" /> },
  { to: '/parent/notices', label: 'Ogaysiis', icon: <Megaphone className="h-4 w-4" /> },
  { to: '/parent/settings', label: 'Dejinta', icon: <Settings className="h-4 w-4" /> },
]

export function ParentLayout() {
  return <DashboardLayout title="Waalid" nav={nav} />
}
