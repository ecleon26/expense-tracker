import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryClient } from '../lib/queryClient'
import { useClubs } from './useClubs'

export interface StudentApprovalItem {
  id: string
  full_name: string
  email: string
  role: 'student' | 'admin'
  approval_status: 'pending' | 'approved' | 'rejected'
  club_id: string | null
  club_role: string | null
  year: string | null
  branch: string | null
  roll_number: string | null
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  club_name?: string
}

export function useAdminApprovals(statusFilter: string = 'all', clubFilter: string = '') {
  const { data: clubs } = useClubs()

  return useQuery({
    queryKey: ['admin', 'approvals', statusFilter, clubFilter],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          id, full_name, email, role, approval_status,
          club_id, club_role, year, branch, roll_number,
          rejection_reason, approved_by, approved_at, created_at
        `)
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('approval_status', statusFilter)
      }

      if (clubFilter) {
        query = query.eq('club_id', clubFilter)
      }

      const { data, error } = await query
      if (error) throw error

      // Enrich with club names from clubs list
      const clubsMap = new Map((clubs ?? []).map((c) => [c.id, c.name]))
      const enriched: StudentApprovalItem[] = (data || []).map((row) => ({
        ...row,
        approval_status: row.approval_status || 'pending',
        club_name: row.club_id ? clubsMap.get(row.club_id) || 'Unknown Club' : 'Not specified',
      }))

      return enriched
    },
    enabled: true,
  })
}

export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ['admin', 'approvals', 'pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('approval_status', 'pending')

      if (error) return 0
      return count ?? 0
    },
    refetchInterval: 30000, // Poll every 30s
  })
}

export function useApproveStudent() {
  return useMutation({
    mutationFn: async (userId: string) => {
      // Try RPC first
      const { error: rpcError } = await supabase.rpc('approve_student', {
        target_user_id: userId,
      })

      if (rpcError) {
        // Fallback to direct table update if RPC is not present
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            approval_status: 'approved',
            rejection_reason: null,
            approved_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (updateError) throw updateError
      }
      return userId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'students'] })
    },
  })
}

export function useRejectStudent() {
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      // Try RPC first
      const { error: rpcError } = await supabase.rpc('reject_student', {
        target_user_id: userId,
        reason,
      })

      if (rpcError) {
        // Fallback to direct table update if RPC is not present
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            approval_status: 'rejected',
            rejection_reason: reason,
            approved_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (updateError) throw updateError
      }
      return userId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'students'] })
    },
  })
}
