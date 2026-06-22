'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import type { AuthEmployee } from '@/lib/auth'
import { getCurrentEmployee } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

interface AuthContextValue {
  employee: AuthEmployee | null
  loading: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  employee: null,
  loading: true,
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<AuthEmployee | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const emp = await getCurrentEmployee()
    setEmployee(emp)
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))

    const supabase = getSupabase()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh()
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ employee, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
