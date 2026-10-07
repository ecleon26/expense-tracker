import { useState } from 'react'
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
import { formatCurrency } from '../utils/formatCurrency'
import { friendlyError } from '../utils/errorMessages'

import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'
import { ImageViewer } from '../components/ImageViewer'
import { useToast } from '../components/Toast'
import { QueryState } from '../components/QueryState'
import { Power, PowerOff, CheckCircle2, XCircle } from 'lucide-react'

// ─── Events Page ─────────────────────────────────────────────────────────────

const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100, 'Name is too long'),
  event_date: z.string().optional(),
})
type CreateEventFormValues = z.infer<typeof createEventSchema>

export function EventsPage() {
  const { data: events, isLoading, error, refetch } = useAdminEvents()
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
      }
    })
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events Management</h1>
          <p className="text-sm text-gray-500">Create events and toggle their active status.</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>Create Event</Button>
      </div>

      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load events"
      >
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Event Name</th>
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
                  <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                    {event.event_date ? new Date(event.event_date).toLocaleDateString() : '—'}
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
                            onSuccess: () => toast(`Event ${event.is_active ? 'deactivated' : 'reactivated'}`, 'success'),
                            onError: (err) => toast(`Failed to update event: ${err.message}`, 'error')
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
              {(!events || events.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No events found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Event">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
  const { data: pending, isLoading, error, refetch } = usePendingExpenses()
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
      }
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
        }
      }
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
        <p className="text-sm text-gray-500">Review and approve or reject pending expense claims.</p>
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
            <h2 className="text-lg font-semibold text-gray-900">Pending Bills ({pending?.length || 0})</h2>
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
                  <div className="flex w-full justify-between gap-4">
                    <span className="font-medium text-gray-900 line-clamp-1">{expense.title}</span>
                    <span className="font-bold text-gray-900">{formatCurrency(expense.amount)}</span>
                  </div>
                  <div className="text-sm text-gray-500">{expense.profiles?.full_name}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(expense.created_at).toLocaleDateString()} · {expense.events?.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

      {/* Detail Pane */}
      <div className="flex w-full flex-col lg:w-2/3">
        {currentSelected ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Review Bill</h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Image Viewer */}
              <div className="flex flex-col">
                <ImageViewer path={currentSelected.bill_path} alt={currentSelected.title} />
              </div>

              {/* Details */}
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Student</div>
                  <div className="text-gray-900">{currentSelected.profiles?.full_name}</div>
                  <div className="text-sm text-gray-500">{currentSelected.profiles?.email}</div>
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
                    Date of expense: {new Date(currentSelected.expense_date).toLocaleDateString()}
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

import { Link, useParams } from 'react-router-dom'
import {
  useKpiStats,
  useSpendByEvent,
  useSpendByStudent,
  useSpendByMonth,
  useStudentDetail,
  type StudentExpense,
} from '../hooks/useAdminAnalytics'
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
import { ChevronLeft } from 'lucide-react'

// ─── Dashboard Page ──────────────────────────────────────────────────────────

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export function DashboardPage() {
  const { data: kpi, isLoading: loadingKpi, error: errorKpi, refetch: refetchKpi } = useKpiStats()
  const { data: byEvent, isLoading: loadingEvent, error: errorEvent, refetch: refetchEvent } = useSpendByEvent()
  const { data: byStudent, isLoading: loadingStudent, error: errorStudent, refetch: refetchStudent } = useSpendByStudent()
  const { data: byMonth, isLoading: loadingMonth, error: errorMonth, refetch: refetchMonth } = useSpendByMonth()

  const loading = loadingKpi || loadingEvent || loadingStudent || loadingMonth
  const error = errorKpi || errorEvent || errorStudent || errorMonth

  const handleRetry = () => {
    refetchKpi()
    refetchEvent()
    refetchStudent()
    refetchMonth()
  }

  // Format month data for chart
  const monthData = byMonth?.map((m) => {
    const d = new Date(m.month)
    return {
      name: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      amount: Number(m.approved_total),
    }
  })

  // Format event data
  const eventData = byEvent?.filter((e) => e.approved_total > 0).map((e) => ({
    name: e.event_name,
    value: Number(e.approved_total),
  }))

  // Format student data
  const studentData = byStudent?.filter((s) => s.approved_total > 0).map((s) => ({
    name: s.full_name,
    value: Number(s.approved_total),
  }))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of club spending (approved only).</p>
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
  const { data: students, isLoading, error, refetch } = useSpendByStudent()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <p className="text-sm text-gray-500">All registered students and their approved totals.</p>
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
                        to={`/admin/students/${student.user_id}`}
                        className="text-accent-600 hover:underline"
                      >
                        {student.full_name}
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
  const { data, isLoading, error, refetch } = useStudentDetail(id || '')
  const [viewImage, setViewImage] = useState<string | null>(null)

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/admin/students"
          className="flex w-fit items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Students
        </Link>
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
                <h1 className="text-2xl font-bold text-gray-900">{data.profile.full_name}</h1>
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
                          {new Date(expense.expense_date).toLocaleDateString()}
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
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
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
