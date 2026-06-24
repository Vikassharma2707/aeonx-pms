-- ============================================================
-- AeonX PMS — Auth + Portal Layer
-- Run this AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- 1. Link employees to Supabase Auth users
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

-- 2. Designations considered MM / SM level (can receive task submissions)
-- HR sets this via appraisal_band or designation. We treat any employee whose
-- designation contains 'Manager' or 'Senior' as MM/SM.
-- We expose a helper view for the frontend to query eligible reviewers.
CREATE OR REPLACE VIEW mm_sm_employees AS
SELECT employee_id, name, designation, practice, appraisal_band
FROM employees
WHERE active_status = 'Active'
  AND (
    appraisal_band ILIKE 'MM%'
    OR appraisal_band ILIKE 'SM%'
  );

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES employees(employee_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'quarterly_task_reminder',
    'goal_review_request',
    'task_submitted',
    'task_reviewed',
    'mid_year_due',
    'appraisal_due',
    'general'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  fiscal_year TEXT,
  quarter TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- 4. Task submissions — track when employee submits tasks to a reviewer
ALTER TABLE quarterly_tasks
  ADD COLUMN IF NOT EXISTS submitted_to TEXT REFERENCES employees(employee_id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pm_comments TEXT,
  ADD COLUMN IF NOT EXISTS submission_status TEXT DEFAULT 'draft'
    CHECK (submission_status IN ('draft', 'submitted', 'reviewed'));

-- 5. ============================================================
--    RLS POLICIES — scoped per role
-- ============================================================

-- Drop old blanket anon policies
DROP POLICY IF EXISTS "anon_all" ON employees;
DROP POLICY IF EXISTS "anon_all" ON goals;
DROP POLICY IF EXISTS "anon_all" ON quarterly_tasks;
DROP POLICY IF EXISTS "anon_all" ON quarterly_feedback;
DROP POLICY IF EXISTS "anon_all" ON mid_year_reviews;
DROP POLICY IF EXISTS "anon_all" ON final_appraisals;
DROP POLICY IF EXISTS "Allow all authenticated" ON employees;
DROP POLICY IF EXISTS "Allow all authenticated" ON goals;
DROP POLICY IF EXISTS "Allow all authenticated" ON quarterly_tasks;
DROP POLICY IF EXISTS "Allow all authenticated" ON quarterly_feedback;
DROP POLICY IF EXISTS "Allow all authenticated" ON mid_year_reviews;
DROP POLICY IF EXISTS "Allow all authenticated" ON final_appraisals;

-- Helper: get the employee_id for the logged-in user
CREATE OR REPLACE FUNCTION current_employee_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT employee_id FROM employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper: is the current user an HR/admin?
-- HR admins are employees whose appraisal_band = 'HR' or designation ILIKE '%HR%'
CREATE OR REPLACE FUNCTION is_hr_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
      AND (appraisal_band = 'HR' OR designation ILIKE '%HR%' OR designation ILIKE '%Admin%')
  );
$$;

-- Helper: is the current user a manager (MM/SM)?
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid()
      AND (
        designation ILIKE '%Manager%'
        OR designation ILIKE '%Senior%'
        OR appraisal_band IN ('MM', 'SM', 'DM', 'AM', 'Partner', 'HR')
      )
  );
$$;

-- ── EMPLOYEES ─────────────────────────────────────────────────
-- HR: full access | Manager: read all | Employee: read own
CREATE POLICY "emp_hr_all" ON employees FOR ALL TO authenticated
  USING (is_hr_admin()) WITH CHECK (is_hr_admin());

CREATE POLICY "emp_manager_read" ON employees FOR SELECT TO authenticated
  USING (is_manager());

CREATE POLICY "emp_self_read" ON employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "emp_self_update" ON employees FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── GOALS ─────────────────────────────────────────────────────
-- HR: full | Manager: read/update goals of their direct reports | Employee: own goals
CREATE POLICY "goals_hr_all" ON goals FOR ALL TO authenticated
  USING (is_hr_admin()) WITH CHECK (is_hr_admin());

CREATE POLICY "goals_self" ON goals FOR ALL TO authenticated
  USING (employee_id = current_employee_id())
  WITH CHECK (employee_id = current_employee_id());

CREATE POLICY "goals_manager_read" ON goals FOR SELECT TO authenticated
  USING (
    is_manager() AND employee_id IN (
      SELECT employee_id FROM employees
      WHERE line_manager = current_employee_id()
    )
  );

CREATE POLICY "goals_manager_update" ON goals FOR UPDATE TO authenticated
  USING (
    is_manager() AND employee_id IN (
      SELECT employee_id FROM employees
      WHERE line_manager = current_employee_id()
    )
  );

