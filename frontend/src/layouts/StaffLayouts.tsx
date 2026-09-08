import { LayoutDashboard, Wallet, Bell } from 'lucide-react'
import { DashboardLayout, type NavItem } from '@/layouts/DashboardLayout'

export function FinanceLayout() {
  const nav: NavItem[] = [
    { to: '/finance', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
    { to: '/finance/payments', label: 'Record Payments', icon: <Wallet className="h-4 w-4" /> },
    { to: '/finance/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  ]
  return <DashboardLayout title="Finance Officer" nav={nav} />
}

export function FinanceManagerLayout() {
  const nav: NavItem[] = [
    { to: '/finance-manager', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
    { to: '/finance-manager/reports', label: 'Reports', icon: <Wallet className="h-4 w-4" /> },
    { to: '/finance-manager/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  ]
  return <DashboardLayout title="Finance Manager" nav={nav} />
}

export function CommitteeLayout() {
  const nav: NavItem[] = [
    { to: '/committee', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
    { to: '/committee/attendance', label: 'Activity Attendance', icon: <Wallet className="h-4 w-4" /> },
  ]
  return <DashboardLayout title="Outside Activity Committee" nav={nav} />
}

export function AttendanceManagerLayout() {
  const nav: NavItem[] = [
    { to: '/attendance', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
    { to: '/attendance/students', label: 'Student Attendance', icon: <Wallet className="h-4 w-4" /> },
    { to: '/attendance/teachers', label: 'Teacher Attendance', icon: <Wallet className="h-4 w-4" /> },
  ]
  return <DashboardLayout title="Attendance Manager" nav={nav} />
}
