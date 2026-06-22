'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { supabase, Employee } from '@/lib/supabase'
import { PRACTICES, EMPLOYMENT_TYPES, STATUS_COLORS } from '@/lib/constants'
import { Plus, Pencil, Trash2, Search, Mail, Upload, Download, CheckCircle, XCircle, Loader2 } from 'lucide-react'

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
  employee_id: '', name: '', designation: '', practice: '', location: '',
  line_manager: '', hire_date: '', employment_type: '', active_status: 'Active',
  appraisal_band: '', email: '',
}

type UploadRow = {
  employee_id: string; name: string; designation: string; practice: string;
  location: string; line_manager: string; hire_date: string; employment_type: string;
  appraisal_band: string; email: string;
}
type UploadResult = { row: UploadRow; status: 'success' | 'error'; message?: string }
type InviteResult = { email: string; status: 'invited' | 'error'; message?: string }

// ── CSV Template ──────────────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = ['employee_id','name','designation','practice','location','line_manager','hire_date','employment_type','appraisal_band','email']
  const example = ['AX-001','Jane Smith','Senior Consultant','SAP','Mumbai','John Manager','2024-01-15','Full Time','Band 3','jane.smith@aeonx.digital']
  const csv = [headers.join(','), example.join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'AeonX_Employee_Upload_Template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): UploadRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj as unknown as UploadRow
  }).filter(r => r.employee_id || r.name)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [practiceFilter, setPracticeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState<EmployeeFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Bulk upload state
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<UploadRow[]>([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResults, setBulkResults] = useState<UploadResult[]>([])
  const [inviteResults, setInviteResults] = useState<InviteResult[]>([])
  const [bulkStep, setBulkStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('employees').select('*').order('name', { ascending: true })
      if (error) throw error
      setEmployees((data ?? []) as Employee[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase()
    return (
      (!q || emp.name.toLowerCase().includes(q) || emp.employee_id.toLowerCase().includes(q)) &&
      (!practiceFilter || emp.practice === practiceFilter) &&
      (!statusFilter || emp.active_status === statusFilter)
    )
  })

  const activeCount = employees.filter((e) => e.active_status === 'Active').length

  // ── Single add/edit ─────────────────────────────────────────────────────────

  function openAdd() { setEditingEmployee(null); setFormData(EMPTY_FORM); setFormError(null); setModalOpen(true) }
  function openEdit(emp: Employee) {
    setEditingEmployee(emp)
    setFormData({
      employee_id: emp.employee_id, name: emp.name, designation: emp.designation ?? '',
      practice: emp.practice ?? '', location: emp.location ?? '', line_manager: emp.line_manager ?? '',
      hire_date: emp.hire_date ?? '', employment_type: emp.employment_type ?? '',
      active_status: emp.active_status, appraisal_band: emp.appraisal_band ?? '', email: emp.email ?? '',
    })
    setFormError(null); setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditingEmployee(null); setFormData(EMPTY_FORM); setFormError(null) }
  function handleFormChange(field: keyof EmployeeFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!formData.employee_id.trim()) { setFormError('Employee ID is required'); return }
    if (!formData.name.trim()) { setFormError('Name is required'); return }
    setSaving(true); setFormError(null)
    try {
      const payload = {
        employee_id: formData.employee_id.trim(), name: formData.name.trim(),
        designation: formData.designation.trim() || null,
        practice: (formData.practice || null) as Employee['practice'],
        location: formData.location.trim() || null, line_manager: formData.line_manager.trim() || null,
        hire_date: formData.hire_date || null,
        employment_type: (formData.employment_type || null) as Employee['employment_type'],
        active_status: formData.active_status, appraisal_band: formData.appraisal_band.trim() || null,
        email: formData.email.trim() || null,
      }
      if (editingEmployee) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingEmployee.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('employees').insert(payload)
        if (error) throw error
      }
      closeModal(); await fetchEmployees()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save employee')
    } finally { setSaving(false) }
  }

  // ── Invite single ──────────────────────────────────────────────────────────

  async function handleInvite(emp: Employee) {
    if (!emp.email) { alert('No email address. Add one first.'); return }
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [emp.email] }),
      })
      const { results } = await res.json()
      const r = results?.[0]
      if (r?.status === 'invited') {
        alert(`Invite sent to ${emp.email}. They will receive a login link.`)
      } else {
        alert(`Invite failed: ${r?.message ?? 'Unknown error'}\n\nNote: If SUPABASE_SERVICE_ROLE_KEY is not set in .env.local, manual invite from Supabase dashboard is required.`)
      }
    } catch {
      alert('Could not send invite. Check that SUPABASE_SERVICE_ROLE_KEY is configured in .env.local')
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(emp: Employee) { setDeleteTarget(emp); setDeleteModalOpen(true) }
  function closeDeleteModal() { setDeleteTarget(null); setDeleteModalOpen(false) }
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('employees').delete().eq('id', deleteTarget.id)
      if (error) throw error
      closeDeleteModal(); await fetchEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      closeDeleteModal()
    } finally { setDeleting(false) }
  }

  // ── Bulk Upload ─────────────────────────────────────────────────────────────

  function openBulk() { setBulkStep('upload'); setBulkRows([]); setBulkResults([]); setInviteResults([]); setBulkModalOpen(true) }
  function closeBulk() { setBulkModalOpen(false) }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      setBulkRows(rows)
      setBulkStep('preview')
    }
    reader.readAsText(file)
  }

  async function handleBulkUpload() {
    if (bulkRows.length === 0) return
    setBulkUploading(true)
    const results: UploadResult[] = []

    for (const row of bulkRows) {
      try {
        if (!row.employee_id || !row.name) throw new Error('Missing employee_id or name')
        const { error } = await supabase.from('employees').upsert({
          employee_id: row.employee_id,
          name: row.name,
          designation: row.designation || null,
          practice: (row.practice || null) as Employee['practice'],
          location: row.location || null,
          line_manager: row.line_manager || null,
          hire_date: row.hire_date || null,
          employment_type: (row.employment_type || null) as Employee['employment_type'],
          active_status: 'Active',
          appraisal_band: row.appraisal_band || null,
          email: row.email || null,
        }, { onConflict: 'employee_id' })
        if (error) throw error
        results.push({ row, status: 'success' })
      } catch (err) {
        results.push({ row, status: 'error', message: err instanceof Error ? err.message : 'Error' })
      }
    }

    setBulkResults(results)

    // Send invites for successfully inserted employees with email
    const emailsToInvite = results
      .filter(r => r.status === 'success' && r.row.email)
      .map(r => r.row.email)

    if (emailsToInvite.length > 0) {
      try {
        const res = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: emailsToInvite }),
        })
        const { results: inv } = await res.json()
        setInviteResults(inv ?? [])
      } catch {
        setInviteResults(emailsToInvite.map(email => ({ email, status: 'error' as const, message: 'API error' })))
      }
    }

    setBulkStep('done')
    setBulkUploading(false)
    await fetchEmployees()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const successCount = bulkResults.filter(r => r.status === 'success').length
  const invitedCount = inviteResults.filter(r => r.status === 'invited').length

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Employees" subtitle="Employee master and reporting lines" />

      <div className="flex-1 p-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span><span className="font-semibold text-gray-900">{employees.length}</span> total</span>
            <span className="text-gray-300">|</span>
            <span><span className="font-semibold text-emerald-600">{activeCount}</span> active</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download size={15} className="mr-1.5" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={openBulk}>
              <Upload size={15} className="mr-1.5" /> Bulk Upload
            </Button>
            <Button onClick={openAdd} size="sm">
              <Plus size={16} className="mr-1.5" /> Add Employee
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input placeholder="Search name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="w-44">
            <Select value={practiceFilter} onChange={(e) => setPracticeFilter(e.target.value)} placeholder="All Practices" options={PRACTICES.map((p) => ({ label: p, value: p }))} />
          </div>
          <div className="w-40">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All Statuses" options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} />
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Employee ID','Name','Designation','Practice','Location','Line Manager','Employment Type','Status','Appraisal Band','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">
                    {employees.length === 0 ? 'No employees yet. Add your first employee.' : 'No employees match the current filters.'}
                  </td></tr>
                ) : (
                  filtered.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{emp.employee_id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.designation ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.practice ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.location ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp.line_manager ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp.employment_type ?? '-'}</td>
                      <td className="px-4 py-3"><Badge className={STATUS_COLORS[emp.active_status] ?? ''}>{emp.active_status}</Badge></td>
                      <td className="px-4 py-3 text-gray-600">{emp.appraisal_band ?? '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Pencil size={15} /></button>
                          <button onClick={() => handleInvite(emp)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title={emp.email ? `Send invite to ${emp.email}` : 'No email'}><Mail size={15} /></button>
                          <button onClick={() => openDelete(emp)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={15} /></button>
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

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editingEmployee ? 'Edit Employee' : 'Add Employee'} size="lg">
        <div className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Employee ID" required><Input placeholder="e.g. AX-001" value={formData.employee_id} onChange={(e) => handleFormChange('employee_id', e.target.value)} /></FormField>
            <FormField label="Full Name" required><Input placeholder="Full name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} /></FormField>
            <FormField label="Designation"><Input placeholder="e.g. Senior Consultant" value={formData.designation} onChange={(e) => handleFormChange('designation', e.target.value)} /></FormField>
            <FormField label="Practice"><Select value={formData.practice} onChange={(e) => handleFormChange('practice', e.target.value)} placeholder="Select practice" options={PRACTICES.map((p) => ({ label: p, value: p }))} /></FormField>
            <FormField label="Location"><Input placeholder="e.g. Bangalore" value={formData.location} onChange={(e) => handleFormChange('location', e.target.value)} /></FormField>
            <FormField label="Line Manager"><Input placeholder="Manager name" value={formData.line_manager} onChange={(e) => handleFormChange('line_manager', e.target.value)} /></FormField>
            <FormField label="Hire Date"><Input type="date" value={formData.hire_date} onChange={(e) => handleFormChange('hire_date', e.target.value)} /></FormField>
            <FormField label="Employment Type"><Select value={formData.employment_type} onChange={(e) => handleFormChange('employment_type', e.target.value)} placeholder="Select type" options={EMPLOYMENT_TYPES.map((t) => ({ label: t, value: t }))} /></FormField>
            <FormField label="Active Status"><Select value={formData.active_status} onChange={(e) => handleFormChange('active_status', e.target.value as 'Active' | 'Inactive')} options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} /></FormField>
            <FormField label="Appraisal Band"><Input placeholder="e.g. Band 3" value={formData.appraisal_band} onChange={(e) => handleFormChange('appraisal_band', e.target.value)} /></FormField>
            <FormField label="Email" className="sm:col-span-2"><Input type="email" placeholder="work@aeonx.digital" value={formData.email} onChange={(e) => handleFormChange('email', e.target.value)} /></FormField>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editingEmployee ? 'Save Changes' : 'Add Employee'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal} title="Delete Employee" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This cannot be undone.</p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closeDeleteModal} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal isOpen={bulkModalOpen} onClose={closeBulk} title="Bulk Upload Employees" size="lg">
        <div className="space-y-5">
          {bulkStep === 'upload' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1.5">
                <p className="font-semibold">How to upload:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Download the CSV template using the Template button above</li>
                  <li>Fill in employee details (one row per employee)</li>
                  <li>Upload the filled CSV file here</li>
                  <li>Employees will be inserted and login invites sent by email</li>
                </ol>
              </div>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">Click to choose a CSV file</p>
                <p className="text-xs text-gray-400 mt-1">or drag & drop — CSV format only</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </div>
              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download size={14} className="mr-1.5" /> Download Template
                </Button>
                <Button variant="outline" onClick={closeBulk}>Cancel</Button>
              </div>
            </>
          )}

          {bulkStep === 'preview' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700 font-medium">{bulkRows.length} employees found in file</p>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => { setBulkStep('upload'); if (fileInputRef.current) fileInputRef.current.value = '' }}>Change file</button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>{['ID','Name','Designation','Practice','Email'].map(h => <th key={h} className="text-left px-3 py-2 font-medium text-gray-500">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono text-gray-600">{r.employee_id}</td>
                        <td className="px-3 py-2 text-gray-900">{r.name}</td>
                        <td className="px-3 py-2 text-gray-600">{r.designation}</td>
                        <td className="px-3 py-2 text-gray-600">{r.practice}</td>
                        <td className="px-3 py-2 text-gray-600">{r.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                Login invitation emails will be sent to all employees with email addresses.
                Existing employees (same employee_id) will be updated.
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={closeBulk} disabled={bulkUploading}>Cancel</Button>
                <Button onClick={handleBulkUpload} disabled={bulkUploading || bulkRows.length === 0}>
                  {bulkUploading ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Uploading…</> : `Upload ${bulkRows.length} Employees`}
                </Button>
              </div>
            </>
          )}

          {bulkStep === 'done' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{successCount}</p>
                  <p className="text-xs text-green-600 mt-1">Employees uploaded</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{invitedCount}</p>
                  <p className="text-xs text-blue-600 mt-1">Invites sent</p>
                </div>
              </div>

              {bulkResults.filter(r => r.status === 'error').length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-red-700">Failed rows:</p>
                  {bulkResults.filter(r => r.status === 'error').map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-600">
                      <XCircle size={13} className="mt-0.5 flex-shrink-0" />
                      <span><strong>{r.row.name || r.row.employee_id}</strong>: {r.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {inviteResults.filter(r => r.status === 'error').length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  Some invites failed. Ensure <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is set in .env.local. You can manually invite users from the Supabase dashboard.
                </div>
              )}

              <div className="max-h-48 overflow-y-auto space-y-1">
                {bulkResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.status === 'success'
                      ? <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
                      : <XCircle size={13} className="text-red-500 flex-shrink-0" />}
                    <span className={r.status === 'success' ? 'text-gray-700' : 'text-red-600'}>
                      {r.row.name} ({r.row.employee_id}) {r.status === 'error' ? `— ${r.message}` : ''}
                    </span>
                    {inviteResults.find(inv => inv.email === r.row.email)?.status === 'invited' && (
                      <span className="ml-auto text-blue-500 font-medium">Invite sent</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={closeBulk}>Done</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

function FormField({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
