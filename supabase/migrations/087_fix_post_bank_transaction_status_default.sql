-- post_bank_transaction's journal-mirroring branch (p_contra_account_code)
-- has never been exercised by any existing caller (expense->paid never
-- passes a contra code) until the new Cash Requests disbursement flow.
-- Testing it surfaced a real bug: journal_entries.status defaults to
-- 'posted' (a legacy default from before is_posted existed), and this
-- function's INSERT only set is_posted := false, leaving status at its
-- 'posted' default. post_journal_entry's guard checks
-- `status = 'posted' OR is_posted`, so it always rejected the freshly
-- created draft entry with "Journal entry is already posted" — which then
-- rolled back the whole bank transaction per the FIX comment already in
-- this function. Explicitly setting status := 'draft' on insert fixes it.
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
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/ACCOUNTANT may post bank transactions';
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
    INSERT INTO journal_entries (entry_date, description, is_posted, status, created_by, reference_type, reference_id, currency)
    VALUES (p_transaction_date, p_description, false, 'draft', auth.uid(), p_reference_type, p_reference_id, v_account.currency)
    RETURNING id INTO v_entry_id;

    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency)
    VALUES
      (v_entry_id, CASE WHEN p_direction = 'out' THEN p_contra_account_code ELSE v_account.coa_account_code END, v_converted, 0, p_description, v_account.currency),
      (v_entry_id, CASE WHEN p_direction = 'out' THEN v_account.coa_account_code ELSE p_contra_account_code END, 0, v_converted, p_description, v_account.currency);

    -- FIX: no longer swallowed — a failed journal mirror now rolls back
    -- the whole bank transaction instead of leaving it silently unposted.
    PERFORM post_journal_entry(v_entry_id);
    UPDATE bank_transactions SET journal_entry_id = v_entry_id WHERE id = v_txn.id;
  END IF;

  RETURN v_txn;
END;
$function$;
