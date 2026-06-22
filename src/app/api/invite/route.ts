import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { emails } = await req.json() as { emails: string[] }
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'No emails provided' }, { status: 400 })
  }

  const results: { email: string; status: 'invited' | 'error'; message?: string }[] = []

  for (const email of emails) {
    try {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${req.headers.get('origin')}/portal`,
        data: { source: 'aeonx-pms-bulk-upload' },
      })
      if (error) throw error
      results.push({ email, status: 'invited' })
    } catch (err: unknown) {
      results.push({ email, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ results })
}
