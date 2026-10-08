import { LOCALE, DISPLAY_TIME_ZONE } from '../lib/config'

/** Today's date in the user's local calendar (yyyy-mm-dd). */
export function localTodayYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Start of a local calendar day as ISO timestamp for Supabase range filters. */
export function localDayStartIso(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

/** Inclusive end of a local calendar day as ISO timestamp for Supabase range filters. */
export function localDayEndIso(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
}

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  timeZone: DISPLAY_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
}

const dateOnlyOptions: Intl.DateTimeFormatOptions = {
  timeZone: DISPLAY_TIME_ZONE,
  dateStyle: 'medium',
}

/** Format an ISO timestamp for display (shared Asia/Kolkata clock for all users). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(LOCALE, dateTimeOptions).format(d)
}

/**
 * Format a date-only value (yyyy-mm-dd expense_date or similar).
 * Parsed as local calendar date, displayed in Asia/Kolkata.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—'
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return new Intl.DateTimeFormat(LOCALE, dateOnlyOptions).format(d)
  }
  return formatDateTime(value)
}

/** Month labels for charts (from SQL month bucket values). */
export function formatMonthYear(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: DISPLAY_TIME_ZONE,
    month: 'short',
    year: 'numeric',
  }).format(d)
}
