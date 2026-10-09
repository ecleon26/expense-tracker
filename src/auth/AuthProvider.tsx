import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { Profile, ApprovalStatus } from './types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoadFailed: boolean
  retryProfile: () => Promise<void>
  refetchProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoadFailed, setProfileLoadFailed] = useState(false)

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoadFailed(false)
    
    // First try full profile with approval fields
    const fullQuery = await supabase
      .from('profiles')
      .select('id, full_name, email, role, approval_status, club_id, club_role, year, branch, roll_number, rejection_reason, created_at')
      .eq('id', userId)
      .maybeSingle()

    if (!fullQuery.error && fullQuery.data) {
      const data = fullQuery.data as unknown as Profile
      // Fallback approval_status for admins or unmigrated rows
      const resolvedStatus: ApprovalStatus = data.approval_status || (data.role === 'admin' ? 'approved' : 'pending')
      setProfile({
        ...data,
        approval_status: resolvedStatus,
      })
      setProfileLoadFailed(false)
      return
    }

    // Fallback if migration 005 hasn't been executed yet
    const basicQuery = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('id', userId)
      .maybeSingle()

    if (basicQuery.error || !basicQuery.data) {
      if (import.meta.env.DEV) console.error('Profile fetch error:', basicQuery.error || fullQuery.error)
      setProfile(null)
      setProfileLoadFailed(true)
    } else {
      const basicData = basicQuery.data as unknown as Profile
      setProfile({
        ...basicData,
        approval_status: 'approved',
      })
      setProfileLoadFailed(false)
    }
  }, [])

  const retryProfile = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) return
    setLoading(true)
    await fetchProfile(userId)
    setLoading(false)
  }, [session?.user?.id, fetchProfile])

  const refetchProfile = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) return
    await fetchProfile(userId)
  }, [session?.user?.id, fetchProfile])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setProfileLoadFailed(false)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, profileLoadFailed, retryProfile, refetchProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
