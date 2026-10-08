import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryKeys } from '../lib/queryKeys'

export interface MyExpense {
  id: string
  title: string
  amount: number
  expense_date: string
  status: 'pending' | 'approved' | 'rejected'
  reject_reason: string | null
  bill_path: string
  club_id: string
  clubs: { name: string } | null
  events: { name: string } | null
}

export function useMyExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses.myExpenses(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id,
          title,
          amount,
          expense_date,
          status,
          reject_reason,
          bill_path,
          club_id,
          clubs ( name ),
          events ( name )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as unknown as MyExpense[]
    },
  })
}
