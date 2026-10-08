import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryClient } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'

export interface AdminEvent {
  id: string
  name: string
  club_id: string
  event_date: string | null
  is_active: boolean
  created_at: string
  clubs: { id: string; name: string } | null
  expenses: { count: number }[]
}

export function useAdminEvents(clubId?: string | null) {
  return useQuery({
    queryKey: [...queryKeys.admin.events(), clubId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select(`
          id, name, club_id, event_date, is_active, created_at,
          clubs ( id, name ),
          expenses:expenses(count)
        `)
        .order('created_at', { ascending: false })

      if (clubId) {
        query = query.eq('club_id', clubId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as AdminEvent[]
    },
  })
}

export function useCreateEvent() {
  return useMutation({
    mutationFn: async (event: { name: string; club_id: string; event_date?: string }) => {
      const { data, error } = await supabase.from('events').insert([
        {
          name: event.name,
          club_id: event.club_id,
          event_date: event.event_date || null,
        },
      ])
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.events() })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all() })
    },
  })
}

export function useToggleEventStatus() {
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('events')
        .update({ is_active })
        .eq('id', id)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.events() })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all() })
    },
  })
}
