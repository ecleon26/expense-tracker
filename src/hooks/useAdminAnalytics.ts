import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryKeys } from '../lib/queryKeys'

export function useKpiStats(clubId?: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.stats.kpi(clubId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('kpi_summary', { p_club_id: clubId || null })
        .single()

      if (error) throw error

      const raw = data as {
        approved_count?: number
        approved_total?: number
        pending_count?: number
        pending_amount?: number
      } | null

      return {
        approvedCount: Number(raw?.approved_count ?? 0),
        approvedTotal: Number(raw?.approved_total ?? 0),
        pendingCount: Number(raw?.pending_count ?? 0),
        pendingTotal: Number(raw?.pending_amount ?? 0),
      }
    },
  })
}

export function useSpendByEvent(clubId?: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.stats.event(clubId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('spend_by_event', { p_club_id: clubId || null })

      if (error) throw error
      return (data || []) as {
        event_id: string
        event_name: string
        club_name: string
        approved_count: number
        approved_total: number
      }[]
    },
  })
}

export function useSpendByStudent(clubId?: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.stats.student(clubId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('spend_by_student', { p_club_id: clubId || null })

      if (error) throw error
      return (data || []) as {
        user_id: string
        full_name: string
        email: string
        approved_count: number
        approved_total: number
      }[]
    },
  })
}

export function useSpendByMonth(clubId?: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.stats.month(clubId),
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('spend_by_month', { p_club_id: clubId || null })

      if (error) throw error
      return (data || []) as {
        month: string
        approved_count: number
        approved_total: number
      }[]
    },
  })
}

export function useSpendByClub() {
  return useQuery({
    queryKey: queryKeys.admin.stats.club(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('spend_by_club')
      if (error) throw error
      return (data || []) as {
        club_id: string
        club_name: string
        approved_count: number
        approved_total: number
      }[]
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
  revert_reason: string | null
  bill_path: string
  club_id: string
  clubs: { name: string } | null
  events: { name: string } | null
}

export function useStudentDetail(studentId: string, clubId?: string | null) {
  return useQuery({
    queryKey: [...queryKeys.admin.students.detail(studentId), clubId ?? 'all'],
    queryFn: async () => {
      // 1. Fetch student row from spend_by_student
      const { data: studentsData, error: profileError } = await supabase
        .rpc('spend_by_student', { p_club_id: clubId || null })

      if (profileError) throw profileError
      const profile = (studentsData || []).find((s: { user_id: string }) => s.user_id === studentId)

      if (!profile) {
        // Fallback: fetch profile directly if user exists but has 0 records
        const { data: directProfile, error: directErr } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', studentId)
          .single()

        if (directErr || !directProfile) return null

        const profileFallback = {
          user_id: directProfile.id,
          full_name: directProfile.full_name,
          email: directProfile.email,
          approved_count: 0,
          approved_total: 0,
        }

        let query = supabase
          .from('expenses')
          .select(`
            id, title, amount, expense_date, status, reject_reason, revert_reason, bill_path, club_id,
            clubs ( name ),
            events ( name )
          `)
          .eq('user_id', studentId)
          .order('created_at', { ascending: false })

        if (clubId) query = query.eq('club_id', clubId)

        const { data: expenses, error: expensesError } = await query
        if (expensesError) throw expensesError

        return {
          profile: profileFallback,
          expenses: (expenses || []) as unknown as StudentExpense[],
        }
      }

      // 2. Fetch expenses
      let query = supabase
        .from('expenses')
        .select(`
          id, title, amount, expense_date, status, reject_reason, revert_reason, bill_path, club_id,
          clubs ( name ),
          events ( name )
        `)
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })

      if (clubId) query = query.eq('club_id', clubId)

      const { data: expenses, error: expensesError } = await query
      if (expensesError) throw expensesError

      return {
        profile: profile as {
          user_id: string
          full_name: string
          email: string
          approved_count: number
          approved_total: number
        },
        expenses: (expenses || []) as unknown as StudentExpense[],
      }
    },
    enabled: !!studentId,
  })
}
