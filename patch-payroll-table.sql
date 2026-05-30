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

-- 2. Add indexes for faster payroll querying
CREATE INDEX IF NOT EXISTS idx_driver_allowances_type ON driver_allowances(type);

-- 3. Success message
SELECT '✅ Payroll schema patch completed successfully!' as status;
