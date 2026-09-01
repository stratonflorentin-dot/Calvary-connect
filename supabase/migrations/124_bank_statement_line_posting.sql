-- Bank statement lines currently support two of three intended actions:
-- Match+Confirm (-> reconciliation_matches, no new JE) and Ignore. There is
-- no way to record a bank line that represents a brand-new accounting event
-- (a bank charge, an unbilled receipt, ...) as a real journal entry against
-- a chosen Chart of Accounts account — "Create expense" is the closest
-- thing, but it only covers money-out and skips the COA picker entirely.
--
-- This migration adds that missing POST action as a thin, atomic wrapper
-- around the existing public.post_bank_transaction() / post_journal_entry()
-- primitives (supabase/migrations/090_cashier_access.sql,
-- 078_accounts_leaf_only_posting.sql) — no parallel posting logic, no new
-- ledger mechanism. It also adds RPC wrappers for reconcile/un-reconcile/
-- ignore/un-ignore so every one of the four actions gets the same
-- server-side validation, row locking and duplicate protection instead of
-- leaving reconcile/ignore as bare client-side .update() calls.
--
-- Idempotent: safe to run more than once.

-- ── Schema: track what each line resolved to ────────────────────────────────
ALTER TABLE bank_statement_lines DROP CONSTRAINT IF EXISTS bank_statement_lines_match_status_check;
ALTER TABLE bank_statement_lines ADD CONSTRAINT bank_statement_lines_match_status_check
  CHECK (match_status IN ('unmatched','matched','confirmed','ignored','posted'));

ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id);
ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES user_profiles(id);
ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS ignore_reason text;
ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS ignored_by uuid REFERENCES user_profiles(id);
ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS ignored_at timestamptz;

-- journal_entries.reference is read by the bank statement detail page
-- already (select "...journal_entries(id, entry_date, reference, ...)");
-- add it defensively in case a given environment never got it via an
-- untracked ad-hoc change (same situation 035 documented for
-- bank_accounts.coa_account_code).
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference text;

-- accounts.is_active and accounts.is_bank_account are both relied on by
-- ChartOfAccountsService.getAccounts() and migrations 096/106 respectively
-- but, like coa_account_code, were never found created by an explicit
-- ADD COLUMN in this repo's migration history — same "added ad hoc against
-- prod" situation. Defensive, idempotent, matches the shape those other
-- call sites already assume.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_bank_account boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_journal_entry ON bank_statement_lines(journal_entry_id);

