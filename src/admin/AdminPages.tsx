import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useAdminEvents,
  useCreateEvent,
  useToggleEventStatus,
} from '../hooks/useAdminEvents'
import {
  usePendingExpenses,
  useApproveExpense,
  useRejectExpense,
  type PendingExpense,
} from '../hooks/useAdminReview'
import { useClubs } from '../hooks/useClubs'
import {
  useKpiStats,
  useSpendByEvent,
  useSpendByStudent,
  useSpendByMonth,
  useSpendByClub,
  useStudentDetail,
  type StudentExpense,
} from '../hooks/useAdminAnalytics'
import { formatCurrency } from '../utils/formatCurrency'
import { friendlyError } from '../utils/errorMessages'
import { displayPersonName } from '../utils/displayName'
import { formatDateOnly, formatDateTime, formatMonthYear } from '../utils/formatDateTime'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'
import { ImageViewer } from '../components/ImageViewer'
import { useToast } from '../components/Toast'
import { QueryState } from '../components/QueryState'
import {
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Building2,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export { AllBillsPage } from './AllBillsPage'
export { HistoryPage } from './HistoryPage'

// ─── Events Page ─────────────────────────────────────────────────────────────

const createEventSchema = z.object({
  club_id: z.string().min(1, 'Please select a club'),
  name: z.string().min(1, 'Event name is required').max(100, 'Name is too long'),
  event_date: z.string().optional(),
})
type CreateEventFormValues = z.infer<typeof createEventSchema>

export function EventsPage() {
  const { data: clubs } = useClubs()
  const [filterClubId, setFilterClubId] = useState<string>('')
  const { data: events, isLoading, error, refetch } = useAdminEvents(filterClubId || null)
  const createEvent = useCreateEvent()
  const toggleEvent = useToggleEventStatus()
  const { toast } = useToast()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      club_id: '',
      name: '',
      event_date: '',
    },
  })

  const onSubmit = (values: CreateEventFormValues) => {
    createEvent.mutate(values, {
      onSuccess: () => {
        setCreateModalOpen(false)
        reset()
        toast('Event created successfully', 'success')
      },
      onError: (err) => {
        toast(friendlyError(err), 'error')
      },
    })
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events Management</h1>
          <p className="text-sm text-gray-500">Create events and toggle their active status per club.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Club Filter */}
          <div className="w-48">
            <select
              value={filterClubId}
              onChange={(e) => setFilterClubId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              aria-label="Filter events by club"
            >
              <option value="">All Clubs</option>
              {(clubs ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>Create Event</Button>
        </div>
      </div>

      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load events"
        empty={!isLoading && !error && (!events || events.length === 0)}
        emptyTitle="No events found"
        emptyDescription="Create an event to allow students to upload expense receipts."
      >
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Event Name</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Club</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Total Bills</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {events?.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {event.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-600">
                      {event.clubs?.name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                      {event.event_date ? formatDateOnly(event.event_date) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {event.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-gray-500">
                      {event.expenses[0]?.count || 0}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleEvent.mutate(
                            { id: event.id, is_active: !event.is_active },
                            {
                              onSuccess: () =>
                                toast(
                                  `Event ${event.is_active ? 'deactivated' : 'reactivated'}`,
                                  'success'
                                ),
                              onError: (err) => toast(friendlyError(err), 'error'),
                            }
                          )
                        }
                        loading={toggleEvent.isPending}
                      >
                        {event.is_active ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <PowerOff className="h-4 w-4" /> Deactivate
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600">
                            <Power className="h-4 w-4" /> Reactivate
                          </span>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Event Modal */}
        <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Event">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Select
              label="Club"
              required
              placeholder="Select a club..."
              options={(clubs ?? []).map((c) => ({ value: c.id, label: c.name }))}
              error={errors.club_id?.message}
              {...register('club_id')}
            />
            <Input label="Event Name" required error={errors.name?.message} {...register('name')} />
            <Input
              label="Date (Optional)"
              type="date"
              error={errors.event_date?.message}
              {...register('event_date')}
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setCreateModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button type="submit" loading={createEvent.isPending}>
                Create
              </Button>
            </div>
          </form>
        </Modal>
      </QueryState>
    </div>
  )
}

// ─── Review Queue Page ───────────────────────────────────────────────────────

export function ReviewQueuePage() {
  const { data: clubs } = useClubs()
  const [filterClubId, setFilterClubId] = useState<string>('')
  const { data: pending, isLoading, error, refetch } = usePendingExpenses(filterClubId || null)
  const [selectedExpense, setSelectedExpense] = useState<PendingExpense | null>(null)
  const { toast } = useToast()

  const approve = useApproveExpense()
  const reject = useRejectExpense()

  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Keep selected expense in sync with data, or clear it if it was processed
  const currentSelected = selectedExpense
    ? pending?.find((p) => p.id === selectedExpense.id) || null
    : null

  const handleApprove = () => {
    if (!currentSelected) return
    approve.mutate(currentSelected.id, {
      onSuccess: (data) => {
        setApproveConfirmOpen(false)
        if (!data || data.length === 0) {
          toast('This bill was already reviewed by someone else.', 'info')
        } else {
          toast('Bill approved successfully', 'success')
        }
        setSelectedExpense(null)
      },
      onError: (err) => {
        toast(friendlyError(err), 'error')
      },
    })
  }

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSelected || !rejectReason.trim()) return
    reject.mutate(
      { id: currentSelected.id, reason: rejectReason },
      {
        onSuccess: (data) => {
          setRejectModalOpen(false)
          setRejectReason('')
          if (!data || data.length === 0) {
            toast('This bill was already reviewed by someone else.', 'info')
          } else {
            toast('Bill rejected', 'success')
          }
          setSelectedExpense(null)
        },
        onError: (err) => {
          toast(friendlyError(err), 'error')
        },
      }
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500">Review and approve or reject pending expense claims.</p>
        </div>
        {/* F4 Club filter */}
        <div className="w-48">
          <select
            value={filterClubId}
            onChange={(e) => {
              setFilterClubId(e.target.value)
              setSelectedExpense(null)
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            aria-label="Filter review queue by club"
          >
            <option value="">All Clubs</option>
            {(clubs ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load review queue"
        empty={!isLoading && !error && (!pending || pending.length === 0)}
        emptyTitle="All caught up!"
        emptyDescription="There are no pending bills to review right now."
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/* List Pane */}
          <div className="flex w-full flex-col gap-3 lg:w-1/3">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Bills ({pending?.length || 0})
            </h2>
            <div className="flex flex-col gap-2">
              {pending?.map((expense) => (
                <button
                  key={expense.id}
                  onClick={() => setSelectedExpense(expense)}
                  className={[
                    'flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors',
                    currentSelected?.id === expense.id
                      ? 'border-accent-500 bg-accent-50 ring-1 ring-accent-500'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <div className="flex w-full justify-between items-start gap-2">
                    <span className="font-medium text-gray-900 line-clamp-1">{expense.title}</span>
                    <span className="font-bold text-gray-900 shrink-0">
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{displayPersonName(expense.student)}</span>
                    <span className="font-medium text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded">
                      {expense.clubs?.name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDateTime(expense.created_at)} · {expense.events?.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail Pane */}
          <div className="flex w-full flex-col lg:w-2/3">
            {currentSelected ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Review Bill</h2>
                  <span className="inline-flex items-center rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700 border border-accent-200">
                    {currentSelected.clubs?.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Image Viewer */}
                  <div className="flex flex-col">
                    <ImageViewer path={currentSelected.bill_path} alt={currentSelected.title} />
                  </div>

                  {/* Details */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-500">Student</div>
                      <div className="text-gray-900 font-medium">
                        {displayPersonName(currentSelected.student)}
                      </div>
                      <div className="text-sm text-gray-500">{currentSelected.student?.email}</div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-500">Event</div>
                      <div className="text-gray-900">{currentSelected.events?.name}</div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-500">Title</div>
                      <div className="text-gray-900">{currentSelected.title}</div>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <div className="text-sm font-medium text-gray-500">Amount</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(currentSelected.amount)}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        Date of expense: {formatDateOnly(currentSelected.expense_date)}
                      </div>
                    </div>

                    {currentSelected.description && (
                      <div>
                        <div className="text-sm font-medium text-gray-500">Notes</div>
                        <div className="text-sm text-gray-700">{currentSelected.description}</div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex gap-3">
                      <Button
                        variant="danger"
                        className="flex-1"
                        onClick={() => setRejectModalOpen(true)}
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                      <Button
                        variant="primary"
                        className="flex-1 bg-green-600 hover:bg-green-700 focus:ring-green-500"
                        onClick={() => setApproveConfirmOpen(true)}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-500">
                Select a bill from the queue to review
              </div>
            )}
          </div>

          {/* Approve Confirm Modal */}
          <Modal
            open={approveConfirmOpen}
            onClose={() => setApproveConfirmOpen(false)}
            title="Approve Bill"
          >
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to approve this bill for{' '}
                <span className="font-bold text-gray-900">
                  {formatCurrency(currentSelected?.amount || 0)}
                </span>
                ? This amount will be added to the approved totals.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setApproveConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
                  onClick={handleApprove}
                  loading={approve.isPending}
                >
                  Confirm Approval
                </Button>
              </div>
            </div>
          </Modal>

          {/* Reject Modal */}
          <Modal open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Reject Bill">
            <form onSubmit={handleReject} className="flex flex-col gap-4">
              <p className="text-sm text-gray-700">
                Please provide a reason for rejecting this bill. The student will be able to see this
                reason and submit a new bill if necessary.
              </p>
              <Input
                label="Reason"
                required
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Amount does not match receipt, missing receipt"
              />
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setRejectModalOpen(false)} type="button">
                  Cancel
                </Button>
                <Button variant="danger" type="submit" loading={reject.isPending}>
                  Reject Bill
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      </QueryState>
    </div>
  )
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export function DashboardPage() {
  const { data: clubs } = useClubs()
  const [selectedClubId, setSelectedClubId] = useState<string>('')

  // F6: RPC queries driven by selectedClubId
  const { data: kpi, isLoading: loadingKpi, error: errorKpi, refetch: refetchKpi } = useKpiStats(
    selectedClubId || null
  )
  const {
    data: byEvent,
    isLoading: loadingEvent,
    error: errorEvent,
    refetch: refetchEvent,
  } = useSpendByEvent(selectedClubId || null)
  const {
    data: byStudent,
    isLoading: loadingStudent,
    error: errorStudent,
    refetch: refetchStudent,
  } = useSpendByStudent(selectedClubId || null)
  const {
    data: byMonth,
    isLoading: loadingMonth,
    error: errorMonth,
    refetch: refetchMonth,
  } = useSpendByMonth(selectedClubId || null)
  const {
    data: byClub,
    isLoading: loadingClub,
    error: errorClub,
    refetch: refetchClub,
  } = useSpendByClub()

  const loading = loadingKpi || loadingEvent || loadingStudent || loadingMonth || loadingClub
  const error = errorKpi || errorEvent || errorStudent || errorMonth || errorClub

  const handleRetry = () => {
    refetchKpi()
    refetchEvent()
    refetchStudent()
    refetchMonth()
    refetchClub()
  }

  // Format month data for chart
  const monthData = byMonth?.map((m) => ({
    name: formatMonthYear(m.month),
    amount: Number(m.approved_total),
  }))

  // Format event data
  const eventData = byEvent
    ?.filter((e) => Number(e.approved_total) > 0)
    .map((e) => ({
      name: e.event_name,
      value: Number(e.approved_total),
    }))

  // Format student data
  const studentData = byStudent
    ?.filter((s) => Number(s.approved_total) > 0)
    .map((s) => ({
      name: displayPersonName({ full_name: s.full_name, email: s.email }),
      value: Number(s.approved_total),
    }))

  // Format club data (F6)
  const clubData = byClub?.map((c) => ({
    name: c.club_name,
    amount: Number(c.approved_total),
    count: Number(c.approved_count),
  }))

  return (
    <div className="flex flex-col gap-8">
      {/* Header with F6 Club Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Overview of spending (approved only).</p>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-500" />
          <select
            value={selectedClubId}
            onChange={(e) => setSelectedClubId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            aria-label="Filter dashboard by club"
          >
            <option value="">All Clubs</option>
            {(clubs ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <QueryState
        loading={loading}
        error={error}
        onRetry={handleRetry}
        errorTitle="Failed to load dashboard data"
      >
        {/* KPI Cards (4 cards per PRD A4) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Total Approved</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {formatCurrency(kpi?.approvedTotal || 0)}
            </div>
            <div className="mt-1 text-xs text-gray-400">Total expenditure</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Approved Bills</div>
            <div className="mt-2 text-3xl font-bold text-green-600">
              {kpi?.approvedCount || 0}
            </div>
            <div className="mt-1 text-xs text-gray-400">Bills approved</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Pending Bills</div>
            <div className="mt-2 text-3xl font-bold text-amber-600">
              {kpi?.pendingCount || 0}
            </div>
            <div className="mt-1 text-xs text-gray-400">Bills in queue</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-500">Pending Amount</div>
            <div className="mt-2 text-3xl font-bold text-amber-600">
              {formatCurrency(kpi?.pendingTotal || 0)}
            </div>
            <div className="mt-1 text-xs text-gray-400">Awaiting approval</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Monthly Spend Bar Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Monthly Spending</h2>
            <div className="h-72 w-full">
              {monthData && monthData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(val) => `₹${val}`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(val: number) => formatCurrency(val)}
                      cursor={{ fill: '#f3f4f6' }}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  No approved spending data yet.
                </div>
              )}
            </div>
          </div>

          {/* F6: Spend by Club Bar Chart (visible when All Clubs selected) */}
          {!selectedClubId && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Spend by Club</h2>
              <div className="h-64 w-full">
                {clubData && clubData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clubData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(val) => `₹${val}`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(val: number) => formatCurrency(val)}
                        cursor={{ fill: '#f3f4f6' }}
                      />
                      <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    No club data available.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event Spend Pie Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Spending by Event</h2>
            <div className="h-64 w-full">
              {eventData && eventData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={eventData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {eventData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  No data
                </div>
              )}
            </div>
          </div>

          {/* Student Spend Pie Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Spending by Student</h2>
            <div className="h-64 w-full">
              {studentData && studentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                    >
                      {studentData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  No data
                </div>
              )}
            </div>
          </div>
        </div>
      </QueryState>
    </div>
  )
}

// ─── Students Page ───────────────────────────────────────────────────────────

export function StudentsPage() {
  const { data: clubs } = useClubs()
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const { data: students, isLoading, error, refetch } = useSpendByStudent(
    selectedClubId || null
  )

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500">All registered students and their approved totals.</p>
        </div>
        {/* F6 Club filter */}
        <div className="w-48">
          <select
            value={selectedClubId}
            onChange={(e) => setSelectedClubId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            aria-label="Filter students by club"
          >
            <option value="">All Clubs</option>
            {(clubs ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load students"
        empty={!isLoading && !error && (!students || students.length === 0)}
        emptyTitle="No students found"
        emptyDescription="No student expenses have been recorded yet."
      >
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Student Name</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Approved Bills</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Approved Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {students?.map((student) => (
                  <tr key={student.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      <Link
                        to={`/admin/students/${student.user_id}${
                          selectedClubId ? `?club=${selectedClubId}` : ''
                        }`}
                        className="text-accent-600 hover:underline"
                      >
                        {displayPersonName(student)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500">{student.email}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-gray-500">
                      {student.approved_count}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(student.approved_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </QueryState>
    </div>
  )
}

// ─── Student Detail Page ─────────────────────────────────────────────────────

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: clubs } = useClubs()
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const { data, isLoading, error, refetch } = useStudentDetail(
    id || '',
    selectedClubId || null
  )
  const [viewImage, setViewImage] = useState<string | null>(null)

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/admin/students"
          className="flex w-fit items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Students
        </Link>
        <div className="w-48">
          <select
            value={selectedClubId}
            onChange={(e) => setSelectedClubId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            aria-label="Filter student bills by club"
          >
            <option value="">All Clubs</option>
            {(clubs ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load student details"
        notFound={!isLoading && !error && !data?.profile}
        notFoundTitle="Student not found"
        notFoundDescription="No student profile matching this ID was found."
      >
        {data?.profile && (
          <>
            <div className="mb-6 flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {displayPersonName(data.profile)}
                </h1>
                <p className="text-sm text-gray-500">{data.profile.email}</p>
              </div>

              <div className="flex max-w-sm flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-medium text-gray-500">Total Approved</div>
                <div className="mt-1 text-2xl font-bold text-green-600">
                  {formatCurrency(data.profile.approved_total)}
                </div>
                <div className="text-sm text-gray-500">{data.profile.approved_count} bills</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-gray-500">Date</th>
                      <th className="px-6 py-3 text-left font-medium text-gray-500">Club</th>
                      <th className="px-6 py-3 text-left font-medium text-gray-500">Event</th>
                      <th className="px-6 py-3 text-left font-medium text-gray-500">Title</th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500">Amount</th>
                      <th className="px-6 py-3 text-center font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {data.expenses.map((expense: StudentExpense) => (
                      <tr
                        key={expense.id}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                        onClick={() => setViewImage(expense.bill_path)}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                          {formatDateOnly(expense.expense_date)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-700">
                          {expense.clubs?.name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-900">
                          {expense.events?.name}
                        </td>
                        <td className="px-6 py-4 text-gray-900">
                          <div className="font-medium">{expense.title}</div>
                          {expense.status === 'rejected' && expense.reject_reason && (
                            <div className="mt-1 text-xs text-red-600">
                              Reason: {expense.reject_reason}
                            </div>
                          )}
                          {expense.status === 'pending' && expense.revert_reason && (
                            <div className="mt-1 text-xs text-amber-600">
                              Reverted: {expense.revert_reason}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          <Badge status={expense.status} />
                        </td>
                      </tr>
                    ))}
                    {data.expenses.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          This student has no bills.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <Modal
              open={!!viewImage}
              onClose={() => setViewImage(null)}
              title="Bill Image"
              maxWidth="2xl"
            >
              <ImageViewer path={viewImage} />
            </Modal>
          </>
        )}
      </QueryState>
    </div>
  )
}
