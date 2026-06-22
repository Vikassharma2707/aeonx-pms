'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { supabase, getSupabase, Employee } from '@/lib/supabase'
import { PRACTICES, EMPLOYMENT_TYPES, STATUS_COLORS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { Plus, Pencil, Trash2, Search, Mail } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type EmployeeFormData = {
  employee_id: string
  name: string
  designation: string
  practice: string
  location: string
  line_manager: string
  hire_date: string
  employment_type: string
  active_status: 'Active' | 'Inactive'
  appraisal_band: string
  email: string
}

const EMPTY_FORM: EmployeeFormData = {
  employee_id: '',
  name: '',
  designation: '',
  practice: '',
  location: '',
  line_manager: '',
  hire_date: '',
  employment_type: '',
  active_status: 'Active',
  appraisal_band: '',
  email: '',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState<EmployeeFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      setEmployees((data ?? []) as Employee[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  // Derived filtered list
  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      emp.name.toLowerCase().includes(q) ||
      emp.employee_id.toLowerCase().includes(q)
    const matchesPractice = !practiceFilter || emp.practice === practiceFilter
    const matchesStatus = !statusFilter || emp.active_status === statusFilter
    return matchesSearch && matchesPractice && matchesStatus
  })

  const activeCount = employees.filter((e) => e.active_status === 'Active').length

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setEditingEmployee(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(emp: Employee) {
    setEditingEmployee(emp)
    setFormData({
      employee_id: emp.employee_id,
      name: emp.name,
      designation: emp.designation ?? '',
      practice: emp.practice ?? '',
      location: emp.location ?? '',
      line_manager: emp.line_manager ?? '',
      hire_date: emp.hire_date ?? '',
      employment_type: emp.employment_type ?? '',
      active_status: emp.active_status,
      appraisal_band: emp.appraisal_band ?? '',
      email: emp.email ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingEmployee(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
  }

  function handleFormChange(field: keyof EmployeeFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!formData.employee_id.trim()) {
      setFormError('Employee ID is required')
      return
    }
    if (!formData.name.trim()) {
      setFormError('Name is required')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = {
        employee_id: formData.employee_id.trim(),
        name: formData.name.trim(),
        designation: formData.designation.trim() || null,
        practice: (formData.practice || null) as Employee['practice'],
        location: formData.location.trim() || null,
        line_manager: formData.line_manager.trim() || null,
        hire_date: formData.hire_date || null,
        employment_type: (formData.employment_type || null) as Employee['employment_type'],
        active_status: formData.active_status,
        appraisal_band: formData.appraisal_band.trim() || null,
        email: formData.email.trim() || null,
      }

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', editingEmployee.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert(payload)
        if (error) throw error
      }

      closeModal()
      await fetchEmployees()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save employee')
    } finally {
      setSaving(false)
    }
  }

  // ── Invite helper ─────────────────────────────────────────────────────────

  async function handleInvite(emp: Employee) {
    if (!emp.email) {
      alert('Employee has no email address. Please add one first.')
      return
    }
    if (!confirm(`Send login invite to ${emp.email}?`)) return
    try {
      const supabaseAdmin = getSupabase()
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(emp.email)
      if (error) throw error
      alert(`Invite sent to ${emp.email}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send invite')
    }
  }

  // ── Delete helpers ─────────────────────────────────────────────────────────

  function openDelete(emp: Employee) {
    setDeleteTarget(emp)
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
      const { error } = await supabase.from('employees').delete().eq('id', deleteTarget.id)
      if (error) throw error
      closeDeleteModal()
      await fetchEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee')
      closeDeleteModal()
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Employees" subtitle="Employee master and reporting lines" />

      <div className="flex-1 p-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              <span className="font-semibold text-gray-900">{employees.length}</span> total
            </span>
            <span className="text-gray-300">|</span>
            <span>
              <span className="font-semibold text-emerald-600">{activeCount}</span> active
            </span>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus size={16} className="mr-1.5" />
            Add Employee
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
              placeholder="Search name or ID…"
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
          <div className="w-40">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="All Statuses"
              options={[
                { label: 'Active', value: 'Active' },
                { label: 'Inactive', value: 'Inactive' },
              ]}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Designation</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Practice</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Line Manager
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Employment Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Appraisal Band
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400">
                      {employees.length === 0
                        ? 'No employees yet. Add your first employee.'
                        : 'No employees match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {emp.employee_id}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {emp.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{emp.designation ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.practice ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.location ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {emp.line_manager ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {emp.employment_type ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[emp.active_status] ?? ''}>
                          {emp.active_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{emp.appraisal_band ?? '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(emp)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleInvite(emp)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title={emp.email ? `Send login invite to ${emp.email}` : 'No email — add one first'}
                          >
                            <Mail size={15} />
                          </button>
                          <button
                            onClick={() => openDelete(emp)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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

            <FormField label="Full Name" required>
              <Input
                placeholder="Full name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
              />
            </FormField>

            <FormField label="Designation">
              <Input
                placeholder="e.g. Senior Consultant"
                value={formData.designation}
                onChange={(e) => handleFormChange('designation', e.target.value)}
              />
            </FormField>

            <FormField label="Practice">
              <Select
                value={formData.practice}
                onChange={(e) => handleFormChange('practice', e.target.value)}
                placeholder="Select practice"
                options={PRACTICES.map((p) => ({ label: p, value: p }))}
              />
            </FormField>

            <FormField label="Location">
              <Input
                placeholder="e.g. Bangalore"
                value={formData.location}
                onChange={(e) => handleFormChange('location', e.target.value)}
              />
            </FormField>

            <FormField label="Line Manager">
              <Input
                placeholder="Manager name"
                value={formData.line_manager}
                onChange={(e) => handleFormChange('line_manager', e.target.value)}
              />
            </FormField>

            <FormField label="Hire Date">
              <Input
                type="date"
                value={formData.hire_date}
                onChange={(e) => handleFormChange('hire_date', e.target.value)}
              />
            </FormField>

            <FormField label="Employment Type">
              <Select
                value={formData.employment_type}
                onChange={(e) => handleFormChange('employment_type', e.target.value)}
                placeholder="Select type"
                options={EMPLOYMENT_TYPES.map((t) => ({ label: t, value: t }))}
              />
            </FormField>

            <FormField label="Active Status">
              <Select
                value={formData.active_status}
                onChange={(e) =>
                  handleFormChange('active_status', e.target.value as 'Active' | 'Inactive')
                }
                options={[
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive', value: 'Inactive' },
                ]}
              />
            </FormField>

            <FormField label="Appraisal Band">
              <Input
                placeholder="e.g. Band 3"
                value={formData.appraisal_band}
                onChange={(e) => handleFormChange('appraisal_band', e.target.value)}
              />
            </FormField>

            <FormField label="Email" className="sm:col-span-2">
              <Input
                type="email"
                placeholder="work@aeonx.digital"
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingEmployee ? 'Save Changes' : 'Add Employee'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal} title="Delete Employee" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This action
            cannot be undone.
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
