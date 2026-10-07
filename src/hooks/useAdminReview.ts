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
  events: { name: string } | null
  profiles: { full_name: string; email: string } | null
}

export function usePendingExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses.pending(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id, title, description, amount, expense_date, bill_path, created_at,
          events ( name ),
          profiles!expenses_user_id_fkey ( full_name, email )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }) // Oldest first per PRD

      if (error) throw new Error(error.message)
      return data as unknown as PendingExpense[]
    },
  })
}

function invalidateAdminQueries() {
  queryClient.invalidateQueries({ queryKey: queryKeys.expenses.pending() })
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats.all() })
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.students.all() })
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.events() })
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
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      invalidateAdminQueries()
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
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      invalidateAdminQueries()
    },
  })
}
