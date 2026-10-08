import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from './types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoadFailed: boolean
  retryProfile: () => Promise<void>
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
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('id', userId)
      .single()

    if (error) {
      if (import.meta.env.DEV) console.error('Profile fetch error:', error)
      setProfile(null)
      setProfileLoadFailed(true)
    } else {
      setProfile(data as Profile)
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
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, profileLoadFailed, retryProfile, signOut }}
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
