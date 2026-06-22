export const PRACTICES = ['SAP', 'Cloud', 'DevOps', 'PMO / Other'] as const
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
export const EMPLOYMENT_TYPES = ['Full Time', 'Contract', 'Intern'] as const
export const ACTIVE_STATUS = ['Active', 'Inactive'] as const
export const FISCAL_YEARS = ['2025-26', '2026-27', '2027-28', '2028-29'] as const
export const PRIORITIES = ['Low', 'Medium', 'High'] as const

export const GOAL_CATEGORIES = [
  'Delivery & Project Execution',
  'Technical Capability',
  'Customer / Stakeholder Management',
  'Process & Innovation',
  'Learning & Development',
  'Behavior / Team Contribution',
] as const

export const GOAL_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Deferred'] as const
export const TASK_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Deferred'] as const

export const REVIEW_STATUSES = ['Draft', 'Submitted', 'Reviewed', 'Calibrated', 'Closed'] as const

export const FINAL_RATINGS = [
  'Outstanding',
  'Exceeds Expectations',
  'Meets Expectations',
  'Needs Improvement',
  'Unsatisfactory',
] as const

export const RECOMMENDED_ACTIONS = [
  'Retain / Reward',
  'Promotion Ready',
  'Development Plan',
  'Performance Improvement Plan',
] as const

export const RATING_COLORS: Record<string, string> = {
  Outstanding: 'bg-emerald-100 text-emerald-800',
  'Exceeds Expectations': 'bg-blue-100 text-blue-800',
  'Meets Expectations': 'bg-yellow-100 text-yellow-800',
  'Needs Improvement': 'bg-orange-100 text-orange-800',
  Unsatisfactory: 'bg-red-100 text-red-800',
}

export const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  Reviewed: 'bg-purple-100 text-purple-700',
  Calibrated: 'bg-amber-100 text-amber-700',
  Closed: 'bg-green-100 text-green-700',
  'Not Started': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Deferred: 'bg-orange-100 text-orange-700',
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-red-100 text-red-700',
}

export const SCORING_MODEL = {
  goalAchievement: 0.5,
  pmFeedback: 0.3,
  behaviorValues: 0.2,
}

export function getFinalRating(score: number): string {
  if (score >= 4.5) return 'Outstanding'
  if (score >= 3.5) return 'Exceeds Expectations'
  if (score >= 2.5) return 'Meets Expectations'
  if (score >= 1.5) return 'Needs Improvement'
  return 'Unsatisfactory'
}

export function getScoreColor(score: number): string {
  if (score >= 4.5) return 'text-emerald-600'
  if (score >= 3.5) return 'text-blue-600'
  if (score >= 2.5) return 'text-yellow-600'
  if (score >= 1.5) return 'text-orange-600'
  return 'text-red-600'
}
