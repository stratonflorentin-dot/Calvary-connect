-- Fixes a real ledger-integrity bug: journal_entry_lines has never
-- tracked currency, and post_journal_entry() (008_coa_integration.sql)
-- rolls debit/credit amounts into accounts.current_balance by matching
-- account_code ALONE — no currency check at all. Any account ever
-- posted to in more than one currency has been silently summing raw
-- numbers from different currencies as if they were the same number.
-- Concretely observed: a real $50 USD fuel expense payment posted into
-- "5001 Fuel Expense" (tagged TZS) and displayed as "Tsh 50".
--
-- journal_entries itself DOES have a currency column already
-- (002_multi_currency_accounting.sql, defaults to 'TZS') — but
-- post_bank_transaction() (035_post_bank_transaction_function.sql)
-- never sets it when creating the mirrored journal entry, so every
-- bank-transaction-originated entry silently took the 'TZS' default
-- regardless of the real transaction currency.
--
-- The recovery path: bank_transactions.currency IS set correctly on
-- every row (from v_account.currency, the real converted currency —
-- see post_bank_transaction), and bank_transactions.journal_entry_id
-- links straight back to the journal entry it created. That lets this
-- migration reconstruct the real historical currency for every
-- bank-transaction-originated entry, rather than guessing. Entries not
-- linked to a bank transaction (payroll postings, direct manual
-- entries) keep whatever currency they already have — those paths
-- already set it correctly at creation.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Schema: journal_entry_lines needs its own currency, not just the
-- parent entry's — a future entry could conceivably mix currencies
-- across lines, and per-line is the only way post_journal_entry can
-- check a line against its account without joining back to the parent
-- for every row.
--
-- accounts.currency / accounts.current_balance are both used below on
-- the assumption they exist — confirmed live (Chart of Accounts UI
-- displays a real per-row Currency column), but neither column is added
-- by anything in the tracked supabase/migrations/ sequence, only by a
-- legacy database/patches script outside it. Guarding defensively here
-- rather than trusting that history, matching this migration's own
-- root cause: untracked scripts are exactly how currency handling got
-- this inconsistent in the first place.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TZS';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS current_balance decimal(15, 2) DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS currency text;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Historical correction: recover the real currency for every
-- bank-transaction-originated entry from bank_transactions.currency,
-- which was always set correctly.
-- ────────────────────────────────────────────────────────────────────────────
UPDATE journal_entries je
   SET currency = bt.currency
  FROM bank_transactions bt
 WHERE bt.journal_entry_id = je.id
   AND bt.currency IS NOT NULL
   AND je.currency IS DISTINCT FROM bt.currency;

-- Backfill every line's currency from its (now-corrected) parent entry.
-- Entries are single-currency by construction in every path that creates
-- them today, so this is a safe default — re-running this migration
-- after a genuinely mixed-currency entry existed would need a manual
-- per-line correction, not blindly re-run this UPDATE.
UPDATE journal_entry_lines jel
   SET currency = je.currency
  FROM journal_entries je
 WHERE je.id = jel.journal_entry_id
   AND jel.currency IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. The concretely-evidenced gap: no USD counterpart for Fuel Expense.
-- Without this, the currency-matching post_journal_entry below would
-- start REJECTING every future USD fuel expense payment (see part 5)
-- until an account exists to receive it.
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO accounts (code, name, category, type, currency)
SELECT '5001-USD', name || ' (USD)', category, type, 'USD'
  FROM accounts
 WHERE code = '5001'
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. post_bank_transaction: set currency correctly on every journal
-- entry/line it creates, going forward. Identical to 035's version
-- except for the two currency assignments (marked below) and the
-- journal_entry_lines currency column.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_bank_transaction(
  p_bank_account_id uuid,
  p_amount numeric,
  p_direction text,
  p_transaction_type text,
  p_currency text,
  p_description text,
  p_reference text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_transaction_date date DEFAULT CURRENT_DATE,
  p_contra_account_code text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS bank_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    -- FIX: entry now carries the real transaction currency instead of
    -- silently taking journal_entries.currency's 'TZS' default.
    INSERT INTO journal_entries (entry_date, description, is_posted, created_by, reference_type, reference_id, currency)
    VALUES (p_transaction_date, p_description, false, auth.uid(), p_reference_type, p_reference_id, v_account.currency)
    RETURNING id INTO v_entry_id;

    -- FIX: both lines now carry that same currency explicitly.
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency)
    VALUES
      (v_entry_id, CASE WHEN p_direction = 'out' THEN p_contra_account_code ELSE v_account.coa_account_code END, v_converted, 0, p_description, v_account.currency),
      (v_entry_id, CASE WHEN p_direction = 'out' THEN v_account.coa_account_code ELSE p_contra_account_code END, 0, v_converted, p_description, v_account.currency);

    BEGIN
      PERFORM post_journal_entry(v_entry_id);
      UPDATE bank_transactions SET journal_entry_id = v_entry_id WHERE id = v_txn.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'post_bank_transaction: journal mirror skipped for % (%)', v_entry_id, SQLERRM;
    END;
  END IF;

  RETURN v_txn;
