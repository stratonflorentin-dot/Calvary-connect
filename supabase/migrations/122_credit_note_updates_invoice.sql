-- invoices.paid_at is read and written throughout the finance module
-- (recordPayment on both the invoice list and detail pages, the payroll
-- "mark paid" flow, the CEO/salesman dashboards' "paid this month" KPIs,
-- and the average-days-to-pay calculation) but — like paid_amount before
-- 079_invoices_paid_amount.sql — the column was never actually migrated
-- onto the live table. UPDATE statements that set it (recordPayment,
-- markPayrollPaidAction) fail outright with "column invoices.paid_at
-- does not exist" the moment they run against a real invoice; SELECT
-- reads of it just silently come back undefined, so the dashboard KPIs
-- that filter on it permanently show zero. Same "gone unnoticed because
-- ~0 real invoices have been paid through the app yet" situation as 079.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- post_credit_note (051_credit_notes.sql) posts the ledger side of a
-- credit note (Dr Sales Returns / Dr VAT / Cr Accounts Receivable) but
-- never touches the invoices row it's issued against. Every other screen
-- that reads `invoices` directly — the invoice detail page, the aging
-- report, credit-check exposure, the customer detail page — has no idea
-- the credit note exists, so a fully-credited invoice still shows as
-- fully owed everywhere except the one report (statement-of-accounts)
-- that was patched to separately re-query credit_notes and merge them in
-- by hand.
--
-- Fix: apply the credit note's total to the invoice the same way a real
-- payment already is (recordPayment) — add to paid_amount, flip status to
-- 'paid' once paid_amount reaches the total, 'partial' otherwise. This
-- reuses the exact mechanism every existing read path already computes
-- outstanding balance from (total_amount - paid_amount), so nothing else
-- needs to change.

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
  v_invoice_total NUMERIC;
  v_invoice_paid NUMERIC;
  v_new_paid NUMERIC;
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

  -- Apply the credit to the invoice it was issued against, same as a real
  -- payment would. total_amount already reflects the invoice's own
  -- currency (v_total above is converted to TZS for the ledger only), so
  -- the credit note's own total_amount (not v_total) is what's applied.
  IF v_note.original_invoice_id IS NOT NULL THEN
    SELECT COALESCE(total_amount, 0), COALESCE(paid_amount, 0)
      INTO v_invoice_total, v_invoice_paid
      FROM invoices WHERE id = v_note.original_invoice_id FOR UPDATE;

    IF FOUND THEN
      v_new_paid := v_invoice_paid + v_note.total_amount;
      UPDATE invoices
         SET paid_amount = v_new_paid,
             status = CASE WHEN v_new_paid >= v_invoice_total THEN 'paid' ELSE 'partial' END,
             paid_at = CASE WHEN v_new_paid >= v_invoice_total THEN now() ELSE paid_at END,
             updated_at = now()
       WHERE id = v_note.original_invoice_id;
    END IF;
  END IF;

  RETURN v_entry_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';
