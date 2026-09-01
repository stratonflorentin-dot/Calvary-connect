-- Bank-to-bank fund transfers. Reuses the existing bank_accounts /
-- bank_transactions / journal_entries / exchange_rates architecture end to
-- end — no parallel banking system.
--
-- Same-currency transfer: one balanced journal entry (Dr destination bank's
-- COA / Cr source bank's COA), via a single post_bank_transaction() call —
-- exactly the existing primitive, called once.
--
-- Cross-currency transfer: post_journal_entry()'s balance check is a raw
-- SUM(debit_amount) = SUM(credit_amount) with no currency conversion (see
-- 106_native_currency_invoice_posting.sql's own comment: every existing
-- multi-currency flow in this chart posts entirely within one currency).
-- A single JE mixing a TZS leg and a USD leg can therefore never balance
-- under the existing engine — this is a real, pre-existing constraint of
-- post_journal_entry, not something this migration works around. The
-- standard, honest way to move value between two different-currency
-- accounts under that constraint is two same-currency legs bridged through
-- a per-currency clearing account (1190 TZS / 1190-USD, seeded below,
-- following the existing per-currency sibling-account convention from
-- 096_coa_usd_siblings.sql). Each leg is independently balanced and
-- posted through the existing engine; nothing here duplicates
-- post_journal_entry's validation. The clearing accounts will carry a
-- residual balance after cross-currency transfers (the FX difference) —
-- reviewing/closing that periodically via Realized FX Gain/Loss (4010 /
-- 6503, already in this chart) is an accountant task this migration does
-- not attempt to automate, since the correct timing/recognition of that
-- entry is a judgment call this migration should not make silently.
--
-- IMPORTANT — there is no "CRDB rate" concept anywhere in this schema.
-- exchange_rates is a generic, manually-maintained rate table with no
-- bank/source attribution column. Rather than fabricate a false "Rate
-- Source: CRDB Bank" label, this migration adds an optional
-- exchange_rates.source text column so a rate CAN be tagged with where it
-- came from going forward, and the UI shows whatever was actually entered
-- (or "Manually configured" if nothing was). It never invents a source.
--
-- Idempotent: safe to run more than once.

INSERT INTO document_sequences (doc_type, prefix, next_number, padding)
VALUES ('bank_transfer', 'TRF-', 1, 4)
ON CONFLICT (doc_type) DO NOTHING;

ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS source text;

-- Bank Transfer Clearing accounts, one per currency actually in use by a
-- bank_accounts row today (TZS, USD) — matches the real accounts on file
-- rather than guessing every currency this system might ever see.
INSERT INTO accounts (code, name, category, type, account_type, currency, is_postable, is_active, is_bank_account, sub_category, description, current_balance, balance, opening_balance)
VALUES ('1190', 'Bank Transfer Clearing', 'ASSETS', 'debit', 'asset', 'TZS', true, true, false, 'Current Assets', 'Bridges the two legs of a cross-currency bank-to-bank transfer; review and close out periodically.', 0, 0, 0)
ON CONFLICT (code) DO NOTHING;
INSERT INTO accounts (code, name, category, type, account_type, currency, is_postable, is_active, is_bank_account, sub_category, description, current_balance, balance, opening_balance)
VALUES ('1190-USD', 'Bank Transfer Clearing (USD)', 'ASSETS', 'debit', 'asset', 'USD', true, true, false, 'Current Assets', 'Bridges the two legs of a cross-currency bank-to-bank transfer; review and close out periodically.', 0, 0, 0)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS bank_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_reference text NOT NULL UNIQUE,
  from_bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  to_bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  source_amount numeric NOT NULL CHECK (source_amount > 0),
  destination_amount numeric NOT NULL CHECK (destination_amount > 0),
  exchange_rate numeric NOT NULL DEFAULT 1,
  exchange_rate_source text,
  exchange_rate_date date,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  reference text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'reversed')),
  from_bank_transaction_id uuid REFERENCES bank_transactions(id),
  to_bank_transaction_id uuid REFERENCES bank_transactions(id),
  from_journal_entry_id uuid REFERENCES journal_entries(id),
  to_journal_entry_id uuid REFERENCES journal_entries(id),
  reversed_at timestamptz,
  reversed_by uuid REFERENCES user_profiles(id),
  reversal_transfer_id uuid REFERENCES bank_transfers(id),
  idempotency_key uuid,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_transfers_accounts_differ CHECK (from_bank_account_id <> to_bank_account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transfers_idempotency ON bank_transfers(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_transfers_from_account ON bank_transfers(from_bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_to_account ON bank_transfers(to_bank_account_id);

ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;

-- Read-only from the client's own queries — every write happens exclusively
-- through transfer_funds()/reverse_bank_transfer() below (SECURITY DEFINER,
-- so RLS doesn't gate their internal writes). No INSERT/UPDATE/DELETE
-- policy exists at all, so a direct client-side write is always denied.
CREATE POLICY bank_transfers_read ON bank_transfers
  FOR SELECT USING (current_user_role() = ANY (ARRAY['CEO','ADMIN','ACCOUNTANT','OPERATOR']));

-- ── TRANSFER FUNDS ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_transfer_date date DEFAULT CURRENT_DATE,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS bank_transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from bank_accounts%ROWTYPE;
  v_to bank_accounts%ROWTYPE;
  v_rate numeric;
  v_rate_source text;
  v_dest_amount numeric;
  v_transfer_ref text;
  v_desc text;
  v_entry_id uuid;
  v_entry_id_2 uuid;
  v_from_txn bank_transactions%ROWTYPE;
  v_to_txn_id uuid;
  v_transfer bank_transfers%ROWTYPE;
  v_clearing_from text;
  v_clearing_to text;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot transfer funds between bank accounts';
  END IF;

  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be different.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive number.';
  END IF;

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM bank_transfers WHERE idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_TRANSFER: this transfer was already submitted';
  END IF;

  -- Lock both accounts in id order regardless of from/to order, so a
  -- concurrent transfer running the opposite direction can't deadlock
  -- against this one.
  PERFORM 1 FROM bank_accounts WHERE id IN (p_from_account_id, p_to_account_id) ORDER BY id FOR UPDATE;
  SELECT * INTO v_from FROM bank_accounts WHERE id = p_from_account_id;
  SELECT * INTO v_to FROM bank_accounts WHERE id = p_to_account_id;
  IF v_from.id IS NULL THEN RAISE EXCEPTION 'Source bank account not found.'; END IF;
  IF v_to.id IS NULL THEN RAISE EXCEPTION 'Destination bank account not found.'; END IF;
  IF v_from.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'Source bank account is not active.'; END IF;
  IF v_to.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'Destination bank account is not active.'; END IF;
  IF v_from.coa_account_code IS NULL THEN RAISE EXCEPTION 'Source bank account has no Chart of Accounts code configured.'; END IF;
  IF v_to.coa_account_code IS NULL THEN RAISE EXCEPTION 'Destination bank account has no Chart of Accounts code configured.'; END IF;

  v_desc := COALESCE(NULLIF(btrim(p_description), ''), 'Transfer from ' || v_from.account_name || ' to ' || v_to.account_name);
  SELECT next_doc_number('bank_transfer') INTO v_transfer_ref;

  IF v_from.currency = v_to.currency THEN
    v_rate := 1;
    v_rate_source := NULL;
    v_dest_amount := p_amount;

    v_from_txn := post_bank_transaction(
      p_bank_account_id := v_from.id, p_amount := p_amount, p_direction := 'out',
      p_transaction_type := 'transfer_out', p_currency := v_from.currency,
      p_description := v_desc, p_reference := COALESCE(NULLIF(btrim(p_reference), ''), v_transfer_ref),
      p_reference_type := 'bank_transfer', p_reference_id := NULL,
      p_transaction_date := p_transfer_date, p_contra_account_code := v_to.coa_account_code,
      p_idempotency_key := p_idempotency_key
    );
    v_entry_id := v_from_txn.journal_entry_id;
    IF v_entry_id IS NULL THEN
      RAISE EXCEPTION 'Unable to create journal entry. No changes were made.';
    END IF;

    INSERT INTO bank_transactions (
      bank_account_id, transaction_date, description, reference, transaction_type,
      amount, currency, debit, credit, reference_type, journal_entry_id, created_by
    ) VALUES (
      v_to.id, p_transfer_date, v_desc, COALESCE(NULLIF(btrim(p_reference), ''), v_transfer_ref), 'transfer_in',
      v_dest_amount, v_to.currency, 0, v_dest_amount, 'bank_transfer', v_entry_id, auth.uid()
    ) RETURNING id INTO v_to_txn_id;

    UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) + v_dest_amount, updated_at = now() WHERE id = v_to.id;

  ELSE
    SELECT rate INTO v_rate FROM exchange_rates
     WHERE from_currency = v_from.currency AND to_currency = v_to.currency AND effective_date <= p_transfer_date
     ORDER BY effective_date DESC LIMIT 1;
    IF v_rate IS NULL THEN
      SELECT CASE WHEN rate = 0 THEN NULL ELSE 1 / rate END INTO v_rate FROM exchange_rates
       WHERE from_currency = v_to.currency AND to_currency = v_from.currency AND effective_date <= p_transfer_date
       ORDER BY effective_date DESC LIMIT 1;
    END IF;
    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'No exchange rate is configured for % -> % as of %. Add one in FX Rates before transferring.', v_from.currency, v_to.currency, p_transfer_date;
    END IF;
    v_dest_amount := round(p_amount * v_rate, 2);
    IF v_dest_amount <= 0 THEN
      RAISE EXCEPTION 'Calculated destination amount is not positive — check the exchange rate.';
    END IF;

    v_clearing_from := CASE WHEN v_from.currency = 'TZS' THEN '1190' ELSE '1190-' || v_from.currency END;
    v_clearing_to := CASE WHEN v_to.currency = 'TZS' THEN '1190' ELSE '1190-' || v_to.currency END;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE code = v_clearing_from AND is_active AND is_postable) THEN
      RAISE EXCEPTION 'No active Bank Transfer Clearing account exists for %. Add one to the Chart of Accounts first.', v_from.currency;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE code = v_clearing_to AND is_active AND is_postable) THEN
      RAISE EXCEPTION 'No active Bank Transfer Clearing account exists for %. Add one to the Chart of Accounts first.', v_to.currency;
    END IF;

    v_from_txn := post_bank_transaction(
      p_bank_account_id := v_from.id, p_amount := p_amount, p_direction := 'out',
      p_transaction_type := 'transfer_out', p_currency := v_from.currency,
      p_description := v_desc, p_reference := COALESCE(NULLIF(btrim(p_reference), ''), v_transfer_ref),
      p_reference_type := 'bank_transfer', p_reference_id := NULL,
      p_transaction_date := p_transfer_date, p_contra_account_code := v_clearing_from,
      p_idempotency_key := p_idempotency_key
    );
    v_entry_id := v_from_txn.journal_entry_id;
    IF v_entry_id IS NULL THEN
      RAISE EXCEPTION 'Unable to create journal entry. No changes were made.';
    END IF;

    -- Second leg mirrors post_bank_transaction's own insert shape instead
    -- of calling it again (which would re-check the idempotency key
    -- against the wrong account) — same primitives (journal_entries /
    -- journal_entry_lines / post_journal_entry), just addressed manually
    -- for the destination side of this one economic event.
    INSERT INTO journal_entries (entry_date, description, is_posted, status, created_by, reference_type, currency)
    VALUES (p_transfer_date, v_desc, false, 'draft', auth.uid(), 'bank_transfer', v_to.currency)
    RETURNING id INTO v_entry_id_2;
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency)
    VALUES
      (v_entry_id_2, v_to.coa_account_code, v_dest_amount, 0, v_desc, v_to.currency),
      (v_entry_id_2, v_clearing_to, 0, v_dest_amount, v_desc, v_to.currency);
    PERFORM post_journal_entry(v_entry_id_2);

    INSERT INTO bank_transactions (
      bank_account_id, transaction_date, description, reference, transaction_type,
      amount, currency, debit, credit, reference_type, journal_entry_id, created_by
    ) VALUES (
      v_to.id, p_transfer_date, v_desc, COALESCE(NULLIF(btrim(p_reference), ''), v_transfer_ref), 'transfer_in',
      v_dest_amount, v_to.currency, 0, v_dest_amount, 'bank_transfer', v_entry_id_2, auth.uid()
    ) RETURNING id INTO v_to_txn_id;

    UPDATE bank_accounts SET current_balance = COALESCE(current_balance, 0) + v_dest_amount, updated_at = now() WHERE id = v_to.id;

    SELECT COALESCE(source, 'Manually configured') INTO v_rate_source FROM exchange_rates
     WHERE from_currency = v_from.currency AND to_currency = v_to.currency AND effective_date <= p_transfer_date
     ORDER BY effective_date DESC LIMIT 1;
    v_rate_source := COALESCE(v_rate_source, 'Manually configured (inverse rate)');
  END IF;

  INSERT INTO bank_transfers (
    transfer_reference, from_bank_account_id, to_bank_account_id, from_currency, to_currency,
    source_amount, destination_amount, exchange_rate, exchange_rate_source, exchange_rate_date,
    transfer_date, description, reference, status,
    from_bank_transaction_id, to_bank_transaction_id, from_journal_entry_id, to_journal_entry_id,
    idempotency_key, created_by
  ) VALUES (
    v_transfer_ref, v_from.id, v_to.id, v_from.currency, v_to.currency,
    p_amount, v_dest_amount, v_rate, v_rate_source, p_transfer_date,
    p_transfer_date, v_desc, p_reference, 'completed',
    v_from_txn.id, v_to_txn_id, v_entry_id, v_entry_id_2,
    p_idempotency_key, auth.uid()
  ) RETURNING * INTO v_transfer;

  UPDATE bank_transactions SET reference_id = v_transfer.id WHERE id IN (v_from_txn.id, v_to_txn_id);

  RETURN v_transfer;
