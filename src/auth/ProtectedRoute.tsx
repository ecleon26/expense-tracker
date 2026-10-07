import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Spinner } from '../components/Spinner'
import type { UserRole } from './types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole: UserRole
}

const roleHome: Record<UserRole, string> = {
  student: '/student/upload',
  admin: '/admin',
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Checking session…" />
      </div>
    )
  }

  // Not logged in → go to login, preserve intended destination
  if (!session || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Wrong role → redirect to own home (never show other role's pages)
  if (profile.role !== requiredRole) {
    return <Navigate to={roleHome[profile.role]} replace />
  }

  return <>{children}</>
}
