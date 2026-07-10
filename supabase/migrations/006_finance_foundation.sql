-- Finance foundation (Phase 1 of docs/finance-erp-audit.md)
--
-- Adds the missing ERP fundamentals without touching existing data:
--   1. fiscal_periods            — period open/close/lock control
--   2. payments + allocations    — receipts & vendor payments with per-invoice allocation
--   3. document_sequences        — server-side document numbering (no more client Date.now())
--   4. Integrity                 — FKs, checks, posting/period guards
--   5. Reporting views           — customer/vendor balances, AR/AP aging, VAT position
--   6. Indexes                   — hot filter paths
--   7. RLS                       — finance roles read; accountants write; posting is privileged
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Helper: role of the calling user (used across RLS policies)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Fiscal periods
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','locked')),
  closed_by uuid REFERENCES user_profiles(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

CREATE OR REPLACE FUNCTION public.is_period_open(p_date date)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'open' FROM fiscal_periods
      WHERE year = EXTRACT(YEAR FROM p_date) AND month = EXTRACT(MONTH FROM p_date)),
    true  -- periods that were never created are treated as open
  );
$$;

-- Close / reopen are privileged operations
CREATE OR REPLACE FUNCTION public.close_fiscal_period(p_year int, p_month int, p_lock boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN can close periods';
  END IF;
  INSERT INTO fiscal_periods (year, month, status, closed_by, closed_at)
  VALUES (p_year, p_month, CASE WHEN p_lock THEN 'locked' ELSE 'closed' END, auth.uid(), now())
  ON CONFLICT (year, month)
  DO UPDATE SET status = EXCLUDED.status, closed_by = EXCLUDED.closed_by, closed_at = EXCLUDED.closed_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_fiscal_period(p_year int, p_month int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN can reopen periods';
  END IF;
  UPDATE fiscal_periods SET status = 'open', closed_by = auth.uid(), closed_at = now()
  WHERE year = p_year AND month = p_month AND status <> 'locked';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Period not found or locked';
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Payments and allocations
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('in','out')),   -- in = receipt, out = vendor payment
  counterparty_type text CHECK (counterparty_type IN ('customer','vendor','employee','other')),
  counterparty_id uuid,                    -- customers.id / vendor_balances.id / user_profiles.id
  counterparty_name text,                  -- denormalized display name
  bank_account_id uuid REFERENCES bank_accounts(id),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'TZS',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text,                             -- bank_transfer | cash | mobile_money | cheque
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','voided')),
  journal_entry_id uuid REFERENCES journal_entries(id),
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_id, invoice_id)
);

-- Allocations may never exceed the payment amount
CREATE OR REPLACE FUNCTION public.check_allocation_total()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment numeric;
  v_allocated numeric;
BEGIN
  SELECT amount INTO v_payment FROM payments WHERE id = NEW.payment_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_allocated
    FROM payment_allocations
    WHERE payment_id = NEW.payment_id AND invoice_id <> NEW.invoice_id;
  IF v_allocated + NEW.amount > v_payment THEN
    RAISE EXCEPTION 'Allocation (%) exceeds payment amount (%)', v_allocated + NEW.amount, v_payment;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_check_allocation_total ON payment_allocations;
CREATE TRIGGER trg_check_allocation_total
  BEFORE INSERT OR UPDATE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION check_allocation_total();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Document numbering
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_sequences (
  doc_type text PRIMARY KEY,               -- invoice | payment | journal | credit_note | expense
  prefix text NOT NULL,
  next_number bigint NOT NULL DEFAULT 1,
  padding int NOT NULL DEFAULT 5
);

INSERT INTO document_sequences (doc_type, prefix) VALUES
  ('invoice', 'INV-'),
  ('credit_note', 'CN-'),
  ('payment', 'PAY-'),
  ('journal', 'JE-'),
  ('expense', 'EXP-')
