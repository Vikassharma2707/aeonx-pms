import { getSupabase } from './supabase'
import type { Employee } from './supabase'

export type UserRole = 'hr' | 'manager' | 'employee'

export type AuthEmployee = Employee & {
  role: UserRole
  user_id: string
}

export async function getCurrentEmployee(): Promise<AuthEmployee | null> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let { data: emp } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Fallback: match by email (case-insensitive) and auto-link user_id
  if (!emp && user.email) {
    const { data: byEmail } = await supabase
      .from('employees')
      .select('*')
      .ilike('email', user.email)
      .single()
    if (byEmail) {
      await supabase.from('employees').update({ user_id: user.id }).eq('id', byEmail.id)
      emp = { ...byEmail, user_id: user.id }
    }
  }

  if (!emp) return null

  const role = getRole(emp)
  return { ...emp, role, user_id: user.id }
}

function getRole(emp: Employee): UserRole {
  const d = (emp.designation ?? '').toLowerCase()
  const b = (emp.appraisal_band ?? '').toUpperCase()
  if (d.includes('hr') || d.includes('admin') || b === 'HR') return 'hr'
  if (
    d.includes('manager') ||
    d.includes('senior') ||
    ['MM', 'SM', 'DM', 'AM', 'Partner'].includes(b)
  ) return 'manager'
  return 'employee'
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabase()
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  const supabase = getSupabase()
  return supabase.auth.signOut()
}

export async function sendInvite(email: string) {
  const supabase = getSupabase()
  return supabase.auth.admin.inviteUserByEmail(email)
}
