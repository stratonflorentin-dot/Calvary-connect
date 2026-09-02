-- post_bank_statement_line() (124_bank_statement_line_posting.sql) calls
-- post_bank_transaction(), which internally calls post_journal_entry() and
-- so returns with the new journal_entries row ALREADY status='posted'.
-- post_bank_statement_line() then runs its own
--   UPDATE journal_entries SET entry_number = ..., reference = ... WHERE id = ...
-- against that same row to backfill entry_number/reference — but
-- guard_posted_journal() (006_finance_foundation.sql) blocks ANY update to
-- an already-posted journal entry whose status isn't itself changing,
-- raising "Posted journal entries are immutable — create a reversal".
--
-- Since post_bank_transaction() always posts the entry synchronously before
-- returning, this UPDATE has hit the guard on every single call — the Post
-- action on a bank statement line has never been able to succeed. Reproduced
-- live: posting a GEPG receipt line failed with exactly this error.
--
-- Fix: set entry_number and reference on the journal_entries row at INSERT
-- time inside post_bank_transaction() — before post_journal_entry() posts
-- it and the guard trigger locks it — instead of backfilling them after the
-- fact. post_bank_statement_line() no longer needs (or is able) to touch
-- journal_entries itself afterward, so that UPDATE is dropped entirely.
-- generate_entry_number() reuses the same helper every other posting
-- function in this schema already calls (060_fix_generate_entry_number_
-- ambiguous_column.sql). No other behavior changes: every existing caller
-- of post_bank_transaction() now gets entry_number/reference populated at
-- creation instead of staying NULL forever, which is what those columns
-- were always meant to hold.
--
-- Idempotent: safe to run more than once.

CREATE OR REPLACE FUNCTION public.post_bank_transaction(p_bank_account_id uuid, p_amount numeric, p_direction text, p_transaction_type text, p_currency text, p_description text, p_reference text DEFAULT NULL::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_transaction_date date DEFAULT CURRENT_DATE, p_contra_account_code text DEFAULT NULL::text, p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS bank_transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account bank_accounts%ROWTYPE;
  v_rate numeric;
  v_converted numeric;
  v_delta numeric;
  v_txn bank_transactions%ROWTYPE;
  v_entry_id uuid;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT','CASHIER') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/ACCOUNTANT/CASHIER may post bank transactions';
  END IF;

  IF p_direction NOT IN ('in','out') THEN
    RAISE EXCEPTION 'p_direction must be ''in'' or ''out''';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be a positive number';
  END IF;

  SELECT * INTO v_account FROM bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank account % not found', p_bank_account_id;
  END IF;

  IF p_currency = v_account.currency THEN
    v_converted := p_amount;
  ELSE
    SELECT rate INTO v_rate
      FROM exchange_rates
     WHERE from_currency = p_currency AND to_currency = v_account.currency
     ORDER BY effective_date DESC
     LIMIT 1;
    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'No exchange rate found for % -> %', p_currency, v_account.currency;
    END IF;
    v_converted := p_amount * v_rate;
  END IF;

  v_delta := CASE WHEN p_direction = 'in' THEN v_converted ELSE -v_converted END;

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM bank_transactions
     WHERE bank_account_id = p_bank_account_id AND idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_TRANSACTION: this payment was already posted';
  END IF;

  INSERT INTO bank_transactions (
    bank_account_id, transaction_date, description, reference,
    transaction_type, amount, currency, debit, credit,
    reference_type, reference_id, idempotency_key, created_by
  ) VALUES (
    p_bank_account_id, p_transaction_date, p_description, p_reference,
    p_transaction_type, v_converted, v_account.currency,
    CASE WHEN p_direction = 'out' THEN v_converted ELSE 0 END,
    CASE WHEN p_direction = 'in' THEN v_converted ELSE 0 END,
    p_reference_type, p_reference_id, p_idempotency_key, auth.uid()
  )
  RETURNING * INTO v_txn;

  UPDATE bank_accounts
     SET current_balance = COALESCE(current_balance, 0) + v_delta,
         updated_at = now()
   WHERE id = p_bank_account_id;

  IF v_account.coa_account_code IS NOT NULL AND p_contra_account_code IS NOT NULL THEN
    INSERT INTO journal_entries (entry_number, entry_date, description, reference, is_posted, status, created_by, reference_type, reference_id, currency)
    VALUES (generate_entry_number(), p_transaction_date, p_description, p_reference, false, 'draft', auth.uid(), p_reference_type, p_reference_id, v_account.currency)
    RETURNING id INTO v_entry_id;

    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency)
    VALUES
      (v_entry_id, CASE WHEN p_direction = 'out' THEN p_contra_account_code ELSE v_account.coa_account_code END, v_converted, 0, p_description, v_account.currency),
      (v_entry_id, CASE WHEN p_direction = 'out' THEN v_account.coa_account_code ELSE p_contra_account_code END, 0, v_converted, p_description, v_account.currency);

    PERFORM post_journal_entry(v_entry_id);
    UPDATE bank_transactions SET journal_entry_id = v_entry_id WHERE id = v_txn.id;
    v_txn.journal_entry_id := v_entry_id;
  END IF;

  RETURN v_txn;
END;
$function$;

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
  -- entry_number/reference are set by post_bank_transaction() itself at
  -- journal_entries INSERT time now — a later UPDATE here would hit
  -- guard_posted_journal() (006_finance_foundation.sql), since the entry
  -- comes back already posted (see 133_fix_post_bank_statement_line_
  -- immutable_je_update.sql).
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

NOTIFY pgrst, 'reload schema';
