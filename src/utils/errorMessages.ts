/** Maps raw Supabase/Postgres errors to friendly messages. Raw errors are logged to console only in dev. */

interface ErrorLike {
  message?: string
  code?: string
  status?: number
  details?: string
  hint?: string
}

const FRIENDLY: [RegExp, string][] = [
  // Trigger-raised messages (match before generic Postgres codes)
  [/already been reviewed/i, 'This bill has already been reviewed by someone else.'],
  [/reject reason required/i, 'A rejection reason is required.'],

  // Postgres constraint errors
  [/42501/, "You don't have permission to do that."],
  [/23505/, 'A duplicate entry already exists (duplicate bill image).'],
  [/23503/, 'A linked record is missing. Please refresh and try again.'],
  [/23514/, 'The submitted value is invalid.'],

  // Supabase Auth errors
  [/invalid login credentials/i, 'Incorrect email or password.'],
  [/user already registered/i, 'An account with this email already exists.'],
  [/email not confirmed/i, 'Please verify your email address before signing in.'],
  [/rate limit/i, 'Too many attempts. Please wait a moment before trying again.'],
  [/email.*already.*use/i, 'An account with this email already exists.'],

  // Storage errors
  [/object size exceeds/i, 'The file is too large. Maximum size is 5 MB.'],
  [/invalid mime type/i, 'Only JPG, PNG, or WebP image files are allowed.'],
  [/violates row-level security/i, "You don't have permission to do that."],

  // Network
  [/failed to fetch/i, 'Network error. Please check your internet connection.'],
  [/networkerror/i, 'Network error. Please check your internet connection.'],
]

export function friendlyError(error: unknown): string {
  const raw = error as ErrorLike
  const message = raw?.message ?? ''
  const code = raw?.code ?? ''

  if (import.meta.env.DEV) {
    console.error('[Dev] Raw error:', error)
  }

  const combined = `${code} ${message}`.trim()
  for (const [pattern, friendly] of FRIENDLY) {
    if (pattern.test(combined)) return friendly
  }

  return 'Something went wrong. Please try again.'
}
