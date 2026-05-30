-- ==========================================================================
-- CALVARY CONNECT - PAYROLL & COMPENSATION PATCH  
-- Run this in your Supabase SQL Editor to support the manual payroll system!
-- ==========================================================================

-- 1. Ensure all columns for manual payroll are in driver_allowances
ALTER TABLE driver_allowances ADD COLUMN IF NOT EXISTS driver_name VARCHAR(200);
ALTER TABLE driver_allowances ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE driver_allowances ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'allowance';
ALTER TABLE driver_allowances ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
ALTER TABLE driver_allowances ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE driver_allowances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1.5. Drop NOT NULL constraints on worker_name and role if they exist from legacy schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_allowances' AND column_name = 'worker_name') THEN
    ALTER TABLE driver_allowances ALTER COLUMN worker_name DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_allowances' AND column_name = 'role') THEN
    ALTER TABLE driver_allowances ALTER COLUMN role DROP NOT NULL;
  END IF;
END $$;

-- 2. Add indexes for faster payroll querying
CREATE INDEX IF NOT EXISTS idx_driver_allowances_type ON driver_allowances(type);
CREATE INDEX IF NOT EXISTS idx_driver_allowances_driver_id ON driver_allowances(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_allowances_status ON driver_allowances(status);

-- 3. Ensure expenses table supports Staff Costs category
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- 4. Ensure invoices table has linked_expense + description
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS linked_expense UUID REFERENCES expenses(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;

-- 5. Ensure user_profiles has salary field
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2) DEFAULT 0;

-- 6. Grant access for service role
GRANT ALL ON driver_allowances TO service_role;
GRANT ALL ON allowances TO service_role;
GRANT ALL ON expenses TO service_role;
GRANT ALL ON invoices TO service_role;

-- 7. Success message
SELECT '✅ Calvary Payroll schema patch v2 completed successfully!' AS status;
