import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryClient } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'

export interface AdminEvent {
  id: string
  name: string
  event_date: string | null
  is_active: boolean
  created_at: string
  expenses: { count: number }[]
}

export function useAdminEvents() {
  return useQuery({
    queryKey: queryKeys.admin.events(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, name, event_date, is_active, created_at,
          expenses:expenses(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data as unknown as AdminEvent[]
    },
  })
}

export function useCreateEvent() {
  return useMutation({
    mutationFn: async (event: { name: string; event_date?: string }) => {
      const { data, error } = await supabase.from('events').insert([
        {
          name: event.name,
          event_date: event.event_date || null,
        },
      ])
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.events() })
      // Also invalidate active events for student dropdowns
      queryClient.invalidateQueries({ queryKey: queryKeys.events.active() })
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
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.events() })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.active() })
    },
  })
}
