import { useState } from 'react'
import { useClubs } from '../hooks/useClubs'
import { useActiveEvents } from '../hooks/useEvents'
import {
  useAdminBills,
  useBillAuditHistory,
  type AdminBillItem,
} from '../hooks/useAdminBills'
import { useUndoReview } from '../hooks/useAdminReview'
import { formatCurrency } from '../utils/formatCurrency'
import { friendlyError } from '../utils/errorMessages'
import { displayPersonName } from '../utils/displayName'
import { formatDateOnly, formatDateTime } from '../utils/formatDateTime'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ImageViewer } from '../components/ImageViewer'
import { QueryState } from '../components/QueryState'
import { useToast } from '../components/Toast'
import {
  RotateCcw,
  Search,
  Filter,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

export function AllBillsPage() {
  const { toast } = useToast()
  const { data: clubs } = useClubs()
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const { data: events } = useActiveEvents(selectedClubId || null)

  // Filters
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [page, setPage] = useState<number>(1)

  // Detail Modal
  const [selectedBill, setSelectedBill] = useState<AdminBillItem | null>(null)

  // Undo Review Modal
  const [undoModalOpen, setUndoModalOpen] = useState(false)
  const [undoReason, setUndoReason] = useState('')
  const undoReview = useUndoReview()

  const {
    data: billsData,
    isLoading,
    error,
    refetch,
  } = useAdminBills({
    page,
    pageSize: 20,
    clubId: selectedClubId || null,
    eventId: selectedEventId || null,
    status: statusFilter === 'all' ? null : statusFilter,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    search: searchQuery || null,
  })

  // Bill audit history for the selected bill
  const { data: auditHistory, isLoading: loadingAudit } = useBillAuditHistory(
    selectedBill?.id || null
  )

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    setPage(1)
  }

  const handleResetFilters = () => {
    setSelectedClubId('')
    setSelectedEventId('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setSearchInput('')
    setSearchQuery('')
    setPage(1)
  }

  const handleOpenUndo = (bill: AdminBillItem) => {
    setSelectedBill(bill)
    setUndoReason('')
    setUndoModalOpen(true)
  }

  const handleConfirmUndo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBill) return
    if (!undoReason.trim()) {
      toast('Please provide a reason to undo the review.', 'error')
      return
    }

    try {
      const res = await undoReview.mutateAsync({
        id: selectedBill.id,
        currentStatus: selectedBill.status as 'approved' | 'rejected',
        reason: undoReason.trim(),
      })

      if (!res || res.length === 0) {
        toast('This bill was changed by someone else.', 'error')
        refetch()
        setUndoModalOpen(false)
        setSelectedBill(null)
        return
      }

      toast('Review reverted to pending successfully.', 'success')
      setUndoModalOpen(false)
      setSelectedBill(null)
      refetch()
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Bills</h1>
          <p className="text-sm text-gray-500">
            Browse and search all submitted expenses across all clubs.
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Club Filter */}
            <Select
              label="Club"
              placeholder="All Clubs"
              value={selectedClubId}
              onChange={(e) => {
                setSelectedClubId(e.target.value)
                setSelectedEventId('')
                setPage(1)
              }}
              options={(clubs ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />

            {/* Event Filter */}
            <Select
              label="Event"
              placeholder="All Events"
              value={selectedEventId}
              disabled={!selectedClubId}
              onChange={(e) => {
                setSelectedEventId(e.target.value)
                setPage(1)
              }}
              options={(events ?? []).map((ev) => ({ value: ev.id, label: ev.name }))}
            />

            {/* Status Filter */}
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />

            {/* Date From */}
            <Input
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
            />

            {/* Date To */}
            <Input
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {/* Search Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by student name, email, or bill title..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary">
                <Filter className="h-4 w-4 mr-1" /> Apply Filter
              </Button>
              <Button type="button" variant="secondary" onClick={handleResetFilters}>
                Reset
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Bills Table with QueryState */}
      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load bills"
        empty={!isLoading && !error && (!billsData || billsData.bills.length === 0)}
        emptyTitle="No bills found"
        emptyDescription="Try adjusting your filters or search terms."
      >
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date Uploaded</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Club</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Event</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Student</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Reviewed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(billsData?.bills ?? []).map((bill) => (
                  <tr
                    key={bill.id}
                    onClick={() => setSelectedBill(bill)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatDateTime(bill.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-700">
                      {bill.clubs?.name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                      {bill.events?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium line-clamp-1">{bill.title}</div>
                      {bill.status === 'rejected' && bill.reject_reason && (
                        <div className="text-xs text-red-600 line-clamp-1">
                          Reason: {bill.reject_reason}
                        </div>
                      )}
                      {bill.status === 'pending' && bill.revert_reason && (
                        <div className="text-xs text-amber-600 line-clamp-1">
                          Reverted: {bill.revert_reason}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      <div>{displayPersonName(bill.student)}</div>
                      <div className="text-xs text-gray-400">{bill.student?.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(bill.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <Badge status={bill.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {bill.reviewer ? (
                        <div>
                          <div className="font-medium text-gray-700">
                            {displayPersonName(bill.reviewer)}
                          </div>
                          {bill.reviewed_at && (
                            <div className="text-xs text-gray-400">
                              {formatDateTime(bill.reviewed_at)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {billsData && billsData.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-white">
              <div className="text-xs text-gray-500">
                Showing {(page - 1) * 20 + 1} to{' '}
                {Math.min(page * 20, billsData.totalCount)} of {billsData.totalCount} bills
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-xs font-medium text-gray-700 px-2">
                  Page {page} of {billsData.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= billsData.totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, billsData.totalPages))}
                  aria-label="Next page"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </QueryState>

      {/* Bill Detail Modal (F7) */}
      <Modal
        open={Boolean(selectedBill) && !undoModalOpen}
        onClose={() => setSelectedBill(null)}
        title="Bill Details"
        maxWidth="3xl"
      >
        {selectedBill && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Image viewer (lazy loaded via signed URL only on open) */}
              <div>
                <ImageViewer path={selectedBill.bill_path} alt={selectedBill.title} />
              </div>

              {/* Bill Details */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent-700">
                    {selectedBill.clubs?.name}
                  </span>
                  <Badge status={selectedBill.status} />
                </div>

                <h3 className="text-lg font-bold text-gray-900">{selectedBill.title}</h3>

                {selectedBill.description && (
                  <p className="text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    {selectedBill.description}
                  </p>
                )}

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500 font-medium">Claimed Amount</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(selectedBill.amount)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block">Event</span>
                    <span className="font-medium text-gray-900">{selectedBill.events?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Expense Date</span>
                    <span className="font-medium text-gray-900">
                      {formatDateOnly(selectedBill.expense_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Student</span>
                    <span className="font-medium text-gray-900">
                      {displayPersonName(selectedBill.student)}
                    </span>
                    <span className="text-gray-400 block">{selectedBill.student?.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Uploaded At</span>
                    <span className="font-medium text-gray-900">
                      {formatDateTime(selectedBill.created_at)}
                    </span>
                  </div>
                </div>

                {selectedBill.reviewer && (
                  <div className="border-t border-gray-200 pt-3 text-xs">
                    <span className="text-gray-500 block">Reviewed By</span>
                    <span className="font-medium text-gray-900">
                      {displayPersonName(selectedBill.reviewer)} ({selectedBill.reviewer.email})
                    </span>
                    {selectedBill.reviewed_at && (
                      <span className="text-gray-400 block">
                        on {formatDateTime(selectedBill.reviewed_at)}
                      </span>
                    )}
                  </div>
                )}

                {selectedBill.reject_reason && (
                  <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                    <span className="font-semibold block">Rejection Reason:</span>
                    {selectedBill.reject_reason}
                  </div>
                )}

                {selectedBill.revert_reason && (
                  <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                    <span className="font-semibold block">Last Revert Reason:</span>
                    {selectedBill.revert_reason}
                  </div>
                )}

                {/* Undo Review Button (F7) */}
                {selectedBill.status !== 'pending' && (
                  <div className="pt-2">
                    <Button
                      variant="secondary"
                      className="w-full text-amber-700 border-amber-300 hover:bg-amber-50"
                      onClick={() => handleOpenUndo(selectedBill)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                      {selectedBill.status === 'approved' ? 'Undo approval' : 'Undo rejection'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Audit Log Timeline for this bill */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gray-500" /> Bill History & Audit Timeline
              </h4>

              {loadingAudit ? (
                <div className="text-xs text-gray-500">Loading history timeline...</div>
              ) : !auditHistory || auditHistory.length === 0 ? (
                <div className="text-xs text-gray-500">No audit records found for this bill.</div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {auditHistory.map((item) => (
                    <div key={item.id} className="relative text-xs">
                      <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-accent-500 ring-4 ring-white" />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 capitalize">
                          {item.action === 'review_reverted'
                            ? 'Approval/Rejection Undone'
                            : item.action}
                        </span>
                        <span className="text-gray-400">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                      <div className="text-gray-600 mt-0.5">
                        Performed by: <span className="font-medium">{item.actor_name || 'System'}</span>
                        {item.actor_email && ` (${item.actor_email})`}
                      </div>
                      {item.reason && (
                        <div className="mt-1 rounded bg-gray-50 p-2 text-gray-700 border border-gray-100">
                          Reason: {item.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Undo Review Confirmation Modal (F7) */}
      <Modal
        open={undoModalOpen}
        onClose={() => setUndoModalOpen(false)}
        title={selectedBill?.status === 'approved' ? 'Undo Approval' : 'Undo Rejection'}
      >
        <form onSubmit={handleConfirmUndo} className="flex flex-col gap-4">
          <p className="text-sm text-gray-700">
            Reverting this bill will return its status to <strong>pending</strong> and place it back
            in the Review Queue.
          </p>
          <Input
            label="Reason for undoing review"
            required
            autoFocus
            value={undoReason}
            onChange={(e) => setUndoReason(e.target.value)}
            placeholder="e.g. Approved by mistake, need student to clarify receipt"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUndoModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={undoReview.isPending}
            >
              Confirm Undo
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
