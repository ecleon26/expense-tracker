import { CURRENCY, LOCALE } from '../lib/config'

/**
 * Format a number as a currency string using the app's configured currency and locale.
 * All money displayed in the app must go through this function.
 */
export function formatCurrency(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(n)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}
