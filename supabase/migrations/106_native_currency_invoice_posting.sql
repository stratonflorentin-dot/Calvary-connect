-- Two related fixes surfaced by an actual USD invoice payment failing
-- live with "No Accounts Receivable account exists in USD":
--
-- 1. 096_coa_usd_siblings.sql deliberately skipped ASSETS/LIABILITIES
--    when generating USD sibling accounts, reasoning they'd "rarely need"
--    a second currency. That assumption no longer holds: this session
--    wired Quotations to carry their currency straight through to
--    Invoices (customer-invoices' quotation-select), so a USD invoice is
--    routine now, not rare. Adds the missing USD siblings for 1104
--    (Accounts Receivable), 2101 (Accounts Payable — the active one;
--    2001 is the dead duplicate flagged in ar-ap-accounts.ts's own
--    comment), 4002 (Local Delivery Revenue), and 2106 (VAT Payable).
--
-- 2. The deeper bug: send_invoice() (103_invoice_send_step.sql)
--    converted every invoice to TZS-equivalent at post time and posted
--    ONLY against the TZS accounts (1104/4002/2106) — a design it
--    inherited unchanged from 050_auto_post_invoices_to_ledger.sql,
--    written before per-currency sibling accounts existed. Meanwhile
--    payment posting (post_bank_transaction, via recordPayment's
--    resolveReceivableAccountCode) requires the contra account's
--    currency to match the receiving bank account's currency exactly —
--    post_journal_entry's currency guard (078_accounts_leaf_only_
--    posting.sql) enforces this as a hard invariant, and
--    post_bank_transaction stamps BOTH lines of a payment with the
--    bank account's own currency, no way around it.
--
--    Net effect for any non-TZS invoice: revenue got booked as a debit
--    to 1104 (TZS), but a payment against it would credit a *different*
--    account (e.g. 1104-USD) — the two would never reconcile. AR would
--    show permanently outstanding in TZS while a phantom, unexplained
--    credit sat in the USD account. Adding just the USD accounts (part
--    1 above) would have made the error go away while quietly producing
--    exactly that broken bookkeeping.
--
--    Fix: send_invoice now resolves AR/Revenue/VAT accounts by the
--    invoice's OWN currency (same code-suffix convention 096 already
--    established: base code + '-' + currency, TZS unsuffixed) and posts
--    the invoice's native amounts directly — no FX conversion at Send
--    time at all anymore, which also removes the old "no exchange rate
--    found" failure mode for sending a foreign-currency invoice. Revenue
--    recognition and payment now both operate in the invoice's own
--    currency, against the same per-currency account pair, exactly like
--    every other multi-currency flow in this chart (096's own stated
--    principle: never blend currencies into one balance).
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- Defensive: safe even if 103_invoice_send_step.sql (which also adds
-- these) hasn't been run yet — send_invoke references both columns.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES user_profiles(id);

INSERT INTO accounts (code, name, category, type, account_type, currency, is_postable, is_active, parent_code, sub_category, description, date, balance, current_balance, opening_balance, is_bank_account)
SELECT
  a.code || '-USD',
  a.name || ' (USD)',
  a.category,
  a.type,
  a.account_type,
  'USD',
  a.is_postable,
  a.is_active,
  a.parent_code,
  a.sub_category,
  a.description,
  CURRENT_DATE,
  0, 0, 0,
  false
FROM accounts a
WHERE a.code IN ('1104', '2101', '4002', '2106')
  AND NOT EXISTS (SELECT 1 FROM accounts existing WHERE existing.code = a.code || '-USD');

CREATE OR REPLACE FUNCTION public.send_invoice(p_invoice_id uuid)
RETURNS invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv invoices;
  v_total numeric;
  v_net numeric;
  v_vat numeric;
  v_entry_id uuid;
  v_suffix text;
  v_ar_code text;
  v_rev_code text;
  v_vat_code text;
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

  -- Native currency, no conversion — the invoice's own amounts post
  -- directly against that currency's own AR/Revenue/VAT accounts.
  v_total := v_inv.total_amount;
  v_net := COALESCE(v_inv.amount, v_inv.total_amount - COALESCE(v_inv.vat_amount, 0));
  v_vat := COALESCE(v_inv.vat_amount, 0);

  v_suffix := CASE WHEN COALESCE(v_inv.currency, 'TZS') = 'TZS' THEN '' ELSE '-' || v_inv.currency END;
  v_ar_code := '1104' || v_suffix;
  v_rev_code := '4002' || v_suffix;
  v_vat_code := '2106' || v_suffix;

  IF NOT EXISTS (SELECT 1 FROM accounts WHERE code = v_ar_code AND is_postable AND is_active) THEN
    RAISE EXCEPTION 'No "Accounts Receivable" account exists in % — add one to the Chart of Accounts first (expected code %)', v_inv.currency, v_ar_code;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE code = v_rev_code AND is_postable AND is_active) THEN
    RAISE EXCEPTION 'No Revenue account exists in % — add one to the Chart of Accounts first (expected code %)', v_inv.currency, v_rev_code;
  END IF;
  IF v_vat > 0 AND NOT EXISTS (SELECT 1 FROM accounts WHERE code = v_vat_code AND is_postable AND is_active) THEN
    RAISE EXCEPTION 'No VAT Payable account exists in % — add one to the Chart of Accounts first (expected code %)', v_inv.currency, v_vat_code;
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
    'INVOICE', v_inv.id, v_inv.id, COALESCE(v_inv.currency, 'TZS'), 'draft', false, auth.uid(), now(), now()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_ar_code, v_total, 0, 'Receivable — ' || v_inv.invoice_number, COALESCE(v_inv.currency, 'TZS'), 1);

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, v_rev_code, 0, v_net, 'Revenue — ' || v_inv.invoice_number, COALESCE(v_inv.currency, 'TZS'), 2);

  IF v_vat > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, v_vat_code, 0, v_vat, 'VAT on ' || v_inv.invoice_number, COALESCE(v_inv.currency, 'TZS'), 3);
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
