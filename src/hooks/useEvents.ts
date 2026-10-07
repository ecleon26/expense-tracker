import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryKeys } from '../lib/queryKeys'

export interface Event {
  id: string
  name: string
  is_active: boolean
}

export function useActiveEvents() {
  return useQuery({
    queryKey: queryKeys.events.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) throw new Error(error.message)
      return data as Event[]
    },
  })
}
