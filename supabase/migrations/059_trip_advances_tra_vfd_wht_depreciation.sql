-- Five-part ERP upgrade for Calvary Investment Co. Ltd, driven by a live
-- schema audit (accounts, invoices, trips, vehicles, vehicle_loans,
-- credit_notes, payroll — read directly off the running database, not off
-- the various legacy database/patches/*.sql files in the repo, several of
-- which were never applied and don't match live state).
--
-- Findings that changed the literal spec this migration was requested against:
--
-- 1. `chart_of_accounts` (12 rows) is a decoy — the real, live-posted ledger
--    is `accounts` (164 rows, referenced by journal_entry_lines.account_code,
--    bank_accounts.coa_account_code, vehicle_loans.*_account_code). All COA
--    work below targets `accounts`.
--
-- 2. There is no `post_customer_invoice()` function. The live invoice poster
--    is `post_invoice_journal_entry()`, a BEFORE INSERT trigger on `invoices`
--    (trg_post_invoice_journal_entry, added in 050/052). Section 3 extends
--    that function in place.
--
-- 3. Account code collisions between the requested new accounts and what's
--    already live and posted-to:
--      - 5102 is already "Driver Salaries", debited by every posted payroll
--        run (post_payroll_period). Using 5102 for subcontractor freight as
--        literally requested would corrupt driver payroll postings. The COA
--        already has an unused, correctly-named 5113 "Freight Subcontractor
--        Expense" — used instead for the subcontractor bill's gross-amount
--        debit.
--      - 5103 already exists as "Driver Allowances" — a duplicate of both
--        5008 "Driver Allowances (Per Diem)" and 2103 "Driver Allowances
--        Payable", and (confirmed via pg_proc + a repo-wide grep) wired into
--        zero live posting functions or app code. Renamed in place to "Fuel
--        & Vehicle Trip Operating Expenses" per the request, and reused as
--        the default trip-advance settlement expense account.
--      - 6503 already exists as "Foreign Exchange Loss" (OPERATING_EXPENSES,
--        debit) — renamed to "Realized Foreign Exchange Loss" instead of
--        reinserted. 4010, 2112 and 1110 do not exist and are added new.
--
-- 4. There is no `vendors`/`subcontractors` master table (only a rollup
--    `vendor_balances` with a freeform vendor_name/vendor_code, no FK
--    target). `vendor_bills.subcontractor_id` is therefore left as a plain
--    nullable uuid with no FK — same freeform pattern `vendor_balances`
--    already uses — alongside a required subcontractor_name.
--
-- 5. Two of the five asks ("Trigger post_trip_advance()" and "Trigger
--    reconcile_trip_advance()") are implemented differently on purpose:
--      - post_trip_advance() IS a real BEFORE INSERT trigger — its shape
--        (fixed 2-line float issuance) matches post_invoice_journal_entry's
--        pattern exactly.
--      - reconcile_trip_advance() is an explicit SECURITY DEFINER RPC
--        function, not a row trigger. Reconciliation takes a variable list
--        of verified-receipt settlement lines plus an optional cash
--        return/reimbursement — the same "variable multi-line, deliberate
--        accountant action" shape as post_credit_note, post_vehicle_
--        acquisition and post_vehicle_loan_repayment, none of which are
--        triggers either, for the same reason.
--
-- 6. Depreciation needed one small addition beyond the literal ask: a
--    vehicle_depreciation_entries ledger. Without tracking accumulated
--    depreciation per vehicle, a monthly job either re-running for the same
--    month or continuing to run after a vehicle is fully depreciated would
--    silently depreciate it past salvage value forever. The ledger makes
--    run_monthly_depreciation() idempotent per (vehicle, year, month) and
--    caps each vehicle at its depreciable base.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- =============================================================================
-- SECTION 1 — CHART OF ACCOUNTS CLEANUP & NEW ACCOUNTS
-- =============================================================================

-- 1a. Deactivate legacy/duplicate seed codes. The user's three named
-- examples (2001, 1500, 2500) plus every other row from the same abandoned
-- seed batches, identified by: (a) duplicating a code from the live 1100s/
-- 1200s/1300s/2100s/2200s/5000s/6000s/7000s series that the posting
-- functions above actually use, or (b) a type/category mismatch (e.g. a
-- liability-named account tagged category='ASSETS') that marks it as
-- leftover junk from a bad seed insert. Every code below was confirmed via
-- live query to have zero references in journal_entry_lines or
-- bank_accounts.coa_account_code before this migration was written; the
-- NOT EXISTS guards below re-check that at apply time so this is safe to
-- run again later even if data has since changed.
UPDATE accounts
   SET is_active = false, updated_at = now()
 WHERE code IN (
   -- user-named examples
   '2001', '1500', '2500',
   -- rest of the same first-gen liability batch as 2001 (superseded by 2101-2111)
   '2002', '2003', '2004', '2005', '2006', '2007',
   -- rest of the same fixed-asset batch as 1500 (superseded by 1201-1207)
   '1501', '1502', '1503', '1504',
   -- accumulated depreciation duplicate (superseded by 1300-1303)
   '1600',
   -- rest of the same vehicle-loan batch as 2500 (superseded by 2200-2204)
   '2501',
   -- plain duplicate of 1105
   '1400',
   -- type/category-mismatched leftovers (liability/equity/revenue accounts
   -- mistagged category='ASSETS'), each a duplicate of a correctly-tagged
   -- live account
   '2300', '3100', '3200', '4300',
   '5100', '5200', '5300', '5400', '5500', '5600', '5700', '5800'
 )
 AND is_active IS DISTINCT FROM false
 AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_code = accounts.code)
 AND NOT EXISTS (SELECT 1 FROM bank_accounts b WHERE b.coa_account_code = accounts.code);

-- 1b. New live accounts.
INSERT INTO accounts (code, name, category, type, account_type, currency, is_active, opening_balance, current_balance, balance)
SELECT '1110', 'Driver Float / Staff Advance', 'ASSETS', 'debit', 'asset', 'TZS', true, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1110');

INSERT INTO accounts (code, name, category, type, account_type, currency, is_active, opening_balance, current_balance, balance)
SELECT '2112', 'TRA Withholding Tax (WHT) Payable', 'LIABILITIES', 'credit', 'liability', 'TZS', true, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '2112');

INSERT INTO accounts (code, name, category, type, account_type, currency, is_active, opening_balance, current_balance, balance)
SELECT '4010', 'Realized Foreign Exchange Gain', 'REVENUE', 'credit', 'revenue', 'TZS', true, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '4010');

INSERT INTO accounts (code, name, category, type, account_type, currency, is_active, opening_balance, current_balance, balance)
SELECT '6206', 'Depreciation Expense', 'OPERATING_EXPENSES', 'debit', 'expense', 'TZS', true, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '6206');

-- 1c. Renames of existing, previously-unused accounts (see audit notes above).
UPDATE accounts SET name = 'Realized Foreign Exchange Loss', updated_at = now() WHERE code = '6503';
UPDATE accounts SET name = 'Fuel & Vehicle Trip Operating Expenses', updated_at = now() WHERE code = '5103';

-- Numbering for the two new document types this migration introduces.
INSERT INTO document_sequences (doc_type, prefix) VALUES ('trip_advance', 'TA-') ON CONFLICT (doc_type) DO NOTHING;
INSERT INTO document_sequences (doc_type, prefix) VALUES ('vendor_bill', 'VB-') ON CONFLICT (doc_type) DO NOTHING;

-- =============================================================================
-- SECTION 2 — TRIP ADVANCE & DRIVER FLOAT SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS trip_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_number text UNIQUE,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'TZS',
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'mobile')),
  bank_account_id uuid REFERENCES bank_accounts(id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'RECONCILED')),
  journal_entry_id uuid REFERENCES journal_entries(id),
  reconciliation_journal_entry_id uuid REFERENCES journal_entries(id),
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (payment_method = 'cash' OR bank_account_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_trip_advances_trip ON trip_advances(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_advances_driver ON trip_advances(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_advances_status ON trip_advances(status);

CREATE TABLE IF NOT EXISTS trip_advance_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_advance_id uuid NOT NULL REFERENCES trip_advances(id) ON DELETE RESTRICT,
  expense_account_code text NOT NULL DEFAULT '5103' REFERENCES accounts(code),
  category text,
  amount numeric NOT NULL CHECK (amount > 0),
  receipt_reference text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_advance_settlements_advance ON trip_advance_settlements(trip_advance_id);

REVOKE ALL ON trip_advances FROM anon;
ALTER TABLE trip_advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trip_advances_all ON trip_advances;
CREATE POLICY trip_advances_all ON trip_advances FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));

REVOKE ALL ON trip_advance_settlements FROM anon;
ALTER TABLE trip_advance_settlements ENABLE ROW LEVEL SECURITY;
-- Read-only: rows are created exclusively by reconcile_trip_advance()
-- (SECURITY DEFINER), same reasoning as vehicle_loan_payments in 056.
DROP POLICY IF EXISTS trip_advance_settlements_read ON trip_advance_settlements;
CREATE POLICY trip_advance_settlements_read ON trip_advance_settlements FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));

CREATE OR REPLACE FUNCTION public.assign_trip_advance_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.advance_number IS NULL THEN
    NEW.advance_number := next_doc_number('trip_advance');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_trip_advance_number ON trip_advances;
CREATE TRIGGER trg_assign_trip_advance_number
  BEFORE INSERT ON trip_advances
  FOR EACH ROW
  EXECUTE FUNCTION assign_trip_advance_number();

-- post_trip_advance(): fires on every trip_advances insert (fixed 2-line
-- shape), mirroring post_invoice_journal_entry exactly — posts directly
-- (is_posted = true) without going through post_journal_entry's own
-- CEO/ADMIN/ACCOUNTANT gate, because float issuance is initiated by
-- whoever created the row (dispatch/ops), not necessarily an accountant.
--   Dr 1110 Driver Float / Staff Advance   amount
--   Cr bank_accounts.coa_account_code, or 1101/1102/1103 by payment_method
CREATE OR REPLACE FUNCTION public.post_trip_advance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bank bank_accounts%ROWTYPE;
  v_credit_account text;
  v_entry_id uuid;
BEGIN
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT * INTO v_bank FROM bank_accounts WHERE id = NEW.bank_account_id FOR UPDATE;
    IF v_bank.id IS NULL OR v_bank.coa_account_code IS NULL THEN
      RAISE EXCEPTION 'Bank account has no linked Chart of Accounts code — set one on the Bank Accounts page first';
    END IF;
    v_credit_account := v_bank.coa_account_code;
  ELSE
    v_credit_account := CASE NEW.payment_method
      WHEN 'bank' THEN '1102'
      WHEN 'mobile' THEN '1103'
      ELSE '1101'
    END;
  END IF;

  IF NOT is_period_open(COALESCE(NEW.issue_date, CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Fiscal period is closed — cannot issue trip advance';
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id,
    trip_id, currency, status, is_posted, total_debit, total_credit, created_by, posted_by, posted_at
  ) VALUES (
    generate_entry_number(), COALESCE(NEW.issue_date, CURRENT_DATE), COALESCE(NEW.issue_date, CURRENT_DATE),
    'Driver float issued — ' || COALESCE(NEW.advance_number, 'trip advance'),
    'TRIP_ADVANCE', NEW.id, NEW.trip_id, COALESCE(NEW.currency, 'TZS'), 'posted', true,
    NEW.amount, NEW.amount, auth.uid(), auth.uid(), now()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '1110', NEW.amount, 0, 'Driver float — ' || COALESCE(NEW.advance_number, ''), COALESCE(NEW.currency, 'TZS'), 1);

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_credit_account, 0, NEW.amount, 'Float issued — ' || COALESCE(NEW.advance_number, ''), COALESCE(NEW.currency, 'TZS'), 2);

  UPDATE accounts SET current_balance = COALESCE(current_balance, 0) + NEW.amount, updated_at = now() WHERE code = '1110';
  UPDATE accounts SET current_balance = COALESCE(current_balance, 0) - NEW.amount, updated_at = now() WHERE code = v_credit_account;

  IF NEW.bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) - NEW.amount, updated_at = now() WHERE id = NEW.bank_account_id;
  END IF;

  NEW.journal_entry_id := v_entry_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_post_trip_advance ON trip_advances;
CREATE TRIGGER trg_post_trip_advance
  BEFORE INSERT ON trip_advances
  FOR EACH ROW
  EXECUTE FUNCTION post_trip_advance();

-- reconcile_trip_advance(): explicit RPC (see audit note 5 above), takes the
-- verified-receipt settlement lines as jsonb: [{account_code, amount,
-- category, receipt_reference, description}, ...]. Always fully clears the
-- float (Cr 1110 = advance.amount), regardless of whether receipts land
-- above or below the advance:
--   Dr <line.account_code, default 5103>   each verified receipt line
--   Cr 1110 Driver Float                   advance.amount (always)
--   Dr bank/cash (settlement account)      if receipts < advance (change returned)
--   Cr bank/cash (settlement account)      if receipts > advance (driver reimbursed)
CREATE OR REPLACE FUNCTION public.reconcile_trip_advance(
  p_trip_advance_id uuid,
  p_settlement_lines jsonb,
  p_settlement_bank_account_id uuid DEFAULT NULL,
  p_settlement_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_adv trip_advances;
  v_bank bank_accounts%ROWTYPE;
  v_settle_account text;
  v_entry_id uuid;
  v_line jsonb;
  v_line_amount numeric;
  v_expensed numeric := 0;
  v_diff numeric;
  v_line_order int := 1;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/ACCOUNTANT may reconcile a trip advance';
  END IF;

  SELECT * INTO v_adv FROM trip_advances WHERE id = p_trip_advance_id FOR UPDATE;
  IF v_adv.id IS NULL THEN
    RAISE EXCEPTION 'Trip advance not found';
  END IF;
  IF v_adv.status = 'RECONCILED' THEN
    RAISE EXCEPTION 'Trip advance % is already reconciled', v_adv.advance_number;
  END IF;
  IF v_adv.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Trip advance % has not been posted yet', v_adv.advance_number;
  END IF;
  IF p_settlement_lines IS NULL OR jsonb_array_length(p_settlement_lines) = 0 THEN
    RAISE EXCEPTION 'At least one settlement line (verified receipt) is required';
  END IF;
  IF NOT is_period_open(p_settlement_date) THEN
    RAISE EXCEPTION 'Fiscal period is closed — cannot reconcile trip advance';
  END IF;

  IF p_settlement_bank_account_id IS NOT NULL THEN
    SELECT * INTO v_bank FROM bank_accounts WHERE id = p_settlement_bank_account_id FOR UPDATE;
  ELSIF v_adv.bank_account_id IS NOT NULL THEN
    SELECT * INTO v_bank FROM bank_accounts WHERE id = v_adv.bank_account_id FOR UPDATE;
  END IF;
  IF v_bank.id IS NOT NULL THEN
    IF v_bank.coa_account_code IS NULL THEN
      RAISE EXCEPTION 'Settlement bank account has no linked Chart of Accounts code';
    END IF;
    v_settle_account := v_bank.coa_account_code;
  ELSE
    v_settle_account := CASE v_adv.payment_method WHEN 'bank' THEN '1102' WHEN 'mobile' THEN '1103' ELSE '1101' END;
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id,
    trip_id, currency, status, is_posted, total_debit, total_credit, created_by
  ) VALUES (
    generate_entry_number(), p_settlement_date, p_settlement_date,
    'Trip advance reconciliation — ' || COALESCE(v_adv.advance_number, v_adv.id::text),
    'TRIP_ADVANCE_RECONCILIATION', v_adv.id, v_adv.trip_id, v_adv.currency, 'draft', false, 0, 0, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_settlement_lines) LOOP
    v_line_amount := (v_line ->> 'amount')::numeric;
    IF v_line_amount IS NULL OR v_line_amount <= 0 THEN
      RAISE EXCEPTION 'Every settlement line amount must be positive';
    END IF;

    INSERT INTO trip_advance_settlements (trip_advance_id, expense_account_code, category, amount, receipt_reference, description)
    VALUES (
      v_adv.id, COALESCE(v_line ->> 'account_code', '5103'), v_line ->> 'category',
      v_line_amount, v_line ->> 'receipt_reference', v_line ->> 'description'
    );

    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (
      v_entry_id, COALESCE(v_line ->> 'account_code', '5103'), v_line_amount, 0,
      COALESCE(v_line ->> 'description', 'Trip expense — ' || COALESCE(v_adv.advance_number, '')), v_adv.currency, v_line_order
    );

    v_expensed := v_expensed + v_line_amount;
    v_line_order := v_line_order + 1;
  END LOOP;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '1110', 0, v_adv.amount, 'Float cleared — ' || COALESCE(v_adv.advance_number, ''), v_adv.currency, v_line_order);
  v_line_order := v_line_order + 1;

  v_diff := v_adv.amount - v_expensed;
  IF v_diff > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, v_settle_account, v_diff, 0, 'Cash returned by driver — ' || COALESCE(v_adv.advance_number, ''), v_adv.currency, v_line_order);
    IF v_bank.id IS NOT NULL THEN
      UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) + v_diff, updated_at = now() WHERE id = v_bank.id;
    END IF;
  ELSIF v_diff < 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, v_settle_account, 0, ABS(v_diff), 'Reimbursement paid to driver — ' || COALESCE(v_adv.advance_number, ''), v_adv.currency, v_line_order);
    IF v_bank.id IS NOT NULL THEN
      UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) - ABS(v_diff), updated_at = now() WHERE id = v_bank.id;
    END IF;
  END IF;

  PERFORM post_journal_entry(v_entry_id);

  UPDATE trip_advances
     SET status = 'RECONCILED', reconciliation_journal_entry_id = v_entry_id, notes = COALESCE(p_notes, notes), updated_at = now()
   WHERE id = p_trip_advance_id;

  RETURN v_entry_id;
END;
$function$;

-- =============================================================================
-- SECTION 3 — TRA VFD INVOICING & VAT LOGIC
-- =============================================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vat_type text NOT NULL DEFAULT 'STANDARD_18'
    CHECK (vat_type IN ('STANDARD_18', 'ZERO_RATED', 'EXEMPT')),
  ADD COLUMN IF NOT EXISTS tra_rct_num text,
  ADD COLUMN IF NOT EXISTS tra_z_num text,
  ADD COLUMN IF NOT EXISTS tra_verification_url text,
  ADD COLUMN IF NOT EXISTS tra_qr_code text,
  ADD COLUMN IF NOT EXISTS is_vfd_verified boolean NOT NULL DEFAULT false;

-- post_invoice_journal_entry(): same trigger as before (currency conversion,
-- CN-/zero-total/already-posted guards, period-open check, 1104/4002/2106
-- lines, direct accounts.current_balance updates) with one change — the
-- v_total/v_net/v_vat derivation now branches on vat_type instead of always
-- assuming a standard-rated invoice.
CREATE OR REPLACE FUNCTION public.post_invoice_journal_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total NUMERIC;
  v_net NUMERIC;
  v_vat NUMERIC;
  v_rate NUMERIC;
  v_entry_id UUID;
BEGIN
  IF NEW.invoice_number ILIKE 'CN-%' THEN
    RETURN NEW;
  END IF;
  IF NEW.total_amount IS NULL OR NEW.total_amount = 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- TRA VAT logic: ZERO_RATED (e.g. transit freight) and EXEMPT invoices
  -- carry no VAT and post 100% of the total to revenue; STANDARD_18 splits
  -- subtotal (revenue) from VAT (2106), recomputing vat_amount from the
  -- 18% statutory rate if the caller didn't supply one.
  IF NEW.vat_type = 'STANDARD_18' THEN
    v_total := NEW.total_amount;
    v_net := COALESCE(NEW.subtotal, NEW.total_amount - COALESCE(NEW.vat_amount, 0));
    v_vat := COALESCE(NEW.vat_amount, ROUND(v_net * 0.18, 2));
  ELSIF NEW.vat_type IN ('ZERO_RATED', 'EXEMPT') THEN
    v_total := NEW.total_amount;
    v_net := NEW.total_amount;
    v_vat := 0;
  ELSE
    -- Defensive fallback; vat_type is NOT NULL with a CHECK constraint so
    -- this branch is unreachable in practice.
    v_total := NEW.total_amount;
    v_net := COALESCE(NEW.amount, NEW.total_amount - COALESCE(NEW.vat_amount, 0));
    v_vat := COALESCE(NEW.vat_amount, 0);
  END IF;

  IF COALESCE(NEW.currency, 'TZS') <> 'TZS' THEN
    SELECT rate INTO v_rate
      FROM exchange_rates
     WHERE from_currency = NEW.currency AND to_currency = 'TZS'
     ORDER BY effective_date DESC
     LIMIT 1;
    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'No exchange rate found for % -> TZS — cannot post invoice % to the ledger', NEW.currency, NEW.invoice_number;
    END IF;
    v_total := v_total * v_rate;
    v_net := v_net * v_rate;
    v_vat := v_vat * v_rate;
  END IF;

  IF NOT is_period_open(COALESCE(NEW.issue_date, CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Fiscal period is closed — cannot post invoice %', NEW.invoice_number;
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id, invoice_id,
    currency, status, is_posted, total_debit, total_credit, created_by, posted_by, posted_at, created_at, updated_at
  ) VALUES (
    generate_entry_number(), COALESCE(NEW.issue_date, CURRENT_DATE), COALESCE(NEW.issue_date, CURRENT_DATE),
    'Invoice ' || NEW.invoice_number || ' to ' || COALESCE(NEW.customer_name, NEW.client_name, 'customer'),
    'INVOICE', NEW.id, NEW.id, 'TZS', 'posted', true, v_total, v_total, auth.uid(), auth.uid(), now(), now(), now()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '1104', v_total, 0, 'Receivable — ' || NEW.invoice_number, 'TZS', 1);

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '4002', 0, v_net, 'Revenue — ' || NEW.invoice_number, 'TZS', 2);

  IF v_vat > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '2106', 0, v_vat, 'VAT on ' || NEW.invoice_number, 'TZS', 3);
  END IF;

  UPDATE accounts SET current_balance = COALESCE(current_balance, 0) + v_total, updated_at = now() WHERE code = '1104';
  UPDATE accounts SET current_balance = COALESCE(current_balance, 0) + v_net, updated_at = now() WHERE code = '4002';
  IF v_vat > 0 THEN
    UPDATE accounts SET current_balance = COALESCE(current_balance, 0) + v_vat, updated_at = now() WHERE code = '2106';
  END IF;

  NEW.journal_entry_id := v_entry_id;
  RETURN NEW;
END;
$function$;

-- =============================================================================
-- SECTION 4 — SUBCONTRACTOR VENDOR BILLS & 2% TRA WHT
-- =============================================================================

CREATE TABLE IF NOT EXISTS vendor_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text UNIQUE,
  subcontractor_name text NOT NULL,
  subcontractor_id uuid,  -- no vendor master table exists yet; see audit note 4 above
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  gross_amount numeric NOT NULL CHECK (gross_amount > 0),
  wht_rate numeric NOT NULL DEFAULT 2.00 CHECK (wht_rate >= 0 AND wht_rate <= 100),
  wht_amount numeric NOT NULL DEFAULT 0 CHECK (wht_amount >= 0),
  net_payable numeric NOT NULL DEFAULT 0 CHECK (net_payable >= 0),
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'paid')),
  journal_entry_id uuid REFERENCES journal_entries(id),
  description text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ROUND(wht_amount + net_payable, 2) = ROUND(gross_amount, 2))
);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_trip ON vendor_bills(trip_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_status ON vendor_bills(status);

REVOKE ALL ON vendor_bills FROM anon;
ALTER TABLE vendor_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_bills_all ON vendor_bills;
CREATE POLICY vendor_bills_all ON vendor_bills FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));

CREATE OR REPLACE FUNCTION public.assign_vendor_bill_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bill_number IS NULL THEN
    NEW.bill_number := next_doc_number('vendor_bill');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_vendor_bill_number ON vendor_bills;
CREATE TRIGGER trg_assign_vendor_bill_number
  BEFORE INSERT ON vendor_bills
  FOR EACH ROW
  EXECUTE FUNCTION assign_vendor_bill_number();

-- wht_amount/net_payable are derived, not user-entered — recomputed
-- whenever gross_amount or wht_rate changes, same "computed columns via
-- BEFORE trigger" approach the rest of this schema uses.
CREATE OR REPLACE FUNCTION public.compute_vendor_bill_amounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.wht_amount := ROUND(NEW.gross_amount * NEW.wht_rate / 100, 2);
  NEW.net_payable := NEW.gross_amount - NEW.wht_amount;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_compute_vendor_bill_amounts ON vendor_bills;
CREATE TRIGGER trg_compute_vendor_bill_amounts
  BEFORE INSERT OR UPDATE OF gross_amount, wht_rate ON vendor_bills
  FOR EACH ROW
  EXECUTE FUNCTION compute_vendor_bill_amounts();

-- post_subcontractor_bill(): explicit RPC, same shape as post_credit_note /
-- post_vehicle_acquisition.
--   Dr 5113 Freight Subcontractor Expense   gross_amount
--   Cr 2112 TRA WHT Payable                 wht_amount (2% default)
--   Cr 2101 Accounts Payable                net_payable (98%)
CREATE OR REPLACE FUNCTION public.post_subcontractor_bill(p_bill_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bill vendor_bills;
  v_entry_id uuid;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/ACCOUNTANT may post a subcontractor bill';
  END IF;

  SELECT * INTO v_bill FROM vendor_bills WHERE id = p_bill_id FOR UPDATE;
  IF v_bill.id IS NULL THEN
    RAISE EXCEPTION 'Vendor bill not found';
  END IF;
  IF v_bill.status <> 'draft' THEN
    RAISE EXCEPTION 'Vendor bill % is already %; cannot re-post', v_bill.bill_number, v_bill.status;
  END IF;
  IF NOT is_period_open(v_bill.bill_date) THEN
    RAISE EXCEPTION 'Fiscal period is closed — cannot post vendor bill %', v_bill.bill_number;
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id, trip_id,
    currency, status, is_posted, total_debit, total_credit, created_by
  ) VALUES (
    generate_entry_number(), v_bill.bill_date, v_bill.bill_date,
    'Subcontractor bill ' || v_bill.bill_number || ' — ' || v_bill.subcontractor_name,
    'VENDOR_BILL', v_bill.id, v_bill.trip_id, v_bill.currency, 'draft', false,
    v_bill.gross_amount, v_bill.gross_amount, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '5113', v_bill.gross_amount, 0, 'Freight subcontracted — ' || v_bill.subcontractor_name, v_bill.currency, 1);

  IF v_bill.wht_amount > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '2112', 0, v_bill.wht_amount, 'TRA WHT withheld (' || v_bill.wht_rate || '%) — ' || v_bill.subcontractor_name, v_bill.currency, 2);
  END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '2101', 0, v_bill.net_payable, 'Net payable — ' || v_bill.subcontractor_name, v_bill.currency, 3);

  PERFORM post_journal_entry(v_entry_id);

  UPDATE vendor_bills SET status = 'posted', journal_entry_id = v_entry_id, updated_at = now() WHERE id = p_bill_id;

  RETURN v_entry_id;
END;
$function$;

-- =============================================================================
-- SECTION 5 — AUTOMATED ASSET DEPRECIATION JOB
-- =============================================================================

-- purchase_price and purchase_date already exist on vehicles (since
-- 20240620_vehicle_details.sql); only useful_life_years and salvage_value
-- are new.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS useful_life_years integer CHECK (useful_life_years > 0),
  ADD COLUMN IF NOT EXISTS salvage_value numeric NOT NULL DEFAULT 0 CHECK (salvage_value >= 0);

-- Per-vehicle, per-month depreciation ledger. Not explicitly requested, but
-- required for run_monthly_depreciation() to be idempotent and to stop
-- depreciating a vehicle once it reaches salvage value (see audit note 6).
CREATE TABLE IF NOT EXISTS vehicle_depreciation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount numeric NOT NULL CHECK (amount >= 0),
  accumulated_after numeric NOT NULL,
  account_code text NOT NULL CHECK (account_code IN ('1301', '1302')),
  journal_entry_id uuid REFERENCES journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_depreciation_entries_vehicle ON vehicle_depreciation_entries(vehicle_id);

REVOKE ALL ON vehicle_depreciation_entries FROM anon;
ALTER TABLE vehicle_depreciation_entries ENABLE ROW LEVEL SECURITY;
-- Read-only: rows are created exclusively by run_monthly_depreciation().
DROP POLICY IF EXISTS vehicle_depreciation_entries_read ON vehicle_depreciation_entries;
CREATE POLICY vehicle_depreciation_entries_read ON vehicle_depreciation_entries FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));

-- run_monthly_depreciation(p_period): straight-line depreciation for every
-- vehicle with purchase_price + useful_life_years set, not yet fully
-- depreciated, not sold/deleted, and not already depreciated for that
-- calendar month. One batch journal entry per run:
--   Dr 6206 Depreciation Expense                sum of all vehicles this run
--   Cr 1301 Accumulated Depreciation, Trucks     trucks/trailers portion
--   Cr 1302 Accumulated Depreciation, Vehicles   everything else
-- Callable both interactively (CEO/ADMIN/ACCOUNTANT, e.g. from a "run
-- depreciation" button) and by an unauthenticated scheduler — schedule with
-- pg_cron (`select cron.schedule('monthly-depreciation', '0 1 1 * *',
-- $$select run_monthly_depreciation()$$)`) or an external cron hitting this
-- RPC with the service role key; auth.uid() is NULL in both those paths, so
-- the role check below is skipped rather than failing closed.
CREATE OR REPLACE FUNCTION public.run_monthly_depreciation(p_period date DEFAULT CURRENT_DATE)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year int := EXTRACT(YEAR FROM p_period);
  v_month int := EXTRACT(MONTH FROM p_period);
  v_period_date date := make_date(v_year, v_month, 1);
  v_vehicle record;
  v_depreciable numeric;
  v_accumulated numeric;
  v_monthly numeric;
  v_amount numeric;
  v_account text;
  v_truck_total numeric := 0;
  v_vehicle_total numeric := 0;
  v_entry_id uuid;
  v_line_order int := 2;
BEGIN
  IF auth.uid() IS NOT NULL AND current_user_role() NOT IN ('CEO', 'ADMIN', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/ACCOUNTANT (or the scheduled job) may run depreciation';
  END IF;

  IF NOT is_period_open(v_period_date) THEN
    RAISE EXCEPTION 'Fiscal period %/% is closed — cannot post depreciation', v_month, v_year;
  END IF;

  FOR v_vehicle IN
    SELECT v.* FROM vehicles v
    WHERE v.purchase_price IS NOT NULL AND v.purchase_price > 0
      AND v.useful_life_years IS NOT NULL AND v.useful_life_years > 0
      AND v.deleted_at IS NULL AND v.sold_date IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM vehicle_depreciation_entries e
         WHERE e.vehicle_id = v.id AND e.period_year = v_year AND e.period_month = v_month
      )
  LOOP
    v_depreciable := v_vehicle.purchase_price - COALESCE(v_vehicle.salvage_value, 0);
    IF v_depreciable <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_accumulated
      FROM vehicle_depreciation_entries WHERE vehicle_id = v_vehicle.id;
    IF v_accumulated >= v_depreciable THEN CONTINUE; END IF;

    v_monthly := ROUND(v_depreciable / (v_vehicle.useful_life_years * 12), 2);
    v_amount := LEAST(v_monthly, v_depreciable - v_accumulated);
    IF v_amount <= 0 THEN CONTINUE; END IF;

    v_account := CASE
      WHEN v_vehicle.type ILIKE '%truck%' OR v_vehicle.type ILIKE '%trailer%' THEN '1301'
      ELSE '1302'
    END;

    IF v_entry_id IS NULL THEN
      INSERT INTO journal_entries (
        entry_number, entry_date, date, description, reference_type,
        currency, status, is_posted, total_debit, total_credit, created_by
      ) VALUES (
        generate_entry_number(), v_period_date, v_period_date,
        'Monthly depreciation — ' || v_month || '/' || v_year,
        'DEPRECIATION', 'TZS', 'draft', false, 0, 0, auth.uid()
      )
      RETURNING id INTO v_entry_id;
    END IF;

    INSERT INTO vehicle_depreciation_entries (vehicle_id, period_year, period_month, amount, accumulated_after, account_code, journal_entry_id)
    VALUES (v_vehicle.id, v_year, v_month, v_amount, v_accumulated + v_amount, v_account, v_entry_id);

    IF v_account = '1301' THEN
      v_truck_total := v_truck_total + v_amount;
    ELSE
      v_vehicle_total := v_vehicle_total + v_amount;
    END IF;
  END LOOP;

  IF v_entry_id IS NULL THEN
    RETURN NULL; -- nothing depreciable this period
  END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '6206', v_truck_total + v_vehicle_total, 0, 'Depreciation expense — ' || v_month || '/' || v_year, 'TZS', 1);

  IF v_truck_total > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '1301', 0, v_truck_total, 'Accumulated depreciation — trucks/trailers', 'TZS', v_line_order);
    v_line_order := v_line_order + 1;
  END IF;

  IF v_vehicle_total > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '1302', 0, v_vehicle_total, 'Accumulated depreciation — motor vehicles', 'TZS', v_line_order);
  END IF;

  PERFORM post_journal_entry(v_entry_id);

  RETURN v_entry_id;
END;
$function$;

INSERT INTO public.schema_migrations (version) VALUES ('059_trip_advances_tra_vfd_wht_depreciation.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
