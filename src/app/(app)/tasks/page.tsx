'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { QuarterlyTask } from '@/lib/supabase'
import { FISCAL_YEARS, QUARTERS, TASK_STATUSES, STATUS_COLORS, PRIORITIES } from '@/lib/constants'
import { cn, formatScore } from '@/lib/utils'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit2, Trash2, AlertCircle } from 'lucide-react'

// ─── Inline FormField helper ───────────────────────────────────────────────

interface FormFieldProps {
  label: string
  required?: boolean
  children: React.ReactNode
}

function FormField({ label, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Priority badge helper ─────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
}

// ─── Default form data ─────────────────────────────────────────────────────

const DEFAULT_FORM: Omit<QuarterlyTask, 'id' | 'created_at' | 'updated_at'> & { [key: string]: unknown } = {
  employee_id: '',
  fiscal_year: '2026-27',
  quarter: 'Q1',
  project_name: '',
  project_manager: '',
  task_id: '',
  task_description: '',
  planned_outcome: '',
  actual_outcome: '',
  task_status: 'Not Started',
  priority: 'Medium',
  self_rating: 0,
  pm_rating: 0,
  final_task_score: 0,
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TasksPage() {
  // State
  const [data, setData] = useState<QuarterlyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterQuarter, setFilterQuarter] = useState('')
  const [filterFiscalYear, setFilterFiscalYear] = useState('2026-27')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  // Modal / form
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<QuarterlyTask | null>(null)
  const [formData, setFormData] = useState<typeof DEFAULT_FORM>({ ...DEFAULT_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<QuarterlyTask | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('quarterly_tasks')
        .select(`*, employees!quarterly_tasks_employee_id_fkey(name)`)
        .order('created_at', { ascending: false })

      if (err) throw err
      setData((rows as QuarterlyTask[]) ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // ── Derived filtered list ──────────────────────────────────────────────

  const filtered = data.filter((task) => {
    const employeeName: string = (task as any).employees?.name ?? ''
    const lowerSearch = search.toLowerCase()

    if (
      search &&
      !task.employee_id?.toLowerCase().includes(lowerSearch) &&
      !employeeName.toLowerCase().includes(lowerSearch)
    ) {
      return false
    }
    if (filterQuarter && task.quarter !== filterQuarter) return false
    if (filterFiscalYear && task.fiscal_year !== filterFiscalYear) return false
    if (filterStatus && task.task_status !== filterStatus) return false
    if (filterPriority && task.priority !== filterPriority) return false
    return true
  })

  // ── Modal helpers ──────────────────────────────────────────────────────

  function openAdd() {
    setEditingItem(null)
    setFormData({ ...DEFAULT_FORM })
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: QuarterlyTask) {
    setEditingItem(item)
    setFormData({
      employee_id: item.employee_id ?? '',
      fiscal_year: item.fiscal_year ?? '2026-27',
      quarter: item.quarter ?? 'Q1',
      project_name: item.project_name ?? '',
      project_manager: item.project_manager ?? '',
      task_id: item.task_id ?? '',
      task_description: item.task_description ?? '',
      planned_outcome: item.planned_outcome ?? '',
      actual_outcome: item.actual_outcome ?? '',
      task_status: item.task_status ?? 'Not Started',
      priority: item.priority ?? 'Medium',
      self_rating: item.self_rating ?? 0,
      pm_rating: item.pm_rating ?? 0,
      final_task_score: item.final_task_score ?? 0,
    })
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    setFormError(null)
  }

  function handleFormChange(field: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // ── Save ───────────────────────────────────────────────────────────────

  async function handleSave() {
    setFormError(null)

    if (!formData.employee_id) {
      setFormError('Employee ID is required.')
      return
    }
    if (!formData.project_name) {
      setFormError('Project name is required.')
      return
    }
    if (!formData.task_id) {
      setFormError('Task ID is required.')
      return
    }

    setSaving(true)
    try {
      const selfRating = Number(formData.self_rating) || 0
      const pmRating = Number(formData.pm_rating) || 0
      const finalScore =
        selfRating > 0 && pmRating > 0
          ? (selfRating + pmRating) / 2
          : selfRating || pmRating || 0

      const payload = {
        employee_id: formData.employee_id,
        fiscal_year: formData.fiscal_year,
        quarter: formData.quarter,
        project_name: formData.project_name,
        project_manager: formData.project_manager,
        task_id: formData.task_id,
        task_description: formData.task_description,
        planned_outcome: formData.planned_outcome,
        actual_outcome: formData.actual_outcome,
        task_status: formData.task_status,
        priority: formData.priority,
        self_rating: selfRating,
        pm_rating: pmRating,
        final_task_score: finalScore,
      }

      if (editingItem) {
        const { error: err } = await supabase
          .from('quarterly_tasks')
          .update(payload)
          .eq('id', editingItem.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('quarterly_tasks').insert(payload)
        if (err) throw err
      }

      closeModal()
      await fetchTasks()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to save task.')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────

  function openDelete(item: QuarterlyTask) {
    setDeleteTarget(item)
    setDeleteModalOpen(true)
  }

  function closeDeleteModal() {
    setDeleteTarget(null)
    setDeleteModalOpen(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error: err } = await supabase
        .from('quarterly_tasks')
        .delete()
        .eq('id', deleteTarget.id)
      if (err) throw err
      closeDeleteModal()
      await fetchTasks()
    } catch (e: unknown) {
      // surface error inside delete modal via alert for simplicity
      alert(e instanceof Error ? e.message : 'Failed to delete task.')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header
        title="Quarterly Task Log"
        subtitle="Consultant tasks and project manager feedback"
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing{' '}
            <span className="font-semibold text-gray-700">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'task' : 'tasks'}
            {data.length !== filtered.length && (
              <> of {data.length} total</>
            )}
          </p>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search by employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={filterQuarter}
            onChange={(e) => setFilterQuarter(e.target.value)}
            className="w-36"
          >
            <option value="">All Quarters</option>
            {QUARTERS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </Select>

          <Select
            value={filterFiscalYear}
            onChange={(e) => setFilterFiscalYear(e.target.value)}
            className="w-36"
          >
            <option value="">All Years</option>
            {FISCAL_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>

          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-40"
          >
            <option value="">All Statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <Select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-36"
          >
            <option value="">All Priorities</option>
            {['Low', 'Medium', 'High'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Emp ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Quarter</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Project</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">PM</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Task ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Description</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 whitespace-nowrap">Self</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 whitespace-nowrap">PM</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 whitespace-nowrap">Final</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 13 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-gray-100 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                    No tasks found.
                  </td>
                </tr>
              ) : (
                filtered.map((task) => {
                  const employeeName: string = (task as any).employees?.name ?? '—'
                  const priorityClass =
                    PRIORITY_COLORS[task.priority ?? ''] ?? 'bg-gray-100 text-gray-700'
                  const statusClass =
                    STATUS_COLORS[task.task_status ?? ''] ?? 'bg-gray-100 text-gray-700'
                  const descTrunc =
                    (task.task_description?.length ?? 0) > 50
                      ? task.task_description!.slice(0, 50) + '…'
                      : (task.task_description ?? '—')

                  return (
                    <tr
                      key={task.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {task.employee_id ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {employeeName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{task.quarter ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[140px] truncate">
                        {task.project_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {task.project_manager ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {task.task_id ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px]" title={task.task_description ?? ''}>
                        {descTrunc}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={cn('text-xs', statusClass)}>
                          {task.task_status ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={cn('text-xs', priorityClass)}>
                          {task.priority ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        {task.self_rating ? formatScore(task.self_rating) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        {task.pm_rating ? formatScore(task.pm_rating) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                        {task.final_task_score ? formatScore(task.final_task_score) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(task)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDelete(task)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingItem ? 'Edit Task' : 'Add Task'}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Employee ID" required>
              <Input
                value={formData.employee_id as string}
                onChange={(e) => handleFormChange('employee_id', e.target.value)}
                placeholder="e.g. EMP001"
              />
            </FormField>

            <FormField label="Fiscal Year">
              <Select
                value={formData.fiscal_year as string}
                onChange={(e) => handleFormChange('fiscal_year', e.target.value)}
              >
                {FISCAL_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Quarter">
              <Select
                value={formData.quarter as string}
                onChange={(e) => handleFormChange('quarter', e.target.value)}
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Task Status">
              <Select
                value={formData.task_status as string}
                onChange={(e) => handleFormChange('task_status', e.target.value)}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Project Name" required>
              <Input
                value={formData.project_name as string}
                onChange={(e) => handleFormChange('project_name', e.target.value)}
                placeholder="Project name"
              />
            </FormField>

            <FormField label="Project Manager">
              <Input
                value={formData.project_manager as string}
                onChange={(e) => handleFormChange('project_manager', e.target.value)}
                placeholder="PM name"
              />
            </FormField>

            <FormField label="Task ID" required>
              <Input
                value={formData.task_id as string}
                onChange={(e) => handleFormChange('task_id', e.target.value)}
                placeholder="e.g. TASK-001"
              />
            </FormField>

            <FormField label="Priority">
              <Select
                value={formData.priority as string}
                onChange={(e) => handleFormChange('priority', e.target.value)}
              >
                {['Low', 'Medium', 'High'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Task Description">
            <Textarea
              value={formData.task_description as string}
              onChange={(e) => handleFormChange('task_description', e.target.value)}
              placeholder="Describe the task…"
              rows={3}
            />
          </FormField>

          <FormField label="Planned Outcome">
            <Textarea
              value={formData.planned_outcome as string}
              onChange={(e) => handleFormChange('planned_outcome', e.target.value)}
              placeholder="What was planned…"
              rows={2}
            />
          </FormField>

          <FormField label="Actual Outcome">
            <Textarea
              value={formData.actual_outcome as string}
              onChange={(e) => handleFormChange('actual_outcome', e.target.value)}
              placeholder="What was achieved…"
              rows={2}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Self Rating (0–10)">
              <Input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={formData.self_rating as number}
                onChange={(e) => handleFormChange('self_rating', parseFloat(e.target.value) || 0)}
              />
            </FormField>

            <FormField label="PM Rating (0–10)">
              <Input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={formData.pm_rating as number}
                onChange={(e) => handleFormChange('pm_rating', parseFloat(e.target.value) || 0)}
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Task'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Task"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete task{' '}
            <span className="font-semibold text-gray-800">
              {deleteTarget?.task_id ?? ''}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={closeDeleteModal} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
