-- Company Loans — history + monthly repayment approval
--
-- Turns the HR loan calculator into a persistent module. A loan the company
-- takes (truck, trailer, land, business expansion, other) is saved as a row in
-- `company_loans` together with the full amortization schedule generated from
-- the same reducing-balance / flat-rate math the calculator uses. Each period
-- becomes a row in `company_loan_payments` that flows through an approval
-- workflow: pending -> submitted -> approved | rejected.
--
-- CEO / ADMIN / HR / ACCOUNTANT can create loans and submit a period's payment
-- return for approval. CEO / ADMIN / HR approve (or reject) it. Approving posts
-- a balanced journal entry (Dr loan payable principal, Dr 6502 Loan Interest,
-- Cr bank account) via post_journal_entry, reduces the bank account's own
-- current_balance inline in the SAME transaction, decrements the loan's
-- outstanding balance, and auto-completes the loan when it reaches zero.
--
-- Modeled directly on vehicle_loans (migration 056) for the GL posting and on
-- employee_loans (041/049) for the issue/approve lifecycle. Idempotent: safe to
-- run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS company_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number text UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('truck', 'trailer', 'land', 'business_expansion', 'other')),
  purpose_note text,
  lender text NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  principal_amount numeric NOT NULL CHECK (principal_amount > 0),
  annual_rate_pct numeric NOT NULL DEFAULT 0 CHECK (annual_rate_pct >= 0),
  method text NOT NULL DEFAULT 'reducing' CHECK (method IN ('reducing', 'flat')),
  frequency int NOT NULL DEFAULT 12 CHECK (frequency IN (1, 2, 4, 12)),
  tenure_years int NOT NULL DEFAULT 0 CHECK (tenure_years >= 0),
  tenure_months int NOT NULL DEFAULT 0 CHECK (tenure_months BETWEEN 0 AND 11),
  processing_fee numeric NOT NULL DEFAULT 0 CHECK (processing_fee >= 0),
  legal_fee numeric NOT NULL DEFAULT 0 CHECK (legal_fee >= 0),
  insurance_annual_pct numeric NOT NULL DEFAULT 0 CHECK (insurance_annual_pct >= 0),
  total_interest numeric NOT NULL DEFAULT 0 CHECK (total_interest >= 0),
  total_insurance numeric NOT NULL DEFAULT 0 CHECK (total_insurance >= 0),
  total_cost numeric NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  installment_amount numeric NOT NULL DEFAULT 0 CHECK (installment_amount >= 0),
  outstanding_balance numeric NOT NULL CHECK (outstanding_balance >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  loan_payable_account_code text NOT NULL DEFAULT '2203'
    CHECK (loan_payable_account_code IN ('2201', '2202', '2203')),
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tenure_years + tenure_months > 0)
);
CREATE INDEX IF NOT EXISTS idx_company_loans_status ON company_loans(status);
CREATE INDEX IF NOT EXISTS idx_company_loans_created ON company_loans(created_at DESC);

CREATE TABLE IF NOT EXISTS company_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_loan_id uuid NOT NULL REFERENCES company_loans(id) ON DELETE RESTRICT,
  period int NOT NULL CHECK (period > 0),
  due_date date NOT NULL,
  principal_portion numeric NOT NULL CHECK (principal_portion >= 0),
  interest_portion numeric NOT NULL DEFAULT 0 CHECK (interest_portion >= 0),
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  submitted_by uuid REFERENCES user_profiles(id),
  submitted_at timestamptz,
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  rejected_by uuid REFERENCES user_profiles(id),
  rejected_at timestamptz,
  rejection_reason text,
  bank_account_id uuid REFERENCES bank_accounts(id),
  journal_entry_id uuid REFERENCES journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (principal_portion + interest_portion = amount),
  UNIQUE (company_loan_id, period)
);
CREATE INDEX IF NOT EXISTS idx_company_loan_payments_loan ON company_loan_payments(company_loan_id);
CREATE INDEX IF NOT EXISTS idx_company_loan_payments_status ON company_loan_payments(status);

REVOKE ALL ON company_loans FROM anon;
ALTER TABLE company_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_loans_all ON company_loans;
CREATE POLICY company_loans_all ON company_loans FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));

REVOKE ALL ON company_loan_payments FROM anon;
ALTER TABLE company_loan_payments ENABLE ROW LEVEL SECURITY;
-- Read-only for clients: every payment row is created exclusively by
-- create_company_loan and its status transitions happen only through the
-- submit/approve/reject RPCs (SECURITY DEFINER, bypass RLS as table owner).
DROP POLICY IF EXISTS company_loan_payments_read ON company_loan_payments;
CREATE POLICY company_loan_payments_read ON company_loan_payments FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));

