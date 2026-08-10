-- Phase 5: overtime pay, loan/salary-advance deductions, and leave
-- tracking wired into payroll. All three were identified as gaps in the
-- Phase 5 audit: payslips.overtime_pay existed but engine.ts hardcoded
-- it to 0; payslips.other_deductions existed but engine.ts hardcoded
-- that to 0 too, and no loans table existed to source a real number
-- from; leave_requests existed but had zero application code touching
-- it and payroll never accounted for unpaid leave.
--
-- Design note on WHY unpaid leave reduces gross_pay but loan deductions
-- don't: unpaid leave means fewer days actually worked, so it changes
-- taxable income (PAYE/NSSF/NHIF must be computed on the reduced
-- amount). A loan repayment is a post-tax deduction from a fully-earned
-- salary — deducting it from net pay after tax is the financially
-- correct order. Getting this backwards would make the payslip's tax
-- withholding wrong, not just the take-home total.
--
-- Design note on WHY loan deductions use a junction table
-- (payslip_loan_deductions) instead of just a number on payslips: the
-- payroll engine's existing regenerate-draft behavior deletes and
-- recreates payslip rows freely (see engine.ts), but an employee_loans
-- balance must only ever be decremented ONCE, at the irreversible
-- "post to ledger" step — never at draft-generate time, or regenerating
-- a draft twice would double-deduct the same installment. The junction
-- table (cascade-deleted with its payslip on regenerate) records
-- exactly which loan(s) and how much were used for a given draft
-- payslip, so postPayrollPeriod() has an exact, auditable list to apply
-- balance decrements from — computed once at generate time, applied
-- once at post time, never re-derived by re-running the "which loans
-- are active" query a second time (which could disagree with itself if
-- a loan was edited in between).
--
-- Design note on WHY leave_requests gets a payroll_period_id column
-- instead of a similar junction table: a leave request can only ever be
-- "spent" by exactly one payroll period (unlike a loan, which can span
-- many periods), so a single nullable FK is sufficient and simpler.
-- Regenerating a draft period releases (sets back to NULL) only the
-- leave requests it had claimed, then re-claims fresh — same
-- idempotency guarantee as the payslip delete/recreate it sits
-- alongside.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Leave tracking — extend the existing (built but unused) table
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT true;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES user_profiles(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejected_reason text;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS payroll_period_id uuid REFERENCES payroll_periods(id);
-- The workflow engine (src/lib/workflow/engine.ts) unconditionally sets
-- updated_at on every transition for every entity kind it manages.
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_payroll_period ON leave_requests(payroll_period_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Loans / salary advances
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES user_profiles(id),
  principal_amount numeric NOT NULL CHECK (principal_amount > 0),
  outstanding_balance numeric NOT NULL CHECK (outstanding_balance >= 0),
  installment_amount numeric NOT NULL CHECK (installment_amount > 0),
  currency text NOT NULL DEFAULT 'TZS',
  reason text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  approved_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_loans_employee ON employee_loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_status ON employee_loans(status);

CREATE TABLE IF NOT EXISTS payslip_loan_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  employee_loan_id uuid NOT NULL REFERENCES employee_loans(id),
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payslip_loan_deductions_payslip ON payslip_loan_deductions(payslip_id);
CREATE INDEX IF NOT EXISTS idx_payslip_loan_deductions_loan ON payslip_loan_deductions(employee_loan_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Overtime
--
-- rate_multiplier default (1.5x) and computed_amount are NOT verified
-- against Tanzania's Employment and Labour Relations Act — same class
-- of caveat as statutory-rates.ts's PAYE/NSSF/NHIF/SDL/WCF disclaimer.
-- computed_amount is a plain editable field (a suggested value, not an
-- asserted-correct one) precisely so a human confirms it rather than
-- this system silently trusting an unverified formula for something
-- that ends up on someone's paycheck.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS overtime_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES user_profiles(id),
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  hours numeric NOT NULL CHECK (hours > 0),
  rate_multiplier numeric NOT NULL DEFAULT 1.5,
  computed_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  approved_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_overtime_entries_employee ON overtime_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_entries_period ON overtime_entries(year, month);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. payslips — one new column: unpaid-leave deduction shown as its own
-- line for transparency, even though (per the design note above) it's
-- also already folded into gross_pay before tax.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS unpaid_leave_deduction numeric NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE employee_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslip_loan_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON employee_loans, payslip_loan_deductions, overtime_entries FROM anon;

DROP POLICY IF EXISTS employee_loans_self ON employee_loans;
CREATE POLICY employee_loans_self ON employee_loans FOR SELECT
  USING (employee_id = auth.uid() OR current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));
DROP POLICY IF EXISTS employee_loans_manage ON employee_loans;
CREATE POLICY employee_loans_manage ON employee_loans FOR INSERT
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));
DROP POLICY IF EXISTS employee_loans_update ON employee_loans;
CREATE POLICY employee_loans_update ON employee_loans FOR UPDATE
  USING (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));

-- Written only by the payroll engine (generate/post), which runs under
-- the requesting HR/ADMIN/CEO user's own session, so INSERT needs the
-- same role gate rather than SECURITY DEFINER.
DROP POLICY IF EXISTS payslip_loan_deductions_read ON payslip_loan_deductions;
CREATE POLICY payslip_loan_deductions_read ON payslip_loan_deductions FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));
DROP POLICY IF EXISTS payslip_loan_deductions_insert ON payslip_loan_deductions;
CREATE POLICY payslip_loan_deductions_insert ON payslip_loan_deductions FOR INSERT
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));
DROP POLICY IF EXISTS payslip_loan_deductions_delete ON payslip_loan_deductions;
CREATE POLICY payslip_loan_deductions_delete ON payslip_loan_deductions FOR DELETE
  USING (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));

DROP POLICY IF EXISTS overtime_entries_self_read ON overtime_entries;
CREATE POLICY overtime_entries_self_read ON overtime_entries FOR SELECT
  USING (employee_id = auth.uid() OR current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));
DROP POLICY IF EXISTS overtime_entries_self_insert ON overtime_entries;
CREATE POLICY overtime_entries_self_insert ON overtime_entries FOR INSERT
  WITH CHECK (employee_id = auth.uid() OR current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));
DROP POLICY IF EXISTS overtime_entries_approve ON overtime_entries;
CREATE POLICY overtime_entries_approve ON overtime_entries FOR UPDATE
  USING (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));

INSERT INTO public.schema_migrations (version) VALUES ('041_payroll_overtime_loans_leave.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
