-- Closes the gap between the manual payment-recording flow
-- (/finance/transactions/payments) and bank-statement reconciliation
-- (124_bank_statement_line_posting.sql): today a recorded payment carries
-- no link back to the bank_transactions row post_bank_transaction() creates
-- for it, and reconciliation targets invoices directly instead of the real
-- payments/payment_allocations relationship. Both are additive, safe
-- changes — no existing table is replaced, no new payment or reconciliation
-- system is introduced.
--
-- Idempotent: safe to run more than once.

-- ── payments: link to the bank transaction that funded it, and to the
--    later-imported bank statement line's own reference once reconciled ──
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_transaction_id uuid REFERENCES bank_transactions(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_reference text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_payments_bank_transaction ON payments(bank_transaction_id);

-- A genuine bank-assigned reference (SWIFT/mobile-money id, etc.) should
-- never legitimately belong to two different payments — this is what makes
-- "exact transaction reference" a safe, deterministic match instead of a
-- fuzzy one. Partial: most payments never get one (recorded before the
-- statement exists), so only non-null values are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_reference_unique
  ON payments(transaction_reference) WHERE transaction_reference IS NOT NULL;

COMMENT ON COLUMN payments.transaction_reference IS
  'The bank''s own transaction id/reference (e.g. a SWIFT reference), backfilled when this payment is reconciled against an imported bank_statement_lines row. Distinct from payments.reference, which historically holds the invoice number.';

-- ── reconciliation_matches: an "invoice_payment" match now targets a real
--    payments.id (via payment_allocations -> invoices), not invoices.id
--    directly. reconcile_bank_statement_line (124) is the only writer of
--    this table for this entity type, so this is a safe, coordinated
--    redefinition rather than a breaking schema change — nothing else in
--    the app reads reconciliation_matches.matched_entity_id for this type. ──

CREATE OR REPLACE FUNCTION public.reconcile_bank_statement_line(
  p_line_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_entity_amount numeric  -- signed: positive = money in, negative = money out
)
RETURNS bank_statement_lines
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_line bank_statement_lines%ROWTYPE;
  v_batch bank_statement_batches%ROWTYPE;
  v_net numeric;
  v_already_reconciled boolean;
  v_payment payments%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot reconcile bank statement lines';
  END IF;

  IF p_entity_type NOT IN ('invoice_payment','expense','journal_line') THEN
    RAISE EXCEPTION 'Unknown match type: %', p_entity_type;
  END IF;

  SELECT * INTO v_line FROM bank_statement_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank statement line not found';
  END IF;

  IF v_line.match_status = 'posted' THEN
    RAISE EXCEPTION 'This transaction has already been posted.';
  ELSIF v_line.match_status = 'confirmed' THEN
    RAISE EXCEPTION 'This transaction has already been reconciled.';
  ELSIF v_line.match_status = 'ignored' THEN
    RAISE EXCEPTION 'This transaction has been ignored. Reverse the ignore first.';
  END IF;

  SELECT * INTO v_batch FROM bank_statement_batches WHERE id = v_line.bank_statement_batch_id;
  IF v_batch.status = 'posted' THEN
    RAISE EXCEPTION 'This bank statement is locked and cannot be changed.';
  END IF;

  v_net := COALESCE(v_line.credit_amount, 0) - COALESCE(v_line.debit_amount, 0);
  IF (v_net >= 0) IS DISTINCT FROM (p_entity_amount >= 0) THEN
    RAISE EXCEPTION 'Direction mismatch: this bank line and the selected transaction move money in opposite directions.';
  END IF;

  IF p_entity_type = 'invoice_payment' THEN
    SELECT * INTO v_payment FROM payments WHERE id = p_entity_id FOR UPDATE;
    IF v_payment.id IS NULL THEN
      RAISE EXCEPTION 'Selected payment not found.';
    END IF;
    v_already_reconciled := v_payment.reconciled;
  ELSIF p_entity_type = 'expense' THEN
    SELECT COALESCE(reconciled, false) INTO v_already_reconciled FROM expenses WHERE id = p_entity_id FOR UPDATE;
  ELSE
    SELECT COALESCE(reconciled, false) INTO v_already_reconciled FROM journal_entry_lines WHERE id = p_entity_id FOR UPDATE;
  END IF;

  IF v_already_reconciled IS NULL THEN
    RAISE EXCEPTION 'Selected transaction not found.';
  END IF;
  IF v_already_reconciled THEN
    RAISE EXCEPTION 'That transaction is already reconciled to a different bank line.';
  END IF;

  INSERT INTO reconciliation_matches (bank_statement_line_id, matched_entity_type, matched_entity_id, matched_amount, created_by)
  VALUES (p_line_id, p_entity_type, p_entity_id, abs(p_entity_amount), auth.uid());

  IF p_entity_type = 'invoice_payment' THEN
    -- Backfills the bank's own reference onto the payment the FIRST time it
    -- is reconciled — every later bank statement import can then find this
    -- payment by an exact reference match instead of only amount/date.
    UPDATE payments
       SET reconciled = true,
           transaction_reference = COALESCE(transaction_reference, v_line.reference_number)
     WHERE id = p_entity_id;

    UPDATE invoices SET reconciled = true
     WHERE id IN (SELECT invoice_id FROM payment_allocations WHERE payment_id = p_entity_id);
  ELSIF p_entity_type = 'expense' THEN
    UPDATE expenses SET reconciled = true WHERE id = p_entity_id;
  ELSE
    UPDATE journal_entry_lines SET reconciled = true WHERE id = p_entity_id;
  END IF;

  UPDATE bank_statement_lines
     SET match_status = 'confirmed', matched_by = auth.uid(), matched_at = now()
   WHERE id = p_line_id
   RETURNING * INTO v_line;

  RETURN v_line;
END;
$$;

GRANT EXECUTE ON FUNCTION reconcile_bank_statement_line(uuid, text, uuid, numeric) TO authenticated;

-- ── unreconcile_bank_statement_line: mirror the same payments-based lookup ──
CREATE OR REPLACE FUNCTION public.unreconcile_bank_statement_line(p_line_id uuid)
RETURNS bank_statement_lines
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_line bank_statement_lines%ROWTYPE;
  v_batch bank_statement_batches%ROWTYPE;
  v_match record;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot un-reconcile bank statement lines';
  END IF;

  SELECT * INTO v_line FROM bank_statement_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank statement line not found';
  END IF;

  IF v_line.match_status NOT IN ('matched','confirmed') THEN
    RAISE EXCEPTION 'This transaction is not reconciled.';
  END IF;

  SELECT * INTO v_batch FROM bank_statement_batches WHERE id = v_line.bank_statement_batch_id;
  IF v_batch.status = 'posted' THEN
    RAISE EXCEPTION 'This bank statement is locked and cannot be changed.';
  END IF;

  FOR v_match IN SELECT * FROM reconciliation_matches WHERE bank_statement_line_id = p_line_id LOOP
    IF v_match.matched_entity_type = 'invoice_payment' THEN
      -- The transaction_reference backfilled at reconcile time is left in
      -- place — it is a fact about the real bank transaction, not about
      -- this particular (now-undone) match, and clearing it would make the
      -- payment un-findable-by-reference on a future re-reconcile attempt.
      UPDATE payments SET reconciled = false WHERE id = v_match.matched_entity_id;
      UPDATE invoices SET reconciled = false
       WHERE id IN (SELECT invoice_id FROM payment_allocations WHERE payment_id = v_match.matched_entity_id);
    ELSIF v_match.matched_entity_type = 'expense' THEN
      UPDATE expenses SET reconciled = false WHERE id = v_match.matched_entity_id;
    ELSE
      UPDATE journal_entry_lines SET reconciled = false WHERE id = v_match.matched_entity_id;
    END IF;
  END LOOP;

  DELETE FROM reconciliation_matches WHERE bank_statement_line_id = p_line_id;

  UPDATE bank_statement_lines
     SET match_status = 'unmatched', matched_by = NULL, matched_at = NULL
   WHERE id = p_line_id
   RETURNING * INTO v_line;

  RETURN v_line;
END;
$$;

GRANT EXECUTE ON FUNCTION unreconcile_bank_statement_line(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
