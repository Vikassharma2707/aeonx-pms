'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
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
import { GOAL_CATEGORIES, GOAL_STATUSES, FISCAL_YEARS, STATUS_COLORS } from '@/lib/constants'
import type { Goal } from '@/lib/supabase'
import { Lock, Send, CheckCircle, AlertCircle, Clock, RotateCcw } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  'Delivery & Project Execution': 'bg-blue-100 text-blue-700',
  'Technical Capability': 'bg-violet-100 text-violet-700',
  'Customer / Stakeholder Management': 'bg-cyan-100 text-cyan-700',
  'Process & Innovation': 'bg-teal-100 text-teal-700',
  'Learning & Development': 'bg-amber-100 text-amber-700',
  'Behavior / Team Contribution': 'bg-pink-100 text-pink-700',
}

const APPROVAL_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:             { label: 'Draft',              color: 'bg-gray-100 text-gray-600',    icon: <RotateCcw size={11} /> },
  pending_approval:  { label: 'Pending Approval',   color: 'bg-amber-100 text-amber-700',  icon: <Clock size={11} /> },
  approved:          { label: 'Approved',            color: 'bg-green-100 text-green-700',  icon: <CheckCircle size={11} /> },
  changes_requested: { label: 'Changes Requested',  color: 'bg-red-100 text-red-700',      icon: <AlertCircle size={11} /> },
}

type GoalForm = {
  fiscal_year: string
  goal_category: string
  goal_description: string
  kpi_success_measure: string
  weightage_percent: string
  start_date: string
  due_date: string
  goal_status: string
  self_progress_percent: string
  self_rating: string
  goal_comments: string
}

