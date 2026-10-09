import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Spinner } from '../components/Spinner'
import { ProfileLoadErrorScreen } from './ProfileLoadErrorScreen'
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
  const { session, profile, loading, profileLoadFailed, retryProfile, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Checking session…" />
      </div>
    )
  }

  if (session && profileLoadFailed) {
    return (
      <ProfileLoadErrorScreen
        onRetry={() => {
          void retryProfile()
        }}
        onSignOut={() => {
          void signOut()
        }}
      />
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

  // If student is not yet approved by an admin
  if (profile.role === 'student') {
    if (profile.approval_status === 'pending') {
      return <Navigate to="/pending-approval" replace />
    }
    if (profile.approval_status === 'rejected') {
      return <Navigate to="/rejected-approval" replace />
    }
  }

  return <>{children}</>
}
