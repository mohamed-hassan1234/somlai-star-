import {
  LayoutDashboard, Megaphone, Clock, ClipboardList, MessageCircle, AlertTriangle,
} from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

const nav: NavItem[] = [
  { to: '/practice', label: 'Guddoomiyaha', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/practice/notices', label: 'Ogeysiisyada', icon: <Megaphone className="h-4 w-4" /> },
  { to: '/practice/late-notices', label: 'Daahista', icon: <Clock className="h-4 w-4" /> },
  { to: '/practice/behavior', label: 'Anshaxa & Daahista', icon: <AlertTriangle className="h-4 w-4" /> },
  { to: '/practice/attendance', label: 'Xaadirka', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/practice/chat', label: 'Wadahadal', icon: <MessageCircle className="h-4 w-4" /> },
]

export function PracticeLayout() {
  return <DashboardLayout title="Macalinka Tababarka" nav={nav} />
}