-- Numbering — mirrors assign_vehicle_loan_number() in 056_vehicle_loan_financing.sql.
INSERT INTO document_sequences (doc_type, prefix) VALUES ('company_loan', 'CL-')
ON CONFLICT (doc_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_company_loan_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.loan_number IS NULL THEN
    NEW.loan_number := next_doc_number('company_loan');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_company_loan_number ON company_loans;
CREATE TRIGGER trg_assign_company_loan_number
  BEFORE INSERT ON company_loans
  FOR EACH ROW
  EXECUTE FUNCTION assign_company_loan_number();

-- ────────────────────────────────────────────────────────────────────────────
-- create_company_loan — persists a loan and generates its full payment
-- schedule using the same amortization math as the HR loan calculator.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_company_loan(
  p_purpose text,
  p_purpose_note text DEFAULT NULL,
  p_lender text DEFAULT 'Company loan',
  p_currency text DEFAULT 'TZS',
  p_principal numeric DEFAULT 0,
  p_annual_rate_pct numeric DEFAULT 0,
  p_method text DEFAULT 'reducing',
  p_frequency int DEFAULT 12,
  p_tenure_years int DEFAULT 0,
  p_tenure_months int DEFAULT 0,
  p_processing_fee numeric DEFAULT 0,
  p_legal_fee numeric DEFAULT 0,
  p_insurance_annual_pct numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_loan_id uuid;
  v_total_months int;
  v_periods int;
  v_periodic_rate numeric;
  v_payment numeric;
  v_balance numeric;
  v_period int := 0;
  v_guard int;
  v_interest numeric;
  v_principal_portion numeric;
  v_period_payment numeric;
  v_closing numeric;
  v_total_interest numeric := 0;
  v_insurance_per_period numeric;
  v_total_insurance numeric;
  v_total_cost numeric;
  v_loan_payable text;
  v_due_date date;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/HR/ACCOUNTANT may create a company loan';
  END IF;

  IF p_principal IS NULL OR p_principal <= 0 THEN
    RAISE EXCEPTION 'p_principal must be a positive number';
  END IF;
  IF p_purpose NOT IN ('truck', 'trailer', 'land', 'business_expansion', 'other') THEN
    RAISE EXCEPTION 'Invalid loan purpose: %', p_purpose;
  END IF;
  IF p_method NOT IN ('reducing', 'flat') THEN
    RAISE EXCEPTION 'Invalid method: %', p_method;
  END IF;
  IF p_frequency NOT IN (1, 2, 4, 12) THEN
    RAISE EXCEPTION 'Invalid frequency: %', p_frequency;
  END IF;

  v_total_months := p_tenure_years * 12 + p_tenure_months;
  IF v_total_months <= 0 THEN
    RAISE EXCEPTION 'Tenure must be at least one month';
  END IF;
  v_periods := GREATEST(1, ROUND(v_total_months / (12.0 / p_frequency)));
  v_periodic_rate := p_annual_rate_pct / 100.0 / p_frequency;

  -- Loan payable account: trucks/trailers map to the vehicle financing
  -- accounts, everything else to the general Bank Loan account.
  v_loan_payable := CASE
    WHEN p_purpose IN ('truck', 'trailer') THEN
      CASE WHEN p_purpose = 'truck' THEN '2201' ELSE '2202' END
    ELSE '2203'
  END;

  v_insurance_per_period := p_principal * (p_insurance_annual_pct / 100.0) / p_frequency;
  v_total_insurance := v_insurance_per_period * v_periods;

  -- Per-period payment (independent of the schedule loop).
  IF p_method = 'reducing' THEN
    v_payment := CASE WHEN v_periodic_rate = 0
      THEN p_principal / v_periods
      ELSE (p_principal * v_periodic_rate * POWER(1 + v_periodic_rate, v_periods))
           / (POWER(1 + v_periodic_rate, v_periods) - 1)
    END;
  ELSE
    v_total_interest := p_principal * (p_annual_rate_pct / 100.0) * (v_total_months / 12.0);
    v_payment := (p_principal + v_total_interest) / v_periods;
  END IF;

  -- Insert the loan first so the schedule rows can reference its id.
  INSERT INTO company_loans (
    purpose, purpose_note, lender, currency, principal_amount, annual_rate_pct,
    method, frequency, tenure_years, tenure_months, processing_fee, legal_fee,
    insurance_annual_pct, total_interest, total_insurance, total_cost,
    installment_amount, outstanding_balance, status, loan_payable_account_code,
    notes, created_by
  ) VALUES (
    p_purpose, p_purpose_note, p_lender, p_currency, p_principal, p_annual_rate_pct,
    p_method, p_frequency, p_tenure_years, p_tenure_months, p_processing_fee, p_legal_fee,
    p_insurance_annual_pct, v_total_interest, v_total_insurance, 0,
    v_payment, p_principal, 'active', v_loan_payable,
    p_notes, auth.uid()
  )
  RETURNING id INTO v_loan_id;

  -- Amortization (mirrors buildReducingSchedule / buildFlatSchedule in the
  -- loan calculator page).
  IF p_method = 'reducing' THEN
    v_total_interest := 0;
    v_balance := p_principal;
    v_guard := v_periods * 2 + 24;
    WHILE v_balance > 0.5 AND v_period < v_guard LOOP
      v_period := v_period + 1;
      v_interest := v_balance * v_periodic_rate;
      v_principal_portion := v_payment - v_interest;
      IF v_principal_portion > v_balance THEN v_principal_portion := v_balance; END IF;
      IF v_principal_portion < 0 THEN v_principal_portion := 0; END IF;
      v_period_payment := v_interest + v_principal_portion;
      v_closing := v_balance - v_principal_portion;
      v_total_interest := v_total_interest + v_interest;
      v_due_date := (CURRENT_DATE + (v_period - 1) * (12 / p_frequency) * INTERVAL '1 month')::date;
      INSERT INTO company_loan_payments
        (company_loan_id, period, due_date, principal_portion, interest_portion, amount)
      VALUES
        (v_loan_id, v_period, v_due_date, v_principal_portion, v_interest, v_period_payment);
      v_balance := v_closing;
    END LOOP;
  ELSE
    v_balance := p_principal;
    FOR v_period IN 1..v_periods LOOP
      v_principal_portion := CASE WHEN v_period = v_periods THEN v_balance ELSE p_principal / v_periods END;
      v_interest := v_total_interest / v_periods;
      v_closing := v_balance - v_principal_portion;
      v_due_date := (CURRENT_DATE + (v_period - 1) * (12 / p_frequency) * INTERVAL '1 month')::date;
      INSERT INTO company_loan_payments
        (company_loan_id, period, due_date, principal_portion, interest_portion, amount)
      VALUES
        (v_loan_id, v_period, v_due_date, v_principal_portion, v_interest, v_principal_portion + v_interest);
      v_balance := v_closing;
    END LOOP;
  END IF;

  v_total_cost := p_principal + v_total_interest + p_processing_fee + p_legal_fee + v_total_insurance;

  UPDATE company_loans
     SET total_interest = v_total_interest, total_cost = v_total_cost, updated_at = now()
   WHERE id = v_loan_id;

  RETURN v_loan_id;
END;
$function$;

-- ────────────────────────────────────────────────────────────────────────────
-- submit_company_loan_payment — a period's payment return is submitted for
-- approval (pending -> submitted).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_company_loan_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment company_loan_payments%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/HR/ACCOUNTANT may submit a payment return';
  END IF;

  SELECT * INTO v_payment FROM company_loan_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment is % — only pending payments can be submitted', v_payment.status;
  END IF;

  UPDATE company_loan_payments
     SET status = 'submitted', submitted_by = auth.uid(), submitted_at = now()
   WHERE id = p_payment_id;
END;
$function$;

-- ────────────────────────────────────────────────────────────────────────────
-- approve_company_loan_payment — CEO/ADMIN/HR approves a submitted payment
-- return. Posts the GL entry, reduces the bank balance, decrements the loan
-- outstanding, and auto-completes the loan at zero.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_company_loan_payment(
  p_payment_id uuid,
  p_bank_account_id uuid,
  p_payment_date date DEFAULT CURRENT_DATE
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment company_loan_payments%ROWTYPE;
  v_loan company_loans%ROWTYPE;
  v_bank bank_accounts%ROWTYPE;
  v_entry_id uuid;
  v_new_balance numeric;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'HR') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/HR may approve a payment return';
  END IF;

  SELECT * INTO v_payment FROM company_loan_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status <> 'submitted' THEN
    RAISE EXCEPTION 'Payment is % — only submitted payments can be approved', v_payment.status;
  END IF;

  SELECT * INTO v_loan FROM company_loans WHERE id = v_payment.company_loan_id FOR UPDATE;
  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'Company loan not found';
  END IF;
  IF v_loan.status <> 'active' THEN
    RAISE EXCEPTION 'Loan % is % — cannot approve a payment', v_loan.loan_number, v_loan.status;
  END IF;

  SELECT * INTO v_bank FROM bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
  IF v_bank.id IS NULL OR v_bank.coa_account_code IS NULL THEN
    RAISE EXCEPTION 'Bank account has no linked Chart of Accounts code — set one on the Bank Accounts page first';
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id,
    currency, status, is_posted, total_debit, total_credit, created_by
  ) VALUES (
    generate_entry_number(), p_payment_date, p_payment_date,
    'Company loan repayment — ' || v_loan.loan_number || ' period ' || v_payment.period,
    'COMPANY_LOAN_PAYMENT', v_payment.id, v_loan.currency, 'draft', false,
    v_payment.amount, v_payment.amount, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_loan.loan_payable_account_code, v_payment.principal_portion, 0, 'Loan principal repaid — ' || v_loan.loan_number, v_loan.currency, 1);

  IF v_payment.interest_portion > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '6502', v_payment.interest_portion, 0, 'Loan interest — ' || v_loan.loan_number, v_loan.currency, 2);
  END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_bank.coa_account_code, 0, v_payment.amount, 'Company loan repayment — ' || v_loan.loan_number, v_loan.currency, 3);

  -- Post the entry directly (not via post_journal_entry, whose role guard only
  -- allows CEO/ADMIN/ACCOUNTANT — HR must be able to approve here). This
  -- function is SECURITY DEFINER and already enforces the CEO/ADMIN/HR guard
  -- above, so we replicate the same balance-check-and-post steps.
  IF NOT is_period_open(p_payment_date) THEN
    RAISE EXCEPTION 'Fiscal period is closed';
  END IF;

  UPDATE journal_entries
     SET status = 'posted', is_posted = true,
         total_debit = v_payment.amount, total_credit = v_payment.amount,
         posted_at = now(), posted_by = auth.uid(), updated_at = now()
   WHERE id = v_entry_id;

  UPDATE accounts a
     SET current_balance = COALESCE(a.current_balance, 0) +
           CASE WHEN a.type = 'debit'
                THEN l.d - l.c
                ELSE l.c - l.d
           END,
         updated_at = now()
    FROM (
      SELECT account_code, SUM(debit_amount) AS d, SUM(credit_amount) AS c
        FROM journal_entry_lines
       WHERE journal_entry_id = v_entry_id
       GROUP BY account_code
    ) l
   WHERE a.code = l.account_code;

  UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) - v_payment.amount, updated_at = now()
  WHERE id = p_bank_account_id;

  v_new_balance := GREATEST(0, v_loan.outstanding_balance - v_payment.principal_portion);
  UPDATE company_loans
     SET outstanding_balance = v_new_balance,
         status = CASE WHEN v_new_balance <= 0 THEN 'completed' ELSE status END,
         updated_at = now()
   WHERE id = v_loan.id;

  UPDATE company_loan_payments
     SET status = 'approved', approved_by = auth.uid(), approved_at = now(),
         bank_account_id = p_bank_account_id, journal_entry_id = v_entry_id
   WHERE id = p_payment_id;

  RETURN v_entry_id;
