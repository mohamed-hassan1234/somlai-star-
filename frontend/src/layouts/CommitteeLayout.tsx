import { LayoutDashboard, ClipboardCheck } from 'lucide-react'
import { DashboardLayout } from './DashboardLayout'

const icon = 'h-4 w-4'

export function CommitteeLayout() {
  return (
    <DashboardLayout
      title="Activity Committee"
      nav={[
        { to: '/committee', label: 'Overview', icon: <LayoutDashboard className={icon} />, end: true },
        { to: '/committee/attendance', label: 'Activity Attendance', icon: <ClipboardCheck className={icon} /> },
      ]}
    />
  )
}
