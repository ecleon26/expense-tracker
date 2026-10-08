import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryKeys } from '../lib/queryKeys'

export interface Club {
  id: string
  name: string
  created_at: string
}

export function useClubs() {
  return useQuery({
    queryKey: queryKeys.clubs.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, created_at')
        .order('name')

      if (error) throw error
      return data as Club[]
    },
  })
}
