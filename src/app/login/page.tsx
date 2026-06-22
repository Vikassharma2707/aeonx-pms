'use client'
import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { setAdminSession, isAdminSession } from '@/lib/adminSession'
import Image from 'next/image'
import { Eye, EyeOff, Lock, Mail, Target, BarChart3, Users, Award, ShieldCheck } from 'lucide-react'

const ADMIN_USERNAME = 'Administrator'
const ADMIN_PASSWORD = 'Aeonx@12345'

const features = [
  { icon: Target,    title: 'Goal Management',   desc: 'Annual goals with KPIs & weightage' },
  { icon: BarChart3, title: 'Quarterly Reviews',  desc: 'PM feedback every quarter' },
  { icon: Users,     title: 'Team Visibility',    desc: 'Managers review direct reports' },
  { icon: Award,     title: 'Final Appraisal',    desc: '50% Goals | 30% PM | 20% Values' },
]

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (isAdminSession()) {
      window.location.href = '/dashboard'
    }
  }, [])

  const isAdmin = username === ADMIN_USERNAME

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStatus('')
    const u = username.trim()
    const p = password.trim()

    // â”€â”€ Admin path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (u === ADMIN_USERNAME) {
      if (p !== ADMIN_PASSWORD) {
        setError('Incorrect admin password.')
        return
      }
      setStatus('Signing in as Administrator...')
      setAdminSession()
      window.location.href = '/dashboard'
      return
    }

    // â”€â”€ Employee path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    setLoading(true)
    setStatus('Checking credentials...')
    try {
      const supabase = getSupabase()
      setStatus('Connecting to auth...')
      const { error: authError, data } = await supabase.auth.signInWithPassword({ email: u, password: p })

      if (authError) {
        console.error('[Login] auth error:', authError)
        throw authError
      }

      console.log('[Login] signed in:', data.user?.email)
      setStatus('Redirecting to portal...')
      window.location.href = '/portal'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.'
      console.error('[Login] caught error:', msg)
      setError(msg)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[58%] h-full flex-col bg-gray-900 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-600 rounded-full opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-10 w-64 h-64 bg-orange-500 rounded-full opacity-15 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div className="relative z-10 px-8 pt-7 pb-0 flex-shrink-0">
          <div className="bg-white rounded-xl px-4 py-2 inline-flex">
            <Image src="/aeonx-logo.png" alt="AeonX Digital" width={110} height={36} style={{ height: 'auto' }} priority />
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-4">
          <p className="text-[10px] font-bold tracking-[0.22em] text-orange-400 uppercase mb-2">
            Enterprise Performance Platform
          </p>
          <h1 className="text-3xl font-extrabold text-white leading-snug mb-3">
            Measure What<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-orange-400">
              Matters Most
            </span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-7 max-w-sm">
            A unified platform to set goals, capture quarterly PM feedback, run mid-year reviews
            and deliver transparent annual appraisals across AeonX Digital.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/25 border border-blue-500/20 flex items-center justify-center mb-2.5">
                  <Icon size={15} className="text-blue-400" />
                </div>
                <p className="text-white text-xs font-semibold mb-0.5">{title}</p>
                <p className="text-gray-500 text-[11px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 px-10 py-4 flex-shrink-0 border-t border-white/5">
          <p className="text-gray-600 text-[11px]">
            &copy; 2026 AeonX Digital Technology Limited &nbsp;&bull;&nbsp; SAP &nbsp;&bull;&nbsp; Cloud &nbsp;&bull;&nbsp; DevOps
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 h-full flex flex-col bg-white overflow-hidden">
        <div className="lg:hidden px-6 pt-6 flex-shrink-0">
          <div className="bg-gray-900 rounded-xl px-4 py-2.5 inline-flex">
            <Image src="/aeonx-logo.png" alt="AeonX Digital" width={100} height={34} style={{ height: 'auto' }} priority />
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-14">
          <div className="w-full max-w-sm mx-auto lg:mx-0">

            <div className="mb-6">
              {isAdmin && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <ShieldCheck size={13} className="text-blue-600" />
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 tracking-widest uppercase">Admin Access</span>
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-1">Welcome back</h2>
              <p className="text-gray-500 text-sm">
                {isAdmin ? 'Enter your admin password to continue' : 'Sign in to your PMS account'}
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <span className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">!</span>
                {error}
              </div>
            )}

            {status && !error && (
              <div className="mb-4 flex items-center gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                {status}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  {isAdmin ? 'Username' : 'Email'}
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Administrator or you@aeonx.digital"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    required autoFocus autoComplete="username" spellCheck={false} suppressHydrationWarning
                  />
                </div>
                {isAdmin && (
                  <p className="mt-1 text-[11px] text-blue-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    Admin account detected
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-10 pl-9 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    required autoComplete="current-password" suppressHydrationWarning
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</>
                  : 'Sign in'}
              </button>
            </form>

            <div className="mt-5 p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Access guide</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span><strong className="text-gray-700">Admin:</strong> username <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[11px] font-mono">Administrator</code></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                <span><strong className="text-gray-700">Employees:</strong> your AeonX email address</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 sm:px-12 lg:px-14 py-4 flex-shrink-0">
          <p className="text-[11px] text-gray-400">&copy; 2026 AeonX Digital Technology Limited</p>
        </div>
      </div>
    </div>
  )
}
