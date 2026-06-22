'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, Lock, Unlock, Save, AlertTriangle, CheckCircle } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type SystemRole = 'hr_admin' | 'line_manager' | 'project_manager' | 'employee'

type EmpRow = {
  id: string
  employee_id: string
  name: string
  designation: string | null
  practice: string | null
  email: string | null
  active_status: 'Active' | 'Inactive'
  system_role: SystemRole[] | null
}

type AppraisalSettings = {
  id: string
  fiscal_year: string
  goal_deadline: string | null
  task_q1_deadline: string | null
  task_q2_deadline: string | null
  task_q3_deadline: string | null
  task_q4_deadline: string | null
  mid_year_deadline: string | null
  final_deadline: string | null
  goals_locked: boolean
  tasks_q1_locked: boolean
  tasks_q2_locked: boolean
  tasks_q3_locked: boolean
  tasks_q4_locked: boolean
  mid_year_locked: boolean
  final_locked: boolean
}

const ROLE_OPTIONS: { value: SystemRole; label: string; desc: string; color: string }[] = [
  { value: 'employee',        label: 'Employee',        desc: 'Personal forms only',                      color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'line_manager',    label: 'Line Manager',    desc: 'View & rate direct reports\' goals',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'project_manager', label: 'Project Manager', desc: 'Receive & rate quarterly task submissions', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'hr_admin',        label: 'HR Admin',        desc: 'Full admin access to all data',            color: 'bg-purple-100 text-purple-700 border-purple-200' },
]

const ROLE_COLOR: Record<SystemRole, string> = {
  employee:        'bg-gray-100 text-gray-600 border-gray-200',
  line_manager:    'bg-blue-100 text-blue-700 border-blue-200',
  project_manager: 'bg-amber-100 text-amber-700 border-amber-200',
  hr_admin:        'bg-purple-100 text-purple-700 border-purple-200',
}

const LOCK_FIELDS: { key: keyof AppraisalSettings; deadlineKey: keyof AppraisalSettings; label: string }[] = [
  { key: 'goals_locked',    deadlineKey: 'goal_deadline',     label: 'Goals' },
  { key: 'tasks_q1_locked', deadlineKey: 'task_q1_deadline',  label: 'Q1 Tasks' },
  { key: 'tasks_q2_locked', deadlineKey: 'task_q2_deadline',  label: 'Q2 Tasks' },
  { key: 'tasks_q3_locked', deadlineKey: 'task_q3_deadline',  label: 'Q3 Tasks' },
  { key: 'tasks_q4_locked', deadlineKey: 'task_q4_deadline',  label: 'Q4 Tasks' },
  { key: 'mid_year_locked', deadlineKey: 'mid_year_deadline', label: 'Mid-Year Review' },
  { key: 'final_locked',    deadlineKey: 'final_deadline',    label: 'Final Appraisal' },
]

