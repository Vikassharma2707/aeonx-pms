'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Combobox } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { createClient } from '@supabase/supabase-js'
import { UserPlus, ShieldCheck, ShieldOff, KeyRound, Trash2, Info } from 'lucide-react'

function getAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

type AdminUser = {
  id: string
  username: string
  full_name: string | null
  employee_id: string | null
  is_active: boolean
  last_login: string | null
  created_at: string
}

type SMEmployee = {
  employee_id: string
  name: string
  designation: string | null
  appraisal_band: string | null
  email: string | null
}

function Spinner() {
  return <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [smEmployees, setSmEmployees] = useState<SMEmployee[]>([])

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ username: '', password: '', full_name: '', employee_id: '' })
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)
  const [showAddPass, setShowAddPass] = useState(false)

  // Password change modal
  const [pwdModal, setPwdModal] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchAdmins() {
    setLoading(true)
    const res = await fetch('/api/auth/admin-users')
    if (res.ok) setAdmins(await res.json())
    else setError('Failed to load admin users')
    setLoading(false)
  }

  useEffect(() => {
    fetchAdmins()
    // Fetch SM** grade employees for the add form
    getAnonClient()
      .from('employees')
      .select('employee_id, name, designation, appraisal_band, email')
      .eq('active_status', 'Active')
      .or('appraisal_band.ilike.SM%')
      .order('name')
      .then(({ data }) => { if (data) setSmEmployees(data as SMEmployee[]) })
  }, [])

  // Pre-fill username when an SM employee is selected
  function handleEmployeeSelect(empId: string) {
    const emp = smEmployees.find(e => e.employee_id === empId)
    setAddForm(prev => ({
      ...prev,
      employee_id: empId,
      full_name: prev.full_name || emp?.name || '',
      username: prev.username || (emp?.name?.toLowerCase().replace(/\s+/g, '') ?? ''),
    }))
  }

  async function handleAdd() {
    if (!addForm.username.trim()) { setAddError('Username is required'); return }
    if (!addForm.password) { setAddError('Password is required'); return }
    if (addForm.password.length < 8) { setAddError('Password must be at least 8 characters'); return }
    setAddSaving(true); setAddError(null)
    const res = await fetch('/api/auth/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error); setAddSaving(false); return }
    setAdmins(prev => [...prev, data])
    setAddOpen(false)
    setAddForm({ username: '', password: '', full_name: '', employee_id: '' })
    setAddSaving(false)
  }

  async function toggleActive(admin: AdminUser) {
    const res = await fetch('/api/auth/admin-users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: admin.id, is_active: !admin.is_active }),
    })
    const data = await res.json()
    if (res.ok) setAdmins(prev => prev.map(a => a.id === admin.id ? data : a))
    else alert(data.error)
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 8) { setPwdError('Password must be at least 8 characters'); return }
    setPwdSaving(true); setPwdError(null)
    const res = await fetch('/api/auth/admin-users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pwdModal!.id, password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) { setPwdError(data.error); setPwdSaving(false); return }
    setAdmins(prev => prev.map(a => a.id === pwdModal!.id ? data : a))
    setPwdModal(null); setNewPassword(''); setPwdSaving(false)
  }

  async function deleteAdmin() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch('/api/auth/admin-users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteTarget.id }),
    })
    const data = await res.json()
    if (res.ok) { setAdmins(prev => prev.filter(a => a.id !== deleteTarget.id)); setDeleteTarget(null) }
    else alert(data.error)
    setDeleting(false)
  }

  const activeCount = admins.filter(a => a.is_active).length

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Admin Users" subtitle="Manage who can access the admin panel" />

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-5">

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-1">Grade restriction</p>
            <p className="text-xs text-blue-600">
              Only employees with appraisal band <strong>SM01–SM05</strong> can be linked to an admin account.
              This ensures admin access is limited to Senior Manager grade and above.
              Passwords are bcrypt-hashed and never stored in plain text.
            </p>
          </div>
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-800">Admin Accounts</h2>
            <Badge className="bg-green-100 text-green-700">{activeCount} active</Badge>
            {admins.length - activeCount > 0 && (
              <Badge className="bg-gray-100 text-gray-500">{admins.length - activeCount} inactive</Badge>
            )}
          </div>
          <Button onClick={() => { setAddOpen(true); setAddError(null); setAddForm({ username: '', password: '', full_name: '', employee_id: '' }) }}>
            <UserPlus size={14} className="mr-2" /> Add Admin User
          </Button>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
        {loading && <div className="flex justify-center py-12"><Spinner /></div>}

        {!loading && admins.map(admin => {
          const emp = smEmployees.find(e => e.employee_id === admin.employee_id)
          return (
            <Card key={admin.id} className={cn('overflow-hidden', !admin.is_active && 'opacity-60')}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                      admin.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500')}>
                      {(admin.full_name ?? admin.username).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{admin.full_name ?? admin.username}</p>
                        <Badge className={admin.is_active ? 'bg-green-100 text-green-700 text-xs' : 'bg-gray-100 text-gray-500 text-xs'}>
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">@{admin.username}</p>
                      {emp ? (
                        <p className="text-xs text-purple-600 mt-0.5">
                          {emp.name} · <span className="font-medium">{emp.appraisal_band}</span>
                          {emp.designation ? ` · ${emp.designation}` : ''}
                        </p>
                      ) : admin.employee_id ? (
                        <p className="text-xs text-gray-400 mt-0.5">Employee: {admin.employee_id}</p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-0.5">No employee linked</p>
                      )}
                      {admin.last_login && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Last login: {new Date(admin.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setPwdModal(admin); setNewPassword(''); setPwdError(null) }}>
                      <KeyRound size={13} className="mr-1.5" /> Change Password
                    </Button>
                    <Button size="sm" variant="outline"
                      className={admin.is_active ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-green-600 border-green-200 hover:bg-green-50'}
                      onClick={() => toggleActive(admin)}
                      disabled={admin.is_active && activeCount <= 1}
                      title={admin.is_active && activeCount <= 1 ? 'Cannot deactivate the last active admin' : ''}>
                      {admin.is_active
                        ? <><ShieldOff size={13} className="mr-1.5" /> Deactivate</>
                        : <><ShieldCheck size={13} className="mr-1.5" /> Activate</>}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                      disabled={admin.is_active && activeCount <= 1}
                      onClick={() => setDeleteTarget(admin)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {!loading && admins.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">No admin users found. Add one above.</div>
        )}
      </div>

      {/* Add Admin Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Admin User" size="sm">
        <div className="space-y-4">
          {addError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{addError}</div>}

          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
            <strong>Grade restriction:</strong> Only SM01–SM05 grade employees can be linked to an admin account.
          </div>

          <Field label="Link to SM Employee (optional)">
            <Combobox
              value={addForm.employee_id}
              onChange={handleEmployeeSelect}
              placeholder="Search SM grade employees…"
              options={smEmployees.map(e => ({
                value: e.employee_id,
                label: e.name,
                sublabel: [e.appraisal_band, e.designation].filter(Boolean).join(' · '),
              }))}
            />
            {smEmployees.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No SM grade employees found in the system.</p>
            )}
          </Field>

          <Field label="Full Name">
            <Input placeholder="e.g. Vikas Sharma" value={addForm.full_name}
              onChange={e => setAddForm(p => ({ ...p, full_name: e.target.value }))} />
          </Field>

          <Field label="Username" required>
            <Input placeholder="e.g. vikassharma" value={addForm.username}
              onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Used to log in (not an email).</p>
          </Field>

          <Field label="Initial Password" required>
            <div className="relative">
              <Input type={showAddPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} />
              <button type="button" onClick={() => setShowAddPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                {showAddPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Adding…' : 'Add Admin User'}</Button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={!!pwdModal} onClose={() => setPwdModal(null)} title={`Change Password — ${pwdModal?.username}`} size="sm">
        <div className="space-y-4">
          {pwdError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{pwdError}</div>}
          <Field label="New Password" required>
            <div className="relative">
              <Input type={showNewPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
              <button type="button" onClick={() => setShowNewPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                {showNewPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setPwdModal(null)} disabled={pwdSaving}>Cancel</Button>
            <Button onClick={changePassword} disabled={pwdSaving}>{pwdSaving ? 'Saving…' : 'Update Password'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Admin User" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to permanently delete admin user <strong>{deleteTarget?.username}</strong>?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAdmin} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
