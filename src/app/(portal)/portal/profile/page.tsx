'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, RATING_COLORS, getFinalRating } from '@/lib/constants'
import type { MidYearReview, FinalAppraisal } from '@/lib/supabase'

// ─── Profile row ──────────────────────────────────────────────────────────────
function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="text-gray-400 italic">Not set</span>}</p>
    </div>
  )
}

// ─── Score chip ───────────────────────────────────────────────────────────────
function ScoreChip({ label, score, sub }: { label: string; score: number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-800">{score.toFixed(2)}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { employee, loading: authLoading } = useAuth()

  const CURRENT_YEAR = '2026-27'

  const [midYear, setMidYear] = useState<MidYearReview | null>(null)
  const [finalAppraisal, setFinalAppraisal] = useState<FinalAppraisal | null>(null)
  const [performanceLoading, setPerformanceLoading] = useState(true)

  // Change password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    if (!employee) return
    async function fetchPerformance() {
      setPerformanceLoading(true)
      const [midRes, finalRes] = await Promise.all([
        supabase
          .from('mid_year_reviews')
          .select('*')
          .eq('employee_id', employee!.employee_id)
          .eq('fiscal_year', CURRENT_YEAR)
          .maybeSingle(),
        supabase
          .from('final_appraisals')
          .select('*')
          .eq('employee_id', employee!.employee_id)
          .eq('fiscal_year', CURRENT_YEAR)
          .maybeSingle(),
      ])
      setMidYear((midRes.data ?? null) as MidYearReview | null)
      setFinalAppraisal((finalRes.data ?? null) as FinalAppraisal | null)
      setPerformanceLoading(false)
    }
    fetchPerformance()
  }, [employee])

  async function handleChangePassword() {
    setPwError(null)
    setPwSuccess(false)

    if (!newPw) { setPwError('New password is required.'); return }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwError('New password and confirm password do not match.'); return }

    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwError(error.message)
    } else {
      setPwSuccess(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    }
    setPwSaving(false)
  }

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header title="My Profile" />
        <div className="flex-1 flex items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  if (!employee) return null

  // Initials
  const initials = employee.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const hireDate = employee.hire_date
    ? new Date(employee.hire_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : undefined

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="My Profile" subtitle={employee.designation} />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Personal details ── */}
          <div className="space-y-5">
            {/* Avatar + Name */}
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-md">
                    {initials}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{employee.name}</h2>
                    <p className="text-sm text-gray-500">{employee.designation}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={cn('text-xs', STATUS_COLORS[employee.active_status])}>
                        {employee.active_status}
                      </Badge>
                      {employee.appraisal_band && (
                        <Badge className="text-xs bg-indigo-100 text-indigo-700">
                          Band: {employee.appraisal_band}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  <ProfileRow label="Employee ID" value={employee.employee_id} />
                  <ProfileRow label="Email" value={employee.email} />
                  <ProfileRow label="Practice / Division" value={employee.practice} />
                  <ProfileRow label="Location" value={employee.location} />
                  <ProfileRow label="Employment Type" value={employee.employment_type} />
                  <ProfileRow label="Date of Joining" value={hireDate} />
                  <ProfileRow label="Line Manager" value={employee.line_manager} />
                </div>
              </CardContent>
            </Card>

            {/* Contact HR note */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800">
                To update your profile details, contact <strong>HR</strong>.
              </p>
            </div>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Change Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pwError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    {pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                    Password updated successfully.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                  <Input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                  <Input
                    type="password"
                    placeholder="At least 8 characters"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
                  <Input
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="pt-1">
                  <Button onClick={handleChangePassword} disabled={pwSaving} className="w-full sm:w-auto">
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Performance Summary ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Summary</CardTitle>
                <p className="text-xs text-gray-400">Fiscal Year {CURRENT_YEAR}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {performanceLoading && (
                  <div className="flex justify-center py-8"><Spinner /></div>
                )}

                {!performanceLoading && !finalAppraisal && !midYear && (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">No appraisal data yet</p>
                    <p className="text-gray-400 text-xs mt-1">Your performance data will appear here once your review cycle begins.</p>
                  </div>
                )}

                {/* Mid-Year Review */}
                {!performanceLoading && midYear && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      Mid-Year Review
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {midYear.mid_year_overall_score != null && (
                        <ScoreChip label="Mid-Year Score" score={midYear.mid_year_overall_score} />
                      )}
                      {midYear.h1_pm_avg != null && (
                        <ScoreChip label="H1 PM Average" score={midYear.h1_pm_avg} />
                      )}
                      {midYear.lm_mid_year_rating != null && (
                        <ScoreChip label="LM Rating" score={midYear.lm_mid_year_rating} />
                      )}
                      {midYear.avg_goal_progress_percent != null && (
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                          <p className="text-xs font-medium text-gray-500 mb-1">Goal Progress</p>
                          <p className="text-3xl font-bold text-gray-800">{midYear.avg_goal_progress_percent}%</p>
                        </div>
                      )}
                    </div>
                    <Badge className={cn('mt-3 text-xs', STATUS_COLORS[midYear.review_status] ?? 'bg-gray-100 text-gray-600')}>
                      {midYear.review_status}
                    </Badge>
                  </div>
                )}

                {/* Final Appraisal */}
                {!performanceLoading && finalAppraisal && (
                  <div className={cn(midYear ? 'pt-5 border-t border-gray-100' : '')}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      Final Appraisal
                    </h3>

                    {finalAppraisal.final_score != null && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 text-center border border-blue-100 mb-4">
                        <p className="text-xs font-medium text-blue-600 mb-1">Final Score</p>
                        <p className="text-5xl font-extrabold text-blue-700">{finalAppraisal.final_score.toFixed(2)}</p>
                        <p className="text-xs text-blue-500 mt-1">out of 5.00</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {finalAppraisal.final_rating && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Final Rating</span>
                          <Badge className={cn('text-xs', RATING_COLORS[finalAppraisal.final_rating] ?? 'bg-gray-100 text-gray-600')}>
                            {finalAppraisal.final_rating}
                          </Badge>
                        </div>
                      )}

                      {finalAppraisal.recommended_action && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Recommended Action</span>
                          <span className="text-sm font-medium text-gray-800">{finalAppraisal.recommended_action}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status</span>
                        <Badge className={cn('text-xs', STATUS_COLORS[finalAppraisal.review_status] ?? 'bg-gray-100 text-gray-600')}>
                          {finalAppraisal.review_status}
                        </Badge>
                      </div>
                    </div>

                    {/* Score breakdown */}
                    {(finalAppraisal.annual_goal_score != null || finalAppraisal.annual_pm_avg != null || finalAppraisal.behavior_values_rating != null) && (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {finalAppraisal.annual_goal_score != null && (
                          <ScoreChip label="Goal Score" score={finalAppraisal.annual_goal_score} />
                        )}
                        {finalAppraisal.annual_pm_avg != null && (
                          <ScoreChip label="PM Average" score={finalAppraisal.annual_pm_avg} />
                        )}
                        {finalAppraisal.behavior_values_rating != null && (
                          <ScoreChip label="Behavior" score={finalAppraisal.behavior_values_rating} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-gray-100">
                <ProfileRow label="Role" value={employee.role === 'hr' ? 'HR Admin' : employee.role === 'manager' ? 'Manager' : 'Employee'} />
                <ProfileRow label="Appraisal Band" value={employee.appraisal_band} />
                <ProfileRow label="Practice" value={employee.practice} />
                <ProfileRow label="Employment Type" value={employee.employment_type} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
