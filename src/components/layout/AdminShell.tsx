'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { isAdminSession } from '@/lib/adminSession'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAdminSession()) {
      router.replace('/login')
    } else {
      setReady(true)
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">{children}</main>
    </div>
  )
}
