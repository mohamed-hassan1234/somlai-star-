import { LayoutDashboard, BarChart3, Bell, MessageCircle } from 'lucide-react'
import { DashboardLayout } from './DashboardLayout'

const icon = 'h-4 w-4'

export function FinanceManagerLayout() {
  return (
    <DashboardLayout
      title="Finance Manager"
      nav={[
        { to: '/finance-manager', label: 'Overview', icon: <LayoutDashboard className={icon} />, end: true },
        { to: '/finance-manager/reports', label: 'Reports', icon: <BarChart3 className={icon} /> },
        { to: '/finance-manager/chat', label: 'Chat', icon: <MessageCircle className={icon} /> },
        { to: '/finance-manager/notifications', label: 'Notifications', icon: <Bell className={icon} /> },
      ]}
    />
  )
}
