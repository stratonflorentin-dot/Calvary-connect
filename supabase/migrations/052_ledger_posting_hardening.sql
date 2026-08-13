-- Two smaller robustness gaps found during the finance-module gap analysis
-- (comparing this system against a reference double-entry accounting spec).
--
-- 1. generate_entry_number() computes the next sequence via a plain
-- MAX(...)+1 read over journal_entries with no locking — two concurrent
-- postings (e.g. an invoice and a bank transaction landing in the same
-- instant) can both read the same MAX and produce the SAME entry_number.
-- next_doc_number() (used by reverse_journal_entry) already does this
-- correctly with an atomic UPDATE...RETURNING against document_sequences,
-- but switching every generate_entry_number() caller to it would change
-- the visible entry_number format (JE-2026-000006 -> JE-00006) for
-- existing/future entries side by side. Keeping the format and just
-- serializing concurrent callers with a transaction-scoped advisory lock
-- is the smaller, lower-risk fix — same numbers as before, just safe now.
--
-- 2. post_bank_transaction wraps its journal-entry mirror in
-- EXCEPTION WHEN OTHERS and only RAISE NOTICEs on failure — the bank
-- transaction itself still succeeds even if the ledger posting silently
-- fails, leaving bank_transactions and the Chart of Accounts out of sync
-- with no visible error. This contradicts the same "every financial event
-- is a balanced ledger entry" principle this session already fixed for
-- invoices (migration 050, which does NOT swallow its own errors). Removed
-- the try/catch so a failed journal mirror rolls back the whole bank
-- transaction instead of silently diverging from the ledger.
--
-- Idempotent: safe to run more than once (CREATE OR REPLACE). Run in the
-- Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.generate_entry_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    year TEXT;
    sequence_num INTEGER;
    entry_number TEXT;
BEGIN
    -- Serializes concurrent callers within this transaction so two
    -- simultaneous posts can't read the same MAX(...) and collide.
    PERFORM pg_advisory_xact_lock(hashtext('generate_entry_number'));

    year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

    SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM journal_entries
    WHERE entry_number LIKE 'JE-' || year || '-%';

    entry_number := 'JE-' || year || '-' || LPAD(sequence_num::TEXT, 6, '0');
    RETURN entry_number;
END;
$function$;

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
    INSERT INTO journal_entries (entry_date, description, is_posted, created_by, reference_type, reference_id, currency)
    VALUES (p_transaction_date, p_description, false, auth.uid(), p_reference_type, p_reference_id, v_account.currency)
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

INSERT INTO public.schema_migrations (version) VALUES ('052_ledger_posting_hardening.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
