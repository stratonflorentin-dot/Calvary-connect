-- ============================================================================
-- 010: Payroll Engine
-- ----------------------------------------------------------------------------
-- Replaces the ad-hoc "driver_allowances WHERE type='payroll'" hack with a
-- real payroll data model, and wires it into the double-entry ledger using
-- the same generate_entry_number() / post_journal_entry() functions already
-- used by create_trip_revenue_entry() / create_trip_expense_entry()
-- (see database/patches/accounting/accounting_functions.sql).
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Chart of accounts additions
--    (2107 NHIF Payable and 2108 NSSF Payable already exist. Adding the
--     accounts needed to stop collapsing every statutory withholding into
--     the generic '2105 Tax Payable' line — each of these is remitted to a
--     different agency on a different schedule, so they need to be
--     trackable and reconcilable separately.)
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO accounts (code, name, category, type) VALUES
  ('2109', 'PAYE Payable', 'LIABILITIES', 'credit'),
  ('2110', 'SDL Payable', 'LIABILITIES', 'credit'),
  ('2111', 'WCF Payable', 'LIABILITIES', 'credit'),
  ('6205', 'Employer Statutory Contributions', 'OPERATING_EXPENSES', 'debit')
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Employee compensation (salary structure)
--    One active row per employee at a time. Historical rows are kept
--    (effective_to set) instead of overwritten, so a payroll run for a past
--    period always uses the compensation that was in force at that time.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES user_profiles(id),
  employment_type text NOT NULL DEFAULT 'permanent'
    CHECK (employment_type IN ('permanent', 'contract', 'casual')),
  pay_frequency text NOT NULL DEFAULT 'monthly'
    CHECK (pay_frequency IN ('monthly', 'weekly')),
  cost_category text NOT NULL DEFAULT 'office'
    CHECK (cost_category IN ('office', 'driver')),  -- drives which expense account (5102 vs 6201) the gross pay is posted to
  base_salary numeric NOT NULL CHECK (base_salary >= 0),
  housing_allowance numeric NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  transport_allowance numeric NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0),
  other_allowances numeric NOT NULL DEFAULT 0 CHECK (other_allowances >= 0),
  currency text NOT NULL DEFAULT 'TZS',
  bank_name text,
  bank_account_number text,
  nssf_number text,
  nhif_number text,
  tin_number text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_employee_compensation_employee ON employee_compensation(employee_id);
-- Only one open-ended (effective_to IS NULL) compensation row per employee at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_compensation_one_active
  ON employee_compensation(employee_id) WHERE effective_to IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Payroll periods
