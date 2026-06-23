-- Workflow additions: goal approval flow, mid-year tracking, PM quarterly feedback
-- Run in Supabase SQL Editor

-- 1. Goal approval fields
ALTER TABLE goals ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft'
  CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'changes_requested'));
ALTER TABLE goals ADD COLUMN IF NOT EXISTS approval_comment TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Index for LM approval queries
CREATE INDEX IF NOT EXISTS idx_goals_approval_status ON goals(approval_status);

-- 3. RLS: LM can update approval_status on direct reports' goals
DROP POLICY IF EXISTS "goals_lm_can_approve" ON goals;
CREATE POLICY "goals_lm_can_approve" ON goals
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (
      SELECT e.employee_id FROM employees e
      WHERE e.line_manager = current_employee_id()
    )
  );

-- 4. RLS: PM can read/write quarterly_feedback for their project reports
DROP POLICY IF EXISTS "quarterly_feedback_pm_access" ON quarterly_feedback;
CREATE POLICY "quarterly_feedback_pm_access" ON quarterly_feedback
  FOR ALL TO authenticated
  USING (
    employee_id IN (
      SELECT e.employee_id FROM employees e
      WHERE e.project_manager = current_employee_id()
    )
    OR employee_id = current_employee_id()
  );

-- 5. RLS: LM can read/write mid_year_reviews for direct reports
DROP POLICY IF EXISTS "mid_year_lm_access" ON mid_year_reviews;
CREATE POLICY "mid_year_lm_access" ON mid_year_reviews
  FOR ALL TO authenticated
  USING (
    employee_id IN (
      SELECT e.employee_id FROM employees e
      WHERE e.line_manager = current_employee_id()
    )
    OR employee_id = current_employee_id()
  );
