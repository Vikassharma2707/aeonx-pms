-- Fix mm_sm_employees view to match MM01–MM05 and SM01–SM05 appraisal bands
-- Run in Supabase SQL Editor

CREATE OR REPLACE VIEW mm_sm_employees AS
SELECT employee_id, name, designation, practice, appraisal_band
FROM employees
WHERE active_status = 'Active'
  AND (
    appraisal_band ILIKE 'MM%'
    OR appraisal_band ILIKE 'SM%'
  );
