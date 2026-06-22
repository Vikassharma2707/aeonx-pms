'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Notification type ────────────────────────────────────────────────────────
type Notification = {
  id: string
  user_id: string
  type: 'reminder' | 'goal_review' | 'task' | 'reviewed' | string
  title: string
  message: string
  action_url?: string
  is_read: boolean
  created_at: string
}

// ─── Filter type ──────────────────────────────────────────────────────────────
type FilterTab = 'all' | 'unread' | 'reminder' | 'goal_review'

// ─── Time ago helper ──────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Notification icon ────────────────────────────────────────────────────────
function NotifIcon({ type }: { type: string }) {
  const base = 'w-10 h-10 rounded-full flex items-center justify-center shrink-0'

  if (type === 'reminder') {
    return (
      <div className={cn(base, 'bg-amber-100')}>
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
    )
  }
  if (type === 'goal_review') {
    return (
      <div className={cn(base, 'bg-purple-100')}>
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
    )
  }
  if (type === 'reviewed') {
    return (
      <div className={cn(base, 'bg-green-100')}>
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    )
  }
  // default: task
  return (
    <div className={cn(base, 'bg-blue-100')}>
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    </div>
  )
}

// ─── Notification item ────────────────────────────────────────────────────────
type NotifItemProps = {
  notif: Notification
  onRead: (id: string) => void
}

function NotifItem({ notif, onRead }: NotifItemProps) {
  const router = useRouter()

  function handleClick() {
    if (!notif.is_read) onRead(notif.id)
    if (notif.action_url) router.push(notif.action_url)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left flex items-start gap-4 px-5 py-4 rounded-xl border transition-all',
        notif.is_read
          ? 'bg-white border-gray-100 hover:bg-gray-50'
          : 'bg-blue-50 border-blue-100 hover:bg-blue-100/60'
      )}
    >
      <NotifIcon type={notif.type} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm leading-snug', notif.is_read ? 'text-gray-700' : 'text-gray-900 font-semibold')}>
            {notif.title}
          </p>
          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{timeAgo(notif.created_at)}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
      </div>

      {!notif.is_read && (
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
      )}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { employee, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setNotifications((data ?? []) as Notification[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading) fetchNotifications()
  }, [authLoading, fetchNotifications])

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.is_read)
    if (unread.length === 0) return
    setMarkingAll(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
    setMarkingAll(false)
  }

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'unread') return !n.is_read
    if (activeFilter === 'reminder') return n.type === 'reminder'
    if (activeFilter === 'goal_review') return n.type === 'goal_review'
    return true
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { id: 'reminder', label: 'Task Reminders' },
    { id: 'goal_review', label: 'Goal Reviews' },
  ]

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header title="Notifications" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!employee) return null

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Notifications" />

      <div className="flex-1 p-6 space-y-5 max-w-3xl mx-auto w-full">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Filter tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 flex-wrap">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  activeFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={markingAll}>
              {markingAll ? 'Marking…' : 'Mark all as read'}
            </Button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">
              {activeFilter === 'unread' ? 'All caught up!' : 'No notifications here'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {activeFilter === 'unread'
                ? "You've read all your notifications."
                : "Notifications will appear here when there's something for you."}
            </p>
          </div>
        )}

        {/* Notification list */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((notif) => (
              <NotifItem key={notif.id} notif={notif} onRead={markAsRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