END;
$$;

GRANT EXECUTE ON FUNCTION post_bank_transaction(uuid, numeric, text, text, text, text, text, text, uuid, date, text, uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. post_journal_entry: only roll a line into an account's balance when
-- their currencies match. A mismatch now fails loudly and safely at
-- posting time (same pattern post_bank_transaction already uses for a
-- missing exchange rate) instead of silently mixing currencies into one
-- meaningless number — the exact bug this migration exists to stop.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry journal_entries;
  v_debits numeric;
  v_credits numeric;
  v_mismatch record;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot post journal entries';
  END IF;
  SELECT * INTO v_entry FROM journal_entries WHERE id = p_id FOR UPDATE;
  IF v_entry.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF v_entry.status = 'posted' OR v_entry.is_posted THEN
    RAISE EXCEPTION 'Journal entry is already posted';
  END IF;
  IF NOT is_period_open(COALESCE(v_entry.entry_date, v_entry.date, CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Fiscal period is closed';
  END IF;
  SELECT COALESCE(SUM(debit_amount),0), COALESCE(SUM(credit_amount),0)
    INTO v_debits, v_credits
    FROM journal_entry_lines WHERE journal_entry_id = p_id;
  IF v_debits = 0 AND v_credits = 0 THEN
    RAISE EXCEPTION 'Journal entry has no lines';
  END IF;
  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'Journal is not balanced: debits % <> credits %', v_debits, v_credits;
  END IF;

  -- Currency guard: every line must land on an account of the same
  -- currency. COALESCE(line.currency, entry.currency) so a line without
  -- its own currency falls back to the entry's, matching how this
  -- migration backfilled historical lines.
  SELECT l.account_code, COALESCE(l.currency, v_entry.currency) AS line_currency, a.currency AS account_currency
    INTO v_mismatch
    FROM journal_entry_lines l
    JOIN accounts a ON a.code = l.account_code
   WHERE l.journal_entry_id = p_id
     AND a.currency IS DISTINCT FROM COALESCE(l.currency, v_entry.currency)
   LIMIT 1;
  IF v_mismatch.account_code IS NOT NULL THEN
    RAISE EXCEPTION 'Account % is % but this entry is % — post to a %-denominated account instead',
      v_mismatch.account_code, v_mismatch.account_currency, v_mismatch.line_currency, v_mismatch.line_currency;
  END IF;

  UPDATE journal_entries
     SET status = 'posted', is_posted = true,
         total_debit = v_debits, total_credit = v_credits,
         posted_at = now(), posted_by = auth.uid(), updated_at = now()
   WHERE id = p_id;

  UPDATE accounts a
     SET current_balance = COALESCE(a.current_balance, 0) +
           CASE WHEN a.type = 'debit'
                THEN l.d - l.c
                ELSE l.c - l.d
           END,
         updated_at = now()
    FROM (
      SELECT account_code, SUM(debit_amount) AS d, SUM(credit_amount) AS c
        FROM journal_entry_lines
       WHERE journal_entry_id = p_id
       GROUP BY account_code
    ) l
   WHERE a.code = l.account_code;
END;
$$;
GRANT EXECUTE ON FUNCTION post_journal_entry(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Full recalculation: accounts.current_balance rebuilt from scratch
-- from every posted line, now that currency is correct. This replaces
-- (not increments) the balance, so it's safe to re-run. Only lines whose
-- (corrected) currency matches the account they're posted to count —
-- matching the same rule post_journal_entry now enforces going forward.
-- ────────────────────────────────────────────────────────────────────────────
WITH recalculated AS (
  SELECT a.code,
         COALESCE(SUM(
           -- je.id IS NULL means the second LEFT JOIN's conditions
           -- (posted, currency match) didn't hold for this line — a
           -- LEFT JOIN's ON clause only controls whether je populates,
           -- it does NOT remove the row, so without this guard every
           -- line for this account_code would count regardless of
           -- posted status or currency match.
           CASE WHEN je.id IS NULL THEN 0
                WHEN a.type = 'debit' THEN l.debit_amount - l.credit_amount
                ELSE l.credit_amount - l.debit_amount
           END
         ), 0) AS balance
    FROM accounts a
    LEFT JOIN journal_entry_lines l ON l.account_code = a.code
    LEFT JOIN journal_entries je ON je.id = l.journal_entry_id
      AND (je.status = 'posted' OR je.is_posted)
      AND COALESCE(l.currency, je.currency) = a.currency
   GROUP BY a.code
)
UPDATE accounts a
   SET current_balance = recalculated.balance,
       updated_at = now()
  FROM recalculated
 WHERE a.code = recalculated.code;

INSERT INTO public.schema_migrations (version) VALUES ('045_fix_journal_currency_integrity.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
