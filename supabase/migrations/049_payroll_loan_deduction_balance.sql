-- Fixes a real, currently-blocking bug in post_payroll_period (live, but
-- only ever defined in the untracked database/migrations/010-payroll-engine.sql
-- — this migration is the first time it's in the tracked supabase/migrations/
-- sequence).
--
-- Phase 5 added employee_loans/payslip_loan_deductions and wired the payroll
-- engine (src/lib/finance/payroll/engine.ts) to fold each period's loan
-- installment into payslips.other_deductions, which reduces net_pay —
-- confirmed by calculatePayslip() in statutory-rates.ts:
--   netPay = grossPay - paye - nssfEmployee - nhifEmployee - otherDeductions
-- but post_payroll_period's journal entry never had a line for that money.
-- Algebraically, whenever any employee has an active loan the entry's
-- credit side falls short of its debit side by exactly the period's total
-- loan deductions — post_journal_entry's balance check then rejects the
-- whole posting outright (RAISE EXCEPTION 'Journal is not balanced'), and
-- src/lib/finance/payroll/engine.ts's postPayrollPeriod() throws before it
-- ever reaches the loan-outstanding-balance update. So today, posting any
-- payroll period with an active loan in it fails 100% of the time.
--
-- Fix: credit the period's SUM(other_deductions) to a new "Staff Loans
-- Receivable" asset account (1109 — next free code in the 11xx current
-- assets block after 1108 VAT Receivable; no such account existed before
-- this). Crediting an asset account correctly reduces it, mirroring what
-- the loan itself represents: money owed TO the company BY staff, paid
-- down via payroll deduction instead of cash.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- Matches the exact column pattern of its 11xx current-asset neighbors
-- (checked live against 1104-1108) — this table has three near-duplicate
-- classification columns (category, type, account_type) and the app reads
-- all three in different places, so all three need real values, not just
-- their generic 'asset' column defaults.
INSERT INTO accounts (code, name, category, type, account_type, currency, is_active, opening_balance, current_balance, balance)
SELECT '1109', 'Staff Loans Receivable', 'ASSETS', 'debit', 'asset', 'TZS', true, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1109');

CREATE OR REPLACE FUNCTION public.post_payroll_period(p_payroll_period_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
  v_loan_deductions DECIMAL;
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
    COALESCE(SUM(wcf), 0),
    COALESCE(SUM(other_deductions), 0)
  INTO v_driver_gross, v_office_gross, v_employer_contrib, v_net_pay, v_paye, v_nssf, v_nhif, v_sdl, v_wcf, v_loan_deductions
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
    VALUES (v_entry_id, '2111', 0, v_wcf, 'WCF due', v_line_order); v_line_order := v_line_order + 1;
  END IF;

  -- FIX: staff loan repayments deducted this period reduce what they owe
  -- the company (an asset), not a new liability — without this line the
  -- entry falls short on the credit side by exactly this amount whenever
  -- any employee has an active loan, and post_journal_entry rejects the
  -- whole posting.
  IF v_loan_deductions > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '1109', 0, v_loan_deductions, 'Staff loan repayments deducted this period', v_line_order);
  END IF;

  PERFORM post_journal_entry(v_entry_id);

  UPDATE payroll_periods SET status = 'posted', journal_entry_id = v_entry_id, updated_at = now()
  WHERE id = p_payroll_period_id;

  UPDATE payslips SET status = 'posted', updated_at = now()
  WHERE payroll_period_id = p_payroll_period_id;

  RETURN v_entry_id;
END;
$function$;

INSERT INTO public.schema_migrations (version) VALUES ('049_payroll_loan_deduction_balance.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
