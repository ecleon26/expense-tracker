// Single source of truth for app-wide configuration.
// Change CURRENCY and LOCALE here to localise the app.

export const CURRENCY = 'INR' as const
export const LOCALE = 'en-IN' as const

// Storage
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// Image compression targets
export const COMPRESS_MAX_SIZE_MB = 0.5
export const COMPRESS_MAX_DIMENSION = 1600
export const COMPRESS_INITIAL_QUALITY = 0.7

// Signed URL expiry in seconds (5 minutes)
export const SIGNED_URL_EXPIRY = 300

// Storage bucket name
export const BILLS_BUCKET = 'bills' as const
