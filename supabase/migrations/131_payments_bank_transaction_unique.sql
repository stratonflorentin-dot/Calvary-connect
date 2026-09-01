-- Prevents two different payments from ever being linked to the same bank
-- transaction. payments.bank_transaction_id had no uniqueness constraint at
-- all — checked existing data first (zero duplicates today, the payments
-- table is effectively unused so far), so this closes the gap before it can
-- ever produce one, rather than reacting after the fact. Partial index:
-- most payments recorded before a statement exists have no bank transaction
-- yet, so only non-null values are constrained (same pattern as
-- idx_payments_transaction_reference_unique in 125_payment_bank_transaction_linking.sql).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_bank_transaction_unique
  ON payments(bank_transaction_id) WHERE bank_transaction_id IS NOT NULL;
