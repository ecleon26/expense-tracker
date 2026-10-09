export type UserRole = 'student' | 'admin'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  approval_status: ApprovalStatus
  club_id?: string | null
  club_role?: string | null
  year?: string | null
  branch?: string | null
  roll_number?: string | null
  rejection_reason?: string | null
  approved_by?: string | null
  approved_at?: string | null
  created_at: string
}
