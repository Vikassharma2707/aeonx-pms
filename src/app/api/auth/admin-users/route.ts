import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

// GET — list all admin users (no password_hash returned)
export async function GET() {
  try {
    const sb = getServiceClient()
    const { data, error } = await sb
      .from('admin_users')
      .select('id, username, full_name, employee_id, is_active, last_login, created_at')
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin-users GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create new admin user
export async function POST(req: NextRequest) {
  try {
    const { username, password, full_name, employee_id } = await req.json()
    if (!username?.trim() || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    const sb = getServiceClient()

    // Grade restriction: if employee_id provided, verify SM** band
    if (employee_id) {
      const { data: emp } = await sb
        .from('employees')
        .select('appraisal_band, name')
        .eq('employee_id', employee_id)
        .single()
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 400 })
      if (!emp.appraisal_band?.toUpperCase().startsWith('SM')) {
        return NextResponse.json(
          { error: `Only employees with SM grade (SM01–SM05) can be admin users. ${emp.name} has band "${emp.appraisal_band}".` },
          { status: 403 }
        )
      }
    }

    const password_hash = await bcrypt.hash(password, 10)
    const { data, error } = await sb
      .from('admin_users')
      .insert({ username: username.trim(), password_hash, full_name: full_name?.trim() || null, employee_id: employee_id || null, is_active: true })
      .select('id, username, full_name, employee_id, is_active, created_at')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
      throw error
    }
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[admin-users POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update active status or password
export async function PATCH(req: NextRequest) {
  try {
    const { id, is_active, password, full_name } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const sb = getServiceClient()

    // Prevent deactivating the last active admin
    if (is_active === false) {
      const { count } = await sb
        .from('admin_users')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Cannot deactivate the last active admin user.' }, { status: 400 })
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (is_active !== undefined) patch.is_active = is_active
    if (full_name !== undefined) patch.full_name = full_name?.trim() || null
    if (password) patch.password_hash = await bcrypt.hash(password, 10)

    const { data, error } = await sb
      .from('admin_users')
      .update(patch)
      .eq('id', id)
      .select('id, username, full_name, employee_id, is_active, last_login, created_at')
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[admin-users PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — remove admin user
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const sb = getServiceClient()

    const { count } = await sb
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last active admin user.' }, { status: 400 })
    }

    const { error } = await sb.from('admin_users').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin-users DELETE]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
