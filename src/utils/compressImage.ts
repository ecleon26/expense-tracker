import imageCompression from 'browser-image-compression'
import {
  COMPRESS_INITIAL_QUALITY,
  COMPRESS_MAX_DIMENSION,
  COMPRESS_MAX_SIZE_MB,
} from '../lib/config'

/**
 * Compress an image file client-side before uploading to Supabase Storage.
 * Target: under ~500 KB, max 1600 px on the longest side.
 * Pass extraOptions to override defaults (e.g. fileType: 'image/jpeg').
 */
export async function compressImage(
  file: File,
  extraOptions?: Parameters<typeof imageCompression>[1]
): Promise<File> {
  const options = {
    maxSizeMB: COMPRESS_MAX_SIZE_MB,
    maxWidthOrHeight: COMPRESS_MAX_DIMENSION,
    initialQuality: COMPRESS_INITIAL_QUALITY,
    useWebWorker: true,
    ...extraOptions,
  }
  return imageCompression(file, options)
}
