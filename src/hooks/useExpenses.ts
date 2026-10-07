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
          events ( name )
        `)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      // Supabase typed the join as an array or object, we know it's an object (many-to-one)
      return data as unknown as MyExpense[]
    },
  })
}
