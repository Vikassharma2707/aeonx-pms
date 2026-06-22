'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { FISCAL_YEARS, QUARTERS, STATUS_COLORS } from '@/lib/constants'
import type { Employee, Goal, QuarterlyTask } from '@/lib/supabase'

// ─── Extended Task with submission fields ─────────────────────────────────────
type Task = QuarterlyTask & {
  submission_status?: 'draft' | 'submitted' | 'reviewed'
  submitted_to?: string
  submitted_at?: string
  pm_comments?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Spinner() {
  return <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
}

// ─── Tab type ─────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'pending' | 'goals'

// ─── Team Member Card with expandable goals ───────────────────────────────────
type TeamMemberCardProps = {
  member: Employee
  managerEmployeeId: string
}

function TeamMemberCard({ member, managerEmployeeId }: TeamMemberCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [ratings, setRatings] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  async function loadGoals() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    setGoalsLoading(true)
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('employee_id', member.employee_id)
      .order('created_at', { ascending: true })
    setGoals((data ?? []) as Goal[])
    const initial: Record<string, string> = {}
    ;(data ?? []).forEach((g: Goal) => { initial[g.id] = String(g.lm_rating ?? '') })
    setRatings(initial)
    setGoalsLoading(false)
  }

  async function saveLmRating(goal: Goal) {
    const val = ratings[goal.id]
    setSavingId(goal.id)
    const { data } = await supabase
      .from('goals')
      .update({ lm_rating: val !== '' ? Number(val) : null, updated_at: new Date().toISOString() })
      .eq('id', goal.id)
      .select()
      .single()
    if (data) setGoals((prev) => prev.map((g) => (g.id === goal.id ? (data as Goal) : g)))
    setSavingId(null)
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm shrink-0">
              {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{member.name}</p>
              <p className="text-xs text-gray-500">{member.designation}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge className="text-xs bg-purple-100 text-purple-700">{member.practice ?? 'N/A'}</Badge>
            <Badge className={cn('text-xs', STATUS_COLORS[member.active_status])}>{member.active_status}</Badge>
            <Badge className="text-xs bg-gray-100 text-gray-600">{member.employment_type ?? 'Full Time'}</Badge>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={loadGoals} className="w-full">
          {expanded ? 'Hide Goals' : 'View Goals'}
        </Button>

        {expanded && (
          <div className="mt-2">
            {goalsLoading ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : goals.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No goals set for this employee.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Wt%</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Self%</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Self Rtg</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">LM Rtg</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {goals.map((goal) => (
                      <tr key={goal.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 max-w-32 truncate">{goal.goal_category ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-48">
                          <span className="line-clamp-2">{goal.goal_description}</span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{goal.weightage_percent ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge className={cn('text-xs', STATUS_COLORS[goal.goal_status] ?? 'bg-gray-100 text-gray-600')}>
                            {goal.goal_status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{goal.self_progress_percent ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{goal.self_rating ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            step={0.5}
                            className="w-16 text-xs p-1 text-center"
                            value={ratings[goal.id] ?? ''}
                            onChange={(e) => setRatings((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs py-0.5 px-2 h-7"
                            disabled={savingId === goal.id}
                            onClick={() => saveLmRating(goal)}
                          >
                            {savingId === goal.id ? '…' : 'Save'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Pending Reviews Tab ──────────────────────────────────────────────────────
type PendingReviewsProps = {
  managerEmployeeId: string
}

function PendingReviews({ managerEmployeeId }: PendingReviewsProps) {
  const [tasks, setTasks] = useState<(Task & { employee_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [quarter, setQuarter] = useState('Q1')
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [ratings, setRatings] = useState<Record<string, { rating: string; comments: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('quarterly_tasks')
      .select('*, employees!quarterly_tasks_employee_id_fkey(name)')
      .eq('submitted_to', managerEmployeeId)
      .eq('submission_status', 'submitted')
      .eq('fiscal_year', fiscalYear)
      .eq('quarter', quarter)
      .order('created_at', { ascending: true })

    const mapped = (data ?? []).map((t: Record<string, unknown>) => ({
      ...(t as unknown as Task),
      employee_name: (t.employees as { name?: string } | null)?.name,
    }))
    setTasks(mapped)
    const init: Record<string, { rating: string; comments: string }> = {}
    mapped.forEach((t) => { init[t.id] = { rating: String(t.pm_rating ?? ''), comments: t.pm_comments ?? '' } })
    setRatings(init)
    setLoading(false)
  }, [managerEmployeeId, fiscalYear, quarter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function saveTask(task: Task) {
    const vals = ratings[task.id]
    setSavingId(task.id)
    await supabase
      .from('quarterly_tasks')
      .update({
        pm_rating: vals.rating !== '' ? Number(vals.rating) : null,
        pm_comments: vals.comments || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)
    setSavingId(null)
  }

  async function markAllReviewed(employeeId: string) {
    setMarkingAll(employeeId)
    await supabase
      .from('quarterly_tasks')
      .update({ submission_status: 'reviewed', updated_at: new Date().toISOString() })
      .eq('employee_id', employeeId)
      .eq('submitted_to', managerEmployeeId)
      .eq('fiscal_year', fiscalYear)
      .eq('quarter', quarter)
    await fetchTasks()
    setMarkingAll(null)
  }

  // Group by employee
  const grouped: Record<string, { name: string; tasks: (Task & { employee_name?: string })[] }> = {}
  tasks.forEach((t) => {
    const eid = t.employee_id
    if (!grouped[eid]) grouped[eid] = { name: t.employee_name ?? eid, tasks: [] }
    grouped[eid].tasks.push(t)
  })

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Quarter</label>
          <Select className="w-24" value={quarter} onChange={(e) => setQuarter(e.target.value)} options={QUARTERS.map((q) => ({ label: q, value: q }))} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Fiscal Year</label>
          <Select className="w-32" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))} />
        </div>
      </div>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {!loading && Object.keys(grouped).length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No pending reviews</p>
          <p className="text-gray-400 text-sm mt-1">No tasks submitted to you for {quarter} · {fiscalYear}.</p>
        </div>
      )}

      {!loading && Object.entries(grouped).map(([empId, group]) => (
        <div key={empId} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{group.name}</h3>
            <Button
              size="sm"
              variant="outline"
              disabled={markingAll === empId}
              onClick={() => markAllReviewed(empId)}
            >
              {markingAll === empId ? 'Marking…' : 'Mark All Reviewed'}
            </Button>
          </div>

          {group.tasks.map((task) => (
            <Card key={task.id} className="overflow-hidden">
              <CardContent className="pt-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{task.project_name}</p>
                    {task.task_id && <p className="text-xs text-gray-500 font-mono">{task.task_id}</p>}
                  </div>
                  <Badge className={cn('text-xs', PRIORITY_COLORS[task.priority] ?? '')}>
                    {task.priority}
                  </Badge>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed">{task.task_description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Planned Outcome</p>
                    <p className="text-sm text-gray-700">{task.planned_outcome || <span className="italic text-gray-400">Not set</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Actual Outcome</p>
                    <p className="text-sm text-gray-700">{task.actual_outcome || <span className="italic text-gray-400">Not set</span>}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Self Rating:</span>
                  <Badge className="bg-blue-50 text-blue-700 text-xs">{task.self_rating ?? '—'}</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="PM Rating (1–5)">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={0.5}
                      placeholder="e.g. 4.0"
                      value={ratings[task.id]?.rating ?? ''}
                      onChange={(e) => setRatings((prev) => ({ ...prev, [task.id]: { ...prev[task.id], rating: e.target.value } }))}
                    />
                  </Field>
                  <Field label="PM Comments">
                    <Textarea
                      rows={2}
                      placeholder="Feedback for this task…"
                      value={ratings[task.id]?.comments ?? ''}
                      onChange={(e) => setRatings((prev) => ({ ...prev, [task.id]: { ...prev[task.id], comments: e.target.value } }))}
                    />
                  </Field>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" disabled={savingId === task.id} onClick={() => saveTask(task)}>
                    {savingId === task.id ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Goal Reviews Tab ─────────────────────────────────────────────────────────
type GoalReviewsProps = {
  teamEmployeeIds: string[]
}

type GoalWithEmployee = Goal & { employee_name?: string }

function GoalReviews({ teamEmployeeIds }: GoalReviewsProps) {
  const [goals, setGoals] = useState<GoalWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [ratings, setRatings] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (teamEmployeeIds.length === 0) { setLoading(false); return }
    async function fetch() {
      setLoading(true)
      const { data } = await supabase
        .from('goals')
        .select('*, employees!goals_employee_id_fkey(name)')
        .in('employee_id', teamEmployeeIds)
        .eq('fiscal_year', fiscalYear)
        .order('employee_id', { ascending: true })
      const mapped = (data ?? []).map((g: Record<string, unknown>) => ({
        ...(g as unknown as Goal),
        employee_name: (g.employees as { name?: string } | null)?.name,
      }))
      setGoals(mapped)
      const init: Record<string, string> = {}
      mapped.forEach((g) => { init[g.id] = String(g.lm_rating ?? '') })
      setRatings(init)
      setLoading(false)
    }
    fetch()
  }, [teamEmployeeIds, fiscalYear])

  async function saveRating(goal: GoalWithEmployee) {
    setSavingId(goal.id)
    const { data } = await supabase
      .from('goals')
      .update({ lm_rating: ratings[goal.id] !== '' ? Number(ratings[goal.id]) : null, updated_at: new Date().toISOString() })
      .eq('id', goal.id)
      .select()
      .single()
    if (data) setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, ...(data as Goal) } : g)))
    setSavingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">Fiscal Year</label>
        <Select className="w-32" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))} />
      </div>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {!loading && goals.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No goals found for your team in {fiscalYear}.</p>
        </div>
      )}

      {!loading && goals.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Wt%</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Self Rtg</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">LM Rating</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {goals.map((goal) => (
                <tr key={goal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{goal.employee_name ?? goal.employee_id}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-32">
                    <span className="line-clamp-2">{goal.goal_category ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-56">
                    <span className="line-clamp-2">{goal.goal_description}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{goal.weightage_percent ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{goal.self_rating ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={0.5}
                      className="w-20 text-sm p-1.5 text-center mx-auto"
                      value={ratings[goal.id] ?? ''}
                      onChange={(e) => setRatings((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      disabled={savingId === goal.id}
                      onClick={() => saveRating(goal)}
                    >
                      {savingId === goal.id ? '…' : 'Save'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const router = useRouter()
  const { employee, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [team, setTeam] = useState<Employee[]>([])
  const [teamLoading, setTeamLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (employee && employee.role === 'employee') {
      router.replace('/portal')
    }
  }, [authLoading, employee, router])

  useEffect(() => {
    if (!employee || employee.role === 'employee') return
    async function fetchTeam() {
      setTeamLoading(true)
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('line_manager', employee!.employee_id)
        .order('name', { ascending: true })
      setTeam((data ?? []) as Employee[])
      setTeamLoading(false)
    }
    fetchTeam()
  }, [employee])

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header title="My Team" />
        <div className="flex-1 flex items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  if (!employee || employee.role === 'employee') return null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Team Overview' },
    { id: 'pending', label: 'Pending Reviews' },
    { id: 'goals', label: 'Goal Reviews' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="My Team" subtitle={employee.name} />

      <div className="flex-1 p-6 space-y-5 max-w-5xl mx-auto w-full">

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Team Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {teamLoading && <div className="flex justify-center py-10"><Spinner /></div>}
            {!teamLoading && team.length === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">No team members yet</p>
                <p className="text-gray-400 text-sm mt-1">Employees with you as their line manager will appear here.</p>
              </div>
            )}
            {!teamLoading && team.map((member) => (
              <TeamMemberCard key={member.id} member={member} managerEmployeeId={employee.employee_id} />
            ))}
          </div>
        )}

        {/* Tab: Pending Reviews */}
        {activeTab === 'pending' && (
          <PendingReviews managerEmployeeId={employee.employee_id} />
        )}

        {/* Tab: Goal Reviews */}
        {activeTab === 'goals' && (
          <GoalReviews teamEmployeeIds={team.map((m) => m.employee_id)} />
        )}
      </div>
    </div>
  )
}
