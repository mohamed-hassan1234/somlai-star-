import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { Button } from '@/components/ui/Button'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { cn, initials } from '@/lib/utils'
import { ROLE_LABELS } from '@/types'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

export function DashboardLayout({
  title,
  nav,
}: {
  title: string
  nav: NavItem[]
}) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!user) return null

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-ink-200/80 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
      <div className="border-b border-ink-100 px-5 py-5 dark:border-ink-800">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" showWordmark={false} />
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-ink-900 dark:text-white">
              Somali Star
            </p>
            <p className="text-xs text-ink-500">Academy · Dharkeynley</p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-navy-600 px-3 py-2 text-xs font-medium text-gold-400 dark:bg-navy-700 dark:text-gold-300">
          {title}
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
              )
            }
          >
            <span className="opacity-90">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-100 p-4 dark:border-ink-800">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-200">
            {user.profile.avatar_url ? (
              <img src={user.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              initials(user.profile.full_name)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
              {user.profile.full_name}
            </p>
            <p className="truncate text-xs text-ink-500">
              {user.profile.login_id} · {ROLE_LABELS[user.profile.role]}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          leftIcon={<LogOut className="h-4 w-4" />}
          onClick={async () => {
            await signOut()
            navigate('/login')
          }}
        >
          Sign out
        </Button>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72">{sidebar}</div>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-ink-950/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="absolute inset-y-0 left-0 z-50"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 z-10"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
              {sidebar}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-ink-200/70 bg-white/80 px-4 backdrop-blur dark:border-ink-800 dark:bg-ink-950/80 sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs text-ink-500">
                Somali Star <span className="font-medium text-gold-500">Academy</span>
              </p>
              <h1 className="font-display text-lg font-semibold leading-tight text-ink-900 dark:text-white">
                {title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" aria-label="Notifications" onClick={() => navigate('notifications')}>
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
