import { LayoutDashboard, Wallet } from 'lucide-react'
import { DashboardLayout } from './DashboardLayout'

const icon = 'h-4 w-4'

export function FinanceLayout() {
  return (
    <DashboardLayout
      title="Finance Officer"
      nav={[
        { to: '/finance', label: 'Overview', icon: <LayoutDashboard className={icon} />, end: true },
        { to: '/finance/payments', label: 'Record Payments', icon: <Wallet className={icon} /> },
        { to: '/finance/expenses', label: 'Expenses', icon: <Wallet className={icon} /> },
        { to: '/finance/salaries', label: 'Salaries', icon: <Wallet className={icon} /> },
        { to: '/finance/other-income', label: 'Other Income', icon: <Wallet className={icon} /> },
      ]}
    />
  )
}
