'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { PortalSidebar } from '@/components/portal/PortalSidebar'

function Guard({ children }: { children: React.ReactNode }) {
  const { employee, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !employee) router.replace('/login')
  }, [employee, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!employee) return null

  return (
    <div className="flex h-full">
      <PortalSidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">{children}</main>
    </div>
  )
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Guard>{children}</Guard>
    </AuthProvider>
  )
}
