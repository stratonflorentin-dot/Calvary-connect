ALTER TABLE driver_allowances
  ADD COLUMN IF NOT EXISTS loan_deduction_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deductions jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
