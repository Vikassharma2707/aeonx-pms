import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key || url === 'your_supabase_project_url') {
      throw new Error('Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
    }
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Convenience alias - lazy singleton
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type Database = {
  employees: Employee
  goals: Goal
  quarterly_tasks: QuarterlyTask
  quarterly_feedback: QuarterlyFeedback
  mid_year_reviews: MidYearReview
  final_appraisals: FinalAppraisal
}

export type Employee = {
  id: string
  employee_id: string
  name: string
  designation?: string
  practice?: 'SAP' | 'Cloud' | 'DevOps' | 'PMO / Other'
  location?: string
  line_manager?: string
  hire_date?: string
  employment_type?: 'Full Time' | 'Contract' | 'Intern'
  active_status: 'Active' | 'Inactive'
  appraisal_band?: string
  email?: string
  created_at?: string
  updated_at?: string
}

export type Goal = {
  id: string
  employee_id: string
  fiscal_year: string
  goal_category?: string
  goal_description: string
  kpi_success_measure?: string
  weightage_percent?: number
  start_date?: string
  due_date?: string
  goal_status: 'Not Started' | 'In Progress' | 'Completed' | 'Deferred'
  self_progress_percent?: number
  self_rating?: number
  lm_rating?: number
  weighted_goal_score?: number
  goal_comments?: string
  created_at?: string
  updated_at?: string
}

export type QuarterlyTask = {
  id: string
  employee_id: string
  fiscal_year: string
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  project_name: string
  project_manager?: string
  task_id?: string
  task_description: string
  planned_outcome?: string
  actual_outcome?: string
  task_status: 'Not Started' | 'In Progress' | 'Completed' | 'Deferred'
  self_rating?: number
  pm_rating?: number
  final_task_score?: number
  priority: 'Low' | 'Medium' | 'High'
  created_at?: string
  updated_at?: string
}

export type QuarterlyFeedback = {
  id: string
  employee_id: string
  fiscal_year: string
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  project_name: string
  project_manager?: string
  allocation_percent?: number
  delivery_rating?: number
  timeliness_rating?: number
  technical_rating?: number
  communication_rating?: number
  ownership_rating?: number
  customer_focus_rating?: number
  process_compliance_rating?: number
  overall_pm_score?: number
  weighted_pm_score?: number
  review_status: 'Draft' | 'Submitted' | 'Reviewed' | 'Calibrated' | 'Closed'
  key_strengths?: string
  improvement_areas?: string
  created_at?: string
  updated_at?: string
}

export type MidYearReview = {
  id: string
  employee_id: string
  fiscal_year: string
  goal_weight_check?: number
  avg_goal_progress_percent?: number
  q1_pm_score?: number
  q2_pm_score?: number
  h1_pm_avg?: number
  lm_mid_year_rating?: number
  mid_year_overall_score?: number
  potential?: string
  key_strengths?: string
  development_actions?: string
  review_status: 'Draft' | 'Submitted' | 'Reviewed' | 'Calibrated' | 'Closed'
  created_at?: string
  updated_at?: string
}

export type FinalAppraisal = {
  id: string
  employee_id: string
  fiscal_year: string
  goal_weight_check?: number
  annual_goal_score?: number
  q1_pm_score?: number
  q2_pm_score?: number
  q3_pm_score?: number
  q4_pm_score?: number
  annual_pm_avg?: number
  behavior_values_rating?: number
  final_score?: number
  final_rating?: 'Outstanding' | 'Exceeds Expectations' | 'Meets Expectations' | 'Needs Improvement' | 'Unsatisfactory'
  recommended_action?: 'Retain / Reward' | 'Promotion Ready' | 'Development Plan' | 'Performance Improvement Plan'
  calibration_notes?: string
  review_status: 'Draft' | 'Submitted' | 'Reviewed' | 'Calibrated' | 'Closed'
  created_at?: string
  updated_at?: string
}
