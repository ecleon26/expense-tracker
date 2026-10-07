import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { Spinner } from '../components/Spinner'
import { useToast } from '../components/Toast'
import { friendlyError } from '../utils/errorMessages'

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

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname
  const { profile, loading } = useAuth()
  const { toast } = useToast()

  // Once auth resolves, redirect to the right home (handles post-login redirect too)
  useEffect(() => {
    if (!loading && profile) {
      navigate(safeFrom(from, profile.role), { replace: true })
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-accent-700">Club Budget Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
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
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />

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

const signupSchema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
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
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) })

  const onSubmit = async (values: SignupFormValues) => {
    setServerError(null)
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.full_name },
      },
    })
    if (error) {
      const msg = friendlyError(error)
      setServerError(msg)
      toast(msg, 'error')
      return
    }
    setSuccess(true)
    toast('Account created! Please check your email.', 'success')
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-xl border border-green-200 bg-green-50 p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-green-800">Check your email ✉️</p>
          <p className="mt-2 text-sm text-green-700">
            We sent a confirmation link to your inbox. Click it to activate your account, then{' '}
            <Link to="/login" className="font-medium underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-accent-700">Club Budget Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">Create your account</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              label="Full name"
              type="text"
              autoComplete="name"
              required
              error={errors.full_name?.message}
              {...register('full_name')}
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              hint="At least 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              error={errors.confirm_password?.message}
              {...register('confirm_password')}
            />

            {serverError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
              Create account
            </Button>
          </form>
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
