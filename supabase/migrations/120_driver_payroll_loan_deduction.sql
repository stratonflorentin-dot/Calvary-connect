-- Drivers can already receive a salary advance today via
-- /admin/hr/payroll/loans (employee_loans — any active user_profile is
-- selectable there, drivers included) and src/lib/finance/payroll/engine.ts
-- already deducts installments from the general HR payroll run. But drivers
-- are paid through a separate, simpler flow (driver_allowances /
-- src/app/allowances/actions.ts) that never looked at employee_loans at
-- all — so a driver with an active advance still got their full salary,
-- with the "loan" just sitting there untouched. This wires the same
-- deduct-until-repaid behavior into that second payroll pathway, reusing
-- employee_loans rather than inventing a parallel advance concept.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE driver_allowances
  ADD COLUMN IF NOT EXISTS loan_deduction_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deductions jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
