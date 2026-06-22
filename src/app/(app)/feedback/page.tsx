'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { QuarterlyFeedback } from '@/lib/supabase'
import { FISCAL_YEARS, QUARTERS, REVIEW_STATUSES, STATUS_COLORS, PRACTICES } from '@/lib/constants'
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

type FeedbackFormData = {
  employee_id: string
  fiscal_year: string
  quarter: string
  project_name: string
  project_manager: string
  allocation_percent: number
  delivery_rating: number
  timeliness_rating: number
  technical_rating: number
  communication_rating: number
  ownership_rating: number
  customer_focus_rating: number
  process_compliance_rating: number
  review_status: string
  key_strengths: string
  improvement_areas: string
}

const EMPTY_FORM: FeedbackFormData = {
  employee_id: '',
  fiscal_year: '2026-27',
  quarter: 'Q1',
  project_name: '',
  project_manager: '',
  allocation_percent: 100,
  delivery_rating: 0,
  timeliness_rating: 0,
  technical_rating: 0,
  communication_rating: 0,
  ownership_rating: 0,
  customer_focus_rating: 0,
  process_compliance_rating: 0,
  review_status: 'Pending',
  key_strengths: '',
  improvement_areas: '',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [data, setData] = useState<QuarterlyFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [quarterFilter, setQuarterFilter] = useState('')
  const [fiscalYearFilter, setFiscalYearFilter] = useState('2026-27')
  const [reviewStatusFilter, setReviewStatusFilter] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<QuarterlyFeedback | null>(null)
  const [formData, setFormData] = useState<FeedbackFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<QuarterlyFeedback | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('quarterly_feedback')
        .select(`*, employees!quarterly_feedback_employee_id_fkey(name, practice)`)
        .order('created_at', { ascending: false })
      if (err) throw err
      setData((rows ?? []) as QuarterlyFeedback[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  // Derived filtered list
  const filtered = data.filter((fb) => {
    const q = search.toLowerCase()
    const empName: string = (fb as any).employees?.name ?? ''
    const empPractice: string = (fb as any).employees?.practice ?? ''
    const matchesSearch =
      !q ||
      fb.employee_id.toLowerCase().includes(q) ||
      empName.toLowerCase().includes(q)
    const matchesQuarter = !quarterFilter || fb.quarter === quarterFilter
    const matchesFiscalYear = !fiscalYearFilter || fb.fiscal_year === fiscalYearFilter
    const matchesReviewStatus = !reviewStatusFilter || fb.review_status === reviewStatusFilter
    const matchesPractice = !practiceFilter || empPractice === practiceFilter
    return matchesSearch && matchesQuarter && matchesFiscalYear && matchesReviewStatus && matchesPractice
  })

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditingItem(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(item: QuarterlyFeedback) {
    setEditingItem(item)
    setFormData({
      employee_id: item.employee_id,
      fiscal_year: item.fiscal_year,
      quarter: item.quarter,
      project_name: item.project_name,
      project_manager: item.project_manager ?? '',
      allocation_percent: item.allocation_percent ?? 100,
      delivery_rating: item.delivery_rating ?? 0,
      timeliness_rating: item.timeliness_rating ?? 0,
      technical_rating: item.technical_rating ?? 0,
      communication_rating: item.communication_rating ?? 0,
      ownership_rating: item.ownership_rating ?? 0,
      customer_focus_rating: item.customer_focus_rating ?? 0,
      process_compliance_rating: item.process_compliance_rating ?? 0,
      review_status: item.review_status,
      key_strengths: item.key_strengths ?? '',
      improvement_areas: item.improvement_areas ?? '',
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

  function handleFormChange(field: keyof FeedbackFormData, value: string | number) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!formData.employee_id.trim()) {
      setFormError('Employee ID is required')
      return
    }
    if (!formData.project_name.trim()) {
      setFormError('Project name is required')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const ratings = [
        formData.delivery_rating,
        formData.timeliness_rating,
        formData.technical_rating,
        formData.communication_rating,
        formData.ownership_rating,
        formData.customer_focus_rating,
        formData.process_compliance_rating,
      ]
      const nonZero = ratings.filter((r) => r > 0)
      const overall_pm_score =
        nonZero.length > 0
          ? nonZero.reduce((sum, r) => sum + r, 0) / nonZero.length
          : 0
      const weighted_pm_score = overall_pm_score * (formData.allocation_percent / 100)

      const payload = {
        employee_id: formData.employee_id.trim(),
        fiscal_year: formData.fiscal_year,
        quarter: formData.quarter as QuarterlyFeedback['quarter'],
        project_name: formData.project_name.trim(),
        project_manager: formData.project_manager.trim() || null,
        allocation_percent: formData.allocation_percent,
        delivery_rating: formData.delivery_rating,
        timeliness_rating: formData.timeliness_rating,
        technical_rating: formData.technical_rating,
        communication_rating: formData.communication_rating,
        ownership_rating: formData.ownership_rating,
        customer_focus_rating: formData.customer_focus_rating,
        process_compliance_rating: formData.process_compliance_rating,
        overall_pm_score,
        weighted_pm_score,
        review_status: formData.review_status as QuarterlyFeedback['review_status'],
        key_strengths: formData.key_strengths.trim() || null,
        improvement_areas: formData.improvement_areas.trim() || null,
      }

      if (editingItem) {
        const { error: err } = await supabase
          .from('quarterly_feedback')
          .update(payload)
          .eq('id', editingItem.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('quarterly_feedback').insert(payload)
        if (err) throw err
      }

      closeModal()
      await fetchFeedback()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save feedback')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  function openDelete(item: QuarterlyFeedback) {
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
        .from('quarterly_feedback')
        .delete()
        .eq('id', deleteTarget.id)
      if (err) throw err
      closeDeleteModal()
      await fetchFeedback()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feedback')
      closeDeleteModal()
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="PM Feedback" subtitle="Project manager quarterly performance feedback" />

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
            Add Feedback
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
              value={quarterFilter}
              onChange={(e) => setQuarterFilter(e.target.value)}
              placeholder="All Quarters"
              options={QUARTERS.map((q) => ({ label: q, value: q }))}
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Employee ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Employee Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Quarter</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Project Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Project Manager
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Alloc %
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Delivery</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Timeliness</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Technical</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Comm</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Ownership</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Cust Focus
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Process</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Overall PM Score
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Review Status
                  </th>
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
                        ? 'No feedback records yet. Add the first one.'
                        : 'No records match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((fb) => {
                    const empName: string = (fb as any).employees?.name ?? '-'
                    const ratings = [
                      fb.delivery_rating ?? 0,
                      fb.timeliness_rating ?? 0,
                      fb.technical_rating ?? 0,
                      fb.communication_rating ?? 0,
                      fb.ownership_rating ?? 0,
                      fb.customer_focus_rating ?? 0,
                      fb.process_compliance_rating ?? 0,
                    ]
                    const nonZero = ratings.filter((r) => r > 0)
                    const computedOverall =
                      nonZero.length > 0
                        ? nonZero.reduce((s, r) => s + r, 0) / nonZero.length
                        : null

                    return (
                      <tr
                        key={fb.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {fb.employee_id}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {empName}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{fb.quarter}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {fb.project_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {fb.project_manager ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fb.allocation_percent != null ? `${fb.allocation_percent}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fb.delivery_rating ? fb.delivery_rating.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fb.timeliness_rating ? fb.timeliness_rating.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fb.technical_rating ? fb.technical_rating.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fb.communication_rating ? fb.communication_rating.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fb.ownership_rating ? fb.ownership_rating.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fb.customer_focus_rating ? fb.customer_focus_rating.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fb.process_compliance_rating
                            ? fb.process_compliance_rating.toFixed(1)
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {computedOverall != null ? computedOverall.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={cn(STATUS_COLORS[fb.review_status] ?? '')}>
                            {fb.review_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(fb)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => openDelete(fb)}
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
        title={editingItem ? 'Edit Feedback' : 'Add Feedback'}
        size="xl"
      >
        <div className="space-y-5">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              {formError}
            </div>
          )}

          {/* Section: Basic Info */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Basic Info
            </h3>
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

              <FormField label="Quarter" required>
                <Select
                  value={formData.quarter}
                  onChange={(e) => handleFormChange('quarter', e.target.value)}
                  options={QUARTERS.map((q) => ({ label: q, value: q }))}
                />
              </FormField>

              <FormField label="Allocation %" required>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.allocation_percent}
                  onChange={(e) =>
                    handleFormChange('allocation_percent', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Project Name" required>
                <Input
                  placeholder="Project name"
                  value={formData.project_name}
                  onChange={(e) => handleFormChange('project_name', e.target.value)}
                />
              </FormField>

              <FormField label="Project Manager">
                <Input
                  placeholder="PM name"
                  value={formData.project_manager}
                  onChange={(e) => handleFormChange('project_manager', e.target.value)}
                />
              </FormField>
            </div>
          </div>

          {/* Section: Ratings */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Ratings (0–5)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField label="Delivery">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.delivery_rating}
                  onChange={(e) =>
                    handleFormChange('delivery_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Timeliness">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.timeliness_rating}
                  onChange={(e) =>
                    handleFormChange('timeliness_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Technical">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.technical_rating}
                  onChange={(e) =>
                    handleFormChange('technical_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Communication">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.communication_rating}
                  onChange={(e) =>
                    handleFormChange('communication_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Ownership">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.ownership_rating}
                  onChange={(e) =>
                    handleFormChange('ownership_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Customer Focus">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.customer_focus_rating}
                  onChange={(e) =>
                    handleFormChange('customer_focus_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>

              <FormField label="Process Compliance">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={formData.process_compliance_rating}
                  onChange={(e) =>
                    handleFormChange('process_compliance_rating', parseFloat(e.target.value) || 0)
                  }
                />
              </FormField>
            </div>
          </div>

          {/* Section: Review & Comments */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Review & Comments
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Review Status">
                <Select
                  value={formData.review_status}
                  onChange={(e) => handleFormChange('review_status', e.target.value)}
                  options={REVIEW_STATUSES.map((s) => ({ label: s, value: s }))}
                />
              </FormField>

              <FormField label="Key Strengths" className="sm:col-span-2">
                <Textarea
                  placeholder="Describe key strengths…"
                  value={formData.key_strengths}
                  onChange={(e) => handleFormChange('key_strengths', e.target.value)}
                  rows={3}
                />
              </FormField>

              <FormField label="Improvement Areas" className="sm:col-span-2">
                <Textarea
                  placeholder="Describe improvement areas…"
                  value={formData.improvement_areas}
                  onChange={(e) => handleFormChange('improvement_areas', e.target.value)}
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
              {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Feedback'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Feedback"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the feedback record for{' '}
            <span className="font-semibold text-gray-900">
              {deleteTarget?.employee_id}
            </span>{' '}
            ({deleteTarget?.quarter} {deleteTarget?.fiscal_year})? This action cannot be undone.
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
