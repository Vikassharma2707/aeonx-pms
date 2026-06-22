'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Goal } from '@/lib/supabase'
import {
  FISCAL_YEARS,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
  STATUS_COLORS,
  PRACTICES,
} from '@/lib/constants'
import { cn, formatDate, formatScore } from '@/lib/utils'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit2, Trash2, AlertCircle, AlertTriangle } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type GoalWithEmployee = Goal & {
  employees?: { name: string; practice: string } | null
}

type GoalFormData = {
  employee_id: string
  fiscal_year: string
  goal_category: string
  goal_description: string
  kpi_success_measure: string
  weightage_percent: number
  start_date: string
  due_date: string
  goal_status: Goal['goal_status']
  self_progress_percent: number
  self_rating: number
  lm_rating: number
  goal_comments: string
}

const EMPTY_FORM: GoalFormData = {
  employee_id: '',
  fiscal_year: '2026-27',
  goal_category: '',
  goal_description: '',
  kpi_success_measure: '',
  weightage_percent: 0,
  start_date: '',
  due_date: '',
  goal_status: 'Not Started',
  self_progress_percent: 0,
  self_rating: 0,
  lm_rating: 0,
  goal_comments: '',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('')
  const [fiscalYearFilter, setFiscalYearFilter] = useState('2026-27')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalWithEmployee | null>(null)
  const [formData, setFormData] = useState<GoalFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<GoalWithEmployee | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('goals')
        .select(`*, employees!goals_employee_id_fkey(name, practice)`)
        .order('employee_id', { ascending: true })
      if (error) throw error
      setGoals((data ?? []) as GoalWithEmployee[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  // Compute per (employee_id, fiscal_year) total weightage
  const weightMap: Record<string, number> = {}
  for (const g of goals) {
    const key = `${g.employee_id}__${g.fiscal_year}`
    weightMap[key] = (weightMap[key] ?? 0) + (g.weightage_percent ?? 0)
  }

  // Derived filtered list
  const filtered = goals.filter((g) => {
    const empName = (g as any).employees?.name ?? ''
    const empPractice = (g as any).employees?.practice ?? ''
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      g.employee_id.toLowerCase().includes(q) ||
      empName.toLowerCase().includes(q)
    const matchesPractice = !practiceFilter || empPractice === practiceFilter
    const matchesFiscalYear = !fiscalYearFilter || g.fiscal_year === fiscalYearFilter
    const matchesCategory = !categoryFilter || g.goal_category === categoryFilter
    const matchesStatus = !statusFilter || g.goal_status === statusFilter
    return matchesSearch && matchesPractice && matchesFiscalYear && matchesCategory && matchesStatus
  })

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setEditingGoal(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(goal: GoalWithEmployee) {
    setEditingGoal(goal)
    setFormData({
      employee_id: goal.employee_id,
      fiscal_year: goal.fiscal_year,
      goal_category: goal.goal_category ?? '',
      goal_description: goal.goal_description,
      kpi_success_measure: goal.kpi_success_measure ?? '',
      weightage_percent: goal.weightage_percent ?? 0,
      start_date: goal.start_date ?? '',
      due_date: goal.due_date ?? '',
      goal_status: goal.goal_status,
      self_progress_percent: goal.self_progress_percent ?? 0,
      self_rating: goal.self_rating ?? 0,
      lm_rating: goal.lm_rating ?? 0,
      goal_comments: goal.goal_comments ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingGoal(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
  }

  function handleFormChange(field: keyof GoalFormData, value: string | number) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!formData.employee_id.trim()) {
      setFormError('Employee ID is required')
      return
    }
    if (!formData.goal_description.trim()) {
      setFormError('Goal description is required')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const weightage = Number(formData.weightage_percent) || 0
      const lmRating = Number(formData.lm_rating) || 0
      const weighted_goal_score = (weightage / 100) * (lmRating / 5) * 100

      const payload = {
        employee_id: formData.employee_id.trim(),
        fiscal_year: formData.fiscal_year,
        goal_category: formData.goal_category || null,
        goal_description: formData.goal_description.trim(),
        kpi_success_measure: formData.kpi_success_measure.trim() || null,
        weightage_percent: weightage,
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
        goal_status: formData.goal_status,
        self_progress_percent: Number(formData.self_progress_percent) || 0,
        self_rating: Number(formData.self_rating) || 0,
        lm_rating: lmRating,
        weighted_goal_score,
        goal_comments: formData.goal_comments.trim() || null,
      }

      if (editingGoal) {
        const { error } = await supabase.from('goals').update(payload).eq('id', editingGoal.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('goals').insert(payload)
        if (error) throw error
      }

      closeModal()
      await fetchGoals()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save goal')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete helpers ─────────────────────────────────────────────────────────

  function openDelete(goal: GoalWithEmployee) {
    setDeleteTarget(goal)
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
      const { error } = await supabase.from('goals').delete().eq('id', deleteTarget.id)
      if (error) throw error
      closeDeleteModal()
      await fetchGoals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal')
      closeDeleteModal()
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const COLS = 15

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Goal Setting" subtitle="Annual goals set by consultants and line managers" />

      <div className="flex-1 p-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              <span className="font-semibold text-gray-900">{goals.length}</span> total goals
            </span>
            <span className="text-gray-300">|</span>
            <span>
              <span className="font-semibold text-blue-600">{filtered.length}</span> shown
            </span>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus size={16} className="mr-1.5" />
            Add Goal
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <Input
              placeholder="Search employee ID or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-44">
            <Select
              value={practiceFilter}
              onChange={(e) => setPracticeFilter(e.target.value)}
              placeholder="All Practices"
              options={PRACTICES.map((p) => ({ label: p, value: p }))}
            />
          </div>
          <div className="w-36">
            <Select
              value={fiscalYearFilter}
              onChange={(e) => setFiscalYearFilter(e.target.value)}
              placeholder="All Years"
              options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))}
            />
          </div>
          <div className="w-56">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="All Categories"
              options={GOAL_CATEGORIES.map((c) => ({ label: c, value: c }))}
            />
          </div>
          <div className="w-40">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="All Statuses"
              options={GOAL_STATUSES.map((s) => ({ label: s, value: s }))}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Employee ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Employee Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Practice</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Fiscal Year
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Goal Category
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Goal Description
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    KPI / Success Measure
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Wt %
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Start Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Due Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Goal Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Self %
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Self Rating
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    LM Rating
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Wtd Score
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      {Array.from({ length: COLS + 1 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLS + 1} className="text-center py-12 text-gray-400">
                      {goals.length === 0
                        ? 'No goals yet. Add the first goal.'
                        : 'No goals match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((goal) => {
                    const empName = (goal as any).employees?.name ?? '-'
                    const empPractice = (goal as any).employees?.practice ?? '-'
                    const weightKey = `${goal.employee_id}__${goal.fiscal_year}`
                    const totalWeight = weightMap[weightKey] ?? 0
                    const weightWarning = totalWeight !== 100

                    return (
                      <tr
                        key={goal.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                          {goal.employee_id}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {empName}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{empPractice}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {goal.fiscal_year}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap max-w-[160px] truncate">
                          {goal.goal_category ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                          <span
                            title={goal.goal_description}
                            className="block truncate"
                          >
                            {goal.goal_description.length > 50
                              ? goal.goal_description.slice(0, 50) + '…'
                              : goal.goal_description}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                          <span
                            title={goal.kpi_success_measure ?? ''}
                            className="block truncate"
                          >
                            {goal.kpi_success_measure
                              ? goal.kpi_success_measure.length > 40
                                ? goal.kpi_success_measure.slice(0, 40) + '…'
                                : goal.kpi_success_measure
                              : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                          <span className="flex items-center justify-end gap-1">
                            {goal.weightage_percent ?? 0}%
                            {weightWarning && (
                              <span
                                title={`Total weight for this employee/year is ${totalWeight}% (should be 100%)`}
                              >
                                <AlertTriangle
                                  size={13}
                                  className="text-amber-500 shrink-0"
                                />
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatDate(goal.start_date)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatDate(goal.due_date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge className={cn(STATUS_COLORS[goal.goal_status] ?? '')}>
                            {goal.goal_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {goal.self_progress_percent ?? 0}%
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {goal.self_rating ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {goal.lm_rating ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">
                          {formatScore(goal.weighted_goal_score)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(goal)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => openDelete(goal)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={15} />
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
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingGoal ? 'Edit Goal' : 'Add Goal'}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Employee ID" required>
              <Input
                placeholder="e.g. AX-001"
                value={formData.employee_id}
                onChange={(e) => handleFormChange('employee_id', e.target.value)}
              />
            </FormField>

            <FormField label="Fiscal Year" required>
              <Select
                value={formData.fiscal_year}
                onChange={(e) => handleFormChange('fiscal_year', e.target.value)}
                options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))}
              />
            </FormField>

            <FormField label="Goal Category" className="sm:col-span-2">
              <Select
                value={formData.goal_category}
                onChange={(e) => handleFormChange('goal_category', e.target.value)}
                placeholder="Select category"
                options={GOAL_CATEGORIES.map((c) => ({ label: c, value: c }))}
              />
            </FormField>

            <FormField label="Goal Description" required className="sm:col-span-2">
              <Textarea
                placeholder="Describe the goal…"
                value={formData.goal_description}
                onChange={(e) => handleFormChange('goal_description', e.target.value)}
                rows={3}
              />
            </FormField>

            <FormField label="KPI / Success Measure" className="sm:col-span-2">
              <Textarea
                placeholder="How will success be measured?"
                value={formData.kpi_success_measure}
                onChange={(e) => handleFormChange('kpi_success_measure', e.target.value)}
                rows={2}
              />
            </FormField>

            <FormField label="Weightage %">
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={formData.weightage_percent}
                onChange={(e) => handleFormChange('weightage_percent', Number(e.target.value))}
              />
            </FormField>

            <FormField label="Goal Status">
              <Select
                value={formData.goal_status}
                onChange={(e) =>
                  handleFormChange('goal_status', e.target.value as Goal['goal_status'])
                }
                options={GOAL_STATUSES.map((s) => ({ label: s, value: s }))}
              />
            </FormField>

            <FormField label="Start Date">
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleFormChange('start_date', e.target.value)}
              />
            </FormField>

            <FormField label="Due Date">
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => handleFormChange('due_date', e.target.value)}
              />
            </FormField>

            <FormField label="Self Progress %">
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={formData.self_progress_percent}
                onChange={(e) =>
                  handleFormChange('self_progress_percent', Number(e.target.value))
                }
              />
            </FormField>

            <FormField label="Self Rating (0–5)">
              <Input
                type="number"
                min={0}
                max={5}
                step={0.5}
                placeholder="0"
                value={formData.self_rating}
                onChange={(e) => handleFormChange('self_rating', Number(e.target.value))}
              />
            </FormField>

            <FormField label="LM Rating (0–5)">
              <Input
                type="number"
                min={0}
                max={5}
                step={0.5}
                placeholder="0"
                value={formData.lm_rating}
                onChange={(e) => handleFormChange('lm_rating', Number(e.target.value))}
              />
            </FormField>

            <FormField label="Comments" className="sm:col-span-2">
              <Textarea
                placeholder="Optional comments…"
                value={formData.goal_comments}
                onChange={(e) => handleFormChange('goal_comments', e.target.value)}
                rows={2}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingGoal ? 'Save Changes' : 'Add Goal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal} title="Delete Goal" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this goal for{' '}
            <span className="font-semibold text-gray-900">
              {(deleteTarget as any)?.employees?.name ?? deleteTarget?.employee_id}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closeDeleteModal} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Helper ───────────────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
  className,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
