import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryKeys } from '../lib/queryKeys'

export interface Event {
  id: string
  name: string
  club_id: string
  is_active: boolean
}

export function useActiveEvents(clubId?: string | null) {
  return useQuery({
    queryKey: clubId ? queryKeys.events.byClub(clubId) : queryKeys.events.active(),
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('id, name, club_id, is_active')
        .eq('is_active', true)
        .order('name')

      if (clubId) {
        query = query.eq('club_id', clubId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Event[]
    },
    enabled: clubId !== undefined ? Boolean(clubId) : true,
  })
}
