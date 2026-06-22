'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { AuthProvider, useAuth } from '@/context/AuthContext'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { employee, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!employee) router.replace('/login')
      else if (employee.role === 'employee') router.replace('/portal')
    }
  }, [employee, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!employee || employee.role === 'employee') return null

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">{children}</main>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminGuard>{children}</AdminGuard>
    </AuthProvider>
  )
}
