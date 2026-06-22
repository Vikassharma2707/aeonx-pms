'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { FinalAppraisal } from '@/lib/supabase'
import {
  FISCAL_YEARS,
  REVIEW_STATUSES,
  FINAL_RATINGS,
  RECOMMENDED_ACTIONS,
  RATING_COLORS,
  STATUS_COLORS,
  PRACTICES,
  getFinalRating,
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
import { Plus, Search, Edit2, Trash2, AlertCircle, Download } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type AppraisalFormData = {
  employee_id: string
  fiscal_year: string
  annual_goal_score: number
  q1_pm_score: number
  q2_pm_score: number
  q3_pm_score: number
  q4_pm_score: number
  behavior_values_rating: number
  recommended_action: string
  calibration_notes: string
  review_status: string
}

const EMPTY_FORM: AppraisalFormData = {
  employee_id: '',
  fiscal_year: '2026-27',
  annual_goal_score: 0,
  q1_pm_score: 0,
  q2_pm_score: 0,
  q3_pm_score: 0,
  q4_pm_score: 0,
  behavior_values_rating: 0,
  recommended_action: '',
  calibration_notes: '',
  review_status: 'Draft',
}

// ── Derived calculations ───────────────────────────────────────────────────────

function calcAnnualPmAvg(q1: number, q2: number, q3: number, q4: number): number {
  const scores = [q1, q2, q3, q4].filter((s) => s > 0)
  if (scores.length === 0) return 0
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

function calcFinalScore(annualGoalScore: number, annualPmAvg: number, behaviorRating: number): number {
  // Goal Achievement 50%: normalize goal score (0-100%) to 0-5 scale
  const normalizedGoal = (annualGoalScore / 100) * 5
  return normalizedGoal * 0.5 + annualPmAvg * 0.3 + behaviorRating * 0.2
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportToCSV(rows: FinalAppraisal[]) {
  const headers = [
    'Employee ID',
    'Fiscal Year',
    'Annual Goal Score %',
    'Q1 PM',
    'Q2 PM',
    'Q3 PM',
    'Q4 PM',
    'Annual PM Avg',
    'Behavior/Values Rating',
    'Final Score',
    'Final Rating',
    'Recommended Action',
    'Calibration Status',
  ]
  const csvRows = rows.map((r) =>
    [
      r.employee_id,
      r.fiscal_year,
      r.annual_goal_score ?? '',
      r.q1_pm_score ?? '',
      r.q2_pm_score ?? '',
      r.q3_pm_score ?? '',
      r.q4_pm_score ?? '',
      r.annual_pm_avg != null ? r.annual_pm_avg.toFixed(2) : '',
      r.behavior_values_rating ?? '',
      r.final_score != null ? r.final_score.toFixed(2) : '',
      r.final_rating ?? '',
      r.recommended_action ?? '',
      r.review_status,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )

  const csv = [headers.join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `final_appraisals_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppraisalPage() {
  const [data, setData] = useState<FinalAppraisal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [fiscalYearFilter, setFiscalYearFilter] = useState('2026-27')
  const [finalRatingFilter, setFinalRatingFilter] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<FinalAppraisal | null>(null)
  const [formData, setFormData] = useState<AppraisalFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<FinalAppraisal | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('final_appraisals')
        .select(`*, employees!final_appraisals_employee_id_fkey(name, practice)`)
        .order('created_at', { ascending: false })
      if (err) throw err
      setData((rows ?? []) as FinalAppraisal[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load final appraisals')
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
    const matchesFinalRating = !finalRatingFilter || row.final_rating === finalRatingFilter
    const matchesPractice = !practiceFilter || empPractice === practiceFilter
    return matchesSearch && matchesFiscalYear && matchesFinalRating && matchesPractice
  })

  // ── Summary stats (based on filtered) ────────────────────────────────────

  const avgFinalScore =
    filtered.length > 0
      ? filtered.reduce((sum, r) => sum + (r.final_score ?? 0), 0) / filtered.length
      : null

  const outstandingCount = filtered.filter((r) => r.final_rating === 'Outstanding').length
  const belowExpectationsCount = filtered.filter(
    (r) => r.final_rating === 'Needs Improvement' || r.final_rating === 'Unsatisfactory'
  ).length

  // ── Derived form values ───────────────────────────────────────────────────

  const annualPmAvg = calcAnnualPmAvg(
    formData.q1_pm_score,
    formData.q2_pm_score,
    formData.q3_pm_score,
    formData.q4_pm_score
  )
  const finalScore = calcFinalScore(
    formData.annual_goal_score,
    annualPmAvg,
    formData.behavior_values_rating
  )
  const derivedFinalRating = getFinalRating(finalScore)

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditingItem(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: FinalAppraisal) {
    setEditingItem(item)
    setFormData({
      employee_id: item.employee_id,
      fiscal_year: item.fiscal_year,
      annual_goal_score: item.annual_goal_score ?? 0,
      q1_pm_score: item.q1_pm_score ?? 0,
      q2_pm_score: item.q2_pm_score ?? 0,
      q3_pm_score: item.q3_pm_score ?? 0,
      q4_pm_score: item.q4_pm_score ?? 0,
      behavior_values_rating: item.behavior_values_rating ?? 0,
      recommended_action: item.recommended_action ?? '',
      calibration_notes: item.calibration_notes ?? '',
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

  function handleFormChange(field: keyof AppraisalFormData, value: string | number) {
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
      const computed_annual_pm_avg = calcAnnualPmAvg(
        formData.q1_pm_score,
        formData.q2_pm_score,
        formData.q3_pm_score,
        formData.q4_pm_score
      )
      const computed_final_score = calcFinalScore(
        formData.annual_goal_score,
        computed_annual_pm_avg,
        formData.behavior_values_rating
      )
      const computed_final_rating = getFinalRating(computed_final_score)

      const payload = {
        employee_id: formData.employee_id.trim(),
        fiscal_year: formData.fiscal_year,
        annual_goal_score: formData.annual_goal_score,
        q1_pm_score: formData.q1_pm_score,
        q2_pm_score: formData.q2_pm_score,
        q3_pm_score: formData.q3_pm_score,
        q4_pm_score: formData.q4_pm_score,
        annual_pm_avg: computed_annual_pm_avg,
        behavior_values_rating: formData.behavior_values_rating,
        final_score: computed_final_score,
        final_rating: computed_final_rating as FinalAppraisal['final_rating'],
        recommended_action: (formData.recommended_action || null) as FinalAppraisal['recommended_action'],
        calibration_notes: formData.calibration_notes.trim() || null,
        review_status: formData.review_status as FinalAppraisal['review_status'],
      }

      if (editingItem) {
        const { error: err } = await supabase
          .from('final_appraisals')
          .update(payload)
          .eq('id', editingItem.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('final_appraisals').insert(payload)
        if (err) {
          if (err.code === '23505') {
            throw new Error(
              `A final appraisal already exists for employee "${payload.employee_id}" in fiscal year ${payload.fiscal_year}. Please edit the existing record instead.`
            )
          }
          throw err
        }
      }

      closeModal()
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save final appraisal')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  function openDelete(item: FinalAppraisal) {
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
        .from('final_appraisals')
        .delete()
        .eq('id', deleteTarget.id)
      if (err) throw err
      closeDeleteModal()
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete final appraisal')
      closeDeleteModal()
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Final Appraisal" subtitle="Annual performance score and rating" />

      <div className="flex-1 p-6 space-y-5">
        {/* Summary stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Records"
            value={String(filtered.length)}
            sub={`of ${data.length} total`}
            color="blue"
          />
          <StatCard
            label="Avg Final Score"
            value={avgFinalScore != null ? avgFinalScore.toFixed(2) : '—'}
            sub="across filtered records"
            color={avgFinalScore != null ? scoreToStatColor(avgFinalScore) : 'gray'}
          />
          <StatCard
            label="Outstanding"
            value={String(outstandingCount)}
            sub="employees"
            color="green"
          />
          <StatCard
            label="Needs Improvement / Below"
            value={String(belowExpectationsCount)}
            sub="employees"
            color={belowExpectationsCount > 0 ? 'red' : 'gray'}
          />
        </div>

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(filtered)}
              disabled={filtered.length === 0}
            >
              <Download size={15} className="mr-1.5" />
              Export CSV
            </Button>
            <Button onClick={openAdd} size="sm">
              <Plus size={16} className="mr-1.5" />
              Add Appraisal
            </Button>
          </div>
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
          <div className="w-52">
            <Select
              value={finalRatingFilter}
              onChange={(e) => setFinalRatingFilter(e.target.value)}
              placeholder="All Ratings"
              options={FINAL_RATINGS.map((r) => ({ label: r, value: r }))}
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
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Annual Goal %</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Q1 PM</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Q2 PM</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Q3 PM</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Q4 PM</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Annual PM Avg</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Behavior Rating</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Final Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Final Rating</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Recommended Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Calibration Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      {Array.from({ length: 16 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center py-12 text-gray-400">
                      {data.length === 0
                        ? 'No final appraisals yet. Add the first one.'
                        : 'No records match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const empName: string = (row as any).employees?.name ?? '-'
                    const empPractice: string = (row as any).employees?.practice ?? '-'
                    const score = row.final_score ?? null
                    const computedPmAvg = calcAnnualPmAvg(
                      row.q1_pm_score ?? 0,
                      row.q2_pm_score ?? 0,
                      row.q3_pm_score ?? 0,
                      row.q4_pm_score ?? 0
                    )
                    const displayPmAvg = row.annual_pm_avg ?? computedPmAvg

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
                          {row.annual_goal_score != null ? `${row.annual_goal_score}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.q1_pm_score ? row.q1_pm_score.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.q2_pm_score ? row.q2_pm_score.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.q3_pm_score ? row.q3_pm_score.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.q4_pm_score ? row.q4_pm_score.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {displayPmAvg ? displayPmAvg.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {row.behavior_values_rating ? row.behavior_values_rating.toFixed(1) : '-'}
                        </td>
                        <td className={cn('px-4 py-3 text-right font-semibold', score != null ? getScoreColor(score) : 'text-gray-400')}>
                          {score != null ? formatScore(score) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {row.final_rating ? (
                            <Badge className={cn(RATING_COLORS[row.final_rating] ?? '')}>
                              {row.final_rating}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {row.recommended_action ?? '-'}
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
        title={editingItem ? 'Edit Final Appraisal' : 'Add Final Appraisal'}
        size="xl"
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
              Performance Scores
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <FormField label="Annual Goal Score (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.annual_goal_score}
                  onChange={(e) =>
                    handleFormChange('annual_goal_score', parseFloat(e.target.value) || 0)
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

              <FormField label="Q3 PM Score (0–5)">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.q3_pm_score}
                  onChange={(e) =>
                    handleFormChange('q3_pm_score', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Q4 PM Score (0–5)">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.q4_pm_score}
                  onChange={(e) =>
                    handleFormChange('q4_pm_score', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Annual PM Avg (auto)">
                <Input
                  type="number"
                  value={annualPmAvg.toFixed(2)}
                  readOnly
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </FormField>

              <FormField label="Behavior / Values Rating (1–5)">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={0.5}
                  value={formData.behavior_values_rating}
                  onChange={(e) =>
                    handleFormChange('behavior_values_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>
            </div>

            {/* Computed final score & rating preview */}
            <div className="mt-3 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-gray-500 mr-2">Final Score (auto):</span>
                <span className={cn('text-lg font-bold', getScoreColor(finalScore))}>
                  {finalScore.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 mr-2">Final Rating (auto):</span>
                {derivedFinalRating ? (
                  <Badge className={cn(RATING_COLORS[derivedFinalRating] ?? '')}>
                    {derivedFinalRating}
                  </Badge>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
              <span className="text-gray-400 text-xs">
                = Goal×50% + Annual PM×30% + Behavior×20%
              </span>
            </div>
          </div>

          {/* Section: Review */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Review & Decision
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Recommended Action">
                <Select
                  value={formData.recommended_action}
                  onChange={(e) => handleFormChange('recommended_action', e.target.value)}
                  placeholder="Select action…"
                  options={RECOMMENDED_ACTIONS.map((a) => ({ label: a, value: a }))}
                />
              </FormField>

              <FormField label="Calibration Status">
                <Select
                  value={formData.review_status}
                  onChange={(e) => handleFormChange('review_status', e.target.value)}
                  options={REVIEW_STATUSES.map((s) => ({ label: s, value: s }))}
                />
              </FormField>

              <FormField label="Calibration Notes" className="sm:col-span-2">
                <Textarea
                  placeholder="Add calibration notes or committee comments…"
                  value={formData.calibration_notes}
                  onChange={(e) => handleFormChange('calibration_notes', e.target.value)}
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
              {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Appraisal'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Final Appraisal"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the final appraisal for{' '}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreToStatColor(score: number): 'green' | 'yellow' | 'red' | 'gray' {
  if (score >= 4.5) return 'green'
  if (score >= 3.5) return 'green'
  if (score >= 2.5) return 'yellow'
  if (score >= 1.5) return 'yellow'
  return 'red'
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray'
}) {
  const valueColors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-amber-600',
    red: 'text-red-600',
    gray: 'text-gray-500',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', valueColors[color])}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

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