ON CONFLICT (doc_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_doc_number(p_type text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_num bigint;
  v_pad int;
BEGIN
  UPDATE document_sequences
     SET next_number = next_number + 1
   WHERE doc_type = p_type
   RETURNING prefix, next_number - 1, padding INTO v_prefix, v_num, v_pad;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Unknown document type: %', p_type;
  END IF;
  RETURN v_prefix || LPAD(v_num::text, v_pad, '0');
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Integrity: FKs, posting guards, period guards
-- ────────────────────────────────────────────────────────────────────────────
-- invoices.customer_id was a bare uuid with no constraint
DO $$
BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Posted journals are immutable; corrections happen via reversal.
CREATE OR REPLACE FUNCTION public.guard_posted_journal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' OR OLD.is_posted THEN
      RAISE EXCEPTION 'Posted journal entries cannot be deleted — create a reversal';
    END IF;
    RETURN OLD;
  END IF;
  IF (OLD.status = 'posted' OR OLD.is_posted)
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Posted journal entries are immutable — create a reversal';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_posted_journal ON journal_entries;
CREATE TRIGGER trg_guard_posted_journal
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION guard_posted_journal();

-- Posting is a privileged, validated transition
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry journal_entries;
  v_debits numeric;
  v_credits numeric;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot post journal entries';
  END IF;
  SELECT * INTO v_entry FROM journal_entries WHERE id = p_id FOR UPDATE;
  IF v_entry.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF v_entry.status = 'posted' OR v_entry.is_posted THEN
    RAISE EXCEPTION 'Journal entry is already posted';
  END IF;
  IF NOT is_period_open(COALESCE(v_entry.entry_date, v_entry.date, CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Fiscal period is closed';
  END IF;
  SELECT COALESCE(SUM(debit_amount),0), COALESCE(SUM(credit_amount),0)
    INTO v_debits, v_credits
    FROM journal_entry_lines WHERE journal_entry_id = p_id;
  IF v_debits = 0 AND v_credits = 0 THEN
    RAISE EXCEPTION 'Journal entry has no lines';
  END IF;
  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'Journal is not balanced: debits % <> credits %', v_debits, v_credits;
  END IF;
  UPDATE journal_entries
     SET status = 'posted', is_posted = true,
         total_debit = v_debits, total_credit = v_credits,
         posted_at = now(), posted_by = auth.uid(), updated_at = now()
   WHERE id = p_id;
END;
$$;

-- Reversal: creates a mirrored draft entry linked to the original
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry journal_entries;
  v_new uuid;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN can reverse posted entries';
  END IF;
  SELECT * INTO v_entry FROM journal_entries WHERE id = p_id;
  IF v_entry.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF NOT (v_entry.status = 'posted' OR v_entry.is_posted) THEN
    RAISE EXCEPTION 'Only posted entries can be reversed';
  END IF;

  INSERT INTO journal_entries
    (entry_number, entry_date, date, description, reference_type, reference_id,
     currency, status, is_posted, created_by, created_at, updated_at)
  VALUES
    (next_doc_number('journal'), CURRENT_DATE, CURRENT_DATE,
     'Reversal of ' || COALESCE(v_entry.entry_number, p_id::text),
     'reversal', p_id, v_entry.currency, 'draft', false, auth.uid(), now(), now())
  RETURNING id INTO v_new;

  INSERT INTO journal_entry_lines
    (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description, line_order)
  SELECT v_new, account_code, account_name, credit_amount, debit_amount,
         'Reversal: ' || COALESCE(description, ''), line_order
    FROM journal_entry_lines WHERE journal_entry_id = p_id;

  RETURN v_new;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Reporting views (balances derive from documents — never mutable columns)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_customer_balances AS
SELECT
  COALESCE(i.customer_id::text, i.client_name, i.customer_name) AS customer_key,
  MAX(COALESCE(i.client_name, i.customer_name))                 AS customer_name,
  i.currency,
  SUM(COALESCE(i.total_amount, i.amount, 0))                    AS total_invoiced,
  SUM(COALESCE(a.allocated, 0))                                 AS total_paid,
  SUM(COALESCE(i.total_amount, i.amount, 0)) - SUM(COALESCE(a.allocated, 0)) AS balance
FROM invoices i
LEFT JOIN LATERAL (
  SELECT SUM(pa.amount) AS allocated
  FROM payment_allocations pa
  JOIN payments p ON p.id = pa.payment_id AND p.status = 'posted'
  WHERE pa.invoice_id = i.id
) a ON true
WHERE i.deleted_at IS NULL AND COALESCE(i.type, 'customer') <> 'vendor'
GROUP BY 1, i.currency;

CREATE OR REPLACE VIEW v_ar_aging AS
SELECT
  COALESCE(i.customer_id::text, i.client_name, i.customer_name) AS customer_key,
  MAX(COALESCE(i.client_name, i.customer_name))                 AS customer_name,
  i.currency,
  SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN out.amount ELSE 0 END)                                   AS current,
  SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 1 AND 30  THEN out.amount ELSE 0 END)                  AS days_30,
  SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN out.amount ELSE 0 END)                  AS days_60,
  SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND 90 THEN out.amount ELSE 0 END)                  AS days_90,
  SUM(CASE WHEN CURRENT_DATE - i.due_date > 90 THEN out.amount ELSE 0 END)                               AS days_90_plus,
  SUM(out.amount)                                                                                        AS total_outstanding
