'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { supabase, Employee, FinalAppraisal, QuarterlyFeedback } from '@/lib/supabase'
import {
  FISCAL_YEARS,
  PRACTICES,
  FINAL_RATINGS,
  RATING_COLORS,
  getFinalRating,
  getScoreColor,
} from '@/lib/constants'
import { formatScore } from '@/lib/utils'
import { Users, TrendingUp, Award, AlertTriangle } from 'lucide-react'

interface DashboardStats {
  activeEmployees: number
  avgFinalScore: number | null
  outstandingCount: number
  needsImprovementCount: number
}

interface RatingDistributionRow {
  rating: string
  count: number
  percentage: number
}

interface PracticeSummaryRow {
  practice: string
  headcount: number
  avgFinalScore: number | null
  avgPMScore: number | null
}

interface RecentAppraisal {
  id: string
  employeeName: string
  practice: string | null
  finalScore: number | null
  finalRating: string | null
}

export default function DashboardPage() {
  const [fiscalYear, setFiscalYear] = useState<string>('2026-27')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<DashboardStats>({
    activeEmployees: 0,
    avgFinalScore: null,
    outstandingCount: 0,
    needsImprovementCount: 0,
  })
  const [ratingDistribution, setRatingDistribution] = useState<RatingDistributionRow[]>([])
  const [practiceSummary, setPracticeSummary] = useState<PracticeSummaryRow[]>([])
  const [recentAppraisals, setRecentAppraisals] = useState<RecentAppraisal[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [fiscalYear])

  async function fetchDashboardData() {
    setLoading(true)
    setError(null)
    try {
      // Fetch employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
      if (empError) throw empError

      // Fetch final appraisals for the selected fiscal year
      const { data: appraisals, error: appError } = await supabase
        .from('final_appraisals')
        .select('*')
        .eq('fiscal_year', fiscalYear)
        .order('created_at', { ascending: false })
      if (appError) throw appError

      // Fetch quarterly feedback for the selected fiscal year
      const { data: feedback, error: fbError } = await supabase
        .from('quarterly_feedback')
        .select('*')
        .eq('fiscal_year', fiscalYear)
      if (fbError) throw fbError

      const typedEmployees = (employees ?? []) as Employee[]
      const typedAppraisals = (appraisals ?? []) as FinalAppraisal[]
      const typedFeedback = (feedback ?? []) as QuarterlyFeedback[]

      // Build employee map: id -> employee
      const employeeMap = new Map<string, Employee>()
      typedEmployees.forEach((e) => employeeMap.set(e.id, e))

      // Stats
      const activeEmployees = typedEmployees.filter((e) => e.active_status === 'Active').length
      const appraisalsWithScore = typedAppraisals.filter((a) => a.final_score != null)
      const avgFinalScore =
        appraisalsWithScore.length > 0
          ? appraisalsWithScore.reduce((sum, a) => sum + (a.final_score ?? 0), 0) /
            appraisalsWithScore.length
          : null
      const outstandingCount = typedAppraisals.filter(
        (a) => a.final_rating === 'Outstanding'
      ).length
      const needsImprovementCount = typedAppraisals.filter(
        (a) => a.final_rating === 'Needs Improvement' || a.final_rating === 'Unsatisfactory'
      ).length

      setStats({ activeEmployees, avgFinalScore, outstandingCount, needsImprovementCount })

      // Rating distribution
      const totalAppraisals = typedAppraisals.length
      const distribution: RatingDistributionRow[] = FINAL_RATINGS.map((rating) => {
        const count = typedAppraisals.filter((a) => a.final_rating === rating).length
        return {
          rating,
          count,
          percentage: totalAppraisals > 0 ? (count / totalAppraisals) * 100 : 0,
        }
      })
      setRatingDistribution(distribution)

      // Practice summary
      const summary: PracticeSummaryRow[] = PRACTICES.map((practice) => {
        const practiceEmployees = typedEmployees.filter((e) => e.practice === practice)
        const headcount = practiceEmployees.length
        const practiceEmployeeIds = new Set(practiceEmployees.map((e) => e.id))

        const practiceAppraisals = typedAppraisals.filter((a) =>
          practiceEmployeeIds.has(a.employee_id)
        )
        const practiceAppraisalsWithScore = practiceAppraisals.filter((a) => a.final_score != null)
        const avgFinalScore =
          practiceAppraisalsWithScore.length > 0
            ? practiceAppraisalsWithScore.reduce((sum, a) => sum + (a.final_score ?? 0), 0) /
              practiceAppraisalsWithScore.length
            : null

        const practiceFeedback = typedFeedback.filter((f) =>
          practiceEmployeeIds.has(f.employee_id)
        )
        const feedbackWithScore = practiceFeedback.filter((f) => f.overall_pm_score != null)
        const avgPMScore =
          feedbackWithScore.length > 0
            ? feedbackWithScore.reduce((sum, f) => sum + (f.overall_pm_score ?? 0), 0) /
              feedbackWithScore.length
            : null

        return { practice, headcount, avgFinalScore, avgPMScore }
      })
      setPracticeSummary(summary)

      // Recent appraisals (last 10)
      const recent: RecentAppraisal[] = typedAppraisals.slice(0, 10).map((a) => {
        const emp = employeeMap.get(a.employee_id)
        return {
          id: a.id,
          employeeName: emp?.name ?? 'Unknown',
          practice: emp?.practice ?? null,
          finalScore: a.final_score ?? null,
          finalRating: a.final_rating ?? null,
        }
      })
      setRecentAppraisals(recent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Dashboard" subtitle="AeonX Digital Technology Limited" />

      <div className="flex-1 p-6 space-y-6">
        {/* Fiscal Year Selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Fiscal Year
          </label>
          <div className="w-40">
            <Select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              options={FISCAL_YEARS.map((y) => ({ label: y, value: y }))}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            loading={loading}
            icon={<Users size={20} className="text-blue-600" />}
            iconBg="bg-blue-50"
            label="Active Employees"
            value={stats.activeEmployees.toString()}
          />
          <StatCard
            loading={loading}
            icon={<TrendingUp size={20} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
            label="Average Final Score"
            value={formatScore(stats.avgFinalScore)}
            valueClass={stats.avgFinalScore != null ? getScoreColor(stats.avgFinalScore) : undefined}
          />
          <StatCard
            loading={loading}
            icon={<Award size={20} className="text-amber-600" />}
            iconBg="bg-amber-50"
            label="Outstanding"
            value={stats.outstandingCount.toString()}
            valueClass="text-emerald-600"
          />
          <StatCard
            loading={loading}
            icon={<AlertTriangle size={20} className="text-red-500" />}
            iconBg="bg-red-50"
            label="Needs Improvement"
            value={stats.needsImprovementCount.toString()}
            valueClass="text-red-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rating Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingSkeleton rows={5} />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 font-medium text-gray-500">Rating</th>
                      <th className="text-right py-2 font-medium text-gray-500 w-16">Count</th>
                      <th className="text-right py-2 font-medium text-gray-500 w-14">%</th>
                      <th className="py-2 w-32" />
                    </tr>
                  </thead>
                  <tbody>
                    {ratingDistribution.map((row) => (
                      <tr key={row.rating} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5">
                          <Badge className={RATING_COLORS[row.rating] ?? ''}>{row.rating}</Badge>
                        </td>
                        <td className="py-2.5 text-right font-medium text-gray-900">
                          {row.count}
                        </td>
                        <td className="py-2.5 text-right text-gray-500">
                          {row.percentage.toFixed(0)}%
                        </td>
                        <td className="py-2.5 pl-3">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-28">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(row.percentage, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Practice Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Practice Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingSkeleton rows={4} />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 font-medium text-gray-500">Practice</th>
                      <th className="text-right py-2 font-medium text-gray-500">HC</th>
                      <th className="text-right py-2 font-medium text-gray-500">Avg Score</th>
                      <th className="text-right py-2 font-medium text-gray-500">Avg PM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {practiceSummary.map((row) => (
                      <tr key={row.practice} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 font-medium text-gray-900">{row.practice}</td>
                        <td className="py-2.5 text-right text-gray-700">{row.headcount}</td>
                        <td
                          className={`py-2.5 text-right font-medium ${
                            row.avgFinalScore != null
                              ? getScoreColor(row.avgFinalScore)
                              : 'text-gray-400'
                          }`}
                        >
                          {formatScore(row.avgFinalScore)}
                        </td>
                        <td
                          className={`py-2.5 text-right font-medium ${
                            row.avgPMScore != null
                              ? getScoreColor(row.avgPMScore)
                              : 'text-gray-400'
                          }`}
                        >
                          {formatScore(row.avgPMScore)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Final Appraisals */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Final Appraisals</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton rows={8} />
            ) : recentAppraisals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No appraisals found for {fiscalYear}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-medium text-gray-500">Employee</th>
                    <th className="text-left py-2 font-medium text-gray-500">Practice</th>
                    <th className="text-right py-2 font-medium text-gray-500">Final Score</th>
                    <th className="text-right py-2 font-medium text-gray-500">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAppraisals.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-900">{a.employeeName}</td>
                      <td className="py-2.5 text-gray-600">{a.practice ?? '-'}</td>
                      <td
                        className={`py-2.5 text-right font-semibold ${
                          a.finalScore != null ? getScoreColor(a.finalScore) : 'text-gray-400'
                        }`}
                      >
                        {formatScore(a.finalScore)}
                      </td>
                      <td className="py-2.5 text-right">
                        {a.finalRating ? (
                          <Badge className={RATING_COLORS[a.finalRating] ?? ''}>{a.finalRating}</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  loading,
  icon,
  iconBg,
  label,
  value,
  valueClass,
}: {
  loading: boolean
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-4 pt-2">
          <div className={`p-2.5 rounded-lg ${iconBg} shrink-0`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 truncate">{label}</p>
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mt-1" />
            ) : (
              <p className={`text-2xl font-bold mt-0.5 ${valueClass ?? 'text-gray-900'}`}>
                {value}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  )
}
