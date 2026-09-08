import { LayoutDashboard, Users, GraduationCap } from 'lucide-react'
import { DashboardLayout } from './DashboardLayout'

const icon = 'h-4 w-4'

export function AttendanceManagerLayout() {
  return (
    <DashboardLayout
      title="Attendance Manager"
      nav={[
        { to: '/attendance', label: 'Overview', icon: <LayoutDashboard className={icon} />, end: true },
        { to: '/attendance/students', label: 'Student Attendance', icon: <Users className={icon} /> },
        { to: '/attendance/teachers', label: 'Teacher Attendance', icon: <GraduationCap className={icon} /> },
      ]}
    />
  )
}
