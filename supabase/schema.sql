-- AeonX Enterprise PMS - Supabase Schema
-- Run this in your Supabase SQL editor

-- Enable RLS
ALTER DATABASE postgres SET timezone TO 'Asia/Kolkata';

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  designation TEXT,
  practice TEXT CHECK (practice IN ('SAP', 'Cloud', 'DevOps', 'PMO / Other')),
  location TEXT,
  line_manager TEXT,
  hire_date DATE,
  employment_type TEXT CHECK (employment_type IN ('Full Time', 'Contract', 'Intern')),
  active_status TEXT DEFAULT 'Active' CHECK (active_status IN ('Active', 'Inactive')),
  appraisal_band TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal Setting
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT REFERENCES employees(employee_id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL,
  goal_category TEXT CHECK (goal_category IN (
    'Delivery & Project Execution',
    'Technical Capability',
    'Customer / Stakeholder Management',
    'Process & Innovation',
    'Learning & Development',
    'Behavior / Team Contribution'
  )),
  goal_description TEXT NOT NULL,
  kpi_success_measure TEXT,
  weightage_percent NUMERIC(5,2),
  start_date DATE,
  due_date DATE,
  goal_status TEXT DEFAULT 'Not Started' CHECK (goal_status IN ('Not Started', 'In Progress', 'Completed', 'Deferred')),
  self_progress_percent NUMERIC(5,2),
  self_rating NUMERIC(3,1),
  lm_rating NUMERIC(3,1),
  weighted_goal_score NUMERIC(5,2),
  goal_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quarterly Task Log
CREATE TABLE IF NOT EXISTS quarterly_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT REFERENCES employees(employee_id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL,
  quarter TEXT CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  project_name TEXT NOT NULL,
  project_manager TEXT,
  task_id TEXT,
  task_description TEXT NOT NULL,
  planned_outcome TEXT,
  actual_outcome TEXT,
  task_status TEXT DEFAULT 'Not Started' CHECK (task_status IN ('Not Started', 'In Progress', 'Completed', 'Deferred')),
  self_rating NUMERIC(3,1),
  pm_rating NUMERIC(3,1),
  final_task_score NUMERIC(3,1),
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quarterly PM Feedback
CREATE TABLE IF NOT EXISTS quarterly_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT REFERENCES employees(employee_id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL,
  quarter TEXT CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  project_name TEXT NOT NULL,
  project_manager TEXT,
  allocation_percent NUMERIC(5,2),
  delivery_rating NUMERIC(3,1),
  timeliness_rating NUMERIC(3,1),
  technical_rating NUMERIC(3,1),
  communication_rating NUMERIC(3,1),
  ownership_rating NUMERIC(3,1),
  customer_focus_rating NUMERIC(3,1),
  process_compliance_rating NUMERIC(3,1),
  overall_pm_score NUMERIC(5,2),
  weighted_pm_score NUMERIC(5,2),
  review_status TEXT DEFAULT 'Draft' CHECK (review_status IN ('Draft', 'Submitted', 'Reviewed', 'Calibrated', 'Closed')),
  key_strengths TEXT,
  improvement_areas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mid Year Review
CREATE TABLE IF NOT EXISTS mid_year_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT REFERENCES employees(employee_id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL,
  goal_weight_check NUMERIC(5,2),
  avg_goal_progress_percent NUMERIC(5,2),
  q1_pm_score NUMERIC(5,2),
  q2_pm_score NUMERIC(5,2),
  h1_pm_avg NUMERIC(5,2),
  lm_mid_year_rating NUMERIC(3,1),
  mid_year_overall_score NUMERIC(5,2),
  potential TEXT,
  key_strengths TEXT,
  development_actions TEXT,
  review_status TEXT DEFAULT 'Draft' CHECK (review_status IN ('Draft', 'Submitted', 'Reviewed', 'Calibrated', 'Closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, fiscal_year)
);

-- Final Appraisal
CREATE TABLE IF NOT EXISTS final_appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT REFERENCES employees(employee_id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL,
  goal_weight_check NUMERIC(5,2),
  annual_goal_score NUMERIC(5,2),
  q1_pm_score NUMERIC(5,2),
  q2_pm_score NUMERIC(5,2),
  q3_pm_score NUMERIC(5,2),
  q4_pm_score NUMERIC(5,2),
  annual_pm_avg NUMERIC(5,2),
  behavior_values_rating NUMERIC(3,1),
  final_score NUMERIC(5,2),
  final_rating TEXT CHECK (final_rating IN (
    'Outstanding',
    'Exceeds Expectations',
    'Meets Expectations',
    'Needs Improvement',
    'Unsatisfactory'
  )),
  recommended_action TEXT CHECK (recommended_action IN (
    'Retain / Reward',
    'Promotion Ready',
    'Development Plan',
    'Performance Improvement Plan'
  )),
  calibration_notes TEXT,
  review_status TEXT DEFAULT 'Draft' CHECK (review_status IN ('Draft', 'Submitted', 'Reviewed', 'Calibrated', 'Closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, fiscal_year)
);

-- Indexes
CREATE INDEX idx_goals_employee ON goals(employee_id);
CREATE INDEX idx_goals_fiscal_year ON goals(fiscal_year);
CREATE INDEX idx_quarterly_tasks_employee ON quarterly_tasks(employee_id);
CREATE INDEX idx_quarterly_feedback_employee ON quarterly_feedback(employee_id);
CREATE INDEX idx_mid_year_reviews_employee ON mid_year_reviews(employee_id);
CREATE INDEX idx_final_appraisals_employee ON final_appraisals(employee_id);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON quarterly_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_feedback_updated BEFORE UPDATE ON quarterly_feedback FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_mid_year_updated BEFORE UPDATE ON mid_year_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appraisal_updated BEFORE UPDATE ON final_appraisals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies (enable after setting up auth)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE mid_year_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_appraisals ENABLE ROW LEVEL SECURITY;

-- Permissive policies for now (lock down per role after initial setup)
CREATE POLICY "Allow all authenticated" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated" ON goals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated" ON quarterly_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated" ON quarterly_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated" ON mid_year_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated" ON final_appraisals FOR ALL TO authenticated USING (true) WITH CHECK (true);
