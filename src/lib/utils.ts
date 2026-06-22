import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date?: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatScore(score?: number | null): string {
  if (score === null || score === undefined) return '-'
  return score.toFixed(2)
}

export function calculateWeightedGoalScore(
  weightage: number,
  lmRating: number,
  maxRating = 5
): number {
  return (weightage / 100) * (lmRating / maxRating) * 100
}

export function calculateOverallPMScore(ratings: number[]): number {
  const valid = ratings.filter((r) => r > 0)
  if (!valid.length) return 0
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

export function calculateFinalScore(
  goalScore: number,
  pmAvg: number,
  behaviorRating: number
): number {
  // Goal Achievement 50%, PM Feedback 30%, Behavior 20%
  const normalizedGoal = goalScore / 100 * 5
  const normalizedPM = pmAvg
  const normalizedBehavior = behaviorRating
  return (
    normalizedGoal * 0.5 +
    normalizedPM * 0.3 +
    normalizedBehavior * 0.2
  )
}
