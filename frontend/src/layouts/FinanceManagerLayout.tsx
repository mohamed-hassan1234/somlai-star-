import { LayoutDashboard, FileBarChart, MessageCircle, User } from 'lucide-react'
import { DashboardLayout } from './DashboardLayout'

const icon = 'h-4 w-4'

export function FinanceManagerLayout() {
  return (
    <DashboardLayout
      title="Finance Manager"
      nav={[
        { to: '/finance-manager', label: 'Overview', icon: <LayoutDashboard className={icon} />, end: true },
        { to: '/finance-manager/class-report', label: 'Class Financial Report', icon: <FileBarChart className={icon} /> },
        { to: '/finance-manager/chat', label: 'Chat', icon: <MessageCircle className={icon} /> },
        { to: '/finance-manager/profile', label: 'Profile', icon: <User className={icon} /> },
      ]}
    />
  )
}
