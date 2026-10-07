import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { BILLS_BUCKET, SIGNED_URL_EXPIRY } from '../lib/config'
import { queryKeys } from '../lib/queryKeys'

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.storage.signedUrl(path),
    queryFn: async () => {
      if (!path) return null
      const { data, error } = await supabase.storage
        .from(BILLS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_EXPIRY)

      if (error) throw new Error(error.message)
      return data.signedUrl
    },
    enabled: !!path,
    // Refresh the URL 1 minute before it expires
    staleTime: Math.max(0, (SIGNED_URL_EXPIRY - 60) * 1000),
  })
}
