'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { FISCAL_YEARS, QUARTERS, STATUS_COLORS } from '@/lib/constants'
import type { Employee, Goal, QuarterlyTask, QuarterlyFeedback, MidYearReview } from '@/lib/supabase'
import { CheckCircle, XCircle, MessageSquare, TrendingUp, Clock } from 'lucide-react'

type Task = QuarterlyTask & {
  submission_status?: 'draft' | 'submitted' | 'reviewed'
  submitted_to?: string
  pm_comments?: string
}

type Tab = 'overview' | 'approvals' | 'midyear' | 'goals' | 'pending' | 'pmfeedback'

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

const PM_RATING_FIELDS: { key: keyof QuarterlyFeedback; label: string }[] = [
  { key: 'delivery_rating',          label: 'Delivery' },
  { key: 'timeliness_rating',        label: 'Timeliness' },
  { key: 'technical_rating',         label: 'Technical' },
  { key: 'communication_rating',     label: 'Communication' },
  { key: 'ownership_rating',         label: 'Ownership' },
  { key: 'customer_focus_rating',    label: 'Customer Focus' },
  { key: 'process_compliance_rating',label: 'Process Compliance' },
]

// ─── Team Overview Card (LM: goals + lm_rating) ───────────────────────────────

function TeamMemberCard({ member, managerEmployeeId }: { member: Employee; managerEmployeeId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [ratings, setRatings] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  async function loadGoals() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true); setGoalsLoading(true)
    const { data } = await supabase.from('goals').select('*')
      .eq('employee_id', member.employee_id).order('created_at', { ascending: true })
    setGoals((data ?? []) as Goal[])
    const init: Record<string, string> = {}
    ;(data ?? []).forEach((g: Goal) => { init[g.id] = String(g.lm_rating ?? '') })
    setRatings(init)
    setGoalsLoading(false)
  }

  async function saveLmRating(goal: Goal) {
    setSavingId(goal.id)
    const { data } = await supabase.from('goals')
      .update({ lm_rating: ratings[goal.id] !== '' ? Number(ratings[goal.id]) : null, updated_at: new Date().toISOString() })
      .eq('id', goal.id).select().single()
    if (data) setGoals((prev) => prev.map((g) => (g.id === goal.id ? (data as Goal) : g)))
    setSavingId(null)
  }

  const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const pendingApprovals = goals.filter(g => g.approval_status === 'pending_approval').length

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{member.name}</p>
              <p className="text-xs text-gray-500">{member.designation}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge className="text-xs bg-purple-100 text-purple-700">{member.practice ?? 'N/A'}</Badge>
            <Badge className={cn('text-xs', STATUS_COLORS[member.active_status])}>{member.active_status}</Badge>
          </div>
        </div>

        {expanded && pendingApprovals > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <Clock size={12} /> {pendingApprovals} goal{pendingApprovals > 1 ? 's' : ''} pending your approval
          </div>
        )}

        <Button variant="outline" size="sm" onClick={loadGoals} className="w-full">
          {expanded ? 'Hide Goals' : 'View Goals & Rate'}
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
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Approval</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Self%</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Self Rtg</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">LM Rating</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {goals.map((goal) => (
                      <tr key={goal.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 max-w-28 truncate">{goal.goal_category ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-44"><span className="line-clamp-2">{goal.goal_description}</span></td>
                        <td className="px-3 py-2 text-center text-gray-600">{goal.weightage_percent ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', {
                            'bg-amber-100 text-amber-700': goal.approval_status === 'pending_approval',
                            'bg-green-100 text-green-700': goal.approval_status === 'approved',
                            'bg-red-100 text-red-700': goal.approval_status === 'changes_requested',
                            'bg-gray-100 text-gray-500': !goal.approval_status || goal.approval_status === 'draft',
                          })}>
                            {goal.approval_status === 'pending_approval' ? 'Pending' :
                             goal.approval_status === 'approved' ? 'Approved' :
                             goal.approval_status === 'changes_requested' ? 'Changes' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{goal.self_progress_percent ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{goal.self_rating ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <Input type="number" min={1} max={5} step={0.5} className="w-16 text-xs p-1 text-center"
                            value={ratings[goal.id] ?? ''} onChange={(e) => setRatings((prev) => ({ ...prev, [goal.id]: e.target.value }))} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button size="sm" variant="outline" className="text-xs py-0.5 px-2 h-7"
                            disabled={savingId === goal.id} onClick={() => saveLmRating(goal)}>
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

// ─── Goal Approvals Tab (LM: approve / request changes) ──────────────────────

function GoalApprovals({ lmReports }: { lmReports: Employee[] }) {
  const [goals, setGoals] = useState<(Goal & { employee_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [commentModal, setCommentModal] = useState<{ goalId: string; empName: string } | null>(null)
  const [changeComment, setChangeComment] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  const fetchPending = useCallback(async () => {
    if (lmReports.length === 0) { setLoading(false); return }
    setLoading(true)
    const ids = lmReports.map(e => e.employee_id)
    const { data } = await supabase
      .from('goals')
      .select('*, employees!goals_employee_id_fkey(name)')
      .in('employee_id', ids)
      .eq('approval_status', 'pending_approval')
      .order('updated_at', { ascending: false })
    const mapped = (data ?? []).map((g: Record<string, unknown>) => ({
      ...(g as unknown as Goal),
      employee_name: (g.employees as { name?: string } | null)?.name,
    }))
    setGoals(mapped)
    setLoading(false)
  }, [lmReports])

  useEffect(() => { fetchPending() }, [fetchPending])

  async function approve(goalId: string) {
    setActionId(goalId)
    await supabase.from('goals').update({
      approval_status: 'approved',
      approval_comment: null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', goalId)
    setGoals(prev => prev.filter(g => g.id !== goalId))
    setActionId(null)
  }

  async function requestChanges() {
    if (!commentModal) return
    setSavingComment(true)
    await supabase.from('goals').update({
      approval_status: 'changes_requested',
      approval_comment: changeComment.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', commentModal.goalId)
    setGoals(prev => prev.filter(g => g.id !== commentModal.goalId))
    setCommentModal(null)
    setChangeComment('')
    setSavingComment(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
        <span className="font-semibold">Line Manager view</span> — Review goals submitted by your direct reports and approve or request changes.
      </div>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {!loading && goals.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-green-400" />
          </div>
          <p className="text-gray-600 font-medium">No pending approvals</p>
          <p className="text-gray-400 text-sm mt-1">All goals have been reviewed.</p>
        </div>
      )}

      {!loading && goals.length > 0 && (
        <div className="space-y-3">
          {goals.map((goal) => (
            <Card key={goal.id} className="overflow-hidden">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-600 mb-1">{goal.employee_name ?? goal.employee_id}</p>
                    <p className="font-medium text-gray-800 text-sm">{goal.goal_description}</p>
                    {goal.goal_category && <p className="text-xs text-gray-500 mt-0.5">{goal.goal_category}</p>}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{goal.weightage_percent != null ? `${goal.weightage_percent}%` : ''}</span>
                </div>

                {goal.kpi_success_measure && (
                  <p className="text-xs text-gray-600"><span className="font-medium">KPI: </span>{goal.kpi_success_measure}</p>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {goal.self_progress_percent != null && <span>Progress: <strong>{goal.self_progress_percent}%</strong></span>}
                  {goal.self_rating != null && <span>Self Rating: <strong>{goal.self_rating}/5</strong></span>}
                </div>

                {goal.goal_comments && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{goal.goal_comments}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={actionId === goal.id} onClick={() => approve(goal.id)}>
                    <CheckCircle size={13} className="mr-1.5" />
                    {actionId === goal.id ? 'Approving…' : 'Approve'}
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setCommentModal({ goalId: goal.id, empName: goal.employee_name ?? goal.employee_id }); setChangeComment('') }}>
                    <XCircle size={13} className="mr-1.5" />
                    Request Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={!!commentModal} onClose={() => setCommentModal(null)} title="Request Changes" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Explain to <strong>{commentModal?.empName}</strong> what needs to be changed:
          </p>
          <Textarea rows={4} placeholder="Describe what changes are needed…" value={changeComment}
            onChange={(e) => setChangeComment(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCommentModal(null)} disabled={savingComment}>Cancel</Button>
            <Button onClick={requestChanges} disabled={savingComment || !changeComment.trim()}>
              {savingComment ? 'Sending…' : 'Send Feedback'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Mid-Year Reviews Tab (LM: progress tracking + discussion notes) ──────────

function MidYearReviews({ lmReports }: { lmReports: Employee[] }) {
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [reviews, setReviews] = useState<Record<string, MidYearReview | null>>({})
  const [progress, setProgress] = useState<Record<string, { avg: number; goals: number }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [localData, setLocalData] = useState<Record<string, Partial<MidYearReview>>>({})

  useEffect(() => {
    if (lmReports.length === 0) { setLoading(false); return }
    async function fetch() {
      setLoading(true)
      const ids = lmReports.map(e => e.employee_id)

      const [{ data: revData }, { data: goalData }] = await Promise.all([
        supabase.from('mid_year_reviews').select('*').in('employee_id', ids).eq('fiscal_year', fiscalYear),
        supabase.from('goals').select('employee_id, self_progress_percent').in('employee_id', ids).eq('fiscal_year', fiscalYear),
      ])

      const revMap: Record<string, MidYearReview | null> = {}
      ids.forEach(id => { revMap[id] = null })
      ;(revData ?? []).forEach((r: MidYearReview) => { revMap[r.employee_id] = r })
      setReviews(revMap)

      const local: Record<string, Partial<MidYearReview>> = {}
      ids.forEach(id => {
        const r = revMap[id]
        local[id] = { lm_mid_year_rating: r?.lm_mid_year_rating ?? undefined, key_strengths: r?.key_strengths ?? '', development_actions: r?.development_actions ?? '' }
      })
      setLocalData(local)

      const prog: Record<string, { avg: number; goals: number }> = {}
      ids.forEach(id => {
        const gs = (goalData ?? []).filter((g: { employee_id: string }) => g.employee_id === id)
        const vals = gs.map((g: { self_progress_percent?: number | null }) => g.self_progress_percent ?? 0)
        prog[id] = { goals: gs.length, avg: vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0 }
      })
      setProgress(prog)
      setLoading(false)
    }
    fetch()
  }, [lmReports, fiscalYear])

  function update(empId: string, field: keyof MidYearReview, value: string | number) {
    setLocalData(prev => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }))
  }

  async function save(emp: Employee) {
    setSaving(emp.employee_id)
    const d = localData[emp.employee_id] ?? {}
    const existing = reviews[emp.employee_id]
    if (existing) {
      await supabase.from('mid_year_reviews').update({
        lm_mid_year_rating: d.lm_mid_year_rating ?? null,
        key_strengths: d.key_strengths ?? null,
        development_actions: d.development_actions ?? null,
        review_status: 'Reviewed',
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('mid_year_reviews').insert({
        employee_id: emp.employee_id,
        fiscal_year: fiscalYear,
        lm_mid_year_rating: d.lm_mid_year_rating ?? null,
        key_strengths: d.key_strengths ?? null,
        development_actions: d.development_actions ?? null,
        review_status: 'Reviewed',
      }).select().single()
      if (data) setReviews(prev => ({ ...prev, [emp.employee_id]: data as MidYearReview }))
    }
    setSaving(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
        <TrendingUp size={13} />
        <span><span className="font-semibold">Line Manager view</span> — Track mid-year progress and record discussion notes for each direct report.</span>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">Fiscal Year</label>
        <Select className="w-32" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)}
          options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))} />
      </div>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {!loading && lmReports.map((emp) => {
        const d = localData[emp.employee_id] ?? {}
        const prog = progress[emp.employee_id] ?? { avg: 0, goals: 0 }
        const rev = reviews[emp.employee_id]

        return (
          <Card key={emp.employee_id} className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm shrink-0">
                  {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                  <p className="text-xs text-gray-500">{emp.designation}</p>
                </div>
              </div>
              {rev && (
                <Badge className="bg-green-100 text-green-700 text-xs">Reviewed</Badge>
              )}
            </div>

            <CardContent className="pt-4 space-y-4">
              {/* Progress summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{prog.goals}</p>
                  <p className="text-xs text-blue-600">Goals Set</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-700">{prog.avg}%</p>
                  <p className="text-xs text-green-600">Avg Progress</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-purple-700">{d.lm_mid_year_rating ?? '—'}</p>
                  <p className="text-xs text-purple-600">LM Rating</p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Overall Progress</span><span>{prog.avg}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${prog.avg}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="LM Mid-Year Rating (1–5)">
                  <Input type="number" min={1} max={5} step={0.5} placeholder="e.g. 3.5"
                    value={d.lm_mid_year_rating ?? ''}
                    onChange={(e) => update(emp.employee_id, 'lm_mid_year_rating', e.target.value !== '' ? Number(e.target.value) : '')} />
                </Field>
                <Field label="Key Strengths">
                  <Textarea rows={2} placeholder="What is this person doing well?"
                    value={d.key_strengths ?? ''}
                    onChange={(e) => update(emp.employee_id, 'key_strengths', e.target.value)} />
                </Field>
                <Field label="Development Actions">
                  <Textarea rows={2} placeholder="Areas to improve / action items…"
                    value={d.development_actions ?? ''}
                    onChange={(e) => update(emp.employee_id, 'development_actions', e.target.value)} />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button size="sm" disabled={saving === emp.employee_id} onClick={() => save(emp)}>
                  <MessageSquare size={13} className="mr-1.5" />
                  {saving === emp.employee_id ? 'Saving…' : rev ? 'Update Review' : 'Save Review'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Goal Reviews Tab (LM: lm_rating table view) ─────────────────────────────

type GoalWithEmployee = Goal & { employee_name?: string }

function GoalReviews({ lmReportIds }: { lmReportIds: string[] }) {
  const [goals, setGoals] = useState<GoalWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [ratings, setRatings] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (lmReportIds.length === 0) { setLoading(false); return }
    async function fetch() {
      setLoading(true)
      const { data } = await supabase.from('goals')
        .select('*, employees!goals_employee_id_fkey(name)')
        .in('employee_id', lmReportIds).eq('fiscal_year', fiscalYear)
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
  }, [lmReportIds, fiscalYear])

  async function saveRating(goal: GoalWithEmployee) {
    setSavingId(goal.id)
    const { data } = await supabase.from('goals')
      .update({ lm_rating: ratings[goal.id] !== '' ? Number(ratings[goal.id]) : null, updated_at: new Date().toISOString() })
      .eq('id', goal.id).select().single()
    if (data) setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, ...(data as Goal) } : g)))
    setSavingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
        <span className="font-semibold">Line Manager view</span> — Set LM ratings for your direct reports&apos; goals. Task ratings are managed by the Project Manager.
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">Fiscal Year</label>
        <Select className="w-32" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)}
          options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))} />
      </div>
      {loading && <div className="flex justify-center py-10"><Spinner /></div>}
      {!loading && goals.length === 0 && <p className="text-center text-gray-500 py-12">No goals found for your direct reports in {fiscalYear}.</p>}
      {!loading && goals.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee','Category','Description','Wt%','Approval','Self Rtg','LM Rating',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {goals.map((goal) => (
                <tr key={goal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap text-xs">{goal.employee_name ?? goal.employee_id}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-28"><span className="line-clamp-2">{goal.goal_category ?? '—'}</span></td>
                  <td className="px-4 py-3 text-gray-700 text-xs max-w-48"><span className="line-clamp-2">{goal.goal_description}</span></td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">{goal.weightage_percent ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', {
                      'bg-amber-100 text-amber-700': goal.approval_status === 'pending_approval',
                      'bg-green-100 text-green-700': goal.approval_status === 'approved',
                      'bg-red-100 text-red-700': goal.approval_status === 'changes_requested',
                      'bg-gray-100 text-gray-500': !goal.approval_status || goal.approval_status === 'draft',
                    })}>
                      {goal.approval_status === 'pending_approval' ? 'Pending' :
                       goal.approval_status === 'approved' ? 'Approved' :
                       goal.approval_status === 'changes_requested' ? 'Changes' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">{goal.self_rating ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Input type="number" min={1} max={5} step={0.5} className="w-20 text-sm p-1.5 text-center mx-auto"
                      value={ratings[goal.id] ?? ''} onChange={(e) => setRatings((prev) => ({ ...prev, [goal.id]: e.target.value }))} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" className="text-xs" disabled={savingId === goal.id} onClick={() => saveRating(goal)}>
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

// ─── Task Reviews Tab (PM: pm_rating + pm_comments) ──────────────────────────

function PendingReviews({ managerEmployeeId }: { managerEmployeeId: string }) {
  const [tasks, setTasks] = useState<(Task & { employee_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [quarter, setQuarter] = useState('Q1')
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [ratings, setRatings] = useState<Record<string, { rating: string; comments: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('quarterly_tasks')
      .select('*, employees!quarterly_tasks_employee_id_fkey(name)')
      .eq('submitted_to', managerEmployeeId).eq('submission_status', 'submitted')
      .eq('fiscal_year', fiscalYear).eq('quarter', quarter).order('created_at', { ascending: true })
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
    await supabase.from('quarterly_tasks').update({
      pm_rating: vals.rating !== '' ? Number(vals.rating) : null,
      pm_comments: vals.comments || null,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id)
    setSavingId(null)
  }

  async function markAllReviewed(employeeId: string) {
    setMarkingAll(employeeId)
    await supabase.from('quarterly_tasks').update({ submission_status: 'reviewed', updated_at: new Date().toISOString() })
      .eq('employee_id', employeeId).eq('submitted_to', managerEmployeeId).eq('fiscal_year', fiscalYear).eq('quarter', quarter)
    await fetchTasks()
    setMarkingAll(null)
  }

  const grouped: Record<string, { name: string; tasks: (Task & { employee_name?: string })[] }> = {}
  tasks.forEach((t) => {
    if (!grouped[t.employee_id]) grouped[t.employee_id] = { name: t.employee_name ?? t.employee_id, tasks: [] }
    grouped[t.employee_id].tasks.push(t)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <span className="font-semibold">Project Manager view</span> — Rate tasks submitted by your project reports. Goal ratings are managed by the Line Manager.
      </div>
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
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No pending task reviews</p>
          <p className="text-gray-400 text-sm mt-1">No tasks submitted to you for {quarter} · {fiscalYear}.</p>
        </div>
      )}
      {!loading && Object.entries(grouped).map(([empId, group]) => (
        <div key={empId} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{group.name}</h3>
            <Button size="sm" variant="outline" disabled={markingAll === empId} onClick={() => markAllReviewed(empId)}>
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
                  <Badge className={cn('text-xs', PRIORITY_COLORS[task.priority] ?? '')}>{task.priority}</Badge>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{task.task_description}</p>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div><p className="font-medium text-gray-500 mb-1">Planned Outcome</p><p>{task.planned_outcome || '—'}</p></div>
                  <div><p className="font-medium text-gray-500 mb-1">Actual Outcome</p><p>{task.actual_outcome || '—'}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Self Rating:</span>
                  <Badge className="bg-blue-50 text-blue-700 text-xs">{task.self_rating ?? '—'}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="PM Rating (1–5)">
                    <Input type="number" min={1} max={5} step={0.5} placeholder="e.g. 4.0"
                      value={ratings[task.id]?.rating ?? ''}
                      onChange={(e) => setRatings((prev) => ({ ...prev, [task.id]: { ...prev[task.id], rating: e.target.value } }))} />
                  </Field>
                  <Field label="PM Comments">
                    <Textarea rows={2} placeholder="Feedback for this task…"
                      value={ratings[task.id]?.comments ?? ''}
                      onChange={(e) => setRatings((prev) => ({ ...prev, [task.id]: { ...prev[task.id], comments: e.target.value } }))} />
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

// ─── PM Quarterly Feedback Tab ────────────────────────────────────────────────
// Derives the employee list dynamically from tasks submitted to this PM

function PMQuarterlyFeedback({ managerEmployeeId }: { managerEmployeeId: string }) {
  const [quarter, setQuarter] = useState('Q1')
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [pmReports, setPmReports] = useState<Employee[]>([])
  const [feedbackMap, setFeedbackMap] = useState<Record<string, Partial<QuarterlyFeedback>>>({})
  const [existingIds, setExistingIds] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)

      // Derive unique employees who submitted tasks to this PM this quarter
      const { data: taskData } = await supabase
        .from('quarterly_tasks')
        .select('employee_id, employees!quarterly_tasks_employee_id_fkey(employee_id, name, designation)')
        .eq('submitted_to', managerEmployeeId)
        .eq('fiscal_year', fiscalYear)
        .eq('quarter', quarter)

      const uniqueMap: Record<string, Employee> = {}
      ;(taskData ?? []).forEach((t: Record<string, unknown>) => {
        const emp = t.employees as Employee | null
        if (emp) uniqueMap[emp.employee_id] = emp
      })
      const reports = Object.values(uniqueMap)
      setPmReports(reports)

      if (reports.length === 0) { setLoading(false); return }

      const ids = reports.map(e => e.employee_id)
      const { data } = await supabase.from('quarterly_feedback').select('*')
        .in('employee_id', ids).eq('fiscal_year', fiscalYear).eq('quarter', quarter)
      const map: Record<string, Partial<QuarterlyFeedback>> = {}
      const eidMap: Record<string, string> = {}
      ids.forEach(id => { map[id] = {} })
      ;(data ?? []).forEach((f: QuarterlyFeedback) => {
        map[f.employee_id] = { ...f }
        eidMap[f.employee_id] = f.id
      })
      setFeedbackMap(map)
      setExistingIds(eidMap)
      setLoading(false)
    }
    fetch()
  }, [managerEmployeeId, quarter, fiscalYear])

  function update(empId: string, field: keyof QuarterlyFeedback, value: string | number) {
    setFeedbackMap(prev => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }))
  }

  async function saveFeedback(emp: Employee) {
    setSaving(emp.employee_id)
    const d = feedbackMap[emp.employee_id] ?? {}
    const ratingFields = PM_RATING_FIELDS.map(f => d[f.key] as number | undefined).filter(Boolean)
    const overall = ratingFields.length > 0
      ? Math.round((ratingFields.reduce((a, b) => a! + b!, 0)! / ratingFields.length) * 10) / 10
      : null

    const payload = {
      employee_id: emp.employee_id,
      fiscal_year: fiscalYear,
      quarter: quarter as QuarterlyFeedback['quarter'],
      project_name: (d.project_name as string) || 'General',
      delivery_rating: (d.delivery_rating as number) || null,
      timeliness_rating: (d.timeliness_rating as number) || null,
      technical_rating: (d.technical_rating as number) || null,
      communication_rating: (d.communication_rating as number) || null,
      ownership_rating: (d.ownership_rating as number) || null,
      customer_focus_rating: (d.customer_focus_rating as number) || null,
      process_compliance_rating: (d.process_compliance_rating as number) || null,
      overall_pm_score: overall,
      key_strengths: (d.key_strengths as string) || null,
      improvement_areas: (d.improvement_areas as string) || null,
      review_status: 'Reviewed' as QuarterlyFeedback['review_status'],
      updated_at: new Date().toISOString(),
    }

    const existingId = existingIds[emp.employee_id]
    if (existingId) {
      await supabase.from('quarterly_feedback').update(payload).eq('id', existingId)
    } else {
      const { data } = await supabase.from('quarterly_feedback').insert(payload).select().single()
      if (data) setExistingIds(prev => ({ ...prev, [emp.employee_id]: (data as QuarterlyFeedback).id }))
    }
    setSaving(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <span className="font-semibold">Project Manager view</span> — Provide structured quarterly feedback for each of your project reports.
      </div>
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

      {!loading && pmReports.map((emp) => {
        const d = feedbackMap[emp.employee_id] ?? {}
        const ratingVals = PM_RATING_FIELDS.map(f => Number(d[f.key]) || 0).filter(v => v > 0)
        const overallScore = ratingVals.length > 0 ? (ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length).toFixed(1) : '—'
        const isExisting = !!existingIds[emp.employee_id]

        return (
          <Card key={emp.employee_id} className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold text-sm shrink-0">
                  {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                  <p className="text-xs text-gray-500">{emp.designation} · {quarter} {fiscalYear}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isExisting && <Badge className="bg-blue-100 text-blue-700 text-xs">Submitted</Badge>}
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{overallScore}</p>
                  <p className="text-xs text-gray-400">Avg Score</p>
                </div>
              </div>
            </div>

            <CardContent className="pt-4 space-y-4">
              <Field label="Project / Assignment Name">
                <Input placeholder="e.g. SAP S/4HANA Migration" value={(d.project_name as string) ?? ''}
                  onChange={(e) => update(emp.employee_id, 'project_name', e.target.value)} />
              </Field>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PM_RATING_FIELDS.map(({ key, label }) => (
                  <Field key={key} label={`${label} (1–5)`}>
                    <Input type="number" min={1} max={5} step={0.5} placeholder="—"
                      value={d[key] != null ? String(d[key]) : ''}
                      onChange={(e) => update(emp.employee_id, key, e.target.value !== '' ? Number(e.target.value) : '')} />
                  </Field>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Key Strengths">
                  <Textarea rows={3} placeholder="What did this person do well this quarter?"
                    value={(d.key_strengths as string) ?? ''}
                    onChange={(e) => update(emp.employee_id, 'key_strengths', e.target.value)} />
                </Field>
                <Field label="Areas for Improvement">
                  <Textarea rows={3} placeholder="What should this person focus on improving?"
                    value={(d.improvement_areas as string) ?? ''}
                    onChange={(e) => update(emp.employee_id, 'improvement_areas', e.target.value)} />
                </Field>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">Overall score is auto-calculated from the ratings above.</p>
                <Button size="sm" disabled={saving === emp.employee_id} onClick={() => saveFeedback(emp)}>
                  {saving === emp.employee_id ? 'Saving…' : isExisting ? 'Update Feedback' : 'Submit Feedback'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { employee, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab | null>(null)
  const [lmReports, setLmReports] = useState<Employee[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)

  const isHR = employee?.role === 'hr'
  const hasLMAccess = isHR || (employee?.isLineManager ?? false)
  const hasPMAccess = isHR || (employee?.isProjectManager ?? false)
  const canAccessPage = hasLMAccess || hasPMAccess

  useEffect(() => {
    if (!employee || authLoading) return
    if (!hasLMAccess && !hasPMAccess) return

    async function fetchTeam() {
      setTeamLoading(true)
      const eid = employee!.employee_id

      if (isHR) {
        const { data } = await supabase.from('employees').select('*').eq('active_status', 'Active').order('name')
        setLmReports((data ?? []) as Employee[])
      } else if (hasLMAccess) {
        const { data } = await supabase.from('employees').select('*').eq('line_manager', eid).order('name')
        setLmReports((data ?? []) as Employee[])
      }
      setTeamLoading(false)
    }
    fetchTeam()
  }, [employee, authLoading, isHR, hasLMAccess, hasPMAccess])

  // Fetch pending approvals count for LM badge
  useEffect(() => {
    if (!hasLMAccess || lmReports.length === 0) return
    const ids = lmReports.map(e => e.employee_id)
    supabase.from('goals').select('id', { count: 'exact', head: true })
      .in('employee_id', ids).eq('approval_status', 'pending_approval')
      .then(({ count }) => setPendingApprovalsCount(count ?? 0))
  }, [hasLMAccess, lmReports])

  useEffect(() => {
    if (!authLoading && employee && !canAccessPage) window.location.href = '/portal'
  }, [authLoading, employee, canAccessPage])

  useEffect(() => {
    if (!teamLoading && activeTab === null) {
      if (hasLMAccess && lmReports.length > 0) setActiveTab('overview')
      else if (hasPMAccess) setActiveTab('pending')
      else if (hasLMAccess) setActiveTab('overview')
    }
  }, [teamLoading, activeTab, hasLMAccess, hasPMAccess, lmReports.length])

  if (authLoading) return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="My Team" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )

  if (!employee || !canAccessPage) return null

  const tabs: { id: Tab; label: string; badge?: string; count?: number }[] = [
    ...(hasLMAccess ? [
      { id: 'overview'  as Tab, label: 'Team Overview',    badge: 'LM' },
      { id: 'approvals' as Tab, label: 'Goal Approvals',   badge: 'LM', count: pendingApprovalsCount },
      { id: 'midyear'   as Tab, label: 'Mid-Year Reviews', badge: 'LM' },
      { id: 'goals'     as Tab, label: 'Goal Reviews',     badge: 'LM' },
    ] : []),
    ...(hasPMAccess ? [
      { id: 'pending'    as Tab, label: 'Task Reviews',      badge: 'PM' },
      { id: 'pmfeedback' as Tab, label: 'Quarterly Feedback', badge: 'PM' },
    ] : []),
  ]

  const currentTab = activeTab ?? tabs[0]?.id
  const roleLabel = hasLMAccess && hasPMAccess ? 'Line Manager & Project Manager' : hasLMAccess ? 'Line Manager' : 'Project Manager'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="My Team" subtitle={roleLabel} />

      <div className="flex-1 p-6 space-y-5 max-w-5xl mx-auto w-full">

        <div className="flex items-center gap-2 flex-wrap">
          {hasLMAccess && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-xs text-green-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Line Manager — {isHR ? 'all' : lmReports.length} direct report{lmReports.length !== 1 ? 's' : ''}
              <span className="text-green-500 text-[10px]">(Goals &amp; Reviews)</span>
            </div>
          )}
          {hasPMAccess && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              Project Manager — task-based reports
              <span className="text-blue-500 text-[10px]">(Tasks &amp; Feedback)</span>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit flex-wrap">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5',
                currentTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50')}>
              {tab.label}
              {tab.badge && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  currentTab === tab.id ? 'bg-white/20 text-white' : tab.badge === 'LM' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600')}>
                  {tab.badge}
                </span>
              )}
              {tab.count != null && tab.count > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  currentTab === tab.id ? 'bg-white text-blue-600' : 'bg-red-100 text-red-600')}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {teamLoading && <div className="flex justify-center py-10"><Spinner /></div>}

        {!teamLoading && (
          <>
            {currentTab === 'overview'   && hasLMAccess && (
              <div className="space-y-4">
                {lmReports.length === 0
                  ? <p className="text-center text-gray-500 py-16">No direct reports yet.</p>
                  : lmReports.map((m) => <TeamMemberCard key={m.id} member={m} managerEmployeeId={employee.employee_id} />)}
              </div>
            )}
            {currentTab === 'approvals'  && hasLMAccess && <GoalApprovals lmReports={lmReports} />}
            {currentTab === 'midyear'    && hasLMAccess && <MidYearReviews lmReports={lmReports} />}
            {currentTab === 'goals'      && hasLMAccess && <GoalReviews lmReportIds={lmReports.map(m => m.employee_id)} />}
            {currentTab === 'pending'    && hasPMAccess && <PendingReviews managerEmployeeId={employee.employee_id} />}
            {currentTab === 'pmfeedback' && hasPMAccess && <PMQuarterlyFeedback managerEmployeeId={employee.employee_id} />}
          </>
        )}
      </div>
    </div>
  )
}
