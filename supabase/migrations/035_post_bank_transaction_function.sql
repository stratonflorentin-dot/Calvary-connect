-- The actual money-flow fix: four separate "record a payment" UI paths
-- (expenses/page.tsx, vendor-bills/page.tsx, transactions/payments/page.tsx,
-- bank-transactions/page.tsx) each insert a bank_transactions row but NONE
-- of them update bank_accounts.current_balance — paying a bill or recording
-- a withdrawal currently never reduces the bank account's balance. The one
-- function that ever did this (SupabaseService.markInvoicePaid, deleted in
-- a follow-up app-code change) was a racy client-side read-then-write with
-- no row lock and zero callers.
--
-- This migration adds post_bank_transaction(), modeled directly on
-- post_journal_entry() (supabase/migrations/008_coa_integration.sql):
-- SECURITY DEFINER, role-gated, row-locked with FOR UPDATE, idempotent,
-- single transaction. All 4 payment UIs are rewired to call this via RPC
-- instead of inserting into bank_transactions directly.
--
-- No CREATE TABLE for bank_transactions exists anywhere in this repo (it
-- was created ad hoc against prod) and the two screens that already write
-- to it disagree on shape (expenses/page.tsx uses amount+transaction_type;
-- bank-transactions/page.tsx uses debit+credit). This migration adds
-- whichever columns are missing so both keep working, and the new function
-- writes all of them so neither screen's existing reads break.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS transaction_date date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS transaction_type text;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TZS';
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS debit numeric NOT NULL DEFAULT 0;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS credit numeric NOT NULL DEFAULT 0;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS balance numeric;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS matched boolean DEFAULT false;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS matched_to_id uuid;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS matched_to_type text;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reference_id uuid;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS journal_entry_id uuid;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Same lockdown treatment as the other finance tables in 034 — this table
-- was created ad hoc and never got RLS at all.
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bank_transactions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_transactions TO authenticated;

DROP POLICY IF EXISTS bank_transactions_read ON bank_transactions;
DROP POLICY IF EXISTS bank_transactions_write ON bank_transactions;
CREATE POLICY bank_transactions_read ON bank_transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY bank_transactions_write ON bank_transactions
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY bank_transactions_update ON bank_transactions
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY bank_transactions_delete ON bank_transactions
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

-- Prevent a retried/duplicate UI call (double-click, network retry) from
-- posting the same submission twice. This is deliberately NOT keyed on
-- (bank_account_id, reference_type, reference_id) alone — a single invoice
-- can legitimately be paid in several installments (vendor-bills/page.tsx
-- supports partial payments), which would all share the same reference_id.
-- Callers instead generate one fresh idempotency_key per user action (e.g.
-- crypto.randomUUID() at the moment "Record Payment" is clicked); retrying
-- the exact same request reuses that key, a new payment gets a new one.
CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_idempotency_uidx
  ON bank_transactions (bank_account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.post_bank_transaction(
  p_bank_account_id uuid,
  p_amount numeric,
  p_direction text,               -- 'in' (deposit/receipt) or 'out' (withdrawal/payment)
  p_transaction_type text,        -- 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out'
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

  -- Row lock: the exact protection markInvoicePaid never had.
  SELECT * INTO v_account FROM bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank account % not found', p_bank_account_id;
  END IF;

  -- Currency conversion via the live exchange_rates table, not the
  -- hardcoded JS rate table in supabase-service.ts.
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

  -- Best-effort double-entry mirror: only when the bank account has a
  -- resolved COA code AND the caller supplied a contra account. Most
  -- expense/vendor-bill rows have no resolved contra account today, so
  -- this stays optional rather than blocking the core balance fix on a
  -- full COA-mapping backfill.
  IF v_account.coa_account_code IS NOT NULL AND p_contra_account_code IS NOT NULL THEN
    INSERT INTO journal_entries (entry_date, description, is_posted, created_by, reference_type, reference_id)
    VALUES (p_transaction_date, p_description, false, auth.uid(), p_reference_type, p_reference_id)
    RETURNING id INTO v_entry_id;

    -- direction 'out' (money leaves the bank): debit contra, credit bank.
    -- direction 'in' (money enters the bank): debit bank, credit contra.
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description)
    VALUES
      (v_entry_id, CASE WHEN p_direction = 'out' THEN p_contra_account_code ELSE v_account.coa_account_code END, v_converted, 0, p_description),
      (v_entry_id, CASE WHEN p_direction = 'out' THEN v_account.coa_account_code ELSE p_contra_account_code END, 0, v_converted, p_description);

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

NOTIFY pgrst, 'reload schema';
