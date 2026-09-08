import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@/services/api'
import { loginIdToEmail, setRememberMePreference, api } from '@/services/api'
import type { AuthUserContext, Profile, Student, Teacher } from '@/types'
import { getErrorMessage } from '@/lib/utils'

interface AuthContextValue {
  session: Session | null
  user: AuthUserContext | null
  loading: boolean
  signIn: (loginId: string, password: string, rememberMe?: boolean) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadUserContext(userId: string): Promise<AuthUserContext | null> {
  const { data: profile, error } = await api
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .is('deleted_at', null)
    .single()

  if (error || !profile) return null

  if (profile.status === 'disabled') {
    await api.auth.signOut()
    throw new Error('Your account has been disabled. Contact the School Manager.')
  }

  let student: Student | null = null
  let teacher: Teacher | null = null

  if (profile.role === 'student') {
    const { data } = await api
      .from('students')
      .select('*, class:classes(*)')
      .eq('profile_id', userId)
      .maybeSingle()
    student = data as Student | null
  }

  if (
    profile.role === 'teacher' ||
    profile.role === 'teacher_cabaas' ||
    profile.role === 'practice_teacher' ||
    profile.role === 'supervisor'
  ) {
    const { data } = await api
      .from('teachers')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle()
    teacher = data as Teacher | null
  }

  return { profile: profile as Profile, student, teacher }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUserContext | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const { data } = await api.auth.getSession()
    if (!data.session?.user) {
      setUser(null)
      return
    }
    const ctx = await loadUserContext(data.session.user.id)
    setUser(ctx)
  }, [])

  useEffect(() => {
    let mounted = true

    api.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        try {
          const ctx = await loadUserContext(data.session.user.id)
          if (mounted) setUser(ctx)
        } catch {
          if (mounted) setUser(null)
        }
      }
      if (mounted) setLoading(false)
    })

    const { data: sub } = api.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        try {
          const ctx = await loadUserContext(nextSession.user.id)
          setUser(ctx)
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (loginId: string, password: string, rememberMe = true) => {
    setRememberMePreference(rememberMe)
    const email = loginIdToEmail(loginId)
    const { data, error } = await api.auth.signInWithPassword({ email, password })
    if (error) throw new Error(getErrorMessage(error, 'Invalid User ID or password'))
    if (!data.session) throw new Error('Login failed')

    const ctx = await loadUserContext(data.session.user.id)
    if (!ctx) throw new Error('Profile not found. Contact the School Manager.')
    setSession(data.session)
    setUser(ctx)
  }, [])

  const signOut = useCallback(async () => {
    await api.auth.signOut()
    setSession(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ session, user, loading, signIn, signOut, refreshProfile }),
    [session, user, loading, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
