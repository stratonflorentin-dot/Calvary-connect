-- Vehicles purchased partly or fully on a loan never posted to the Chart of
-- Accounts at all — purchase_price/purchase_date columns have existed on
-- `vehicles` since 20240620_vehicle_details.sql, but vehicle-form-dialog.tsx
-- never read or wrote them, and nothing ever posted a journal entry for a
-- vehicle acquisition. Meanwhile the Chart of Accounts already has every
-- account this needs, seeded since the original schema but wired into zero
-- posting functions: fixed assets 1201 (Trucks and Trailers) / 1202 (Motor
-- Vehicles), long-term liabilities 2201 (Truck Loan) / 2202 (Vehicle
-- Financing), and 6502 (Loan Interest).
--
-- Modeled directly on employee_loans (migration 041, refined by 049): a loan
-- table with principal/outstanding/status, here adapted for manual (not
-- payroll-period-driven) repayments. Explicitly out of scope per the user's
-- own choice: depreciation (accounts 1301/1302 stay untouched placeholders)
-- and amortization schedules (repayments are recorded one at a time, like a
-- simplified bank transaction, not generated in advance).
--
-- post_vehicle_acquisition posts:
--   Dr Fixed Asset (1201/1202)         purchase_price
--   Cr Vehicle Loan Payable (2201/2202) principal_amount (financed portion)
--   Cr down-payment bank account        down_payment, if any
-- post_vehicle_loan_repayment posts:
--   Dr Vehicle Loan Payable (2201/2202) principal_portion
--   Dr Loan Interest (6502)             interest_portion, if any
--   Cr bank account                     amount
-- Both call post_journal_entry (the same balance-check-and-post primitive
-- every other posting function in this system uses) and update the bank
-- account's own current_balance inline in the SAME transaction — not via a
-- second call into post_bank_transaction, which would produce a second,
-- redundant journal entry for the same cash movement (the exact class of
-- bug migration 052 already fixed once for post_bank_transaction's own
-- journal mirror).
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS vehicle_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number text UNIQUE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  lender text NOT NULL,
  purchase_price numeric NOT NULL CHECK (purchase_price > 0),
  down_payment numeric NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
  principal_amount numeric NOT NULL CHECK (principal_amount > 0),
  outstanding_balance numeric NOT NULL CHECK (outstanding_balance >= 0),
  interest_rate numeric,                    -- annual %, informational only — no amortization schedule
  installment_amount numeric,               -- suggested installment, informational only
  currency text NOT NULL DEFAULT 'TZS',
  down_payment_bank_account_id uuid REFERENCES bank_accounts(id),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  fixed_asset_account_code text NOT NULL CHECK (fixed_asset_account_code IN ('1201', '1202')),
  loan_payable_account_code text NOT NULL CHECK (loan_payable_account_code IN ('2201', '2202')),
  journal_entry_id uuid REFERENCES journal_entries(id),
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (principal_amount = purchase_price - down_payment),
  CHECK (down_payment = 0 OR down_payment_bank_account_id IS NOT NULL),
  CHECK ((fixed_asset_account_code = '1201' AND loan_payable_account_code = '2201')
      OR (fixed_asset_account_code = '1202' AND loan_payable_account_code = '2202'))
);
CREATE INDEX IF NOT EXISTS idx_vehicle_loans_vehicle ON vehicle_loans(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_loans_status ON vehicle_loans(status);

CREATE TABLE IF NOT EXISTS vehicle_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_loan_id uuid NOT NULL REFERENCES vehicle_loans(id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount > 0),
  principal_portion numeric NOT NULL CHECK (principal_portion >= 0),
  interest_portion numeric NOT NULL DEFAULT 0 CHECK (interest_portion >= 0),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  currency text NOT NULL DEFAULT 'TZS',
  notes text,
  journal_entry_id uuid REFERENCES journal_entries(id),
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (principal_portion + interest_portion = amount)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_loan_payments_loan ON vehicle_loan_payments(vehicle_loan_id);

REVOKE ALL ON vehicle_loans FROM anon;
ALTER TABLE vehicle_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicle_loans_all ON vehicle_loans;
CREATE POLICY vehicle_loans_all ON vehicle_loans FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));

