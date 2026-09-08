import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import type { AppRole } from '@/types'
import { ROLE_HOME } from '@/types'
import { PageLoader } from '@/components/ui/PageLoader'

export function ProtectedRoute({ roles }: { roles?: AppRole[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && !roles.includes(user.profile.role)) {
    return <Navigate to={ROLE_HOME[user.profile.role]} replace />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (user) return <Navigate to={ROLE_HOME[user.profile.role]} replace />
  return <Outlet />
}