function getRoles(emp: EmpRow): SystemRole[] {
  const roles = emp.system_role ?? []
  return roles.length === 0 ? ['employee'] : roles as SystemRole[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const [employees, setEmployees] = useState<EmpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AppraisalSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [localSettings, setLocalSettings] = useState<AppraisalSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Role editing
  const [editingRole, setEditingRole] = useState<EmpRow | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<Set<SystemRole>>(new Set())
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('id,employee_id,name,designation,practice,email,active_status,system_role')
      .order('name')
    setEmployees((data ?? []) as EmpRow[])
    setLoading(false)
  }, [])

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true)
    const { data } = await supabase
      .from('appraisal_settings')
      .select('*')
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .single()
    setSettings(data)
    setLocalSettings(data ? { ...data } : null)
    setSettingsLoading(false)
  }, [])

  useEffect(() => { fetchEmployees(); fetchSettings() }, [fetchEmployees, fetchSettings])

  // ── Role management ──────────────────────────────────────────────────────────

  function openRoleModal(emp: EmpRow) {
    setEditingRole(emp)
    const current = getRoles(emp)
    setSelectedRoles(new Set(current.filter(r => r !== 'employee') as SystemRole[]))
    setRoleError(null)
    setRoleModalOpen(true)
  }

  function toggleRole(role: SystemRole) {
    if (role === 'employee') return // employee is implicit default, not toggled
    setSelectedRoles(prev => {
      const next = new Set(prev)
      if (next.has(role)) next.delete(role)
      else next.add(role)
      return next
    })
  }

  async function handleSaveRole() {
    if (!editingRole) return
    setSavingRole(true); setRoleError(null)

    // Build role array: if no elevated roles selected, store ['employee']
    const roles: SystemRole[] = selectedRoles.size > 0
      ? Array.from(selectedRoles)
      : ['employee']

    const { error } = await supabase
      .from('employees')
      .update({ system_role: roles })
      .eq('id', editingRole.id)

    if (error) { setRoleError(error.message); setSavingRole(false); return }

    // Audit log
    const oldRoles = getRoles(editingRole).join(', ')
    const newRoles = roles.join(', ')
    await supabase.from('security_audit').insert({
      action: 'role_change',
      target_employee_id: editingRole.employee_id,
      changed_by: 'Administrator',
      old_value: oldRoles,
      new_value: newRoles,
    })

    setSavingRole(false)
    setRoleModalOpen(false)
    await fetchEmployees()
  }

  // ── Deadline / lock settings ─────────────────────────────────────────────────

  function handleSettingChange(field: keyof AppraisalSettings, value: string | boolean) {
    setLocalSettings(prev => prev ? { ...prev, [field]: value } : prev)
    setSettingsSaved(false)
  }

  async function handleSaveSettings() {
    if (!localSettings) return
    setSavingSettings(true); setSettingsSaved(false)
    const { error } = await supabase
      .from('appraisal_settings')
      .update({
        goal_deadline:     localSettings.goal_deadline,
        task_q1_deadline:  localSettings.task_q1_deadline,
        task_q2_deadline:  localSettings.task_q2_deadline,
        task_q3_deadline:  localSettings.task_q3_deadline,
        task_q4_deadline:  localSettings.task_q4_deadline,
        mid_year_deadline: localSettings.mid_year_deadline,
        final_deadline:    localSettings.final_deadline,
        goals_locked:      localSettings.goals_locked,
        tasks_q1_locked:   localSettings.tasks_q1_locked,
        tasks_q2_locked:   localSettings.tasks_q2_locked,
        tasks_q3_locked:   localSettings.tasks_q3_locked,
        tasks_q4_locked:   localSettings.tasks_q4_locked,
        mid_year_locked:   localSettings.mid_year_locked,
        final_locked:      localSettings.final_locked,
        updated_at: new Date().toISOString(),
      })
      .eq('id', localSettings.id)
    setSavingSettings(false)
    if (!error) { setSettingsSaved(true); await fetchSettings() }
  }

  async function handleAddFiscalYear() {
    const year = prompt('Enter fiscal year (e.g. 2027-28):')
    if (!year) return
    const { error } = await supabase.from('appraisal_settings').insert({ fiscal_year: year })
    if (!error) await fetchSettings()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Security & Access" subtitle="Role management and appraisal form deadlines" />

      <div className="flex-1 p-6 space-y-6">

        {/* ── Appraisal Deadlines & Locks ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-orange-500" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Appraisal Form Deadlines & Locks</h2>
                <p className="text-xs text-gray-500 mt-0.5">Set deadlines and manually lock employee forms to read-only</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settingsSaved && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle size={13} /> Saved
                </span>
              )}
              <Button size="sm" variant="outline" onClick={handleAddFiscalYear}>+ New FY</Button>
              <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings || !localSettings}>
                <Save size={14} className="mr-1.5" /> {savingSettings ? 'Saving…' : 'Save Settings'}
              </Button>
            </div>
          </div>

          {settingsLoading ? (
            <div className="p-6 text-sm text-gray-400">Loading settings…</div>
          ) : !localSettings ? (
            <div className="p-6 text-sm text-gray-400">
              No settings found.
              <button className="ml-2 text-blue-600 hover:underline" onClick={handleAddFiscalYear}>Add fiscal year</button>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fiscal Year:</span>
                <span className="text-sm font-bold text-gray-900">{localSettings.fiscal_year}</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>Locking a section makes it <strong>read-only for all employees</strong>. They cannot edit after a section is locked, even if the deadline has not passed. Unlock by toggling the switch off.</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Section</th>
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deadline</th>
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lock (Read-Only)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LOCK_FIELDS.map(({ key, deadlineKey, label }) => {
                      const isLocked = !!localSettings[key]
                      return (
                        <tr key={key} className="border-b border-gray-50 last:border-0">
                          <td className="py-3 pr-4 font-medium text-gray-800">{label}</td>
                          <td className="py-3 pr-4">
                            <input
                              type="date"
                              value={(localSettings[deadlineKey] as string) ?? ''}
                              onChange={(e) => handleSettingChange(deadlineKey, e.target.value || null as unknown as string)}
                              className="h-8 px-2 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => handleSettingChange(key, !isLocked)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                isLocked
                                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {isLocked ? <><Lock size={12} /> Locked</> : <><Unlock size={12} /> Open</>}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Role Management ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-500" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Employee Access Roles</h2>
              <p className="text-xs text-gray-500 mt-0.5">Employees can hold multiple roles simultaneously</p>
            </div>
          </div>

          {/* Role legend */}
          <div className="p-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ROLE_OPTIONS.map(r => (
              <div key={r.value} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                <Badge className={r.color}>{r.label}</Badge>
                <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Employee ID','Name','Designation','Practice','Email','Current Roles','Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : employees.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No employees found.</td></tr>
                ) : (
                  employees.map(emp => {
                    const roles = getRoles(emp)
                    return (
                      <tr key={emp.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{emp.employee_id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{emp.designation ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{emp.practice ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{emp.email ?? '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {roles.map(r => (
                              <Badge key={r} className={ROLE_COLOR[r] ?? 'bg-gray-100 text-gray-600'}>
                                {ROLE_OPTIONS.find(o => o.value === r)?.label ?? r}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openRoleModal(emp)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                          >
                            Edit Roles
                          </button>
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

      {/* Role Edit Modal */}
      <Modal isOpen={roleModalOpen} onClose={() => setRoleModalOpen(false)} title="Edit Employee Roles" size="sm">
        {editingRole && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">{editingRole.name}</p>
              <p className="text-xs text-gray-500">{editingRole.designation ?? ''} — {editingRole.email ?? 'no email'}</p>
            </div>

            {roleError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{roleError}</div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Select Roles (multiple allowed)</p>
              <div className="space-y-2">
                {ROLE_OPTIONS.filter(r => r.value !== 'employee').map(opt => {
                  const checked = selectedRoles.has(opt.value)
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(opt.value)}
                        className="mt-0.5 w-4 h-4 rounded accent-blue-600 flex-shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={opt.color}>{opt.label}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {selectedRoles.size === 0
                  ? 'No elevated roles selected — employee will have standard access only.'
                  : `${selectedRoles.size} role${selectedRoles.size > 1 ? 's' : ''} selected`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setRoleModalOpen(false)} disabled={savingRole}>Cancel</Button>
              <Button onClick={handleSaveRole} disabled={savingRole}>
                {savingRole ? 'Saving…' : 'Save Roles'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