FROM invoices i
CROSS JOIN LATERAL (
  SELECT COALESCE(i.total_amount, i.amount, 0) - COALESCE((
    SELECT SUM(pa.amount) FROM payment_allocations pa
    JOIN payments p ON p.id = pa.payment_id AND p.status = 'posted'
    WHERE pa.invoice_id = i.id
  ), 0) AS amount
) out
WHERE i.deleted_at IS NULL
  AND COALESCE(i.type, 'customer') <> 'vendor'
  AND COALESCE(i.status, '') NOT IN ('draft','cancelled','void')
  AND out.amount > 0
GROUP BY 1, i.currency;

CREATE OR REPLACE VIEW v_vat_position AS
SELECT
  date_trunc('month', COALESCE(i.issue_date, i.created_at::date)) AS month,
  i.currency,
  SUM(CASE WHEN COALESCE(i.type,'customer') <> 'vendor' THEN COALESCE(i.vat_amount, i.tax_amount, 0) ELSE 0 END) AS output_vat,
  SUM(CASE WHEN COALESCE(i.type,'customer') =  'vendor' THEN COALESCE(i.vat_amount, i.tax_amount, 0) ELSE 0 END) AS input_vat,
  SUM(CASE WHEN COALESCE(i.type,'customer') <> 'vendor' THEN COALESCE(i.vat_amount, i.tax_amount, 0)
           ELSE -COALESCE(i.vat_amount, i.tax_amount, 0) END)     AS net_vat_payable
FROM invoices i
WHERE i.deleted_at IS NULL AND COALESCE(i.status,'') NOT IN ('draft','cancelled','void')
GROUP BY 1, i.currency;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Indexes on hot paths
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_date            ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_expenses_status          ON expenses (status);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due      ON invoices (status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer        ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date     ON journal_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_jel_account_code         ON journal_entry_lines (account_code);
CREATE INDEX IF NOT EXISTS idx_bank_statements_acct_rec ON bank_statements (bank_account_id, reconciled);
CREATE INDEX IF NOT EXISTS idx_payments_date            ON payments (payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_invoice    ON payment_allocations (invoice_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE fiscal_periods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences  ENABLE ROW LEVEL SECURITY;

-- Everyone signed-in can read; only finance roles can write.
DROP POLICY IF EXISTS fiscal_periods_read ON fiscal_periods;
CREATE POLICY fiscal_periods_read ON fiscal_periods
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- (writes only via close/reopen SECURITY DEFINER functions)

DROP POLICY IF EXISTS payments_read ON payments;
CREATE POLICY payments_read ON payments
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS payments_write ON payments;
CREATE POLICY payments_write ON payments
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
DROP POLICY IF EXISTS payments_update ON payments;
CREATE POLICY payments_update ON payments
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));

DROP POLICY IF EXISTS payment_allocations_read ON payment_allocations;
CREATE POLICY payment_allocations_read ON payment_allocations
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS payment_allocations_write ON payment_allocations;
CREATE POLICY payment_allocations_write ON payment_allocations
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
DROP POLICY IF EXISTS payment_allocations_delete ON payment_allocations;
CREATE POLICY payment_allocations_delete ON payment_allocations
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));

DROP POLICY IF EXISTS document_sequences_read ON document_sequences;
CREATE POLICY document_sequences_read ON document_sequences
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- (numbers issued only via next_doc_number SECURITY DEFINER function)

GRANT EXECUTE ON FUNCTION next_doc_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION post_journal_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_journal_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION close_fiscal_period(int, int, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION reopen_fiscal_period(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION is_period_open(date) TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Deprecation renames (duplicates identified in the audit; data preserved)
-- ────────────────────────────────────────────────────────────────────────────
-- Uncomment after confirming nothing external reads them:
-- ALTER TABLE chart_of_accounts       RENAME TO zz_deprecated_chart_of_accounts;
-- ALTER TABLE currency_exchange_rates RENAME TO zz_deprecated_currency_exchange_rates;
-- ALTER TABLE income                  RENAME TO zz_deprecated_income;
-- ALTER TABLE sales                   RENAME TO zz_deprecated_sales;
-- ALTER TABLE purchases               RENAME TO zz_deprecated_purchases;
