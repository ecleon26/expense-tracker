// Placeholder auth context — implemented fully in Phase 1
// Exporting minimal types so other modules can import safely

export type UserRole = 'student' | 'admin'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
}
