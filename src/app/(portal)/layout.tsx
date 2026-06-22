'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { PortalSidebar } from '@/components/portal/PortalSidebar'

function PortalGuard({ children }: { children: React.ReactNode }) {
  const { employee, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !employee) router.replace('/login')
  }, [employee, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your portal…</p>
        </div>
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

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PortalGuard>{children}</PortalGuard>
    </AuthProvider>
  )
}
