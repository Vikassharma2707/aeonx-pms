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
import { QUARTERS, FISCAL_YEARS, TASK_STATUSES, PRIORITIES, STATUS_COLORS } from '@/lib/constants'
import type { QuarterlyTask, Employee } from '@/lib/supabase'
import { Send } from 'lucide-react'
import { Combobox } from '@/components/ui/combobox'

type Task = QuarterlyTask & {
  submission_status?: 'draft' | 'submitted' | 'reviewed'
  submitted_to?: string
  submitted_at?: string
  pm_comments?: string
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

function Spinner() {
  return <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
}

// ─── Task Card ───────────────────────────────────────────────────────────────

type TaskCardProps = {
  task: Task
  managers: Employee[]
  onSave: (id: string, patch: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSubmit: (task: Task) => Promise<void>
}

function TaskCard({ task, managers, onSave, onDelete, onSubmit }: TaskCardProps) {
  const [status, setStatus] = useState(task.task_status)
  const [selfRating, setSelfRating] = useState(String(task.self_rating ?? ''))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isDraft = !task.submission_status || task.submission_status === 'draft'
  const isSubmitted = task.submission_status === 'submitted'
  const isReviewed = task.submission_status === 'reviewed'

  const pmEmployee = managers.find(m => m.employee_id === task.project_manager)
  const submittedToEmployee = managers.find(m => m.employee_id === task.submitted_to)

  async function handleSave() {
    setSaving(true)
    await onSave(task.id, {
      task_status: status as Task['task_status'],
      self_rating: selfRating !== '' ? Number(selfRating) : undefined,
    })
    setSaving(false)
    setDirty(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this task? This cannot be undone.')) return
    setDeleting(true)
    await onDelete(task.id)
    setDeleting(false)
  }

  async function handleSubmit() {
    if (!task.project_manager) return
    setSubmitting(true)
    await onSubmit(task)
    setSubmitting(false)
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{task.project_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            PM: <span className="font-medium text-gray-700">{pmEmployee?.name ?? task.project_manager ?? '—'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {task.task_id && (
            <Badge className="bg-gray-100 text-gray-600 text-xs font-mono">{task.task_id}</Badge>
          )}
          <Badge className={cn('text-xs', PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600')}>
            {task.priority}
          </Badge>
          <Badge className={cn('text-xs',
            isReviewed ? STATUS_COLORS['Reviewed'] :
            isSubmitted ? STATUS_COLORS['Active'] :
            STATUS_COLORS['Inactive'])}>
            {isReviewed ? 'Reviewed' : isSubmitted ? 'Submitted' : 'Draft'}
          </Badge>
        </div>
      </div>

      <CardContent className="pt-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Task Description</p>
          <p className="text-sm text-gray-800 leading-relaxed">{task.task_description}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Planned Outcome</p>
            <p className="text-sm text-gray-700">{task.planned_outcome || <span className="text-gray-400 italic">Not set</span>}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Actual Outcome</p>
            <p className="text-sm text-gray-700">{task.actual_outcome || <span className="text-gray-400 italic">Not set</span>}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Task Status">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as Task['task_status']); setDirty(true) }}
              options={TASK_STATUSES.map(s => ({ label: s, value: s }))} disabled={!isDraft} />
          </Field>
          <Field label="Self Rating (1–5)">
            <Input type="number" min={1} max={5} step={0.5} placeholder="e.g. 3.5"
              value={selfRating} onChange={(e) => { setSelfRating(e.target.value); setDirty(true) }} disabled={!isDraft} />
          </Field>
          <Field label="PM Rating">
            <Input type="number" value={task.pm_rating ?? ''} readOnly disabled placeholder="Set by PM" className="bg-gray-50 cursor-not-allowed" />
          </Field>
          <Field label="Final Score">
            <Input type="number" value={task.final_task_score ?? ''} readOnly disabled placeholder="Calculated" className="bg-gray-50 cursor-not-allowed" />
          </Field>
        </div>

        {task.pm_comments && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-blue-700 mb-1">PM Comments</p>
            <p className="text-sm text-blue-800">{task.pm_comments}</p>
          </div>
        )}

        {isSubmitted && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
            Submitted to <strong>{submittedToEmployee?.name ?? task.submitted_to}</strong>
            {task.submitted_at && ` on ${new Date(task.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            . Awaiting review.
          </div>
        )}

        {isReviewed && (
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            Reviewed by <strong>{submittedToEmployee?.name ?? task.submitted_to}</strong>.
          </div>
        )}

        <div className="flex items-center justify-between pt-1 gap-2">
          {isDraft ? (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : <span />}

          <div className="flex items-center gap-2">
            {isDraft && dirty && (
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
            {isDraft && task.project_manager && (
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                <Send size={12} className="mr-1.5" />
                {submitting ? 'Submitting…' : `Submit to PM`}
              </Button>
            )}
            {isDraft && !task.project_manager && (
              <p className="text-xs text-gray-400 italic">Select a PM to submit</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Add Task Form ────────────────────────────────────────────────────────────

type TaskForm = {
  project_name: string
  project_manager: string   // employee_id of the PM
  task_id: string
  task_description: string
  planned_outcome: string
  actual_outcome: string
  priority: string
  task_status: string
  self_rating: string
}

const EMPTY_FORM: TaskForm = {
  project_name: '',
  project_manager: '',
  task_id: '',
  task_description: '',
  planned_outcome: '',
  actual_outcome: '',
  priority: 'Medium',
  task_status: 'Not Started',
  self_rating: '',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { employee, loading: authLoading } = useAuth()

  const [quarter, setQuarter] = useState('Q1')
  const [fiscalYear, setFiscalYear] = useState('2026-27')
  const [tasks, setTasks] = useState<Task[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [managers, setManagers] = useState<Employee[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSaving, setFormSaving] = useState(false)

  const fetchTasks = useCallback(async () => {
    if (!employee) return
    setDataLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('quarterly_tasks')
      .select('*')
      .eq('employee_id', employee.employee_id)
      .eq('fiscal_year', fiscalYear)
      .eq('quarter', quarter)
      .order('created_at', { ascending: true })
    if (err) setError(err.message)
    else setTasks((data ?? []) as Task[])
    setDataLoading(false)
  }, [employee, fiscalYear, quarter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    // Fetch all active employees with MM or SM appraisal bands (MM01–MM05, SM01–SM05)
    supabase.from('employees').select('employee_id, name, designation, appraisal_band')
      .eq('active_status', 'Active')
      .or('appraisal_band.ilike.MM%,appraisal_band.ilike.SM%')
      .order('name')
      .then(({ data }) => { if (data) setManagers(data as Employee[]) })
  }, [])

  async function handleSave(id: string, patch: Partial<Task>) {
    const { data, error: err } = await supabase
      .from('quarterly_tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (!err && data) setTasks(prev => prev.map(t => t.id === id ? { ...t, ...(data as Task) } : t))
  }

  async function handleDelete(id: string) {
    await supabase.from('quarterly_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function handleSubmitTask(task: Task) {
    if (!task.project_manager) return
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('quarterly_tasks')
      .update({ submission_status: 'submitted', submitted_to: task.project_manager, submitted_at: now, updated_at: now })
      .eq('id', task.id).select().single()
    if (data) setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...(data as Task) } : t))
  }

  function setField(key: keyof TaskForm, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleAddTask() {
    if (!form.project_name.trim()) { setFormError('Project name is required.'); return }
    if (!form.task_description.trim()) { setFormError('Task description is required.'); return }
    setFormSaving(true)
    setFormError(null)

    const payload = {
      employee_id: employee!.employee_id,
      fiscal_year: fiscalYear,
      quarter,
      project_name: form.project_name.trim(),
      project_manager: form.project_manager || null,
      task_id: form.task_id.trim() || null,
      task_description: form.task_description.trim(),
      planned_outcome: form.planned_outcome.trim() || null,
      actual_outcome: form.actual_outcome.trim() || null,
      priority: form.priority as QuarterlyTask['priority'],
      task_status: form.task_status as QuarterlyTask['task_status'],
      self_rating: form.self_rating !== '' ? Number(form.self_rating) : null,
      submission_status: 'draft',
    }

    const { data, error: err } = await supabase.from('quarterly_tasks').insert(payload).select().single()
    if (err) { setFormError(err.message) }
    else { setTasks(prev => [...prev, data as Task]); setModalOpen(false) }
    setFormSaving(false)
  }

  if (authLoading) return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="My Task Log" />
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
    </div>
  )
  if (!employee) return null

  const draftCount = tasks.filter(t => !t.submission_status || t.submission_status === 'draft').length
  const submittedCount = tasks.filter(t => t.submission_status === 'submitted').length
  const reviewedCount = tasks.filter(t => t.submission_status === 'reviewed').length

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="My Task Log" subtitle={`${quarter} · ${fiscalYear}`} />

      <div className="flex-1 p-6 space-y-5 max-w-4xl mx-auto w-full">

        {/* Filters + Add */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Quarter</label>
              <Select className="w-24" value={quarter} onChange={e => setQuarter(e.target.value)}
                options={QUARTERS.map(q => ({ label: q, value: q }))} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Fiscal Year</label>
              <Select className="w-32" value={fiscalYear} onChange={e => setFiscalYear(e.target.value)}
                options={FISCAL_YEARS.map(y => ({ label: y, value: y }))} />
            </div>
          </div>
          <Button onClick={() => { setForm(EMPTY_FORM); setFormError(null); setModalOpen(true) }}>
            + Add Task
          </Button>
        </div>

        {/* Summary chips */}
        {tasks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''}:</span>
            {draftCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{draftCount} draft</span>}
            {submittedCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{submittedCount} submitted</span>}
            {reviewedCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{reviewedCount} reviewed</span>}
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

        {dataLoading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {!dataLoading && tasks.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">No tasks for {quarter} · {fiscalYear}</p>
            <p className="text-gray-400 text-sm mt-1">Click "Add Task" to log tasks for this quarter. Each task can go to a different PM.</p>
            <Button className="mt-4" onClick={() => { setForm(EMPTY_FORM); setFormError(null); setModalOpen(true) }}>
              + Add Your First Task
            </Button>
          </div>
        )}

        {!dataLoading && tasks.length > 0 && (
          <div className="space-y-4">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} managers={managers}
                onSave={handleSave} onDelete={handleDelete} onSubmit={handleSubmitTask} />
            ))}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add New Task" size="lg">
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{formError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Project Name" required>
              <Input placeholder="e.g. ERP Migration Phase 2" value={form.project_name}
                onChange={e => setField('project_name', e.target.value)} />
            </Field>
            <Field label="Project Manager" required>
              <Combobox
                value={form.project_manager}
                onChange={v => setField('project_manager', v)}
                placeholder="Search by name or band…"
                options={managers.map(m => ({
                  value: m.employee_id,
                  label: m.name,
                  sublabel: [m.designation, m.appraisal_band].filter(Boolean).join(' · '),
                }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Task ID">
              <Input placeholder="e.g. T-001" value={form.task_id} onChange={e => setField('task_id', e.target.value)} />
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={e => setField('priority', e.target.value)}
                options={PRIORITIES.map(p => ({ label: p, value: p }))} />
            </Field>
            <Field label="Task Status">
              <Select value={form.task_status} onChange={e => setField('task_status', e.target.value)}
                options={TASK_STATUSES.map(s => ({ label: s, value: s }))} />
            </Field>
          </div>

          <Field label="Task Description" required>
            <Textarea rows={3} placeholder="Describe the task clearly…" value={form.task_description}
              onChange={e => setField('task_description', e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Planned Outcome">
              <Textarea rows={2} placeholder="What was the expected outcome?" value={form.planned_outcome}
                onChange={e => setField('planned_outcome', e.target.value)} />
            </Field>
            <Field label="Actual Outcome">
              <Textarea rows={2} placeholder="What was actually delivered?" value={form.actual_outcome}
                onChange={e => setField('actual_outcome', e.target.value)} />
            </Field>
          </div>

          <Field label="Self Rating (1–5)">
            <Input type="number" min={1} max={5} step={0.5} placeholder="e.g. 4.0"
              value={form.self_rating} onChange={e => setField('self_rating', e.target.value)} className="w-40" />
          </Field>

          <p className="text-xs text-gray-400">
            The task will be saved as draft. Use the <strong>Submit to PM</strong> button on each task card to submit when ready.
          </p>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={formSaving}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={formSaving}>{formSaving ? 'Saving…' : 'Add Task'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
