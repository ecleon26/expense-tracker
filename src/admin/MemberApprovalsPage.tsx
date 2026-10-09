import { useState } from 'react'
import { useClubs } from '../hooks/useClubs'
import {
  useAdminApprovals,
  useApproveStudent,
  useRejectStudent,
  type StudentApprovalItem,
} from '../hooks/useAdminApprovals'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { QueryState } from '../components/QueryState'
import { useToast } from '../components/Toast'
import { friendlyError } from '../utils/errorMessages'
import { formatDateOnly } from '../utils/formatDateTime'
import {
  CheckCircle2,
  XCircle,
  Search,
  GraduationCap,
} from 'lucide-react'

export function MemberApprovalsPage() {
  const { data: clubs } = useClubs()
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const { data: registrations, isLoading, error, refetch } = useAdminApprovals(statusFilter, selectedClubId)
  const approveMutation = useApproveStudent()
  const rejectMutation = useRejectStudent()
  const { toast } = useToast()

  // Selected student for modals
  const [approveTarget, setApproveTarget] = useState<StudentApprovalItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<StudentApprovalItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Filter in memory for search
  const filteredList = (registrations ?? []).filter((item) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.full_name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      (item.roll_number && item.roll_number.toLowerCase().includes(q)) ||
      (item.branch && item.branch.toLowerCase().includes(q)) ||
      (item.club_name && item.club_name.toLowerCase().includes(q))
    )
  })

  const pendingCount = (registrations ?? []).filter((r) => r.approval_status === 'pending').length

  const handleApprove = () => {
    if (!approveTarget) return
    approveMutation.mutate(approveTarget.id, {
      onSuccess: () => {
        toast(`Approved access for ${approveTarget.full_name}`, 'success')
        setApproveTarget(null)
      },
      onError: (err) => {
        toast(friendlyError(err), 'error')
      },
    })
  }

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectTarget || !rejectReason.trim()) return
    rejectMutation.mutate(
      { userId: rejectTarget.id, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          toast(`Registration rejected for ${rejectTarget.full_name}`, 'info')
          setRejectTarget(null)
          setRejectReason('')
        },
        onError: (err) => {
          toast(friendlyError(err), 'error')
        },
      }
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Digital VJTI Member Approvals</h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {pendingCount} pending
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Verify Digital VJTI member identity, team role, and branch details before permitting platform access.
          </p>
        </div>

        {/* Club filter (shown only if multiple clubs exist) */}
        {Boolean(clubs && clubs.length > 1) && (
          <div className="w-full sm:w-52">
            <select
              value={selectedClubId}
              onChange={(e) => setSelectedClubId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              aria-label="Filter approvals by club"
            >
              <option value="">All Clubs</option>
              {clubs?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs and Search Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {(
            [
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'all', label: 'All Students' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === tab.key
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, roll no, email…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
      </div>

      {/* Main List Table */}
      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load registrations"
        empty={!isLoading && !error && filteredList.length === 0}
        emptyTitle={statusFilter === 'pending' ? 'No pending approvals 🎉' : 'No registrations found'}
        emptyDescription={
          statusFilter === 'pending'
            ? 'All registered students have been reviewed.'
            : 'No student accounts match the selected filters.'
        }
      >
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Student & Email</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Digital VJTI Role</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Academic Info</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Roll No</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Registered</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    {/* Student & Email */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{item.full_name}</div>
                      <div className="text-xs text-gray-500">{item.email}</div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      <div>
                        <span className="inline-flex items-center rounded-md bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 border border-accent-200">
                          {item.club_role || 'Tech Core'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500 font-medium">Digital VJTI</div>
                    </td>

                    {/* Academic Info */}
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5 text-gray-900 font-medium">
                        <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                        <span>{item.year || 'Year unspecified'}</span>
                      </div>
                      <div className="text-xs text-gray-500">{item.branch || 'Branch unspecified'}</div>
                    </td>

                    {/* Roll No */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono font-medium text-gray-800">
                        {item.roll_number || '—'}
                      </code>
                    </td>

                    {/* Registered Date */}
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                      {formatDateOnly(item.created_at)}
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <Badge status={item.approval_status} />
                      {item.approval_status === 'rejected' && item.rejection_reason && (
                        <div className="mt-1 text-xs text-red-600 max-w-xs truncate" title={item.rejection_reason}>
                          {item.rejection_reason}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.approval_status !== 'approved' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setApproveTarget(item)}
                            className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-green-600" />
                            Approve
                          </Button>
                        )}
                        {item.approval_status !== 'rejected' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRejectTarget(item)}
                            className="text-red-600 hover:bg-red-50 border-red-200"
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5 text-red-500" />
                            Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </QueryState>

      {/* Approve Confirmation Modal */}
      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Approve Student Registration"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to approve{' '}
            <strong className="text-gray-900">{approveTarget?.full_name}</strong>?
          </p>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
            <p><strong>Email:</strong> {approveTarget?.email}</p>
            <p><strong>Club:</strong> {approveTarget?.club_name} ({approveTarget?.club_role || 'Member'})</p>
            <p><strong>Roll No:</strong> {approveTarget?.roll_number || 'N/A'}</p>
            <p><strong>Academics:</strong> {approveTarget?.year} • {approveTarget?.branch}</p>
          </div>
          <p className="text-xs text-gray-500">
            This student will gain immediate access to submit bills and view their expenses.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              loading={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm Approval
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal with Reason */}
      <Modal
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null)
          setRejectReason('')
        }}
        title="Reject Student Registration"
      >
        <form onSubmit={handleReject} className="space-y-4">
          <p className="text-sm text-gray-600">
            Provide a reason for declining registration for{' '}
            <strong className="text-gray-900">{rejectTarget?.full_name}</strong>:
          </p>
          <div>
            <label htmlFor="reject-reason-input" className="block text-xs font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reject-reason-input"
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Roll number not found in club roster / Not an active member"
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={rejectMutation.isPending}
              disabled={!rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
