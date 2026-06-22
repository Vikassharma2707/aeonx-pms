'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth'
import {
  LayoutDashboard,
  Users,
  Target,
  ClipboardList,
  MessageSquare,
  LogOut,
  FileCheck,
  Award,
  ChevronRight,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/goals', label: 'Goal Setting', icon: Target },
  { href: '/tasks', label: 'Task Log', icon: ClipboardList },
  { href: '/feedback', label: 'PM Feedback', icon: MessageSquare },
  { href: '/midyear', label: 'Mid-Year Review', icon: FileCheck },
  { href: '/appraisal', label: 'Final Appraisal', icon: Award },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col fixed left-0 top-0 bottom-0 z-40">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">
            AX
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">AeonX Digital</p>
            <p className="text-xs text-gray-400 leading-tight">Performance Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} />}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-700 space-y-2">
        <p className="text-xs text-gray-500 text-center">FY 2026-27</p>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
