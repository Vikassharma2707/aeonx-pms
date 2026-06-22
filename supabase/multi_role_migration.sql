-- Convert system_role from TEXT to TEXT[] to support multiple roles per employee
-- Run this in Supabase SQL Editor

-- 1. Convert existing single-value column to array
ALTER TABLE employees
  ALTER COLUMN system_role TYPE TEXT[]
  USING CASE
    WHEN system_role IS NULL THEN NULL
    ELSE ARRAY[system_role]
  END;

-- 2. Set default to empty array for new rows
ALTER TABLE employees ALTER COLUMN system_role SET DEFAULT '{}';

-- 3. Update any NULLs to empty array
UPDATE employees SET system_role = '{}' WHERE system_role IS NULL;

-- 4. Update security_audit policies if needed (old_value / new_value stay as TEXT)