END;
$$;

REVOKE EXECUTE ON FUNCTION transfer_funds(uuid, uuid, numeric, date, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION transfer_funds(uuid, uuid, numeric, date, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION transfer_funds(uuid, uuid, numeric, date, text, text, uuid) TO authenticated;

-- ── REVERSE TRANSFER ─────────────────────────────────────────────────────
-- Never edits the original's posted entries — creates a brand new transfer
-- moving the funds back, at today's rate if cross-currency (a reversal is
-- a new, real event, not a retroactive correction of the original).
CREATE OR REPLACE FUNCTION public.reverse_bank_transfer(p_transfer_id uuid)
RETURNS bank_transfers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_original bank_transfers%ROWTYPE;
  v_reversal bank_transfers%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN may reverse a bank transfer';
  END IF;

  SELECT * INTO v_original FROM bank_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF v_original.id IS NULL THEN
    RAISE EXCEPTION 'Transfer not found.';
  END IF;
  IF v_original.status = 'reversed' THEN
    RAISE EXCEPTION 'This transfer has already been reversed.';
  END IF;

  v_reversal := transfer_funds(
    p_from_account_id := v_original.to_bank_account_id,
    p_to_account_id := v_original.from_bank_account_id,
    p_amount := v_original.destination_amount,
    p_transfer_date := CURRENT_DATE,
    p_reference := v_original.transfer_reference,
    p_description := 'Reversal of ' || v_original.transfer_reference,
    p_idempotency_key := NULL
  );

  UPDATE bank_transfers
     SET status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_transfer_id = v_reversal.id
   WHERE id = p_transfer_id;

  RETURN v_reversal;
END;
$$;

REVOKE EXECUTE ON FUNCTION reverse_bank_transfer(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reverse_bank_transfer(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION reverse_bank_transfer(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