--    A period is a lock boundary: once 'posted' or 'paid', payslips inside
--    it should not be silently edited (mirrors fiscal_periods from
--    006_finance_foundation.sql, scoped to payroll specifically).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'posted', 'paid', 'cancelled')),
  pay_date date,
  generated_by uuid REFERENCES user_profiles(id),
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  journal_entry_id uuid REFERENCES journal_entries(id),  -- the single consolidated JE for this period's payroll run
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Payslips
--    One row per employee per period. Amounts are stored (not recomputed
--    live) so a payslip stays accurate even if statutory rates change later.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES user_profiles(id),
  employee_compensation_id uuid REFERENCES employee_compensation(id),
  cost_category text NOT NULL DEFAULT 'office' CHECK (cost_category IN ('office', 'driver')),

  -- Earnings
  base_salary numeric NOT NULL DEFAULT 0,
  housing_allowance numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  other_allowances numeric NOT NULL DEFAULT 0,
  overtime_pay numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,

  -- Employee-side statutory deductions (withheld from gross pay)
  paye numeric NOT NULL DEFAULT 0,
  nssf_employee numeric NOT NULL DEFAULT 0,
  nhif_employee numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  other_deductions_note text,

  -- Employer-side statutory costs (NOT deducted from the employee; separate employer expense)
  nssf_employer numeric NOT NULL DEFAULT 0,
  sdl numeric NOT NULL DEFAULT 0,
  wcf numeric NOT NULL DEFAULT 0,

  net_pay numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'paid')),
  payment_id uuid REFERENCES payments(id),  -- set once actually disbursed via the payments module
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Journal posting for a payroll period
--    One consolidated entry per period rather than one per employee, so the
--    general ledger doesn't get flooded with per-employee lines every month.
--    Follows the same shape as create_trip_expense_entry():
--      generate_entry_number() -> insert journal_entries header
--                               -> insert journal_entry_lines
--                               -> post_journal_entry()
--
--    Debit:  5102 Driver Salaries   (sum of driver payslips' gross_pay)
--    Debit:  6201 Office Salaries   (sum of office payslips' gross_pay)
--    Debit:  6205 Employer Statutory Contributions (nssf_employer + sdl + wcf, all employees)
--    Credit: 2104 Salaries Payable  (total net_pay — what's actually owed to staff)
--    Credit: 2109 PAYE Payable      (total paye)
--    Credit: 2108 NSSF Payable      (nssf_employee + nssf_employer)
--    Credit: 2107 NHIF Payable      (total nhif_employee)
--    Credit: 2110 SDL Payable       (total sdl)
--    Credit: 2111 WCF Payable       (total wcf)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION post_payroll_period(p_payroll_period_id UUID)
RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
  v_entry_number TEXT;
  v_period RECORD;
  v_driver_gross DECIMAL;
  v_office_gross DECIMAL;
  v_employer_contrib DECIMAL;
  v_net_pay DECIMAL;
  v_paye DECIMAL;
  v_nssf DECIMAL;
  v_nhif DECIMAL;
  v_sdl DECIMAL;
  v_wcf DECIMAL;
  v_total DECIMAL;
  v_line_order INT := 1;
BEGIN
  SELECT * INTO v_period FROM payroll_periods WHERE id = p_payroll_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll period % not found', p_payroll_period_id;
  END IF;
  IF v_period.status NOT IN ('draft', 'approved') THEN
    RAISE EXCEPTION 'Payroll period % is already %; cannot re-post', p_payroll_period_id, v_period.status;
  END IF;

  SELECT
    COALESCE(SUM(gross_pay) FILTER (WHERE cost_category = 'driver'), 0),
    COALESCE(SUM(gross_pay) FILTER (WHERE cost_category = 'office'), 0),
    COALESCE(SUM(nssf_employer + sdl + wcf), 0),
    COALESCE(SUM(net_pay), 0),
    COALESCE(SUM(paye), 0),
    COALESCE(SUM(nssf_employee + nssf_employer), 0),
    COALESCE(SUM(nhif_employee), 0),
    COALESCE(SUM(sdl), 0),
    COALESCE(SUM(wcf), 0)
  INTO v_driver_gross, v_office_gross, v_employer_contrib, v_net_pay, v_paye, v_nssf, v_nhif, v_sdl, v_wcf
  FROM payslips
  WHERE payroll_period_id = p_payroll_period_id;

  v_total := v_driver_gross + v_office_gross + v_employer_contrib;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Payroll period % has no payslips to post', p_payroll_period_id;
  END IF;

  v_entry_number := generate_entry_number();

  INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, total_debit, total_credit)
  VALUES (
    v_entry_number,
    COALESCE(v_period.pay_date, CURRENT_DATE),
    'PAYROLL',
    p_payroll_period_id,
    'Payroll for ' || v_period.month || '/' || v_period.year,
    v_total,
    v_total
  )
  RETURNING id INTO v_entry_id;

  IF v_driver_gross > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '5102', v_driver_gross, 0, 'Driver salaries — gross pay', v_line_order); v_line_order := v_line_order + 1;
  END IF;

  IF v_office_gross > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '6201', v_office_gross, 0, 'Office salaries — gross pay', v_line_order); v_line_order := v_line_order + 1;
  END IF;

  IF v_employer_contrib > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '6205', v_employer_contrib, 0, 'Employer NSSF + SDL + WCF contributions', v_line_order); v_line_order := v_line_order + 1;
  END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
  VALUES (v_entry_id, '2104', 0, v_net_pay, 'Net pay owed to staff', v_line_order); v_line_order := v_line_order + 1;

  IF v_paye > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '2109', 0, v_paye, 'PAYE withheld, due to TRA', v_line_order); v_line_order := v_line_order + 1;
  END IF;

  IF v_nssf > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '2108', 0, v_nssf, 'NSSF due (employee + employer)', v_line_order); v_line_order := v_line_order + 1;
  END IF;

  IF v_nhif > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '2107', 0, v_nhif, 'NHIF due', v_line_order); v_line_order := v_line_order + 1;
  END IF;

  IF v_sdl > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '2110', 0, v_sdl, 'SDL due', v_line_order); v_line_order := v_line_order + 1;
  END IF;

  IF v_wcf > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '2111', 0, v_wcf, 'WCF due', v_line_order);
  END IF;

  PERFORM post_journal_entry(v_entry_id);

  UPDATE payroll_periods SET status = 'posted', journal_entry_id = v_entry_id, updated_at = now()
  WHERE id = p_payroll_period_id;

  UPDATE payslips SET status = 'posted', updated_at = now()
  WHERE payroll_period_id = p_payroll_period_id;

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. RLS — same role model as the rest of finance/HR (see 006_finance_foundation.sql)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE employee_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "HR/Finance manage compensation" ON employee_compensation;
CREATE POLICY "HR/Finance manage compensation" ON employee_compensation
  FOR ALL USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));

DROP POLICY IF EXISTS "HR/Finance manage payroll periods" ON payroll_periods;
CREATE POLICY "HR/Finance manage payroll periods" ON payroll_periods
  FOR ALL USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));

DROP POLICY IF EXISTS "HR/Finance manage payslips" ON payslips;
CREATE POLICY "HR/Finance manage payslips" ON payslips
  FOR ALL USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));

-- Employees can see their own payslips (read-only), same self-access pattern as driver_allowances
DROP POLICY IF EXISTS "Employees view own payslips" ON payslips;
CREATE POLICY "Employees view own payslips" ON payslips
  FOR SELECT USING (auth.uid() = employee_id);
