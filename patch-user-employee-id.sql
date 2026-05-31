-- ==========================================================================
-- CALVARY CONNECT - USER EMPLOYEE ID & DEPARTMENT PATCH
-- Run this in your Supabase SQL Editor to add employee_id and department
-- columns to user_profiles, enabling the auto-ID generation system.
-- ==========================================================================

-- 1. Add employee_id TEXT column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);

-- 2. Add department TEXT column to user_profiles (simple text, not FK)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS department TEXT;

-- 3. Add useful columns for user management
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS invited_by TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- 4. Create a unique index on employee_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_employee_id
  ON user_profiles(employee_id)
  WHERE employee_id IS NOT NULL AND employee_id != '';

-- 5. Create index for faster department lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_department
  ON user_profiles(department);

-- 6. Auto-backfill department from role for existing users who have no department set
UPDATE user_profiles
SET department = CASE role
  WHEN 'CEO' THEN 'Administration'
  WHEN 'ADMIN' THEN 'Administration'
  WHEN 'HR' THEN 'HR'
  WHEN 'OPERATOR' THEN 'Operations'
  WHEN 'DRIVER' THEN 'Operations'
  WHEN 'MECHANIC' THEN 'Workshop'
  WHEN 'ACCOUNTANT' THEN 'Finance'
  WHEN 'SALESMAN' THEN 'Sales'
  ELSE 'General'
END
WHERE department IS NULL AND role IS NOT NULL;

-- 7. Auto-generate employee_id for existing users who don't have one
-- This uses a window function to number users within each department prefix
DO $$
DECLARE
  r RECORD;
  v_prefix TEXT;
  v_count INTEGER;
  v_new_id TEXT;
BEGIN
  FOR r IN
    SELECT id, role, department
    FROM user_profiles
    WHERE (employee_id IS NULL OR employee_id = '')
    ORDER BY created_at ASC
  LOOP
    -- Determine prefix
    v_prefix := CASE r.department
      WHEN 'Administration' THEN 'ADM'
      WHEN 'Finance' THEN 'FIN'
      WHEN 'HR' THEN 'HR'
      WHEN 'IT' THEN 'IT'
      WHEN 'Operations' THEN 'OPS'
      WHEN 'Sales' THEN 'SAL'
      WHEN 'Workshop' THEN 'WRK'
      ELSE CASE r.role
        WHEN 'CEO' THEN 'ADM'
        WHEN 'ADMIN' THEN 'ADM'
        WHEN 'HR' THEN 'HR'
        WHEN 'OPERATOR' THEN 'OPS'
        WHEN 'DRIVER' THEN 'OPS'
        WHEN 'MECHANIC' THEN 'WRK'
        WHEN 'ACCOUNTANT' THEN 'FIN'
        WHEN 'SALESMAN' THEN 'SAL'
        ELSE 'EMP'
      END
    END;

    -- Find the current max number for this prefix
    SELECT COALESCE(MAX(
      CAST(SPLIT_PART(employee_id, '-', 2) AS INTEGER)
    ), 0) INTO v_count
    FROM user_profiles
    WHERE employee_id LIKE v_prefix || '-%';

    v_count := v_count + 1;
    v_new_id := v_prefix || '-' || LPAD(v_count::TEXT, 3, '0');

    UPDATE user_profiles
    SET employee_id = v_new_id,
        updated_at = NOW()
    WHERE id = r.id;
  END LOOP;
END $$;

-- 8. Verification
SELECT id, name, email, role, department, employee_id
FROM user_profiles
ORDER BY employee_id;

SELECT '✅ User Employee ID patch completed successfully!' AS status;
