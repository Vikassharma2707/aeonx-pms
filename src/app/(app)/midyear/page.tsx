'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MidYearReview } from '@/lib/supabase'
import {
  FISCAL_YEARS,
  REVIEW_STATUSES,
  PRACTICES,
  STATUS_COLORS,
  getScoreColor,
} from '@/lib/constants'
import { cn, formatScore } from '@/lib/utils'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit2, Trash2, AlertCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type MidYearFormData = {
  employee_id: string
  fiscal_year: string
  goal_weight_check: number
  avg_goal_progress_percent: number
  q1_pm_score: number
  q2_pm_score: number
  lm_mid_year_rating: number
  potential: string
  key_strengths: string
  development_actions: string
  review_status: string
}

const EMPTY_FORM: MidYearFormData = {
  employee_id: '',
  fiscal_year: '2026-27',
  goal_weight_check: 100,
  avg_goal_progress_percent: 0,
  q1_pm_score: 0,
  q2_pm_score: 0,
  lm_mid_year_rating: 0,
  potential: '',
  key_strengths: '',
  development_actions: '',
  review_status: 'Draft',
}

// ── Derived calculations ───────────────────────────────────────────────────────

function calcH1PmAvg(q1: number, q2: number): number {
  const scores = [q1, q2].filter((s) => s > 0)
  if (scores.length === 0) return 0
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

function calcMidYearOverallScore(
  avgGoalProgress: number,
  h1PmAvg: number,
  lmRating: number
): number {
  // Goal Achievement 50%: normalize goal progress (0-100%) to 0-5 scale
  const normalizedGoal = (avgGoalProgress / 100) * 5
  return normalizedGoal * 0.5 + h1PmAvg * 0.3 + lmRating * 0.2
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MidYearPage() {
  const [data, setData] = useState<MidYearReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [fiscalYearFilter, setFiscalYearFilter] = useState('2026-27')
  const [reviewStatusFilter, setReviewStatusFilter] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MidYearReview | null>(null)
  const [formData, setFormData] = useState<MidYearFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MidYearReview | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('mid_year_reviews')
        .select(`*, employees!mid_year_reviews_employee_id_fkey(name, practice)`)
        .order('created_at', { ascending: false })
      if (err) throw err
      setData((rows ?? []) as MidYearReview[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mid-year reviews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Derived filtered list
  const filtered = data.filter((row) => {
    const q = search.toLowerCase()
    const empName: string = (row as any).employees?.name ?? ''
    const empPractice: string = (row as any).employees?.practice ?? ''
    const matchesSearch =
      !q ||
      row.employee_id.toLowerCase().includes(q) ||
      empName.toLowerCase().includes(q)
    const matchesFiscalYear = !fiscalYearFilter || row.fiscal_year === fiscalYearFilter
    const matchesReviewStatus = !reviewStatusFilter || row.review_status === reviewStatusFilter
    const matchesPractice = !practiceFilter || empPractice === practiceFilter
    return matchesSearch && matchesFiscalYear && matchesReviewStatus && matchesPractice
  })

  // ── Derived form values ───────────────────────────────────────────────────

  const h1PmAvg = calcH1PmAvg(formData.q1_pm_score, formData.q2_pm_score)
  const midYearOverallScore = calcMidYearOverallScore(
    formData.avg_goal_progress_percent,
    h1PmAvg,
    formData.lm_mid_year_rating
  )

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditingItem(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: MidYearReview) {
    setEditingItem(item)
    setFormData({
      employee_id: item.employee_id,
      fiscal_year: item.fiscal_year,
      goal_weight_check: item.goal_weight_check ?? 100,
      avg_goal_progress_percent: item.avg_goal_progress_percent ?? 0,
      q1_pm_score: item.q1_pm_score ?? 0,
      q2_pm_score: item.q2_pm_score ?? 0,
      lm_mid_year_rating: item.lm_mid_year_rating ?? 0,
      potential: item.potential ?? '',
      key_strengths: item.key_strengths ?? '',
      development_actions: item.development_actions ?? '',
      review_status: item.review_status,
    })
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
  }

  function handleFormChange(field: keyof MidYearFormData, value: string | number) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!formData.employee_id.trim()) {
      setFormError('Employee ID is required')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const computed_h1_pm_avg = calcH1PmAvg(formData.q1_pm_score, formData.q2_pm_score)
      const computed_score = calcMidYearOverallScore(
        formData.avg_goal_progress_percent,
        computed_h1_pm_avg,
        formData.lm_mid_year_rating
      )

      const payload = {
        employee_id: formData.employee_id.trim(),
        fiscal_year: formData.fiscal_year,
        goal_weight_check: formData.goal_weight_check,
        avg_goal_progress_percent: formData.avg_goal_progress_percent,
        q1_pm_score: formData.q1_pm_score,
        q2_pm_score: formData.q2_pm_score,
        h1_pm_avg: computed_h1_pm_avg,
        lm_mid_year_rating: formData.lm_mid_year_rating,
        mid_year_overall_score: computed_score,
        potential: formData.potential.trim() || null,
        key_strengths: formData.key_strengths.trim() || null,
        development_actions: formData.development_actions.trim() || null,
        review_status: formData.review_status as MidYearReview['review_status'],
      }

      if (editingItem) {
        const { error: err } = await supabase
          .from('mid_year_reviews')
          .update(payload)
          .eq('id', editingItem.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('mid_year_reviews').insert(payload)
        if (err) {
          // Surface unique constraint violation clearly
          if (err.code === '23505') {
            throw new Error(
              `A mid-year review already exists for employee "${payload.employee_id}" in fiscal year ${payload.fiscal_year}. Please edit the existing record instead.`
            )
          }
          throw err
        }
      }

      closeModal()
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save mid-year review')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  function openDelete(item: MidYearReview) {
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
        .from('mid_year_reviews')
        .delete()
        .eq('id', deleteTarget.id)
      if (err) throw err
      closeDeleteModal()
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mid-year review')
      closeDeleteModal()
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Mid-Year Review" subtitle="Half-year review by line manager" />

      <div className="flex-1 p-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              <span className="font-semibold text-gray-900">{data.length}</span> total
            </span>
            <span className="text-gray-300">|</span>
            <span>
              <span className="font-semibold text-blue-600">{filtered.length}</span> shown
            </span>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus size={16} className="mr-1.5" />
            Add Review
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
          <div className="w-36">
            <Select
              value={fiscalYearFilter}
              onChange={(e) => setFiscalYearFilter(e.target.value)}
              placeholder="All Years"
              options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))}
            />
          </div>
          <div className="w-40">
            <Select
              value={reviewStatusFilter}
              onChange={(e) => setReviewStatusFilter(e.target.value)}
              placeholder="All Statuses"
              options={REVIEW_STATUSES.map((s) => ({ label: s, value: s }))}
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
        </div>

        {/* Error banner */}
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Employee ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Employee Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Practice</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Fiscal Year</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Goal Weight Check</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Avg Goal %</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Q1 PM</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Q2 PM</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">H1 PM Avg</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">LM Rating</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Overall Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Potential</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Review Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      {Array.from({ length: 14 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-12 text-gray-400">
                      {data.length === 0
                        ? 'No mid-year reviews yet. Add the first one.'
                        : 'No records match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const empName: string = (row as any).employees?.name ?? '-'
                    const empPractice: string = (row as any).employees?.practice ?? '-'
                    const computedH1 = calcH1PmAvg(row.q1_pm_score ?? 0, row.q2_pm_score ?? 0)
                    const displayH1 = row.h1_pm_avg ?? computedH1
                    const score = row.mid_year_overall_score ?? null

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.employee_id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{empName}</td>
                        <td className="px-4 py-3 text-gray-600">{empPractice}</td>
                        <td className="px-4 py-3 text-gray-600">{row.fiscal_year}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.goal_weight_check != null ? `${row.goal_weight_check}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.avg_goal_progress_percent != null
                            ? `${row.avg_goal_progress_percent}%`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.q1_pm_score ? row.q1_pm_score.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.q2_pm_score ? row.q2_pm_score.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {displayH1 ? displayH1.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.lm_mid_year_rating ? row.lm_mid_year_rating.toFixed(1) : '-'}
                        </td>
                        <td className={cn('px-4 py-3 text-right font-semibold', score != null ? getScoreColor(score) : 'text-gray-400')}>
                          {score != null ? formatScore(score) : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate" title={row.potential ?? ''}>
                          {row.potential ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={cn(STATUS_COLORS[row.review_status] ?? '')}>
                            {row.review_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(row)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => openDelete(row)}
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
        title={editingItem ? 'Edit Mid-Year Review' : 'Add Mid-Year Review'}
        size="lg"
      >
        <div className="space-y-5">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              {formError}
            </div>
          )}

          {/* Section: Identity */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Employee ID" required>
                <Input
                  placeholder="e.g. AX-001"
                  value={formData.employee_id}
                  onChange={(e) => handleFormChange('employee_id', e.target.value)}
                  disabled={!!editingItem}
                />
              </FormField>

              <FormField label="Fiscal Year" required>
                <Select
                  value={formData.fiscal_year}
                  onChange={(e) => handleFormChange('fiscal_year', e.target.value)}
                  options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))}
                  disabled={!!editingItem}
                />
              </FormField>
            </div>
          </div>

          {/* Section: Goal & PM Scores */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Scores
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <FormField label="Goal Weight Check (%)">
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={formData.goal_weight_check}
                  onChange={(e) =>
                    handleFormChange('goal_weight_check', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Avg Goal Progress (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.avg_goal_progress_percent}
                  onChange={(e) =>
                    handleFormChange('avg_goal_progress_percent', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Q1 PM Score (0–5)">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.q1_pm_score}
                  onChange={(e) =>
                    handleFormChange('q1_pm_score', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Q2 PM Score (0–5)">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.q2_pm_score}
                  onChange={(e) =>
                    handleFormChange('q2_pm_score', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="H1 PM Avg (auto)">
                <Input
                  type="number"
                  value={h1PmAvg.toFixed(2)}
                  readOnly
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </FormField>

              <FormField label="LM Mid-Year Rating (1–5)">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={0.5}
                  value={formData.lm_mid_year_rating}
                  onChange={(e) =>
                    handleFormChange('lm_mid_year_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>
            </div>

            {/* Computed overall score preview */}
            <div className="mt-3 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-4 text-sm">
              <span className="text-gray-500">Mid-Year Overall Score (auto):</span>
              <span className={cn('text-lg font-bold', getScoreColor(midYearOverallScore))}>
                {midYearOverallScore.toFixed(2)}
              </span>
              <span className="text-gray-400 text-xs">
                = Goal×50% + H1 PM×30% + LM Rating×20%
              </span>
            </div>
          </div>

          {/* Section: Qualitative */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Qualitative
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Potential">
                <Input
                  placeholder="e.g. High, Medium, Low"
                  value={formData.potential}
                  onChange={(e) => handleFormChange('potential', e.target.value)}
                />
              </FormField>

              <FormField label="Review Status">
                <Select
                  value={formData.review_status}
                  onChange={(e) => handleFormChange('review_status', e.target.value)}
                  options={REVIEW_STATUSES.map((s) => ({ label: s, value: s }))}
                />
              </FormField>

              <FormField label="Key Strengths" className="sm:col-span-2">
                <Textarea
                  placeholder="Describe key strengths observed in H1…"
                  value={formData.key_strengths}
                  onChange={(e) => handleFormChange('key_strengths', e.target.value)}
                  rows={3}
                />
              </FormField>

              <FormField label="Development Actions" className="sm:col-span-2">
                <Textarea
                  placeholder="Recommended development actions for H2…"
                  value={formData.development_actions}
                  onChange={(e) => handleFormChange('development_actions', e.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Review'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Mid-Year Review"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the mid-year review for{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.employee_id}</span>{' '}
            ({deleteTarget?.fiscal_year})? This action cannot be undone.
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

// ── Helper ────────────────────────────────────────────────────────────────────

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
