import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Button } from '../components/Button'
import { Spinner } from '../components/Spinner'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { friendlyError } from '../utils/errorMessages'
import { useClubs } from '../hooks/useClubs'
import { QueryState } from '../components/QueryState'
import { Clock } from 'lucide-react'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
} from '../utils/validators'
import { ProfileLoadErrorScreen } from './ProfileLoadErrorScreen'

// ─── Login ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type LoginFormValues = z.infer<typeof loginSchema>

const roleHome = { student: '/student/upload', admin: '/admin' } as const
const rolePrefix = { student: '/student', admin: '/admin' } as const

/** Only return to `from` if it belongs to the user's own role area. */
function safeFrom(from: string | undefined, role: 'student' | 'admin'): string {
  if (from && from.startsWith(rolePrefix[role])) return from
  return roleHome[role]
}

function safeHome(profile: { role: 'student' | 'admin'; approval_status?: string }, from: string | undefined): string {
  if (profile.role === 'admin') return safeFrom(from, 'admin')
  if (profile.approval_status === 'pending') return '/pending-approval'
  if (profile.approval_status === 'rejected') return '/rejected-approval'
  return safeFrom(from, 'student')
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname
  const { profile, loading, session, profileLoadFailed, retryProfile, signOut } = useAuth()
  const { toast } = useToast()

  // Once auth resolves, redirect to the right home (handles post-login redirect too)
  useEffect(() => {
    if (!loading && profile) {
      navigate(safeHome(profile, from), { replace: true })
    }
  }, [loading, profile, navigate, from])

  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (error) {
      const msg = friendlyError(error)
      setServerError(msg)
      toast(msg, 'error')
    } else {
      toast('Welcome back!', 'success')
    }
    // Do NOT navigate here — the useEffect above fires once profile loads
  }

  // Show spinner while checking existing session on mount
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-accent-700">Budget Tracker</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">By Digital VJTI</p>
          <p className="mt-2 text-sm text-gray-500">Sign in to your account</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <div>
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                error={errors.password?.message}
                {...register('password')}
              />
              <div className="mt-1 flex justify-end">
                <Link to="/forgot-password" className="text-xs font-medium text-accent-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            {serverError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-accent-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Signup ──────────────────────────────────────────────────────────────────

const YEAR_OPTIONS = [
  { value: '1st Year (FY)', label: '1st Year (FY)' },
  { value: '2nd Year (SY)', label: '2nd Year (SY)' },
  { value: '3rd Year (TY)', label: '3rd Year (TY)' },
  { value: '4th Year (B.Tech)', label: '4th Year (B.Tech)' },
  { value: 'M.Tech / Postgrad', label: 'M.Tech / Postgrad' },
  { value: 'Other', label: 'Other' },
]

const CLUB_ROLE_OPTIONS = [
  { value: 'Tech Core', label: 'Tech Core' },
  { value: 'Operations & PR', label: 'Operations & PR' },
  { value: 'Design', label: 'Design' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Sponsorship', label: 'Sponsorship' },
  { value: 'Treasurer', label: 'Treasurer' },
]

const signupSchema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    club_id: z.string().uuid('Please select which club you are from'),
    club_role: z.string().min(1, 'Please select your club role'),
    year: z.string().min(1, 'Please select your academic year'),
    branch: z.string().min(2, 'Branch must be at least 2 characters (e.g. Computer Engg)'),
    roll_number: z.string().min(2, 'Roll number / ID is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
type SignupFormValues = z.infer<typeof signupSchema>

export function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { data: clubs, isLoading: clubsLoading, error: clubsError, refetch: refetchClubs } = useClubs()
  const { toast } = useToast()

  const clubOptions =
    clubs?.map((c) => ({ value: c.id, label: c.name })) ?? []

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) })

  const onSubmit = async (values: SignupFormValues) => {
    setServerError(null)
    const clubExists = clubs?.some((c) => c.id === values.club_id)
    if (!clubExists) {
      const msg = 'Selected club is not valid. Please refresh and try again.'
      setServerError(msg)
      toast(msg, 'error')
      return
    }

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          club_id: values.club_id,
          club_role: values.club_role,
          year: values.year,
          branch: values.branch,
          roll_number: values.roll_number,
        },
      },
    })
    if (error) {
      const msg = friendlyError(error)
      setServerError(msg)
      toast(msg, 'error')
      return
    }
    setSuccess(true)
    toast('Registration submitted for admin approval!', 'success')
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
            <Clock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Registration Submitted!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your details (Club, Role, Year, Branch, and Roll Number) have been recorded. To keep our club funds secure, an administrator must confirm your membership before access is granted.
          </p>
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800 text-left space-y-1.5">
            <p className="font-semibold text-amber-900">What happens next?</p>
            <p>1. If email confirmation was requested, please verify the link in your inbox.</p>
            <p>2. A club administrator will review your membership information.</p>
            <p>3. Once approved, you can sign in to submit bills and track expenses.</p>
          </div>
          <div className="mt-6">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-700"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-accent-700">Budget Tracker</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">By Digital VJTI</p>
          <p className="mt-2 text-sm text-gray-500">Student Account Registration</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800">
            <strong>Member Verification Notice:</strong> Access requires administrator confirmation. Please provide your actual college and club details.
          </div>

          <QueryState
            loading={clubsLoading}
            error={clubsError}
            onRetry={refetchClubs}
            errorTitle="Could not load clubs"
            empty={!clubsLoading && !clubsError && clubOptions.length === 0}
            emptyTitle="No clubs available"
            emptyDescription="Registration is temporarily unavailable. Please try again later or contact an administrator."
          >
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Full name"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Rahul Sharma"
                  required
                  error={errors.full_name?.message}
                  {...register('full_name')}
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="College Email"
                  type="email"
                  autoComplete="email"
                  placeholder="your.email@example.com"
                  required
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <div className="sm:col-span-2">
                <Select
                  label="Which club are you from?"
                  placeholder="Select your club…"
                  required
                  options={clubOptions}
                  error={errors.club_id?.message}
                  {...register('club_id')}
                />
              </div>

              <div className="sm:col-span-2">
                <Select
                  label="Club Role"
                  placeholder="Select your role…"
                  required
                  options={CLUB_ROLE_OPTIONS}
                  error={errors.club_role?.message}
                  {...register('club_role')}
                />
              </div>

              <div>
                <Select
                  label="Academic Year"
                  placeholder="Select year…"
                  required
                  options={YEAR_OPTIONS}
                  error={errors.year?.message}
                  {...register('year')}
                />
              </div>

              <div>
                <Input
                  label="Branch / Department"
                  type="text"
                  placeholder="e.g. Computer Engineering"
                  required
                  error={errors.branch?.message}
                  {...register('branch')}
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="Roll Number / Student ID"
                  type="text"
                  placeholder="e.g. 211080045"
                  required
                  error={errors.roll_number?.message}
                  {...register('roll_number')}
                />
              </div>

              <div>
                <Input
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  required
                  hint="Min. 8 characters"
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>

              <div>
                <Input
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  required
                  error={errors.confirm_password?.message}
                  {...register('confirm_password')}
                />
              </div>
            </div>

            {serverError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="mt-2 w-full" disabled={clubOptions.length === 0}>
              Submit for Approval
            </Button>
          </form>
          </QueryState>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}


