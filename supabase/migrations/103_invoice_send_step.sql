-- Revenue was being recognized at invoice INSERT (050's BEFORE INSERT
-- trigger), not at an explicit Sent transition — this app's create flow
-- has always set new invoices straight to status 'pending' and posted
-- immediately, with no real Draft state in practice.
--
-- This migration:
--   1. Stops auto-posting on insert (drops trg_post_invoice_journal_entry
--      and the now-unused post_invoice_journal_entry()).
--   2. Adds a real Draft → Sent transition: send_invoice(p_invoice_id)
--      builds the same Dr AR / Cr Revenue / Cr VAT lines 050 used to build
--      inline, but — unlike 050 — hands them to post_journal_entry(), the
--      SAME generic posting primitive post_bank_transaction() already uses
--      for payment posting (validates role/period/balance/postability/
--      currency, then rolls the lines into accounts.current_balance by
--      each account's normal-balance type — see 078_accounts_leaf_only_
--      posting.sql). Both money events in this invoice's lifecycle now
--      go through that one shared primitive instead of one DB trigger
--      duplicating the balance-rolling logic and one RPC using it properly.
--   3. Adds invoices.sent_at / sent_by so "sent" is a real, timestamped
--      event, not just a status label.
--
-- guard_sent_invoice() (102_shipments_waybills_invoice_lock.sql) already
-- treats 'draft' and 'pending' as the unlocked states and everything else
-- (including the new 'sent') as locked — no change needed there. The app
-- side (customer-invoices/page.tsx) switches from creating invoices at
-- 'pending' with immediate posting to creating them at 'draft' with no
-- posting, then calling this RPC from an explicit "Send" action.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES user_profiles(id);

-- Invoices are now referenced by Quotation, not Trip (the customer-invoices
-- create form dropped its Trip Ref selector for a Quotation Ref one) — the
-- lock guard needs to know quotation_id is financially-significant too, or
-- a locked/sent invoice could be silently re-pointed at a different quote.
CREATE OR REPLACE FUNCTION public.guard_sent_invoice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS NULL OR OLD.status IN ('draft', 'pending') THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.shipment_id IS DISTINCT FROM OLD.shipment_id
     OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
     OR NEW.quotation_id IS DISTINCT FROM OLD.quotation_id
  THEN
    RAISE EXCEPTION 'This invoice is locked and cannot be edited — it has been issued and is a finalized financial document. Use a Credit Note instead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_invoice_journal_entry ON invoices;
DROP FUNCTION IF EXISTS public.post_invoice_journal_entry();

CREATE OR REPLACE FUNCTION public.send_invoice(p_invoice_id uuid)
RETURNS invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invoices;
  v_total numeric;
  v_net numeric;
  v_vat numeric;
  v_rate numeric;
  v_entry_id uuid;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot send invoices';
  END IF;

  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  IF v_inv.status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'Invoice % has already been sent', v_inv.invoice_number;
  END IF;
  IF v_inv.journal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice % already has a posted journal entry', v_inv.invoice_number;
  END IF;

  -- Legacy "CN-" prefixed rows and zero-amount invoices skip posting,
  -- matching 050's original exemptions, but still transition to Sent.
  IF v_inv.invoice_number ILIKE 'CN-%' OR v_inv.total_amount IS NULL OR v_inv.total_amount = 0 THEN
    UPDATE invoices
       SET status = 'sent', sent_at = now(), sent_by = auth.uid(), updated_at = now()
     WHERE id = p_invoice_id
    RETURNING * INTO v_inv;
    RETURN v_inv;
  END IF;

  v_total := v_inv.total_amount;
  v_net := COALESCE(v_inv.amount, v_inv.total_amount - COALESCE(v_inv.vat_amount, 0));
  v_vat := COALESCE(v_inv.vat_amount, 0);

  IF COALESCE(v_inv.currency, 'TZS') <> 'TZS' THEN
    SELECT rate INTO v_rate
      FROM exchange_rates
     WHERE from_currency = v_inv.currency AND to_currency = 'TZS'
     ORDER BY effective_date DESC
     LIMIT 1;
    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'No exchange rate found for % -> TZS — cannot send invoice %', v_inv.currency, v_inv.invoice_number;
    END IF;
    v_total := v_total * v_rate;
    v_net := v_net * v_rate;
    v_vat := v_vat * v_rate;
  END IF;

  IF NOT is_period_open(COALESCE(v_inv.issue_date, CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Fiscal period is closed — cannot send invoice %', v_inv.invoice_number;
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id, invoice_id,
    currency, status, is_posted, created_by, created_at, updated_at
  ) VALUES (
    generate_entry_number(), COALESCE(v_inv.issue_date, CURRENT_DATE), COALESCE(v_inv.issue_date, CURRENT_DATE),
    'Invoice ' || v_inv.invoice_number || ' to ' || COALESCE(v_inv.customer_name, v_inv.client_name, 'customer'),
    'INVOICE', v_inv.id, v_inv.id, 'TZS', 'draft', false, auth.uid(), now(), now()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '1104', v_total, 0, 'Receivable — ' || v_inv.invoice_number, 'TZS', 1);

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '4002', 0, v_net, 'Revenue — ' || v_inv.invoice_number, 'TZS', 2);

  IF v_vat > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '2106', 0, v_vat, 'VAT on ' || v_inv.invoice_number, 'TZS', 3);
  END IF;

  -- The shared primitive: validates balance/period/postability/currency
  -- and rolls the lines into accounts.current_balance.
  PERFORM post_journal_entry(v_entry_id);

  UPDATE invoices
     SET status = 'sent', sent_at = now(), sent_by = auth.uid(),
         journal_entry_id = v_entry_id, updated_at = now()
   WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_invoice(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
