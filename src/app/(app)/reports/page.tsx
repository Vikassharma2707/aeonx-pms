'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { FISCAL_YEARS, QUARTERS } from '@/lib/constants'
import { createClient } from '@supabase/supabase-js'
import {
  AlertTriangle, CheckCircle, Clock, Users, Target, ClipboardList,
  RefreshCw, Bell, ChevronDown, ChevronUp, Download,
} from 'lucide-react'

// Admin uses service-role or anon key — same pattern as other admin pages
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}
const sb = getAdminSupabase()

type ReportRow = {
  employee_id: string
  name: string
  designation?: string
  practice?: string
  email?: string
  extra?: string   // secondary info (e.g. LM name, count)
}

type ReportStatus = 'idle' | 'loading' | 'done' | 'error'
type NotifyStatus = 'idle' | 'sending' | 'sent' | 'error'

type Report = {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  badgeColor: string
  rows: ReportRow[]
  status: ReportStatus
  notifyStatus: NotifyStatus
  expanded: boolean
  fetch: () => Promise<ReportRow[]>
}

function Spinner({ small }: { small?: boolean }) {
  return (
    <div className={cn('border-blue-500 border-t-transparent rounded-full animate-spin border-2',
      small ? 'w-4 h-4' : 'w-8 h-8')} />
  )
}

