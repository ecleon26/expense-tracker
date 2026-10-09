import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'
import { useClubs } from '../hooks/useClubs'
import { useActiveEvents } from '../hooks/useEvents'
import { useMyExpenses } from '../hooks/useExpenses'
import { uploadBillSchema, type UploadBillFormValues } from '../utils/validators'
import { compressImage } from '../utils/compressImage'
import { BILLS_BUCKET } from '../lib/config'
import { formatCurrency } from '../utils/formatCurrency'
import { friendlyError } from '../utils/errorMessages'
import { formatDateOnly, localTodayYmd } from '../utils/formatDateTime'

import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ImageViewer } from '../components/ImageViewer'
import { useToast } from '../components/Toast'
import { QueryState } from '../components/QueryState'
import { queryClient } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'
import { ImagePlus, AlertCircle, CheckCircle2 } from 'lucide-react'

// ─── Upload Bill ─────────────────────────────────────────────────────────────

export function UploadBillPage() {
  const { profile } = useAuth()
  const { data: clubs, isLoading: loadingClubs, error: clubsError, refetch: refetchClubs } = useClubs()
  const { toast } = useToast()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<UploadBillFormValues>({
    resolver: zodResolver(uploadBillSchema),
    defaultValues: {
      club_id: '',
      event_id: '',
      amount: '',
      title: '',
      description: '',
      expense_date: localTodayYmd(),
    },
  })

  const selectedClubId = watch('club_id')

  // F3: Load active events for selected club only
  const {
    data: events,
    isLoading: loadingEvents,
    error: eventsError,
    refetch: refetchEvents,
  } = useActiveEvents(selectedClubId || null)

  // F3: Changing the club clears the selected event
  const prevClubRef = useRef(selectedClubId)
  useEffect(() => {
    if (prevClubRef.current !== selectedClubId) {
      setValue('event_id', '')
      prevClubRef.current = selectedClubId
    }
  }, [selectedClubId, setValue])

  const onSubmit = async (values: UploadBillFormValues) => {
    if (!profile) return
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      // 1. Compress image as JPEG (A5)
      const compressedFile = await compressImage(values.image, { fileType: 'image/jpeg' })

      // 2. Always save as .jpg (A5)
      const filePath = `${profile.id}/${crypto.randomUUID()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from(BILLS_BUCKET)
        .upload(filePath, compressedFile, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // 3. Insert expense record with club_id
      const { error: insertError } = await supabase.from('expenses').insert({
        user_id: profile.id,
        club_id: values.club_id,
        event_id: values.event_id,
        title: values.title,
        description: values.description || null,
        amount: parseFloat(values.amount),
        expense_date: values.expense_date,
        bill_path: filePath,
        status: 'pending',
      })

      if (insertError) {
        // Cleanup orphaned image
        await supabase.storage.from(BILLS_BUCKET).remove([filePath])
        throw insertError
      }

      // Success — revoke preview URL and reset form
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setSubmitSuccess(true)
      reset({
        club_id: '',
        event_id: '',
        amount: '',
        title: '',
        description: '',
        expense_date: localTodayYmd(),
      })
      setImagePreview(null)
      toast('Bill submitted successfully! It is now pending review.', 'success')
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.myExpenses() })
    } catch (err) {
      const msg = friendlyError(err)
      setSubmitError(msg)
      toast(msg, 'error')
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Revoke the previous preview URL before creating a new one (A5)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      previewUrlRef.current = url
      setImagePreview(url)
    } else {
      setImagePreview(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Bill</h1>
        <p className="text-sm text-gray-500">Submit a new expense for committee approval.</p>
      </div>

      <QueryState
        loading={loadingClubs}
        error={clubsError}
        onRetry={refetchClubs}
        errorTitle="Could not load clubs"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {submitSuccess && (
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-800 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-medium">Bill submitted successfully!</h3>
                <p className="mt-1 text-sm text-green-700">
                  Your expense is now pending review by an admin.
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm">{submitError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* F3: Club dropdown (required, above Event) */}
            <Select
              label="Club"
              required
              placeholder="Select a club..."
              options={(clubs ?? []).map((c) => ({ value: c.id, label: c.name }))}
              error={errors.club_id?.message}
              {...register('club_id')}
            />

            {/* F3: Event dropdown (disabled until club chosen) */}
            <div>
              <Select
                label="Event"
                required
                disabled={!selectedClubId || loadingEvents}
                placeholder={
                  !selectedClubId
                    ? 'Select a club first...'
                    : loadingEvents
                    ? 'Loading events...'
                    : (events ?? []).length === 0
                    ? 'No active events for this club'
                    : 'Select an event...'
                }
                options={(events ?? []).map((e) => ({ value: e.id, label: e.name }))}
                error={errors.event_id?.message}
                {...register('event_id')}
              />
              {selectedClubId && !loadingEvents && (events ?? []).length === 0 && !eventsError && (
                <p className="mt-1.5 text-xs text-amber-600">
                  This club currently has no active events. Please contact the administrator.
                </p>
              )}
              {eventsError && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-red-600">
                  <span>Failed to load events.</span>
                  <button
                    type="button"
                    onClick={() => refetchEvents()}
                    className="underline hover:text-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            <Input
              label="Title"
              required
              placeholder="e.g. Pizza for orientation"
              error={errors.title?.message}
              {...register('title')}
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Input
                label="Amount"
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                error={errors.amount?.message}
                {...register('amount')}
              />
              <Input
                label="Date of Expense"
                required
                type="date"
                error={errors.expense_date?.message}
                {...register('expense_date')}
              />
            </div>

            <Input
              label="Notes (Optional)"
              placeholder="Any additional details..."
              error={errors.description?.message}
              {...register('description')}
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Bill Photo <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex items-center gap-4">
                <label
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-within:ring-2 focus-within:ring-accent-500 focus-within:ring-offset-2"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  <span>Choose Image</span>
                  <input
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    capture="environment"
                    className="sr-only"
                    aria-label="Choose bill photo"
                    {...register('image')}
                    onChange={(e) => {
                      register('image').onChange(e)
                      handleImageChange(e)
                    }}
                  />
                </label>
                <span className="text-sm text-gray-500">
                  JPG, PNG, WebP (max 5MB)
                </span>
              </div>
              {errors.image?.message && (
                <p className="mt-1 text-xs text-red-600">{errors.image.message as string}</p>
              )}

              {imagePreview && (
                <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                  <img
                    src={imagePreview}
                    alt="Selected bill preview"
                    className="max-h-64 w-full object-contain bg-gray-50"
                  />
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
                Submit Bill
              </Button>
            </div>
          </form>
        </div>
      </QueryState>
    </div>
  )
}

// ─── My Expenses ─────────────────────────────────────────────────────────────

export function MyExpensesPage() {
  const { data: expenses, isLoading, error, refetch } = useMyExpenses()
  const [viewImage, setViewImage] = useState<string | null>(null)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Expenses</h1>
          <p className="text-sm text-gray-500">Track the status of your submitted bills.</p>
        </div>
      </div>

      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        errorTitle="Failed to load expenses"
        empty={!isLoading && !error && (!expenses || expenses.length === 0)}
        emptyTitle="No expenses yet"
        emptyDescription="Upload a bill to start tracking your expenses."
      >
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
                {(expenses ?? []).map((expense) => (
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
                      {expense.events?.name || 'Unknown Event'}
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
      </QueryState>
    </div>
  )
}
