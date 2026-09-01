-- Safe payment reversal. Replaces the raw payments.delete() the Payments
-- list page used to expose (removed in the previous pass) — deleting a
-- payment cascades to payment_allocations but reverses nothing in
-- bank_transactions, invoices.paid_amount, or the posted journal entry.
--
-- Follows the exact same pattern as reverse_bank_transfer()
-- (129_bank_transfers.sql): never edit or delete the original record,
-- create an opposite-direction entry through the SAME posting primitive
-- (post_bank_transaction -> post_journal_entry), and stamp the original
-- as reversed with a pointer to the reversal. No new accounting engine,
-- no new ledger mechanism.
--
-- 'voided' already existed in payments_status_check (and already had a
-- StatusBadge tone) but nothing ever set it — reused here as "this
-- payment's financial effect has been undone" rather than adding a new
-- status value. Idempotent: safe to run more than once.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES user_profiles(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_reason text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_journal_entry_id uuid REFERENCES journal_entries(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_bank_transaction_id uuid REFERENCES bank_transactions(id);

CREATE OR REPLACE FUNCTION public.reverse_customer_payment(p_payment_id uuid, p_reason text DEFAULT NULL)
RETURNS payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_invoice invoices%ROWTYPE;
  v_alloc record;
  v_new_paid numeric;
  v_total numeric;
  v_bank_code text;
  v_contra_code text;
  v_rev_txn bank_transactions%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN may reverse a payment';
  END IF;

  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found.';
  END IF;
  IF v_payment.status = 'voided' THEN
    RAISE EXCEPTION 'This payment has already been reversed.';
  END IF;
  IF v_payment.reconciled THEN
    RAISE EXCEPTION 'This payment is reconciled against a bank statement line — un-reconcile it first, then reverse.';
  END IF;
  IF v_payment.bank_account_id IS NULL OR v_payment.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'This payment has no linked bank transaction or journal entry to reverse.';
  END IF;

  SELECT coa_account_code INTO v_bank_code FROM bank_accounts WHERE id = v_payment.bank_account_id;

  -- The contra account actually posted against at creation time (usually
  -- Accounts Receivable) — read back from the original entry's own lines
  -- rather than re-resolving "the" receivable account for this currency,
  -- so a later change to the Chart of Accounts can't reverse the wrong line.
  SELECT account_code INTO v_contra_code
    FROM journal_entry_lines
   WHERE journal_entry_id = v_payment.journal_entry_id
     AND account_code IS DISTINCT FROM v_bank_code
   LIMIT 1;
  IF v_contra_code IS NULL THEN
    RAISE EXCEPTION 'Could not determine the original accounting entry for this payment.';
  END IF;

  v_rev_txn := post_bank_transaction(
    p_bank_account_id   := v_payment.bank_account_id,
    p_amount            := v_payment.amount,
    p_direction         := 'out',
    p_transaction_type  := 'payment_reversal',
    p_currency          := v_payment.currency,
    p_description       := 'Reversal of payment ' || COALESCE(v_payment.payment_number, v_payment.id::text),
    p_reference         := v_payment.payment_number,
    p_reference_type    := 'payment',
    p_reference_id      := v_payment.id,
    p_transaction_date  := CURRENT_DATE,
    p_contra_account_code := v_contra_code,
    p_idempotency_key   := gen_random_uuid()
  );

  -- Restore each allocated invoice's balance. payment_allocations rows are
  -- left in place (they are the historical record of what this payment
  -- once paid) — only the invoice's own cached paid_amount/status, which
  -- every payment-creation path in this app already maintains the same
  -- imperative way, is adjusted back down.
  FOR v_alloc IN SELECT * FROM payment_allocations WHERE payment_id = p_payment_id LOOP
    SELECT * INTO v_invoice FROM invoices WHERE id = v_alloc.invoice_id FOR UPDATE;
    IF v_invoice.id IS NOT NULL THEN
      v_total := COALESCE(v_invoice.total_amount, v_invoice.amount, 0);
      v_new_paid := GREATEST(0, COALESCE(v_invoice.paid_amount, 0) - v_alloc.amount);
      UPDATE invoices
         SET paid_amount = v_new_paid,
             status = CASE
                        WHEN v_new_paid <= 0.01 THEN 'unpaid'
                        WHEN v_new_paid < v_total - 0.01 THEN 'partial'
                        ELSE invoices.status
                      END
       WHERE id = v_invoice.id;
    END IF;
  END LOOP;

  UPDATE payments
     SET status = 'voided',
         reversed_at = now(),
         reversed_by = auth.uid(),
         reversal_reason = NULLIF(btrim(p_reason), ''),
         reversal_journal_entry_id = v_rev_txn.journal_entry_id,
         reversal_bank_transaction_id = v_rev_txn.id
   WHERE id = p_payment_id
   RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

REVOKE EXECUTE ON FUNCTION reverse_customer_payment(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reverse_customer_payment(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION reverse_customer_payment(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
