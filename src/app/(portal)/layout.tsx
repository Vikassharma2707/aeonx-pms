'use client'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { PortalSidebar } from '@/components/portal/PortalSidebar'

function Guard({ children }: { children: React.ReactNode }) {
  const { employee, loading } = useAuth()

  useEffect(() => {
    if (!loading && !employee) {
      window.location.href = '/login'
    }
  }, [employee, loading])

  if (loading || !employee) return <div className="min-h-screen bg-gray-50" />

  return (
    <div className="flex h-full">
      <PortalSidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">{children}</main>
    </div>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="min-h-screen bg-gray-50" />
  return (
    <AuthProvider>
      <Guard>{children}</Guard>
    </AuthProvider>
  )
}
