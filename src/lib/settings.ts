import { getSupabase } from './supabase'

export interface AppraisalSettings {
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
  updated_at: string
}

export async function getActiveSettings(): Promise<AppraisalSettings | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('appraisal_settings')
    .select('*')
    .order('fiscal_year', { ascending: false })
    .limit(1)
    .single()
  return data
}

export function isLocked(settings: AppraisalSettings | null, field: keyof AppraisalSettings): boolean {
  if (!settings) return false
  return !!settings[field]
}
