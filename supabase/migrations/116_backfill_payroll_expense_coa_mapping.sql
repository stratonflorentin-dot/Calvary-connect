-- Payroll-generated expenses (approvePayrollRecordAction, src/app/allowances/
-- actions.ts) used category 'Staff Costs', which matches nothing in
-- EXPENSE_CATEGORY_COA_MAP (chart-of-accounts-service.ts uses 'salaries',
-- 'fuel', etc — not this label) and never set account_code directly, so
-- every one of these expenses showed "Unmapped" in Expenses/
-- Reconciliation. Fixed going forward in code; this backfills existing
-- rows. Safe to assume every existing 'Staff Costs' row is base payroll
-- (not a trip/per-diem allowance) — confirmed live, every driver_allowances
-- row on file today has type = 'payroll'; no trip-allowance type has been
-- used yet.
--
-- Idempotent: only touches rows still carrying the old label/no code, safe
-- to run more than once. Run in the Supabase SQL editor.

UPDATE expenses
SET category = 'Driver Salaries', account_code = '5102'
WHERE category = 'Staff Costs' AND account_code IS NULL;

NOTIFY pgrst, 'reload schema';
