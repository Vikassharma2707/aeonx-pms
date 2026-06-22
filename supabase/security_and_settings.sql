-- ============================================================
-- AeonX PMS — Security, Roles & Deadline Settings
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add system_role column to employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS system_role TEXT DEFAULT 'employee'
    CHECK (system_role IN ('hr_admin', 'line_manager', 'project_manager', 'employee'));

-- 2. Appraisal settings table — deadlines + locks per fiscal year
CREATE TABLE IF NOT EXISTS appraisal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year TEXT NOT NULL UNIQUE,
  goal_deadline DATE,
  task_q1_deadline DATE,
  task_q2_deadline DATE,
  task_q3_deadline DATE,
  task_q4_deadline DATE,
  mid_year_deadline DATE,
  final_deadline DATE,
  goals_locked BOOLEAN DEFAULT FALSE,
  tasks_q1_locked BOOLEAN DEFAULT FALSE,
  tasks_q2_locked BOOLEAN DEFAULT FALSE,
  tasks_q3_locked BOOLEAN DEFAULT FALSE,
  tasks_q4_locked BOOLEAN DEFAULT FALSE,
  mid_year_locked BOOLEAN DEFAULT FALSE,
  final_locked BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default for current fiscal year
INSERT INTO appraisal_settings (fiscal_year)
VALUES ('2026-27')
ON CONFLICT (fiscal_year) DO NOTHING;

-- 3. Audit log for security changes
CREATE TABLE IF NOT EXISTS security_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  target_employee_id TEXT,
  changed_by TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS for appraisal_settings (admin only write, all read)
ALTER TABLE appraisal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_anon_read" ON appraisal_settings FOR SELECT TO anon USING (true);
CREATE POLICY "settings_auth_read" ON appraisal_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_anon_write" ON appraisal_settings FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE security_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_anon_all" ON security_audit FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Trigger to auto-lock when deadline passes
CREATE OR REPLACE FUNCTION auto_lock_on_deadline()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE appraisal_settings SET
    goals_locked      = CASE WHEN goal_deadline IS NOT NULL AND goal_deadline < CURRENT_DATE THEN TRUE ELSE goals_locked END,
    tasks_q1_locked   = CASE WHEN task_q1_deadline IS NOT NULL AND task_q1_deadline < CURRENT_DATE THEN TRUE ELSE tasks_q1_locked END,
    tasks_q2_locked   = CASE WHEN task_q2_deadline IS NOT NULL AND task_q2_deadline < CURRENT_DATE THEN TRUE ELSE tasks_q2_locked END,
    tasks_q3_locked   = CASE WHEN task_q3_deadline IS NOT NULL AND task_q3_deadline < CURRENT_DATE THEN TRUE ELSE tasks_q3_locked END,
    tasks_q4_locked   = CASE WHEN task_q4_deadline IS NOT NULL AND task_q4_deadline < CURRENT_DATE THEN TRUE ELSE tasks_q4_locked END,
    mid_year_locked   = CASE WHEN mid_year_deadline IS NOT NULL AND mid_year_deadline < CURRENT_DATE THEN TRUE ELSE mid_year_locked END,
    final_locked      = CASE WHEN final_deadline IS NOT NULL AND final_deadline < CURRENT_DATE THEN TRUE ELSE final_locked END,
    updated_at = NOW();
END;
$$;