-- ── POST: new accounting event, allocated to a chosen COA account ──────────
CREATE OR REPLACE FUNCTION public.post_bank_statement_line(
  p_line_id uuid,
  p_coa_account_code text,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS bank_statement_lines
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_line bank_statement_lines%ROWTYPE;
  v_batch bank_statement_batches%ROWTYPE;
  v_bank bank_accounts%ROWTYPE;
  v_account accounts%ROWTYPE;
  v_direction text;
  v_amount numeric;
  v_txn bank_transactions%ROWTYPE;
  v_final_description text;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot post bank statement lines';
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
  ELSIF v_line.match_status = 'matched' THEN
    RAISE EXCEPTION 'This transaction has a pending match. Undo it before posting.';
  END IF;

  SELECT * INTO v_batch FROM bank_statement_batches WHERE id = v_line.bank_statement_batch_id;
  IF v_batch.status = 'posted' THEN
    RAISE EXCEPTION 'This bank statement is locked and cannot be changed.';
  END IF;

  IF p_coa_account_code IS NULL OR btrim(p_coa_account_code) = '' THEN
    RAISE EXCEPTION 'Please select a COA account.';
  END IF;

  SELECT * INTO v_account FROM accounts WHERE code = p_coa_account_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected account does not exist.';
  END IF;
  IF v_account.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Selected account is not active.';
  END IF;
  IF v_account.is_postable IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Selected account is not postable.';
  END IF;

  SELECT * INTO v_bank FROM bank_accounts WHERE id = v_batch.bank_account_id;
  IF v_bank.id IS NULL OR v_bank.coa_account_code IS NULL THEN
    RAISE EXCEPTION 'No valid bank COA is configured for this account.';
  END IF;

  IF COALESCE(v_line.debit_amount, 0) > 0 AND COALESCE(v_line.credit_amount, 0) = 0 THEN
    v_direction := 'out';
    v_amount := v_line.debit_amount;
  ELSIF COALESCE(v_line.credit_amount, 0) > 0 AND COALESCE(v_line.debit_amount, 0) = 0 THEN
    v_direction := 'in';
    v_amount := v_line.credit_amount;
  ELSE
    RAISE EXCEPTION 'This line has no valid amount to post.';
  END IF;

  v_final_description := 'Bank statement posting: ' ||
    COALESCE(NULLIF(btrim(p_description), ''), v_line.description, 'transaction');

  -- Same transaction as this function (plpgsql calls compose transactionally)
  -- — if post_bank_transaction / post_journal_entry raises for any reason
  -- (closed period, unbalanced entry, currency mismatch, header account,
  -- ...), everything here rolls back and the line stays untouched.
  v_txn := post_bank_transaction(
    p_bank_account_id   := v_bank.id,
    p_amount            := v_amount,
    p_direction         := v_direction,
    p_transaction_type  := 'bank_statement_posting',
    p_currency          := v_bank.currency,
    p_description       := v_final_description,
    p_reference         := COALESCE(NULLIF(btrim(p_reference), ''), v_line.reference_number),
    p_reference_type    := 'bank_statement_line',
    p_reference_id      := v_line.id,
    p_transaction_date  := v_line.transaction_date,
    p_contra_account_code := p_coa_account_code,
    p_idempotency_key   := v_line.id
  );

  IF v_txn.journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Unable to create journal entry. No changes were made.';
  END IF;

  UPDATE journal_entries
     SET entry_number = COALESCE(entry_number, generate_entry_number()),
         reference = COALESCE(NULLIF(btrim(p_reference), ''), v_line.reference_number, reference)
   WHERE id = v_txn.journal_entry_id;

  UPDATE bank_statement_lines
     SET match_status = 'posted',
         journal_entry_id = v_txn.journal_entry_id,
         posted_by = auth.uid(),
         posted_at = now()
   WHERE id = p_line_id
   RETURNING * INTO v_line;

  RETURN v_line;
END;
$$;

GRANT EXECUTE ON FUNCTION post_bank_statement_line(uuid, text, text, text) TO authenticated;

-- ── RECONCILE: link to an existing accounting transaction, no new JE ───────
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
    SELECT COALESCE(reconciled, false) INTO v_already_reconciled FROM invoices WHERE id = p_entity_id FOR UPDATE;
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
    UPDATE invoices SET reconciled = true WHERE id = p_entity_id;
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

-- ── UN-RECONCILE: drop the match, keep the original transaction intact ─────
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
      UPDATE invoices SET reconciled = false WHERE id = v_match.matched_entity_id;
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

-- ── IGNORE / UN-IGNORE ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ignore_bank_statement_line(p_line_id uuid, p_reason text DEFAULT NULL)
RETURNS bank_statement_lines
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_line bank_statement_lines%ROWTYPE;
  v_batch bank_statement_batches%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot ignore bank statement lines';
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
    RAISE EXCEPTION 'This transaction is already ignored.';
  END IF;

  SELECT * INTO v_batch FROM bank_statement_batches WHERE id = v_line.bank_statement_batch_id;
  IF v_batch.status = 'posted' THEN
    RAISE EXCEPTION 'This bank statement is locked and cannot be changed.';
  END IF;

  UPDATE bank_statement_lines
     SET match_status = 'ignored',
         ignore_reason = NULLIF(btrim(p_reason), ''),
         ignored_by = auth.uid(),
         ignored_at = now(),
         -- kept in sync for any older code/reports still reading matched_by/matched_at
         matched_by = auth.uid(),
         matched_at = now()
   WHERE id = p_line_id
   RETURNING * INTO v_line;

  RETURN v_line;
END;
$$;

GRANT EXECUTE ON FUNCTION ignore_bank_statement_line(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.unignore_bank_statement_line(p_line_id uuid)
RETURNS bank_statement_lines
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_line bank_statement_lines%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN may reverse an ignored transaction';
  END IF;

  SELECT * INTO v_line FROM bank_statement_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank statement line not found';
  END IF;
  IF v_line.match_status <> 'ignored' THEN
    RAISE EXCEPTION 'This transaction is not ignored.';
  END IF;

  UPDATE bank_statement_lines
     SET match_status = 'unmatched',
         ignore_reason = NULL, ignored_by = NULL, ignored_at = NULL,
         matched_by = NULL, matched_at = NULL
   WHERE id = p_line_id
   RETURNING * INTO v_line;

  RETURN v_line;
END;
$$;

GRANT EXECUTE ON FUNCTION unignore_bank_statement_line(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
