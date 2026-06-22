'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import {
  LayoutDashboard,
  Target,
  ClipboardList,
  Users,
  Bell,
  LogOut,
  ChevronRight,
  UserCircle,
} from 'lucide-react'

export function PortalSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { employee } = useAuth()

  const isManager = employee?.role === 'manager' || employee?.role === 'hr'

  const navItems = [
    { href: '/portal', label: 'My Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/portal/goals', label: 'My Goals', icon: Target },
    { href: '/portal/tasks', label: 'My Tasks', icon: ClipboardList },
    ...(isManager
      ? [{ href: '/portal/team', label: 'My Team', icon: Users }]
      : []),
    { href: '/portal/notifications', label: 'Notifications', icon: Bell },
  ]

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
            <p className="text-xs text-gray-400 leading-tight">My PMS Portal</p>
          </div>
        </div>
      </div>

      {/* Employee info */}
      {employee && (
        <div className="px-4 py-4 border-b border-gray-700 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{employee.name}</p>
            <p className="text-xs text-gray-400 truncate">{employee.designation ?? employee.employee_id}</p>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
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

      <div className="p-4 border-t border-gray-700 space-y-1">
        <Link
          href="/portal/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <UserCircle size={18} />
          <span>My Profile</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
