import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryKeys } from '../lib/queryKeys'

export function useKpiStats() {
  return useQuery({
    queryKey: queryKeys.admin.stats.kpi(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_kpis')
        .select('*')
        .single()

      if (error) throw new Error(error.message)

      return {
        approvedCount: Number(data.approved_count),
        approvedTotal: Number(data.approved_total),
        pendingCount: Number(data.pending_count),
        pendingTotal: Number(data.pending_amount),
      }
    },
  })
}

export function useSpendByEvent() {
  return useQuery({
    queryKey: queryKeys.admin.stats.event(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_spend_by_event')
        .select('*')
        .order('approved_total', { ascending: false })
      if (error) throw new Error(error.message)
      return data as { event_id: string; event_name: string; approved_count: number; approved_total: number }[]
    },
  })
}

export function useSpendByStudent() {
  return useQuery({
    queryKey: queryKeys.admin.stats.student(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_spend_by_student')
        .select('*')
        .order('approved_total', { ascending: false })
      if (error) throw new Error(error.message)
      return data as { user_id: string; full_name: string; email: string; approved_count: number; approved_total: number }[]
    },
  })
}

export function useSpendByMonth() {
  return useQuery({
    queryKey: queryKeys.admin.stats.month(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_spend_by_month')
        .select('*')
        .order('month', { ascending: true })
      if (error) throw new Error(error.message)
      return data as { month: string; approved_count: number; approved_total: number }[]
    },
  })
}

export interface StudentExpense {
  id: string
  title: string
  amount: number
  expense_date: string
  status: 'pending' | 'approved' | 'rejected'
  reject_reason: string | null
  bill_path: string
  events: { name: string } | null
}

export function useStudentDetail(studentId: string) {
  return useQuery({
    queryKey: queryKeys.admin.students.detail(studentId),
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('v_spend_by_student')
        .select('*')
        .eq('user_id', studentId)
        .single()

      if (profileError) throw new Error(profileError.message)

      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('id, title, amount, expense_date, status, reject_reason, bill_path, events(name)')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })

      if (expensesError) throw new Error(expensesError.message)

      return {
        profile: profile as { user_id: string; full_name: string; email: string; approved_count: number; approved_total: number },
        expenses: expenses as unknown as StudentExpense[],
      }
    },
    enabled: !!studentId,
  })
}
