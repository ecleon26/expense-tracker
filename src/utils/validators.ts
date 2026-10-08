import { z } from 'zod'
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from '../lib/config'
import { localTodayYmd } from './formatDateTime'

/** Amount: positive number, max 2 decimal places */
export const amountSchema = z
  .string()
  .min(1, 'Amount is required')
  .refine(
    (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0,
    'Enter a valid amount greater than 0 (max 2 decimal places)'
  )

/** Date: required, not in the future */
export const expenseDateSchema = z
  .string()
  .min(1, 'Date is required')
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Enter a valid date')
  .refine((v) => v <= localTodayYmd(), 'Date cannot be in the future')

/** Image file: correct type, under 5 MB */
export const imageFileSchema = z
  .any()
  .refine((files) => files && files.length > 0, 'Image is required')
  .transform((files) => (files instanceof FileList ? files[0] : files[0]))
  .refine(
    (f) => f instanceof File,
    'Expected a file'
  )
  .refine(
    (f) => ALLOWED_IMAGE_TYPES.includes(f.type as (typeof ALLOWED_IMAGE_TYPES)[number]),
    'Only JPG, PNG, or WebP images are allowed'
  )
  .refine(
    (f) => f.size <= MAX_FILE_SIZE_BYTES,
    `Image must be under ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`
  )

/** Upload bill form schema */
export const uploadBillSchema = z.object({
  club_id: z.string().min(1, 'Please select a club'),
  event_id: z.string().min(1, 'Please select an event'),
  title: z.string().min(1, 'Title is required').max(120, 'Max 120 characters'),
  amount: amountSchema,
  expense_date: expenseDateSchema,
  description: z.string().optional(),
  image: imageFileSchema,
})

export type UploadBillFormValues = z.infer<typeof uploadBillSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
