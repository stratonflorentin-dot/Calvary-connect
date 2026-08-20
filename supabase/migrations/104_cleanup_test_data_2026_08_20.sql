-- One-time cleanup: removes everything created on 2026-08-20 while testing
-- the Quotations/Shipments/Invoicing features built this session — a test
-- customer ("fxl"), 4 quotations, 1 trip, 2 invoices, 1 credit note, 2
-- expense rows, and the 7 journal entries + 3 bank transactions they
-- posted — so the system starts clean for real data entry.
--
-- Posted journal entries are protected by guard_posted_journal()
-- (006_finance_foundation.sql) — by design, so a real entry never
-- disappears silently. This is a deliberate, one-time exception: the
-- trigger is disabled only for the DELETE statements below, on only
-- these 7 specific entries, then re-enabled immediately after.
--
-- Account/bank balances are reversed by the exact deltas these entries
-- applied (same debit/credit-normal math post_journal_entry itself uses,
-- run backwards) — not reset to zero, since those accounts may carry
-- balances from before today that must not be touched.
--
-- Run once, in the Supabase SQL editor. Re-running is safe (all deletes
-- are id-scoped and become no-ops once the rows are gone) except the
-- balance-reversal UPDATEs, which would double-reverse if the same rows
-- were re-applied — they aren't, because the rows they read from are
-- deleted at the end of this same transaction.

BEGIN;

-- All the ids being removed, computed once.
CREATE TEMP TABLE _cleanup_je_ids (id uuid) ON COMMIT DROP;
INSERT INTO _cleanup_je_ids (id) VALUES
  ('c4737ada-2713-4339-97e5-cf7547779437'),
  ('614d4ec2-aa1e-4452-914a-c401c66ed833'),
  ('e74f1743-6c68-4567-bead-e189e4a720e5'),
  ('d71a4361-89f3-495f-98ac-6b1549aa15eb'),
  ('453f7cd8-b5fc-470b-94bc-9f5a48abe864'),
  ('b58f86dc-2821-42d3-9868-c03aeac1a372'),
  ('a5bc30fe-cd87-478c-9e37-6db5d5e70d57');

CREATE TEMP TABLE _cleanup_bt_ids (id uuid) ON COMMIT DROP;
INSERT INTO _cleanup_bt_ids (id) VALUES
  ('05adb7ba-a3e0-444d-a739-f06e581744d6'),
  ('b83875c2-476e-4a87-9630-a964fa5f217d'),
  ('e6696499-6be8-4d8e-8d79-8b3a729f7bb9');

-- 1. Reverse Chart of Accounts balances for the 7 journal entries — same
--    debit/credit-normal expression post_journal_entry uses, subtracted
--    instead of added (078_accounts_leaf_only_posting.sql).
UPDATE accounts a
   SET current_balance = COALESCE(a.current_balance, 0) -
         CASE WHEN a.type = 'debit' THEN l.d - l.c ELSE l.c - l.d END,
       updated_at = now()
  FROM (
    SELECT account_code, SUM(debit_amount) AS d, SUM(credit_amount) AS c
      FROM journal_entry_lines
     WHERE journal_entry_id IN (SELECT id FROM _cleanup_je_ids)
     GROUP BY account_code
  ) l
 WHERE a.code = l.account_code;

-- 2. Reverse bank_accounts balances for the 3 bank transactions —
--    delta was (credit - debit) when applied (052_ledger_posting_
--    hardening.sql), so undo with the opposite sign.
UPDATE bank_accounts ba
   SET current_balance = COALESCE(ba.current_balance, 0) - (bt.credit - bt.debit),
       updated_at = now()
  FROM bank_transactions bt
 WHERE bt.id IN (SELECT id FROM _cleanup_bt_ids)
   AND ba.id = bt.bank_account_id;

-- 3. Delete in dependency order: documents that reference the journal
--    entries/invoices/trips first, then the entries/invoices/trips
--    themselves, then the quotations and customer they all trace back to.
DELETE FROM credit_notes WHERE id = 'ed1dda56-d4e5-4b19-85ef-96577d9cf39a';
DELETE FROM bank_transactions WHERE id IN (SELECT id FROM _cleanup_bt_ids);
DELETE FROM invoices WHERE id IN ('dc3b0e01-e9a4-4648-8a8d-6e48bb12326b', 'b2c57c12-6efc-4578-8a50-59d1ec3ac064');

ALTER TABLE journal_entries DISABLE TRIGGER trg_guard_posted_journal;
DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM _cleanup_je_ids);
DELETE FROM journal_entries WHERE id IN (SELECT id FROM _cleanup_je_ids);
ALTER TABLE journal_entries ENABLE TRIGGER trg_guard_posted_journal;

DELETE FROM expenses WHERE id IN ('c848c670-23d8-4562-84f9-7f3b0d67b552', 'a1c2b576-d907-4c52-9491-28837b88435b');
DELETE FROM trips WHERE id = 'd171b9ad-fb38-4966-bcc6-56bd4c5522f0';

DELETE FROM quotation_lines WHERE quotation_id IN (
  'ba93509f-dd67-4f9b-b53f-2c88bf5bce62', 'e1fdb895-c4f1-4995-8cc9-365b89413dd8',
  '39a3c447-be1f-488c-b855-433cec1d0334', '166327b7-33e7-4d37-8c3b-27d40998c472'
);
DELETE FROM quotations WHERE id IN (
  'ba93509f-dd67-4f9b-b53f-2c88bf5bce62', 'e1fdb895-c4f1-4995-8cc9-365b89413dd8',
  '39a3c447-be1f-488c-b855-433cec1d0334', '166327b7-33e7-4d37-8c3b-27d40998c472'
);

DELETE FROM customers WHERE id = '85995b54-115f-43d3-84a8-08166c897f91';

COMMIT;
