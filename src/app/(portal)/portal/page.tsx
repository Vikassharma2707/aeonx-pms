'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatDate, formatScore } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'
import type { Goal, MidYearReview } from '@/lib/supabase'

const FISCAL_YEAR = '2026-27'

type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

type StatCardProps = {
  label: string
  value: string | number
  sub?: string
  accent?: 'green' | 'amber' | 'blue' | 'purple'
}

function StatCard({ label, value, sub, accent = 'blue' }: StatCardProps) {
  const accentMap = {
    blue: 'border-t-blue-500',
    green: 'border-t-green-500',
    amber: 'border-t-amber-500',
    purple: 'border-t-purple-500',
  }
  return (
    <Card className={cn('border-t-4', accentMap[accent])}>
      <CardContent className="pt-5">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function PortalDashboard() {
  const { employee, loading: authLoading } = useAuth()

  const [goals, setGoals] = useState<Goal[]>([])
  const [midYear, setMidYear] = useState<MidYearReview | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pendingTeamCount, setPendingTeamCount] = useState<number>(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!employee) return

    async function fetchAll() {
      setDataLoading(true)
      setError(null)
      try {
        const eid = employee!.employee_id

        const [goalsRes, midYearRes, notifsRes, teamRes] = await Promise.all([
          supabase
            .from('goals')
            .select('*')
            .eq('employee_id', eid)
            .eq('fiscal_year', FISCAL_YEAR),

          supabase
            .from('mid_year_reviews')
            .select('*')
            .eq('employee_id', eid)
            .eq('fiscal_year', FISCAL_YEAR)
            .maybeSingle(),

          supabase
            .from('notifications')
            .select('*')
            .eq('user_id', eid)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(3),

          employee!.role === 'manager'
            ? supabase
                .from('quarterly_tasks')
                .select('employee_id')
                .eq('submitted_to', eid)
                .eq('submission_status', 'submitted')
            : Promise.resolve({ data: null, error: null }),
        ])

        if (goalsRes.error) throw goalsRes.error
        if (midYearRes.error) throw midYearRes.error
        if (notifsRes.error) throw notifsRes.error

        setGoals(goalsRes.data ?? [])
        setMidYear(midYearRes.data ?? null)
        setNotifications(notifsRes.data ?? [])

        if (employee!.role === 'manager' && teamRes.data) {
          const unique = new Set(teamRes.data.map((r: { employee_id: string }) => r.employee_id))
          setPendingTeamCount(unique.size)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
      } finally {
        setDataLoading(false)
      }
    }

    fetchAll()
  }, [employee])

  async function markAllRead() {
    if (!employee) return
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', employee.employee_id)
      .eq('is_read', false)
    if (!error) setNotifications([])
  }

  if (authLoading || dataLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header title="Dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading your dashboard…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!employee) return null

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header title="Dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6 text-center">
              <p className="text-red-600 font-medium">Something went wrong</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const totalWeight = goals.reduce((sum, g) => sum + (g.weightage_percent ?? 0), 0)
  const avgProgress =
    goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (g.self_progress_percent ?? 0), 0) / goals.length)
      : 0
  const weightAccent = totalWeight === 100 ? 'green' : totalWeight > 0 ? 'amber' : 'blue'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Dashboard" subtitle={`Fiscal Year ${FISCAL_YEAR}`} />

      <div className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
        {/* Greeting */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-md">
          <h1 className="text-2xl font-bold">
            {getGreeting()}, {employee.name} 👋
          </h1>
          <p className="text-blue-100 mt-1 text-sm">
            {employee.designation ?? 'Employee'}
            {employee.practice ? ` · ${employee.practice}` : ''}
          </p>
          <p className="text-blue-200 text-xs mt-2">Fiscal Year {FISCAL_YEAR}</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Goals Set"
            value={goals.length}
            sub={`For ${FISCAL_YEAR}`}
            accent="blue"
          />
          <StatCard
            label="Total Weight"
            value={`${totalWeight}%`}
            sub={totalWeight !== 100 ? '⚠ Should be 100%' : '✓ Balanced'}
            accent={weightAccent}
          />
          <StatCard
            label="Avg Self Progress"
            value={`${avgProgress}%`}
            sub="Across all goals"
            accent="purple"
          />
          <StatCard
            label="Mid-Year Score"
            value={
              midYear?.mid_year_overall_score != null
                ? formatScore(midYear.mid_year_overall_score)
                : '—'
            }
            sub={midYear ? `Status: ${midYear.review_status}` : 'Not yet reviewed'}
            accent="green"
          />
        </div>

        {/* Manager card */}
        {employee.role === 'manager' && (
          <Card className="border-l-4 border-l-orange-400">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span>Team Pending Reviews</span>
                {pendingTeamCount > 0 && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {pendingTeamCount}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingTeamCount > 0 ? (
                <p className="text-gray-600 text-sm">
                  <span className="font-semibold text-orange-600">{pendingTeamCount}</span>{' '}
                  team member{pendingTeamCount !== 1 ? 's have' : ' has'} submitted tasks awaiting
                  your review.
                </p>
              ) : (
                <p className="text-gray-500 text-sm">No pending team task reviews. All caught up!</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Goals Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Goals — {FISCAL_YEAR}</CardTitle>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No goals found for {FISCAL_YEAR}.</p>
                <p className="text-gray-400 text-xs mt-1">
                  Head to <span className="font-medium text-blue-500">My Goals</span> to set your goals.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-3 font-medium">Category</th>
                      <th className="pb-2 pr-3 font-medium">Description</th>
                      <th className="pb-2 pr-3 font-medium text-right">Weight</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 pr-3 font-medium text-right">Progress</th>
                      <th className="pb-2 pr-3 font-medium text-right">Self</th>
                      <th className="pb-2 font-medium text-right">LM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {goals.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 pr-3 text-gray-600 text-xs whitespace-nowrap">
                          {g.goal_category ?? '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-800 max-w-[240px]">
                          {(g.goal_description ?? '').length > 60
                            ? `${g.goal_description.slice(0, 60)}…`
                            : g.goal_description}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-medium">
                          {g.weightage_percent ?? '—'}%
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge
                            className={cn(
                              'text-xs',
                              STATUS_COLORS[g.goal_status] ?? 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {g.goal_status}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          {g.self_progress_percent ?? 0}%
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          {g.self_rating ?? '—'}
                        </td>
                        <td className="py-2.5 text-right text-gray-500">
                          {g.lm_rating ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Notifications
                {notifications.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {notifications.length}
                  </span>
                )}
              </CardTitle>
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">
                You're all caught up — no unread notifications.
              </p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id} className="flex gap-3 items-start">
                    <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                      {timeAgo(n.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
