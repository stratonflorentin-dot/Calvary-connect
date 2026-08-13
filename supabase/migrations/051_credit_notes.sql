-- Replaces the credit-notes page's current hack: it has no credit_notes
-- table at all, and instead inserts NEGATIVE-amount rows into `invoices`
-- with a "CN-" prefix on invoice_number. That never posted to the ledger
-- (confirmed: no RPC call, no trigger touched it), so a credit note issued
-- through the app today has zero accounting effect — it doesn't reduce AR,
-- doesn't post a reversal, nothing. It also silently mixes fake negative
-- invoices into the same `invoices` table used for real revenue reporting.
-- document_sequences already had an unused 'credit_note' -> 'CN-' row
-- provisioned (from whoever built that page originally), so real numbering
-- was half set up and never finished.
--
-- credit_notes is now a real table with a real posting function, following
-- the reference posting rule for a credit note against a paid/issued
-- invoice:
--   Dr Sales Returns (contra-revenue, new account 4009)   net
--   Dr VAT Payable (2106)                                 vat, if any
--   Cr Accounts Receivable (1104)                          total
--
-- Posting is an explicit action (post_credit_note RPC), not an insert
-- trigger like invoices — a credit note is a deliberate correction that
-- should go through post_journal_entry's normal CEO/ADMIN/ACCOUNTANT role
-- check, same as reverse_journal_entry and post_bank_transaction.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  original_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TZS',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'voided')),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_original_invoice_id ON credit_notes(original_invoice_id);

REVOKE ALL ON credit_notes FROM anon;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- Same role set as customers_all / client_emails_all: CEO/ADMIN/SALESMAN
-- can raise a draft credit note, but posting it to the ledger (below) is
-- narrowed further to CEO/ADMIN/ACCOUNTANT by post_journal_entry itself.
DROP POLICY IF EXISTS credit_notes_all ON credit_notes;
CREATE POLICY credit_notes_all ON credit_notes FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN', 'ACCOUNTANT'));

CREATE OR REPLACE FUNCTION public.assign_credit_note_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.credit_note_number IS NULL THEN
    NEW.credit_note_number := next_doc_number('credit_note');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_assign_credit_note_number ON credit_notes;
CREATE TRIGGER trg_assign_credit_note_number
  BEFORE INSERT ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION assign_credit_note_number();

INSERT INTO accounts (code, name, category, type, account_type, currency, is_active, opening_balance, current_balance, balance)
SELECT '4009', 'Sales Returns & Credit Notes', 'REVENUE', 'debit', 'revenue', 'TZS', true, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '4009');

CREATE OR REPLACE FUNCTION public.post_credit_note(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note credit_notes;
  v_total NUMERIC;
  v_net NUMERIC;
  v_vat NUMERIC;
  v_rate NUMERIC;
  v_entry_id UUID;
BEGIN
  SELECT * INTO v_note FROM credit_notes WHERE id = p_id FOR UPDATE;
  IF v_note.id IS NULL THEN
    RAISE EXCEPTION 'Credit note not found';
  END IF;
  IF v_note.status <> 'draft' THEN
    RAISE EXCEPTION 'Credit note % is already %; cannot re-post', v_note.credit_note_number, v_note.status;
  END IF;

  v_total := v_note.total_amount;
  v_net := v_note.amount;
  v_vat := COALESCE(v_note.vat_amount, 0);

  IF COALESCE(v_note.currency, 'TZS') <> 'TZS' THEN
    SELECT rate INTO v_rate
      FROM exchange_rates
     WHERE from_currency = v_note.currency AND to_currency = 'TZS'
     ORDER BY effective_date DESC
     LIMIT 1;
    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'No exchange rate found for % -> TZS — cannot post credit note %', v_note.currency, v_note.credit_note_number;
    END IF;
    v_total := v_total * v_rate;
    v_net := v_net * v_rate;
    v_vat := v_vat * v_rate;
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id, invoice_id,
    currency, status, is_posted, total_debit, total_credit, created_by
  ) VALUES (
    generate_entry_number(), v_note.issue_date, v_note.issue_date,
    'Credit note ' || v_note.credit_note_number || ' — ' || COALESCE(v_note.customer_name, 'customer'),
    'CREDIT_NOTE', v_note.id, v_note.original_invoice_id, 'TZS', 'draft', false, v_total, v_total, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '4009', v_net, 0, 'Sales return — ' || v_note.credit_note_number, 'TZS', 1);

  IF v_vat > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '2106', v_vat, 0, 'VAT reversed — ' || v_note.credit_note_number, 'TZS', 2);
  END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '1104', 0, v_total, 'AR reduced — ' || v_note.credit_note_number, 'TZS', 3);

  PERFORM post_journal_entry(v_entry_id);

  UPDATE credit_notes SET status = 'issued', journal_entry_id = v_entry_id, updated_at = now() WHERE id = p_id;

  RETURN v_entry_id;
END;
$function$;

INSERT INTO public.schema_migrations (version) VALUES ('051_credit_notes.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
