import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { queryKeys } from '../lib/queryKeys'
import { sanitizeSearchTerm } from '../utils/sanitize'

export interface AdminBillItem {
  id: string
  created_at: string
  expense_date: string
  title: string
  description: string | null
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  reject_reason: string | null
  revert_reason: string | null
  bill_path: string
  reviewed_at: string | null
  club_id: string
  event_id: string
  user_id: string
  clubs: { id: string; name: string } | null
  events: { id: string; name: string } | null
  student: { full_name: string; email: string } | null
  reviewer: { full_name: string; email: string } | null
}

export interface AdminBillsFilter {
  page?: number
  pageSize?: number
  clubId?: string | null
  eventId?: string | null
  status?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  search?: string | null
}

export function useAdminBills(filters: AdminBillsFilter) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20

  return useQuery({
    queryKey: queryKeys.expenses.adminBills(filters as Record<string, unknown>),
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('expenses')
        .select(
          `
          id, created_at, expense_date, title, description, amount, status,
          reject_reason, revert_reason, bill_path, reviewed_at, club_id, event_id, user_id,
          clubs ( id, name ),
          events ( id, name ),
          student:profiles!expenses_user_id_fkey ( full_name, email ),
          reviewer:profiles!expenses_reviewed_by_fkey ( full_name, email )
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.clubId) {
        query = query.eq('club_id', filters.clubId)
      }
      if (filters.eventId) {
        query = query.eq('event_id', filters.eventId)
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters.dateFrom) {
        query = query.gte('expense_date', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte('expense_date', filters.dateTo)
      }
      if (filters.search) {
        const term = sanitizeSearchTerm(filters.search)
        if (term) {
          // Search in title or description
          query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
        }
      }

      const { data, error, count } = await query
      if (error) throw error

      return {
        bills: (data || []) as unknown as AdminBillItem[],
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
        page,
      }
    },
  })
}

export interface BillAuditEntry {
  id: number
  expense_id: string
  action: 'uploaded' | 'approved' | 'rejected' | 'review_reverted'
  actor_name: string | null
  actor_email: string | null
  from_status: string | null
  to_status: string | null
  reason: string | null
  created_at: string
}

export function useBillAuditHistory(expenseId: string | null) {
  return useQuery({
    queryKey: ['expenses', 'audit', expenseId],
    queryFn: async () => {
      if (!expenseId) return []
      const { data, error } = await supabase
        .from('expense_audit_log')
        .select('*')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as BillAuditEntry[]
    },
    enabled: Boolean(expenseId),
  })
}
