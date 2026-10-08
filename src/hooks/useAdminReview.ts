import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryClient } from '../lib/queryClient'
import { queryKeys } from '../lib/queryKeys'

export interface PendingExpense {
  id: string
  title: string
  description: string | null
  amount: number
  expense_date: string
  bill_path: string
  created_at: string
  club_id: string
  clubs: { id: string; name: string } | null
  events: { id: string; name: string } | null
  student: { full_name: string; email: string } | null
}

export function usePendingExpenses(clubId?: string | null) {
  return useQuery({
    queryKey: [...queryKeys.expenses.pending(), clubId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select(`
          id, title, description, amount, expense_date, bill_path, created_at, club_id,
          clubs ( id, name ),
          events ( id, name ),
          student:profiles!expenses_user_id_fkey ( full_name, email )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }) // Oldest first per PRD

      if (clubId) {
        query = query.eq('club_id', clubId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as PendingExpense[]
    },
  })
}

export function invalidateAllAdminQueries() {
  queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() })
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats.all() })
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.students.all() })
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.events() })
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.history() })
}

export function useApproveExpense() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({ status: 'approved' })
        .eq('id', id)
        .eq('status', 'pending')
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateAllAdminQueries()
    },
  })
}

export function useRejectExpense() {
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({ status: 'rejected', reject_reason: reason })
        .eq('id', id)
        .eq('status', 'pending')
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateAllAdminQueries()
    },
  })
}

export function useUndoReview() {
  return useMutation({
    mutationFn: async ({
      id,
      currentStatus,
      reason,
    }: {
      id: string
      currentStatus: 'approved' | 'rejected'
      reason: string
    }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({ status: 'pending', revert_reason: reason })
        .eq('id', id)
        .eq('status', currentStatus)
        .select()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateAllAdminQueries()
    },
  })
}
