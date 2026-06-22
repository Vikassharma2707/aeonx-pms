-- Project Manager relationship and section-level access control
-- Run this in Supabase SQL Editor

-- 1. Add project_manager column to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS project_manager TEXT;
CREATE INDEX IF NOT EXISTS idx_employees_project_manager ON employees(project_manager);

-- 2. RLS: Line managers can read goals of their direct reports
DROP POLICY IF EXISTS "goals_lm_can_read_reports" ON goals;
CREATE POLICY "goals_lm_can_read_reports" ON goals
  FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT e.employee_id FROM employees e
      WHERE e.line_manager = current_employee_id()
    )
  );

DROP POLICY IF EXISTS "goals_lm_can_update_reports" ON goals;
CREATE POLICY "goals_lm_can_update_reports" ON goals
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (
      SELECT e.employee_id FROM employees e
      WHERE e.line_manager = current_employee_id()
    )
  );

-- 3. RLS: Project managers can read and update tasks of their project reports
DROP POLICY IF EXISTS "tasks_pm_can_read_reports" ON quarterly_tasks;
CREATE POLICY "tasks_pm_can_read_reports" ON quarterly_tasks
  FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT e.employee_id FROM employees e
      WHERE e.project_manager = current_employee_id()
    )
  );

DROP POLICY IF EXISTS "tasks_pm_can_update_reports" ON quarterly_tasks;
CREATE POLICY "tasks_pm_can_update_reports" ON quarterly_tasks
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (
      SELECT e.employee_id FROM employees e
      WHERE e.project_manager = current_employee_id()
    )
  );

-- 4. RLS: Line managers can read employees who report to them (for team page)
DROP POLICY IF EXISTS "employees_lm_can_read_reports" ON employees;
CREATE POLICY "employees_lm_can_read_reports" ON employees
  FOR SELECT TO authenticated
  USING (
    line_manager = current_employee_id() OR
    project_manager = current_employee_id()
  );
