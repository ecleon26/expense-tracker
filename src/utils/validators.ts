import { z } from 'zod'
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from '../lib/config'

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
  .refine((v) => {
    const d = new Date(v)
    return !isNaN(d.getTime()) && d <= new Date()
  }, 'Date cannot be in the future')

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
  event_id: z.string().min(1, 'Please select an event'),
  title: z.string().min(1, 'Title is required').max(120, 'Max 120 characters'),
  amount: amountSchema,
  expense_date: expenseDateSchema,
  description: z.string().optional(),
  image: imageFileSchema,
})

export type UploadBillFormValues = z.infer<typeof uploadBillSchema>
