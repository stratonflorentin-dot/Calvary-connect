-- Customer invoices never posted to the Chart of Accounts at all: no
-- trigger, no RPC call from src/app/finance/invoicing/customer-invoices,
-- nothing. create_invoice_journal_entry (a function that WOULD do this)
-- exists in the DB but is called from zero places in the app, and it
-- hardcodes AR as account '1100' — which is actually the "Current Assets"
-- section header, not Accounts Receivable (that's '1104') — confirming it
-- was never really exercised. The only automated thing invoices feed is
-- trip_revenue (an operational reporting table), not the ledger.
--
-- Fix, per the user's explicit choice (auto-post, same pattern as
-- vehicle_costs auto-syncing from expenses in migration 039): every new
-- invoice posts itself on insert —
--   Dr Accounts Receivable (1104)   total_amount
--   Cr Revenue (4002)               amount (pre-VAT)
--   Cr VAT Payable (2106)           vat_amount, if any
-- — matching this system's existing account codes (checked live) rather
-- than the dead function's wrong ones.
--
-- Not called via post_journal_entry: that function's role check
-- (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT')) reads the actual
-- invoking user's role, which SECURITY DEFINER on a trigger function does
-- NOT change. invoices_write happens to restrict invoice creation to the
-- same CEO/ADMIN/ACCOUNTANT set, so that check would pass here too — but
-- relying on two separately-maintained role lists staying in sync forever
-- is exactly the kind of thing that quietly breaks later, so this trigger
-- does the same balance-check-and-post steps inline regardless, trusted
-- because the three amounts are computed here, not user-supplied lines.
-- Unlike post_bank_transaction's journal mirror (which swallows a
-- failure into a NOTICE), this does NOT catch its own errors — an invoice
-- and its ledger posting stay atomic, in the same transaction.
--
-- Multi-currency: AR/Revenue/VAT accounts are TZS-only today. A USD
-- invoice is converted to TZS at post time via exchange_rates, same
-- pattern as post_bank_transaction — the ledger stays in base currency
-- even when the customer-facing invoice is in USD.
--
-- Legacy "CN-" prefixed rows (the credit-notes page's old negative-invoice
-- hack, replaced in the next migration) are explicitly excluded so they
-- don't double-post once real credit notes exist.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id);

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

  v_total := NEW.total_amount;
  v_net := COALESCE(NEW.amount, NEW.total_amount - COALESCE(NEW.vat_amount, 0));
  v_vat := COALESCE(NEW.vat_amount, 0);

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

DROP TRIGGER IF EXISTS trg_post_invoice_journal_entry ON invoices;
CREATE TRIGGER trg_post_invoice_journal_entry
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION post_invoice_journal_entry();

INSERT INTO public.schema_migrations (version) VALUES ('050_auto_post_invoices_to_ledger.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
