import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryKeys } from '../lib/queryKeys'
import { localDayEndIso, localDayStartIso } from '../utils/formatDateTime'

export interface AuditLogItem {
  id: number
  expense_id: string
  club_id: string
  student_id: string
  actor_id: string | null
  actor_name: string | null
  actor_email: string | null
  action: 'uploaded' | 'approved' | 'rejected' | 'review_reverted'
  from_status: string | null
  to_status: string | null
  amount: number | null
  title: string | null
  reason: string | null
  created_at: string
}

export interface AdminHistoryFilter {
  page?: number
  pageSize?: number
  clubId?: string | null
  action?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

export function useAdminHistory(filters: AdminHistoryFilter) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 25

  return useQuery({
    queryKey: queryKeys.admin.history(filters as Record<string, unknown>),
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('expense_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.clubId) {
        query = query.eq('club_id', filters.clubId)
      }
      if (filters.action && filters.action !== 'all') {
        query = query.eq('action', filters.action)
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', localDayStartIso(filters.dateFrom))
      }
      if (filters.dateTo) {
        query = query.lte('created_at', localDayEndIso(filters.dateTo))
      }

      const { data, error, count } = await query
      if (error) throw error

      return {
        items: (data || []) as AuditLogItem[],
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
        page,
      }
    },
  })
}