const EMPTY_FORM: GoalForm = {
  fiscal_year: '2026-27', goal_category: '', goal_description: '',
  kpi_success_measure: '', weightage_percent: '', start_date: '', due_date: '',
  goal_status: 'Not Started', self_progress_percent: '', self_rating: '', goal_comments: '',
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><Label required={required}>{label}</Label>{children}</div>
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

type GoalCardProps = {
  goal: Goal
  isOwner: boolean
  locked: boolean
  onSave: (id: string, patch: Partial<Goal>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSubmitApproval: (id: string) => Promise<void>
}

function GoalCard({ goal, isOwner, locked, onSave, onDelete, onSubmitApproval }: GoalCardProps) {
  const approval = goal.approval_status ?? 'draft'
  const approvalCfg = APPROVAL_CONFIG[approval]

  // Editing rules:
  // - pending_approval → fully read-only (waiting for LM)
  // - approved → only self_progress_percent and self_rating editable
  // - draft / changes_requested → fully editable
  const isReadOnly = !isOwner || locked || approval === 'pending_approval'
  const canEditSelfFields = isOwner && !locked && approval !== 'pending_approval'
  const canEditGoalFields = isOwner && !locked && (approval === 'draft' || approval === 'changes_requested')
  const canSubmit = isOwner && !locked && (approval === 'draft' || approval === 'changes_requested')
  const canDelete = isOwner && !locked && approval === 'draft' && goal.goal_status === 'Not Started'

  const [status, setStatus] = useState(goal.goal_status)
  const [progress, setProgress] = useState(String(goal.self_progress_percent ?? ''))
  const [rating, setRating] = useState(String(goal.self_rating ?? ''))
  const [comments, setComments] = useState(goal.goal_comments ?? '')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dirty, setDirty] = useState(false)

  const mark = () => setDirty(true)

  async function handleSave() {
    setSaving(true)
    await onSave(goal.id, {
      goal_status: status as Goal['goal_status'],
      self_progress_percent: progress !== '' ? Number(progress) : undefined,
      self_rating: rating !== '' ? Number(rating) : undefined,
      goal_comments: comments,
    })
    setSaving(false)
    setDirty(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this goal? This cannot be undone.')) return
    setDeleting(true)
    await onDelete(goal.id)
    setDeleting(false)
  }

  async function handleSubmit() {
    setSubmitting(true)
    await onSubmitApproval(goal.id)
    setSubmitting(false)
  }

  const catColor = CATEGORY_COLORS[goal.goal_category ?? ''] ?? 'bg-gray-100 text-gray-600'

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {goal.goal_category && (
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', catColor)}>
              {goal.goal_category}
            </span>
          )}
          <Badge className={cn('text-xs', STATUS_COLORS[goal.goal_status] ?? 'bg-gray-100 text-gray-600')}>
            {goal.goal_status}
          </Badge>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border', approvalCfg.color)}>
            {approvalCfg.icon}
            {approvalCfg.label}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {goal.weightage_percent != null ? `${goal.weightage_percent}% weight` : ''}
        </span>
      </div>

      <CardContent className="pt-4 space-y-4">
        {/* Changes requested banner */}
        {approval === 'changes_requested' && goal.approval_comment && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
            <div>
              <p className="font-semibold mb-0.5">Line Manager requested changes:</p>
              <p>{goal.approval_comment}</p>
            </div>
          </div>
        )}

        {/* Pending banner */}
        {approval === 'pending_approval' && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            <Clock size={13} className="flex-shrink-0" />
            Waiting for your Line Manager to review this goal. You cannot edit while it is pending.
          </div>
        )}

        {/* Approved banner */}
        {approval === 'approved' && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
            <CheckCircle size={13} className="flex-shrink-0" />
            This goal has been approved by your Line Manager. You can still update your progress and self-rating.
          </div>
        )}

        <div className="space-y-1">
          <p className="text-gray-800 font-medium text-sm leading-relaxed">{goal.goal_description}</p>
          {goal.kpi_success_measure && (
            <p className="text-xs text-gray-500"><span className="font-medium">KPI: </span>{goal.kpi_success_measure}</p>
          )}
        </div>

        {(goal.start_date || goal.due_date) && (
          <p className="text-xs text-gray-400">
            {goal.start_date ? new Date(goal.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            {' → '}
            {goal.due_date ? new Date(goal.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Goal Status">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof goal.goal_status); mark() }}
              disabled={!canEditGoalFields} options={GOAL_STATUSES.map((s) => ({ label: s, value: s }))} />
          </Field>
          <Field label="Self Progress %">
            <Input type="number" min={0} max={100} placeholder="0 – 100" value={progress}
              onChange={(e) => { setProgress(e.target.value); mark() }} disabled={!canEditSelfFields} />
          </Field>
          <Field label="Self Rating (1 – 5)">
            <Input type="number" min={1} max={5} step={0.5} placeholder="e.g. 3.5" value={rating}
              onChange={(e) => { setRating(e.target.value); mark() }} disabled={!canEditSelfFields} />
          </Field>
          <Field label="LM Rating">
            <Input type="number" value={goal.lm_rating ?? ''} readOnly disabled
              placeholder="Set by line manager" className="bg-gray-50 cursor-not-allowed" />
          </Field>
        </div>

        <Field label="Comments">
          <Textarea placeholder="Add notes or comments about this goal…" value={comments}
            onChange={(e) => { setComments(e.target.value); mark() }}
            disabled={!canEditSelfFields} rows={3} />
        </Field>

        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <div className="flex gap-2">
            {canDelete && (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {canSubmit && (
              <Button variant="outline" size="sm" onClick={handleSubmit} disabled={submitting}>
                <Send size={13} className="mr-1.5" />
                {submitting ? 'Submitting…' : 'Submit for Approval'}
              </Button>
            )}
            {canEditSelfFields && (
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyGoalsPage() {
  const { employee, loading: authLoading } = useAuth()
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [goals, setGoals] = useState<Goal[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [goalsLocked, setGoalsLocked] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.from('appraisal_settings').select('goals_locked').order('fiscal_year', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) setGoalsLocked(!!data.goals_locked) })
  }, [])

  useEffect(() => {
    if (!employee) return
    async function fetchGoals() {
      setDataLoading(true); setError(null)
      const { data, error } = await supabase.from('goals').select('*')
        .eq('employee_id', employee!.employee_id).eq('fiscal_year', fiscalYear)
        .order('created_at', { ascending: true })
      if (error) setError(error.message)
      else setGoals(data ?? [])
      setDataLoading(false)
    }
    fetchGoals()
  }, [employee, fiscalYear])

  const totalWeight = goals.reduce((sum, g) => sum + (g.weightage_percent ?? 0), 0)
  const weightOk = totalWeight === 100
  const pendingCount = goals.filter(g => g.approval_status === 'pending_approval').length
  const approvedCount = goals.filter(g => g.approval_status === 'approved').length

  async function handleSave(id: string, patch: Partial<Goal>) {
    const { data, error } = await supabase.from('goals')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id).eq('employee_id', employee!.employee_id).select().single()
    if (!error && data) setGoals((prev) => prev.map((g) => (g.id === id ? (data as Goal) : g)))
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('goals').delete()
      .eq('id', id).eq('employee_id', employee!.employee_id)
    if (!error) setGoals((prev) => prev.filter((g) => g.id !== id))
  }

  async function handleSubmitApproval(id: string) {
    const { data, error } = await supabase.from('goals')
      .update({ approval_status: 'pending_approval', approval_comment: null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('employee_id', employee!.employee_id).select().single()
    if (!error && data) setGoals((prev) => prev.map((g) => (g.id === id ? (data as Goal) : g)))
  }

  function openAddModal() { setForm({ ...EMPTY_FORM, fiscal_year: fiscalYear }); setFormError(null); setModalOpen(true) }
  function setField(key: keyof GoalForm, value: string) { setForm((prev) => ({ ...prev, [key]: value })) }

  async function handleAddGoal() {
    if (!form.goal_description.trim()) { setFormError('Goal description is required.'); return }
    setSubmitting(true); setFormError(null)
    const { data, error } = await supabase.from('goals').insert({
      employee_id: employee!.employee_id,
      fiscal_year: form.fiscal_year,
      goal_category: form.goal_category || null,
      goal_description: form.goal_description.trim(),
      kpi_success_measure: form.kpi_success_measure.trim() || null,
      weightage_percent: form.weightage_percent !== '' ? Number(form.weightage_percent) : null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      goal_status: (form.goal_status || 'Not Started') as Goal['goal_status'],
      self_progress_percent: form.self_progress_percent !== '' ? Number(form.self_progress_percent) : null,
      self_rating: form.self_rating !== '' ? Number(form.self_rating) : null,
      goal_comments: form.goal_comments.trim() || null,
      approval_status: 'draft',
    }).select().single()
    if (error) setFormError(error.message)
    else { if (form.fiscal_year === fiscalYear) setGoals((prev) => [...prev, data as Goal]); setModalOpen(false) }
    setSubmitting(false)
  }

  if (authLoading) return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="My Goals" />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )

  if (!employee) return null

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="My Goals" subtitle={`Fiscal Year ${fiscalYear}`} />

      <div className="flex-1 p-6 space-y-5 max-w-4xl mx-auto w-full">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">Fiscal Year</label>
            <Select className="w-36" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)}
              options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))} />
          </div>
          {!goalsLocked && <Button onClick={openAddModal}>+ Add Goal</Button>}
        </div>

        {/* Approval summary chips */}
        {goals.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Approval status:</span>
            {pendingCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                <Clock size={10} /> {pendingCount} pending
              </span>
            )}
            {approvedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
                <CheckCircle size={10} /> {approvedCount} approved
              </span>
            )}
            {goals.filter(g => g.approval_status === 'changes_requested').length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
                <AlertCircle size={10} /> {goals.filter(g => g.approval_status === 'changes_requested').length} needs changes
              </span>
            )}
            {goals.filter(g => !g.approval_status || g.approval_status === 'draft').length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                {goals.filter(g => !g.approval_status || g.approval_status === 'draft').length} draft
              </span>
            )}
          </div>
        )}

        {goalsLocked && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
            <Lock size={16} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Goals are locked</p>
              <p className="text-xs text-red-600 mt-0.5">The appraisal deadline has passed. Goals are now read-only.</p>
            </div>
          </div>
        )}

        {/* Weight bar */}
        <div className={cn('rounded-xl p-4 flex flex-col gap-2', weightOk ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200')}>
          <div className="flex items-center justify-between">
            <span className={cn('text-sm font-semibold', weightOk ? 'text-green-700' : 'text-amber-700')}>
              Total Weight: {totalWeight}% / 100%
            </span>
            <span className={cn('text-xs font-medium', weightOk ? 'text-green-600' : 'text-amber-600')}>
              {weightOk ? '✓ Balanced' : totalWeight > 100 ? `${totalWeight - 100}% over` : `${100 - totalWeight}% remaining`}
            </span>
          </div>
          <div className="w-full bg-white rounded-full h-2.5 overflow-hidden border border-gray-200">
            <div className={cn('h-full rounded-full transition-all duration-500', weightOk ? 'bg-green-500' : totalWeight > 100 ? 'bg-red-400' : 'bg-amber-400')}
              style={{ width: `${Math.min(totalWeight, 100)}%` }} />
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

        {dataLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {!dataLoading && goals.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">No goals yet for {fiscalYear}</p>
            <p className="text-gray-400 text-sm mt-1">Click "Add Goal" to set your first goal.</p>
            <Button className="mt-4" onClick={openAddModal}>+ Add Your First Goal</Button>
          </div>
        )}

        {!dataLoading && goals.length > 0 && (
          <div className="space-y-4">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} isOwner locked={goalsLocked}
                onSave={handleSave} onDelete={handleDelete} onSubmitApproval={handleSubmitApproval} />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add New Goal" size="lg">
        <div className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fiscal Year" required>
              <Select value={form.fiscal_year} onChange={(e) => setField('fiscal_year', e.target.value)}
                options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))} />
            </Field>
            <Field label="Goal Category">
              <Select value={form.goal_category} onChange={(e) => setField('goal_category', e.target.value)}
                placeholder="Select category" options={GOAL_CATEGORIES.map((c) => ({ label: c, value: c }))} />
            </Field>
          </div>
          <Field label="Goal Description" required>
            <Textarea rows={3} placeholder="Describe the goal clearly and specifically…"
              value={form.goal_description} onChange={(e) => setField('goal_description', e.target.value)} />
          </Field>
          <Field label="KPI / Success Measure">
            <Textarea rows={2} placeholder="How will you measure success?"
              value={form.kpi_success_measure} onChange={(e) => setField('kpi_success_measure', e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Weightage %">
              <Input type="number" min={1} max={100} placeholder="e.g. 20"
                value={form.weightage_percent} onChange={(e) => setField('weightage_percent', e.target.value)} />
            </Field>
            <Field label="Start Date">
              <Input type="date" value={form.start_date} onChange={(e) => setField('start_date', e.target.value)} />
            </Field>
            <Field label="Due Date">
              <Input type="date" value={form.due_date} onChange={(e) => setField('due_date', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Goal Status">
              <Select value={form.goal_status} onChange={(e) => setField('goal_status', e.target.value)}
                options={GOAL_STATUSES.map((s) => ({ label: s, value: s }))} />
            </Field>
            <Field label="Self Progress %">
              <Input type="number" min={0} max={100} placeholder="0 – 100"
                value={form.self_progress_percent} onChange={(e) => setField('self_progress_percent', e.target.value)} />
            </Field>
            <Field label="Self Rating (1 – 5)">
              <Input type="number" min={1} max={5} step={0.5} placeholder="e.g. 3.5"
                value={form.self_rating} onChange={(e) => setField('self_rating', e.target.value)} />
            </Field>
          </div>
          <Field label="Comments">
            <Textarea rows={2} placeholder="Any notes or context for this goal…"
              value={form.goal_comments} onChange={(e) => setField('goal_comments', e.target.value)} />
          </Field>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAddGoal} disabled={submitting}>{submitting ? 'Saving…' : 'Add Goal'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