function exportCSV(title: string, rows: ReportRow[]) {
  const headers = ['Employee ID', 'Name', 'Designation', 'Practice', 'Email', 'Note']
  const lines = [
    headers.join(','),
    ...rows.map(r => [r.employee_id, r.name, r.designation ?? '', r.practice ?? '', r.email ?? '', r.extra ?? ''].map(v => `"${v}"`).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Report fetch functions ───────────────────────────────────────────────────

async function fetchNoGoals(fiscalYear: string): Promise<ReportRow[]> {
  const { data: all } = await sb.from('employees').select('employee_id, name, designation, practice, email').eq('active_status', 'Active').order('name')
  const { data: withGoals } = await sb.from('goals').select('employee_id').eq('fiscal_year', fiscalYear)
  const hasSets = new Set((withGoals ?? []).map((g: { employee_id: string }) => g.employee_id))
  return (all ?? []).filter((e: ReportRow) => !hasSets.has(e.employee_id))
}

async function fetchDraftGoals(fiscalYear: string): Promise<ReportRow[]> {
  // Employees who have goals but none are pending/approved (all still draft)
  const { data } = await sb.from('goals').select('employee_id, approval_status, employees!goals_employee_id_fkey(name, designation, practice, email)')
    .eq('fiscal_year', fiscalYear)
  const byEmp: Record<string, { row: ReportRow; statuses: string[] }> = {}
  ;(data ?? []).forEach((g: Record<string, unknown>) => {
    const emp = g.employees as ReportRow | null
    if (!emp) return
    const eid = g.employee_id as string
    if (!byEmp[eid]) byEmp[eid] = { row: { ...emp, employee_id: eid }, statuses: [] }
    byEmp[eid].statuses.push((g.approval_status as string) ?? 'draft')
  })
  return Object.values(byEmp)
    .filter(({ statuses }) => statuses.every(s => s === 'draft' || !s))
    .map(({ row }) => ({ ...row, extra: 'All goals in draft — not submitted for approval' }))
}

async function fetchPendingGoalApprovals(fiscalYear: string): Promise<ReportRow[]> {
  // LMs who have goals pending their approval
  const { data } = await sb.from('goals')
    .select('employee_id, employees!goals_employee_id_fkey(name, line_manager)')
    .eq('fiscal_year', fiscalYear).eq('approval_status', 'pending_approval')
  const lmIds: Record<string, number> = {}
  ;(data ?? []).forEach((g: Record<string, unknown>) => {
    const emp = g.employees as { line_manager?: string } | null
    if (emp?.line_manager) lmIds[emp.line_manager] = (lmIds[emp.line_manager] ?? 0) + 1
  })
  if (Object.keys(lmIds).length === 0) return []
  const { data: lms } = await sb.from('employees').select('employee_id, name, designation, practice, email').in('employee_id', Object.keys(lmIds))
  return (lms ?? []).map((e: ReportRow) => ({ ...e, extra: `${lmIds[e.employee_id]} goal${lmIds[e.employee_id] > 1 ? 's' : ''} awaiting approval` }))
}

async function fetchNoTasksSubmitted(fiscalYear: string, quarter: string): Promise<ReportRow[]> {
  const { data: all } = await sb.from('employees').select('employee_id, name, designation, practice, email').eq('active_status', 'Active').order('name')
  const { data: submitted } = await sb.from('quarterly_tasks').select('employee_id').eq('fiscal_year', fiscalYear).eq('quarter', quarter).neq('submission_status', 'draft')
  const hasSets = new Set((submitted ?? []).map((t: { employee_id: string }) => t.employee_id))
  return (all ?? []).filter((e: ReportRow) => !hasSets.has(e.employee_id))
}

async function fetchDraftTasks(fiscalYear: string, quarter: string): Promise<ReportRow[]> {
  // Employees who have tasks but all are still draft (not submitted)
  const { data } = await sb.from('quarterly_tasks')
    .select('employee_id, submission_status, employees!quarterly_tasks_employee_id_fkey(name, designation, practice, email)')
    .eq('fiscal_year', fiscalYear).eq('quarter', quarter)
  const byEmp: Record<string, { row: ReportRow; statuses: string[] }> = {}
  ;(data ?? []).forEach((t: Record<string, unknown>) => {
    const emp = t.employees as ReportRow | null
    if (!emp) return
    const eid = t.employee_id as string
    if (!byEmp[eid]) byEmp[eid] = { row: { ...emp, employee_id: eid }, statuses: [] }
    byEmp[eid].statuses.push((t.submission_status as string) ?? 'draft')
  })
  return Object.values(byEmp)
    .filter(({ statuses }) => statuses.every(s => s === 'draft' || !s))
    .map(({ row, statuses }) => ({ ...row, extra: `${statuses.length} task${statuses.length > 1 ? 's' : ''} in draft — not submitted to PM` }))
}

async function fetchPendingTaskReviews(fiscalYear: string, quarter: string): Promise<ReportRow[]> {
  // PMs who have tasks submitted to them but not reviewed
  const { data } = await sb.from('quarterly_tasks')
    .select('submitted_to').eq('fiscal_year', fiscalYear).eq('quarter', quarter).eq('submission_status', 'submitted')
  const pmCounts: Record<string, number> = {}
  ;(data ?? []).forEach((t: { submitted_to?: string }) => {
    if (t.submitted_to) pmCounts[t.submitted_to] = (pmCounts[t.submitted_to] ?? 0) + 1
  })
  if (Object.keys(pmCounts).length === 0) return []
  const { data: pms } = await sb.from('employees').select('employee_id, name, designation, practice, email').in('employee_id', Object.keys(pmCounts))
  return (pms ?? []).map((e: ReportRow) => ({ ...e, extra: `${pmCounts[e.employee_id]} task${pmCounts[e.employee_id] > 1 ? 's' : ''} pending review` }))
}

async function fetchNoMidYearReview(fiscalYear: string): Promise<ReportRow[]> {
  // LMs who have direct reports but haven't done mid-year reviews
  const { data: lmGroups } = await sb.from('employees').select('line_manager').eq('active_status', 'Active').not('line_manager', 'is', null)
  const lmIds = [...new Set((lmGroups ?? []).map((e: { line_manager: string }) => e.line_manager).filter(Boolean))]
  if (lmIds.length === 0) return []
  const { data: reviewed } = await sb.from('mid_year_reviews').select('employee_id').eq('fiscal_year', fiscalYear).eq('review_status', 'Reviewed')
  const reviewedSet = new Set((reviewed ?? []).map((r: { employee_id: string }) => r.employee_id))
  const pendingLmIds = lmIds.filter(id => !reviewedSet.has(id))
  if (pendingLmIds.length === 0) return []
  const { data: lms } = await sb.from('employees').select('employee_id, name, designation, practice, email').in('employee_id', pendingLmIds)
  return (lms ?? []).map((e: ReportRow) => ({ ...e, extra: 'Mid-year review not completed' }))
}

async function fetchNoQuarterlyFeedback(fiscalYear: string, quarter: string): Promise<ReportRow[]> {
  // PMs who received task submissions but haven't done quarterly_feedback
  const { data: submittedTasks } = await sb.from('quarterly_tasks').select('submitted_to')
    .eq('fiscal_year', fiscalYear).eq('quarter', quarter).not('submitted_to', 'is', null)
  const pmIds = [...new Set((submittedTasks ?? []).map((t: { submitted_to: string }) => t.submitted_to).filter(Boolean))]
  if (pmIds.length === 0) return []
  const { data: feedback } = await sb.from('quarterly_feedback').select('employee_id').eq('fiscal_year', fiscalYear).eq('quarter', quarter)
  // Note: quarterly_feedback.employee_id is the RECIPIENT employee — not the PM
  // We check if the PM (project_manager field) has given feedback instead
  const { data: feedbackByPm } = await sb.from('quarterly_feedback').select('project_manager').eq('fiscal_year', fiscalYear).eq('quarter', quarter)
  const feedbackPms = new Set((feedbackByPm ?? []).map((f: { project_manager?: string }) => f.project_manager).filter(Boolean))
  const pendingPmIds = pmIds.filter(id => !feedbackPms.has(id))
  if (pendingPmIds.length === 0) return []
  const { data: pms } = await sb.from('employees').select('employee_id, name, designation, practice, email').in('employee_id', pendingPmIds)
  return (pms ?? []).map((e: ReportRow) => ({ ...e, extra: 'Quarterly feedback not submitted' }))
}

async function fetchChangesRequestedGoals(fiscalYear: string): Promise<ReportRow[]> {
  // Employees whose goals were sent back but not resubmitted
  const { data } = await sb.from('goals')
    .select('employee_id, employees!goals_employee_id_fkey(name, designation, practice, email)')
    .eq('fiscal_year', fiscalYear).eq('approval_status', 'changes_requested')
  const unique: Record<string, ReportRow> = {}
  ;(data ?? []).forEach((g: Record<string, unknown>) => {
    const emp = g.employees as ReportRow | null
    if (emp && !unique[g.employee_id as string]) unique[g.employee_id as string] = { ...emp, employee_id: g.employee_id as string, extra: 'LM requested changes — awaiting resubmission' }
  })
  return Object.values(unique)
}

// ─── Notification helper ──────────────────────────────────────────────────────

async function sendNotifications(rows: ReportRow[], message: string): Promise<boolean> {
  try {
    const inserts = rows
      .filter(r => r.email)
      .map(r => ({
        employee_id: r.employee_id,
        type: 'admin_reminder',
        title: 'Action Required',
        message,
        is_read: false,
      }))
    if (inserts.length === 0) return true
    const { error } = await sb.from('notifications').insert(inserts)
    return !error
  } catch {
    return false
  }
}

// ─── Report Card Component ────────────────────────────────────────────────────

function ReportCard({
  report,
  onLoad,
  onToggle,
  onNotify,
}: {
  report: Report
  onLoad: () => void
  onToggle: () => void
  onNotify: () => void
}) {
  const Icon = report.icon
  const hasData = report.status === 'done'
  const count = report.rows.length

  return (
    <Card className="overflow-hidden">
      <div className={cn('px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4')}>
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', report.color)}>
            <Icon size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-800 text-sm">{report.title}</h3>
              {hasData && (
                <Badge className={cn('text-xs font-bold', count === 0 ? 'bg-green-100 text-green-700' : report.badgeColor)}>
                  {count === 0 ? '✓ All clear' : `${count} pending`}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{report.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {report.status === 'loading' && <Spinner small />}
          {report.status === 'idle' && (
            <Button size="sm" variant="outline" onClick={onLoad}>
              <RefreshCw size={12} className="mr-1.5" /> Run
            </Button>
          )}
          {hasData && (
            <>
              {count > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={() => exportCSV(report.title, report.rows)}>
                    <Download size={12} className="mr-1.5" /> CSV
                  </Button>
                  <Button size="sm" variant="outline"
                    className={report.notifyStatus === 'sent' ? 'text-green-600 border-green-200' : ''}
                    disabled={report.notifyStatus === 'sending' || report.notifyStatus === 'sent'}
                    onClick={onNotify}>
                    {report.notifyStatus === 'sending' ? <Spinner small /> :
                     report.notifyStatus === 'sent' ? <><CheckCircle size={12} className="mr-1.5" /> Sent</> :
                     <><Bell size={12} className="mr-1.5" /> Notify All</>}
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={onLoad}>
                <RefreshCw size={12} className="mr-1" />
              </Button>
              {count > 0 && (
                <Button size="sm" variant="outline" onClick={onToggle}>
                  {report.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {hasData && report.expanded && count > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Employee ID', 'Name', 'Designation', 'Practice', 'Note'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.rows.map(row => (
                <tr key={row.employee_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-gray-600">{row.employee_id}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{row.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{row.designation ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {row.practice ? <Badge className="text-[10px] bg-purple-50 text-purple-700">{row.practice}</Badge> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-amber-700">{row.extra ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasData && count === 0 && (
        <div className="flex items-center gap-2 px-5 py-3 text-xs text-green-700 bg-green-50">
          <CheckCircle size={13} /> All employees are up to date for this report.
        </div>
      )}

      {report.status === 'error' && (
        <div className="flex items-center gap-2 px-5 py-3 text-xs text-red-700 bg-red-50">
          <AlertTriangle size={13} /> Failed to load. <button className="underline" onClick={onLoad}>Retry</button>
        </div>
      )}
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [quarter, setQuarter] = useState('Q1')

  type ReportState = {
    rows: ReportRow[]
    status: ReportStatus
    notifyStatus: NotifyStatus
    expanded: boolean
  }

  const REPORT_DEFS: { id: string; title: string; description: string; icon: React.ElementType; color: string; badgeColor: string; notifyMsg: string; fetch: () => Promise<ReportRow[]> }[] = [
    {
      id: 'no_goals',
      title: 'Employees — No Goals Set',
      description: 'Active employees who have not created any goals for the selected fiscal year.',
      icon: Target,
      color: 'bg-red-500',
      badgeColor: 'bg-red-100 text-red-700',
      notifyMsg: `Reminder: Please set your goals for FY ${fiscalYear} in the PMS portal. Goals are required for your annual appraisal.`,
      fetch: () => fetchNoGoals(fiscalYear),
    },
    {
      id: 'draft_goals',
      title: 'Employees — Goals Not Submitted for Approval',
      description: 'Employees who have drafted goals but haven\'t submitted them to their Line Manager for approval.',
      icon: Clock,
      color: 'bg-amber-500',
      badgeColor: 'bg-amber-100 text-amber-700',
      notifyMsg: `Reminder: You have draft goals in the PMS portal for FY ${fiscalYear}. Please submit them to your Line Manager for approval.`,
      fetch: () => fetchDraftGoals(fiscalYear),
    },
    {
      id: 'changes_requested',
      title: 'Employees — Goal Changes Requested (Not Resubmitted)',
      description: 'Employees whose goals were sent back by their LM for changes but have not yet resubmitted.',
      icon: AlertTriangle,
      color: 'bg-orange-500',
      badgeColor: 'bg-orange-100 text-orange-700',
      notifyMsg: `Action Required: Your Line Manager has requested changes to your goals in PMS. Please review the feedback and resubmit.`,
      fetch: () => fetchChangesRequestedGoals(fiscalYear),
    },
    {
      id: 'pending_goal_approvals',
      title: 'Line Managers — Pending Goal Approvals',
      description: 'Line Managers who have goals from direct reports awaiting their approval.',
      icon: Users,
      color: 'bg-blue-500',
      badgeColor: 'bg-blue-100 text-blue-700',
      notifyMsg: `Reminder: Your direct reports have submitted goals for FY ${fiscalYear} awaiting your approval in the PMS portal.`,
      fetch: () => fetchPendingGoalApprovals(fiscalYear),
    },
    {
      id: 'no_tasks',
      title: `Employees — No Tasks Submitted (${quarter})`,
      description: `Active employees who have not submitted any tasks to a PM for ${quarter} ${fiscalYear}.`,
      icon: ClipboardList,
      color: 'bg-red-500',
      badgeColor: 'bg-red-100 text-red-700',
      notifyMsg: `Reminder: Please log and submit your tasks for ${quarter} ${fiscalYear} in the PMS portal.`,
      fetch: () => fetchNoTasksSubmitted(fiscalYear, quarter),
    },
    {
      id: 'draft_tasks',
      title: `Employees — Tasks in Draft (${quarter})`,
      description: `Employees who have added tasks for ${quarter} but haven't submitted them to their PM yet.`,
      icon: Clock,
      color: 'bg-amber-500',
      badgeColor: 'bg-amber-100 text-amber-700',
      notifyMsg: `Reminder: You have draft tasks for ${quarter} ${fiscalYear} in PMS. Please select your Project Manager and submit.`,
      fetch: () => fetchDraftTasks(fiscalYear, quarter),
    },
    {
      id: 'pending_task_reviews',
      title: `Project Managers — Pending Task Reviews (${quarter})`,
      description: `PMs who have tasks submitted to them for ${quarter} ${fiscalYear} but haven't rated or reviewed them.`,
      icon: Users,
      color: 'bg-purple-500',
      badgeColor: 'bg-purple-100 text-purple-700',
      notifyMsg: `Reminder: Team members have submitted tasks to you for ${quarter} ${fiscalYear} in PMS awaiting your review and rating.`,
      fetch: () => fetchPendingTaskReviews(fiscalYear, quarter),
    },
    {
      id: 'no_quarterly_feedback',
      title: `Project Managers — Quarterly Feedback Not Submitted (${quarter})`,
      description: `PMs who received task submissions for ${quarter} but have not submitted structured quarterly feedback.`,
      icon: MessageSquareOff,
      color: 'bg-indigo-500',
      badgeColor: 'bg-indigo-100 text-indigo-700',
      notifyMsg: `Reminder: Please submit your quarterly feedback for ${quarter} ${fiscalYear} for your project team members in PMS.`,
      fetch: () => fetchNoQuarterlyFeedback(fiscalYear, quarter),
    },
    {
      id: 'no_midyear',
      title: 'Line Managers — Mid-Year Review Not Completed',
      description: 'Line Managers who have direct reports but have not completed the mid-year review in the portal.',
      icon: AlertTriangle,
      color: 'bg-rose-500',
      badgeColor: 'bg-rose-100 text-rose-700',
      notifyMsg: `Reminder: Please complete the mid-year review for your direct reports in the PMS portal for FY ${fiscalYear}.`,
      fetch: () => fetchNoMidYearReview(fiscalYear),
    },
  ]

  const [states, setStates] = useState<Record<string, ReportState>>(() =>
    Object.fromEntries(REPORT_DEFS.map(r => [r.id, { rows: [], status: 'idle', notifyStatus: 'idle', expanded: false }]))
  )

  // Reset states when fiscal year or quarter changes
  useEffect(() => {
    setStates(Object.fromEntries(REPORT_DEFS.map(r => [r.id, { rows: [], status: 'idle', notifyStatus: 'idle', expanded: false }])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalYear, quarter])

  function setReportState(id: string, patch: Partial<ReportState>) {
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function loadReport(def: typeof REPORT_DEFS[0]) {
    setReportState(def.id, { status: 'loading', rows: [], expanded: false })
    try {
      const rows = await def.fetch()
      setReportState(def.id, { status: 'done', rows, expanded: rows.length > 0 })
    } catch {
      setReportState(def.id, { status: 'error' })
    }
  }

  async function loadAll() {
    for (const def of REPORT_DEFS) {
      loadReport(def)
    }
  }

  async function notify(def: typeof REPORT_DEFS[0]) {
    const rows = states[def.id]?.rows ?? []
    if (rows.length === 0) return
    setReportState(def.id, { notifyStatus: 'sending' })
    const ok = await sendNotifications(rows, def.notifyMsg)
    setReportState(def.id, { notifyStatus: ok ? 'sent' : 'error' })
  }

  const totalPending = Object.values(states).filter(s => s.status === 'done' && s.rows.length > 0).length
  const totalClear = Object.values(states).filter(s => s.status === 'done' && s.rows.length === 0).length

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Reports & Notifications" subtitle="Track pending actions across the organization" />

      <div className="flex-1 p-6 space-y-5 max-w-6xl mx-auto w-full">

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Fiscal Year</label>
            <Select className="w-32" value={fiscalYear} onChange={e => setFiscalYear(e.target.value)}
              options={FISCAL_YEARS.map(y => ({ label: y, value: y }))} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Quarter</label>
            <Select className="w-24" value={quarter} onChange={e => setQuarter(e.target.value)}
              options={QUARTERS.map(q => ({ label: q, value: q }))} />
          </div>
          <Button onClick={loadAll} className="ml-auto">
            <RefreshCw size={14} className="mr-2" /> Run All Reports
          </Button>
        </div>

        {/* Summary bar */}
        {(totalPending > 0 || totalClear > 0) && (
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl text-sm">
            <span className="text-gray-500 font-medium">Summary:</span>
            {totalPending > 0 && (
              <span className="flex items-center gap-1.5 text-amber-700">
                <AlertTriangle size={14} /> {totalPending} report{totalPending > 1 ? 's' : ''} with pending items
              </span>
            )}
            {totalClear > 0 && (
              <span className="flex items-center gap-1.5 text-green-700">
                <CheckCircle size={14} /> {totalClear} all clear
              </span>
            )}
          </div>
        )}

        {/* Section: Goal Management */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">Goal Management</h2>
          {REPORT_DEFS.slice(0, 4).map(def => (
            <ReportCard key={def.id}
              report={{ ...def, ...states[def.id] }}
              onLoad={() => loadReport(def)}
              onToggle={() => setReportState(def.id, { expanded: !states[def.id].expanded })}
              onNotify={() => notify(def)}
            />
          ))}
        </div>

        {/* Section: Task Management */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">Task Management</h2>
          {REPORT_DEFS.slice(4, 8).map(def => (
            <ReportCard key={def.id}
              report={{ ...def, ...states[def.id] }}
              onLoad={() => loadReport(def)}
              onToggle={() => setReportState(def.id, { expanded: !states[def.id].expanded })}
              onNotify={() => notify(def)}
            />
          ))}
        </div>

        {/* Section: Reviews */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-1">Reviews</h2>
          {REPORT_DEFS.slice(8).map(def => (
            <ReportCard key={def.id}
              report={{ ...def, ...states[def.id] }}
              onLoad={() => loadReport(def)}
              onToggle={() => setReportState(def.id, { expanded: !states[def.id].expanded })}
              onNotify={() => notify(def)}
            />
          ))}
        </div>

      </div>
    </div>
  )
}

// lucide doesn't export MessageSquareOff by that exact name in older versions — inline it
function MessageSquareOff({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}
