import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { useClubs } from '../hooks/useClubs'
import { Button } from '../components/Button'
import { useToast } from '../components/Toast'
import { Clock, ShieldAlert, LogOut, RefreshCw } from 'lucide-react'
import { formatDateOnly } from '../utils/formatDateTime'

export function PendingApprovalPage() {
  const { profile, loading, refetchProfile, signOut } = useAuth()
  const { data: clubs } = useClubs()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [checking, setChecking] = useState(false)

  if (loading) {
    return null
  }

  // If not logged in, go to login
  if (!profile) {
    return <Navigate to="/login" replace />
  }

  // If already approved or admin, redirect to respective home
  if (profile.role === 'admin') {
    return <Navigate to="/admin" replace />
  }
  if (profile.approval_status === 'approved') {
    return <Navigate to="/student/upload" replace />
  }
  if (profile.approval_status === 'rejected') {
    return <Navigate to="/rejected-approval" replace />
  }

  const clubName = clubs?.find((c) => c.id === profile.club_id)?.name || 'Digital VJTI'

  const handleCheckStatus = async () => {
    try {
      setChecking(true)
      await refetchProfile()
      toast('Profile status refreshed', 'info')
    } catch {
      toast('Failed to refresh status. Please try again.', 'error')
    } finally {
      setChecking(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-accent-700">Budget Tracker</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">By Digital VJTI</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Pending Admin Approval
              </span>
              <h2 className="mt-1 text-xl font-bold text-gray-900">Registration Under Review</h2>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Hello, <strong className="text-gray-900">{profile.full_name}</strong>. Your account has been registered,
            but club expense and bill access requires verification by a club administrator to prevent unauthorized access.
          </p>

          {/* Details submitted */}
          <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted Details</h3>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Club</dt>
                <dd className="font-medium text-gray-900">{clubName}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Club Role</dt>
                <dd className="font-medium text-gray-900">{profile.club_role || 'Member'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Academic Year</dt>
                <dd className="font-medium text-gray-900">{profile.year || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Branch</dt>
                <dd className="font-medium text-gray-900">{profile.branch || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Roll Number</dt>
                <dd className="font-medium text-gray-900">{profile.roll_number || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Registered On</dt>
                <dd className="font-medium text-gray-900">{formatDateOnly(profile.created_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="secondary"
              onClick={handleCheckStatus}
              loading={checking}
              className="flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Check Status
            </Button>

            <Button
              variant="secondary"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          Once your club administrator confirms your membership, you will automatically get access to submit bills and view expenses.
        </p>
      </div>
    </div>
  )
}

export function RejectedApprovalPage() {
  const { profile, loading, signOut } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return null
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.role === 'admin') {
    return <Navigate to="/admin" replace />
  }
  if (profile.approval_status === 'approved') {
    return <Navigate to="/student/upload" replace />
  }
  if (profile.approval_status === 'pending') {
    return <Navigate to="/pending-approval" replace />
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-accent-700">Budget Tracker</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">By Digital VJTI</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                Access Not Approved
              </span>
              <h2 className="mt-1 text-xl font-bold text-gray-900">Registration Declined</h2>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Hello, <strong className="text-gray-900">{profile.full_name}</strong>. Your registration for the club
            tracker could not be approved by the administrator.
          </p>

          {profile.rejection_reason && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <span className="font-semibold">Reason provided:</span> {profile.rejection_reason}
            </div>
          )}

          <p className="mt-4 text-xs text-gray-500">
            If you believe this was in error, please contact your club head or administrator to review your membership details.
          </p>

          <div className="mt-6">
            <Button
              variant="secondary"
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 text-gray-700 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