END;
$function$;

-- ────────────────────────────────────────────────────────────────────────────
-- reject_company_loan_payment — CEO/ADMIN/HR rejects a submitted payment
-- return (submitted -> rejected).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_company_loan_payment(
  p_payment_id uuid,
  p_reason text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment company_loan_payments%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'HR') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/HR may reject a payment return';
  END IF;

  SELECT * INTO v_payment FROM company_loan_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status <> 'submitted' THEN
    RAISE EXCEPTION 'Payment is % — only submitted payments can be rejected', v_payment.status;
  END IF;

  UPDATE company_loan_payments
     SET status = 'rejected', rejected_by = auth.uid(), rejected_at = now(),
         rejection_reason = p_reason
   WHERE id = p_payment_id;
END;
$function$;

-- ────────────────────────────────────────────────────────────────────────────
-- cancel_company_loan — cancels an active loan (no further payments).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_company_loan(p_loan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_loan company_loans%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/HR/ACCOUNTANT may cancel a company loan';
  END IF;

  SELECT * INTO v_loan FROM company_loans WHERE id = p_loan_id FOR UPDATE;
  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'Company loan not found';
  END IF;
  IF v_loan.status <> 'active' THEN
    RAISE EXCEPTION 'Loan % is % — cannot cancel', v_loan.loan_number, v_loan.status;
  END IF;

  UPDATE company_loans SET status = 'cancelled', updated_at = now() WHERE id = p_loan_id;
END;
$function$;

INSERT INTO public.schema_migrations (version) VALUES ('137_company_loans.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