REVOKE ALL ON vehicle_loan_payments FROM anon;
ALTER TABLE vehicle_loan_payments ENABLE ROW LEVEL SECURITY;
-- Read-only for clients: every payment row is created exclusively by
-- post_vehicle_loan_repayment (SECURITY DEFINER, bypasses RLS as table
-- owner). Unlike credit_notes there's no draft state to insert into
-- directly — closing off client INSERT prevents a "payment" being logged
-- that never actually posts or decrements the loan balance.
DROP POLICY IF EXISTS vehicle_loan_payments_read ON vehicle_loan_payments;
CREATE POLICY vehicle_loan_payments_read ON vehicle_loan_payments FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));

-- Numbering — mirrors assign_credit_note_number() in 051_credit_notes.sql.
INSERT INTO document_sequences (doc_type, prefix) VALUES ('vehicle_loan', 'VL-')
ON CONFLICT (doc_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_vehicle_loan_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.loan_number IS NULL THEN
    NEW.loan_number := next_doc_number('vehicle_loan');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_vehicle_loan_number ON vehicle_loans;
CREATE TRIGGER trg_assign_vehicle_loan_number
  BEFORE INSERT ON vehicle_loans
  FOR EACH ROW
  EXECUTE FUNCTION assign_vehicle_loan_number();

CREATE OR REPLACE FUNCTION public.post_vehicle_acquisition(p_vehicle_loan_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_loan vehicle_loans;
  v_bank bank_accounts%ROWTYPE;
  v_plate text;
  v_entry_id uuid;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/ACCOUNTANT may post a vehicle acquisition';
  END IF;

  SELECT * INTO v_loan FROM vehicle_loans WHERE id = p_vehicle_loan_id FOR UPDATE;
  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'Vehicle loan not found';
  END IF;
  IF v_loan.journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Vehicle loan % is already posted', v_loan.loan_number;
  END IF;

  SELECT plate_number INTO v_plate FROM vehicles WHERE id = v_loan.vehicle_id;

  IF v_loan.down_payment > 0 THEN
    SELECT * INTO v_bank FROM bank_accounts WHERE id = v_loan.down_payment_bank_account_id FOR UPDATE;
    IF v_bank.id IS NULL OR v_bank.coa_account_code IS NULL THEN
      RAISE EXCEPTION 'Down-payment bank account has no linked Chart of Accounts code — set one on the Bank Accounts page first';
    END IF;
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id,
    currency, status, is_posted, total_debit, total_credit, created_by
  ) VALUES (
    generate_entry_number(), v_loan.purchase_date, v_loan.purchase_date,
    'Vehicle acquisition — ' || COALESCE(v_plate, v_loan.vehicle_id::text) || ' financed by ' || v_loan.lender,
    'VEHICLE_LOAN', v_loan.id, v_loan.currency, 'draft', false,
    v_loan.purchase_price, v_loan.purchase_price, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_loan.fixed_asset_account_code, v_loan.purchase_price, 0, 'Vehicle acquired — ' || COALESCE(v_plate, ''), v_loan.currency, 1);

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_loan.loan_payable_account_code, 0, v_loan.principal_amount, 'Loan payable — ' || v_loan.lender, v_loan.currency, 2);

  IF v_loan.down_payment > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, v_bank.coa_account_code, 0, v_loan.down_payment, 'Down payment — ' || COALESCE(v_plate, ''), v_loan.currency, 3);
  END IF;

  PERFORM post_journal_entry(v_entry_id);

  IF v_loan.down_payment > 0 THEN
    UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) - v_loan.down_payment, updated_at = now()
    WHERE id = v_loan.down_payment_bank_account_id;
  END IF;

  UPDATE vehicle_loans SET journal_entry_id = v_entry_id, updated_at = now() WHERE id = p_vehicle_loan_id;

  RETURN v_entry_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_vehicle_loan_repayment(
  p_vehicle_loan_id uuid,
  p_amount numeric,
  p_principal_portion numeric,
  p_interest_portion numeric,
  p_bank_account_id uuid,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_loan vehicle_loans;
  v_bank bank_accounts%ROWTYPE;
  v_plate text;
  v_entry_id uuid;
  v_payment_id uuid;
  v_new_balance numeric;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/ACCOUNTANT may record a vehicle loan repayment';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be a positive number';
  END IF;
  IF p_principal_portion IS NULL OR p_principal_portion < 0 OR p_interest_portion IS NULL OR p_interest_portion < 0 THEN
    RAISE EXCEPTION 'p_principal_portion and p_interest_portion must be non-negative';
  END IF;
  IF ROUND(p_principal_portion + p_interest_portion, 2) <> ROUND(p_amount, 2) THEN
    RAISE EXCEPTION 'Principal (%) + interest (%) must equal the payment amount (%)', p_principal_portion, p_interest_portion, p_amount;
  END IF;

  SELECT * INTO v_loan FROM vehicle_loans WHERE id = p_vehicle_loan_id FOR UPDATE;
  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'Vehicle loan not found';
  END IF;
  IF v_loan.status <> 'active' THEN
    RAISE EXCEPTION 'Vehicle loan % is % — cannot record a repayment', v_loan.loan_number, v_loan.status;
  END IF;
  IF p_principal_portion > v_loan.outstanding_balance + 0.01 THEN
    RAISE EXCEPTION 'Principal portion (%) exceeds outstanding balance (%)', p_principal_portion, v_loan.outstanding_balance;
  END IF;

  SELECT * INTO v_bank FROM bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
  IF v_bank.id IS NULL OR v_bank.coa_account_code IS NULL THEN
    RAISE EXCEPTION 'Bank account has no linked Chart of Accounts code — set one on the Bank Accounts page first';
  END IF;

  SELECT plate_number INTO v_plate FROM vehicles WHERE id = v_loan.vehicle_id;

  INSERT INTO vehicle_loan_payments (
    vehicle_loan_id, payment_date, amount, principal_portion, interest_portion,
    bank_account_id, currency, notes, created_by
  ) VALUES (
    p_vehicle_loan_id, p_payment_date, p_amount, p_principal_portion, p_interest_portion,
    p_bank_account_id, v_loan.currency, p_notes, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id,
    currency, status, is_posted, total_debit, total_credit, created_by
  ) VALUES (
    generate_entry_number(), p_payment_date, p_payment_date,
    'Loan repayment — ' || COALESCE(v_plate, v_loan.vehicle_id::text) || ' (' || v_loan.lender || ')',
    'VEHICLE_LOAN_PAYMENT', v_payment_id, v_loan.currency, 'draft', false,
    p_amount, p_amount, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_loan.loan_payable_account_code, p_principal_portion, 0, 'Loan principal repaid — ' || v_loan.lender, v_loan.currency, 1);

  IF p_interest_portion > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '6502', p_interest_portion, 0, 'Loan interest — ' || v_loan.lender, v_loan.currency, 2);
  END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_bank.coa_account_code, 0, p_amount, 'Loan repayment — ' || COALESCE(v_plate, ''), v_loan.currency, 3);

  PERFORM post_journal_entry(v_entry_id);

  UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) - p_amount, updated_at = now()
  WHERE id = p_bank_account_id;

  v_new_balance := GREATEST(0, v_loan.outstanding_balance - p_principal_portion);
  UPDATE vehicle_loans
     SET outstanding_balance = v_new_balance,
         status = CASE WHEN v_new_balance <= 0 THEN 'completed' ELSE status END,
         updated_at = now()
   WHERE id = p_vehicle_loan_id;

  UPDATE vehicle_loan_payments SET journal_entry_id = v_entry_id WHERE id = v_payment_id;

  RETURN v_entry_id;
END;
$function$;

INSERT INTO public.schema_migrations (version) VALUES ('056_vehicle_loan_financing.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