-- ── QUARTERLY TASKS ────────────────────────────────────────────
CREATE POLICY "tasks_hr_all" ON quarterly_tasks FOR ALL TO authenticated
  USING (is_hr_admin()) WITH CHECK (is_hr_admin());

CREATE POLICY "tasks_self" ON quarterly_tasks FOR ALL TO authenticated
  USING (employee_id = current_employee_id())
  WITH CHECK (employee_id = current_employee_id());

-- Reviewer (submitted_to) can read and update tasks submitted to them
CREATE POLICY "tasks_reviewer" ON quarterly_tasks FOR SELECT TO authenticated
  USING (submitted_to = current_employee_id());

CREATE POLICY "tasks_reviewer_update" ON quarterly_tasks FOR UPDATE TO authenticated
  USING (submitted_to = current_employee_id());

-- ── QUARTERLY FEEDBACK ─────────────────────────────────────────
CREATE POLICY "feedback_hr_all" ON quarterly_feedback FOR ALL TO authenticated
  USING (is_hr_admin()) WITH CHECK (is_hr_admin());

CREATE POLICY "feedback_pm" ON quarterly_feedback FOR ALL TO authenticated
  USING (
    employee_id = current_employee_id() OR
    project_manager = (SELECT name FROM employees WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "feedback_manager_read" ON quarterly_feedback FOR SELECT TO authenticated
  USING (
    is_manager() AND employee_id IN (
      SELECT employee_id FROM employees WHERE line_manager = current_employee_id()
    )
  );

-- ── MID YEAR REVIEWS ──────────────────────────────────────────
CREATE POLICY "myr_hr_all" ON mid_year_reviews FOR ALL TO authenticated
  USING (is_hr_admin()) WITH CHECK (is_hr_admin());

CREATE POLICY "myr_self_read" ON mid_year_reviews FOR SELECT TO authenticated
  USING (employee_id = current_employee_id());

CREATE POLICY "myr_manager" ON mid_year_reviews FOR ALL TO authenticated
  USING (
    is_manager() AND employee_id IN (
      SELECT employee_id FROM employees WHERE line_manager = current_employee_id()
    )
  );

-- ── FINAL APPRAISALS ──────────────────────────────────────────
CREATE POLICY "appraisal_hr_all" ON final_appraisals FOR ALL TO authenticated
  USING (is_hr_admin()) WITH CHECK (is_hr_admin());

CREATE POLICY "appraisal_self_read" ON final_appraisals FOR SELECT TO authenticated
  USING (employee_id = current_employee_id());

CREATE POLICY "appraisal_manager" ON final_appraisals FOR ALL TO authenticated
  USING (
    is_manager() AND employee_id IN (
      SELECT employee_id FROM employees WHERE line_manager = current_employee_id()
    )
  );

-- ── NOTIFICATIONS ─────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- HR can insert notifications for anyone
CREATE POLICY "notif_hr_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (is_hr_admin());

-- 6. Function to send quarterly task reminders to all active employees
CREATE OR REPLACE FUNCTION send_quarterly_reminders(p_fiscal_year TEXT, p_quarter TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications (user_id, employee_id, type, title, message, action_url, fiscal_year, quarter)
  SELECT
    e.user_id,
    e.employee_id,
    'quarterly_task_reminder',
    p_quarter || ' Task Log Due',
    'Please update your quarterly task log for ' || p_quarter || ' ' || p_fiscal_year || '. Submit your tasks to your reporting manager by end of this week.',
    '/portal/tasks',
    p_fiscal_year,
    p_quarter
  FROM employees e
  WHERE e.active_status = 'Active' AND e.user_id IS NOT NULL;
END;
$$;

-- 7. Trigger: notify reviewer when a task is submitted
CREATE OR REPLACE FUNCTION notify_task_submission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reviewer_user_id UUID;
  v_employee_name TEXT;
BEGIN
  IF NEW.submission_status = 'submitted' AND (OLD.submission_status IS DISTINCT FROM 'submitted') THEN
    SELECT user_id INTO v_reviewer_user_id FROM employees WHERE employee_id = NEW.submitted_to;
    SELECT name INTO v_employee_name FROM employees WHERE employee_id = NEW.employee_id;

    IF v_reviewer_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, employee_id, type, title, message, action_url, fiscal_year, quarter)
      VALUES (
        v_reviewer_user_id,
        NEW.submitted_to,
        'task_submitted',
        'Task Submitted for Review',
        v_employee_name || ' has submitted their ' || NEW.quarter || ' task log for your review.',
        '/portal/team/tasks',
        NEW.fiscal_year,
        NEW.quarter
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_submission
AFTER UPDATE ON quarterly_tasks
FOR EACH ROW EXECUTE FUNCTION notify_task_submission();
