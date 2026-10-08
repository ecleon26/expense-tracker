import { useState } from 'react'
import { useClubs } from '../hooks/useClubs'
import { useAdminHistory, type AuditLogItem } from '../hooks/useAdminHistory'
import { formatCurrency } from '../utils/formatCurrency'
import { displayActorName } from '../utils/displayName'
import { formatDateTime } from '../utils/formatDateTime'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { QueryState } from '../components/QueryState'
import { Modal } from '../components/Modal'
import { ImageViewer } from '../components/ImageViewer'
import { supabase } from '../lib/supabaseClient'
import {
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

function ActionBadge({ action }: { action: string }) {
  switch (action) {
    case 'uploaded':
      return (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
          Uploaded
        </span>
      )
    case 'approved':
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
          Approved
        </span>
      )
    case 'rejected':
      return (
        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
          Rejected
        </span>
      )
    case 'review_reverted':
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
          Approval undone
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
          {action}
        </span>
      )
  }
}

export function HistoryPage() {
  const { data: clubs } = useClubs()
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [page, setPage] = useState<number>(1)

  // Selected item detail view
  const [selectedItem, setSelectedItem] = useState<AuditLogItem | null>(null)
  const [billImage, setBillImage] = useState<string | null>(null)
  const [loadingBill, setLoadingBill] = useState(false)

  const { data, isLoading, error, refetch } = useAdminHistory({
    page,
    pageSize: 25,
    clubId: selectedClubId || null,
    action: selectedAction === 'all' ? null : selectedAction,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  })

  // Map club names for quick lookup
  const clubNameMap = new Map((clubs ?? []).map((c) => [c.id, c.name]))

  const handleResetFilters = () => {
    setSelectedClubId('')
    setSelectedAction('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const handleRowClick = async (item: AuditLogItem) => {
    setSelectedItem(item)
    setBillImage(null)
    setLoadingBill(true)

    // Lookup expense to get bill_path
    try {
      const { data: exp } = await supabase
        .from('expenses')
        .select('bill_path')
        .eq('id', item.expense_id)
        .single()

      if (exp?.bill_path) {
        setBillImage(exp.bill_path)
      }
    } finally {
      setLoadingBill(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit History</h1>
        <p className="text-sm text-gray-500">
          Comprehensive, append-only log of all bill activities and admin decisions.
        </p>
      </div>

      {/* F8 Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <ShieldAlert className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <span className="font-semibold">Permanent Record:</span> All activity recorded here is
          immutable and preserved in the audit log forever. Entries cannot be edited or deleted by
          any client.
        </div>
      </div>

      {/* Filters Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Club"
            placeholder="All Clubs"
            value={selectedClubId}
            onChange={(e) => {
              setSelectedClubId(e.target.value)
              setPage(1)
            }}
            options={(clubs ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />

          <Select
            label="Action"
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All Actions' },
              { value: 'uploaded', label: 'Uploaded' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'review_reverted', label: 'Approval Undone' },
            ]}
          />

          <Input
            label="From Date"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
          />

          <Input
            label="To Date"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
          />

          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleResetFilters}
              className="w-full"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </div>

      {/* History Table with QueryState */}
      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load history"
        empty={!isLoading && !error && (!data || data.items.length === 0)}
        emptyTitle="No audit records found"
        emptyDescription="No events match your selected filters."
      >
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Bill Title & Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Club</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Performed By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(data?.items ?? []).map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 text-xs">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <ActionBadge action={item.action} />
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium line-clamp-1">{item.title || '—'}</div>
                      {item.amount !== null && (
                        <div className="text-xs text-gray-500">{formatCurrency(item.amount)}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700 text-xs">
                      {clubNameMap.get(item.club_id) || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700 text-xs">
                      <div className="font-medium text-gray-900">
                        {displayActorName(item)}
                      </div>
                      {item.actor_email && (
                        <div className="text-gray-400">{item.actor_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {item.reason ? (
                        <span className="line-clamp-2 text-gray-700 font-medium bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          {item.reason}
                        </span>
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
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-white">
              <div className="text-xs text-gray-500">
                Showing {(page - 1) * 25 + 1} to{' '}
                {Math.min(page * 25, data.totalCount)} of {data.totalCount} entries
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
                  Page {page} of {data.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, data.totalPages))}
                  aria-label="Next page"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </QueryState>

      {/* Audit Detail Modal */}
      <Modal
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title="Audit Record Detail"
        maxWidth="2xl"
      >
        {selectedItem && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-xs text-gray-500">
                Logged at: {formatDateTime(selectedItem.created_at)}
              </span>
              <ActionBadge action={selectedItem.action} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block">Bill Title</span>
                <span className="font-semibold text-gray-900 text-sm">
                  {selectedItem.title || '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Amount</span>
                <span className="font-semibold text-gray-900 text-sm">
                  {selectedItem.amount !== null ? formatCurrency(selectedItem.amount) : '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Club</span>
                <span className="font-medium text-gray-900">
                  {clubNameMap.get(selectedItem.club_id) || '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Actor</span>
                <span className="font-medium text-gray-900">
                  {displayActorName(selectedItem)}
                </span>
                {selectedItem.actor_email && (
                  <span className="text-gray-400 block">{selectedItem.actor_email}</span>
                )}
              </div>
              {selectedItem.from_status && (
                <div>
                  <span className="text-gray-500 block">Status Transition</span>
                  <span className="font-medium text-gray-900">
                    {selectedItem.from_status} → {selectedItem.to_status}
                  </span>
                </div>
              )}
              {selectedItem.reason && (
                <div className="col-span-2 rounded bg-gray-50 p-2.5 border border-gray-100">
                  <span className="text-gray-500 block font-semibold mb-1">Reason:</span>
                  <p className="text-gray-800">{selectedItem.reason}</p>
                </div>
              )}
            </div>

            {/* Bill image if available */}
            {loadingBill ? (
              <div className="text-xs text-gray-500">Checking bill image...</div>
            ) : billImage ? (
              <div className="border-t pt-3">
                <span className="text-xs text-gray-500 block mb-2 font-medium">Bill Image</span>
                <ImageViewer path={billImage} alt={selectedItem.title || 'Bill'} />
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}