// ─── Forgot Password ─────────────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const [sentMessage, setSentMessage] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) })

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
    } catch {
      // Intentionally ignore raw error to keep response neutral
    }
    // Always show same neutral message per PRD F1
    setSentMessage(true)
    setCooldown(15) // 15 seconds cooldown
    toast('If an account exists for this email, a reset link has been sent.', 'info')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-accent-700">Budget Tracker</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">By Digital VJTI</p>
          <p className="mt-2 text-sm text-gray-500">Reset your password</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {sentMessage && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={cooldown > 0}
              className="mt-1 w-full"
            >
              {cooldown > 0 ? `Wait ${cooldown}s` : 'Send reset link'}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Remember your password?{' '}
          <Link to="/login" className="font-medium text-accent-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Reset Password ──────────────────────────────────────────────────────────

function isRecoveryUrl(): boolean {
  const hash = window.location.hash
  const search = window.location.search
  return (
    hash.includes('type=recovery') ||
    hash.includes('type%3Drecovery') ||
    search.includes('type=recovery')
  )
}

type ResetAccess = 'loading' | 'recovery' | 'signed-in' | 'no-session'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { profile } = useAuth()
  const [access, setAccess] = useState<ResetAccess>('loading')
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    let recoveryFromEvent = false

    const resolveAccess = async () => {
      if (recoveryFromEvent || isRecoveryUrl()) {
        setAccess('recovery')
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setAccess('signed-in')
      } else {
        setAccess('no-session')
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryFromEvent = true
        setAccess('recovery')
      }
    })

    if (isRecoveryUrl()) {
      setAccess('recovery')
    } else {
      void resolveAccess()
      const timer = window.setTimeout(() => {
        if (recoveryFromEvent || isRecoveryUrl()) {
          setAccess('recovery')
          return
        }
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (recoveryFromEvent || isRecoveryUrl()) {
            setAccess('recovery')
          } else if (session) {
            setAccess('signed-in')
          } else {
            setAccess('no-session')
          }
        })
      }, 800)
      return () => {
        window.clearTimeout(timer)
        subscription.unsubscribe()
      }
    }

    return () => subscription.unsubscribe()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      const msg = friendlyError(error)
      setServerError(msg)
      toast(msg, 'error')
      return
    }

    // Success: sign out per PRD F1 and redirect to /login
    await supabase.auth.signOut()
    toast('Password successfully updated! Please sign in with your new password.', 'success')
    navigate('/login', { replace: true })
  }

  if (access === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Spinner size="lg" label="Validating reset link…" />
      </div>
    )
  }

  if (access === 'signed-in') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-xl border border-blue-200 bg-blue-50 p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-blue-900">Already signed in</p>
          <p className="mt-2 text-sm text-blue-800">
            To change your password while logged in, open the menu and choose{' '}
            <span className="font-medium">Change password</span>.
          </p>
          <div className="mt-4">
            <Link
              to={profile?.role === 'admin' ? '/admin' : '/student/upload'}
              className="inline-flex rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
            >
              Back to app
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (access === 'no-session') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-red-800">Invalid or Expired Link</p>
          <p className="mt-2 text-sm text-red-700">
            This password reset link is invalid or has expired. Please request a new link.
          </p>
          <div className="mt-4">
            <Link
              to="/forgot-password"
              className="inline-flex rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Request new link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-accent-700">Budget Tracker</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">By Digital VJTI</p>
          <p className="mt-2 text-sm text-gray-500">Enter your new password</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              hint="At least 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            {serverError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
              Update password
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Change Password Modal (Logged-in users) ─────────────────────────────────

export function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { toast } = useToast()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      const msg = friendlyError(error)
      setServerError(msg)
      toast(msg, 'error')
      return
    }

    toast('Password changed successfully!', 'success')
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Change Password" maxWidth="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Change password
          </Button>
        </div>
      </form>
    </Modal>
  )
}
