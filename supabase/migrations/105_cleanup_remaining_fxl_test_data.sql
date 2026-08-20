-- Follow-up to 104_cleanup_test_data_2026_08_20.sql — that migration
-- scoped "today" to the UTC calendar day and missed rows created before
-- 21:00 UTC (00:00 in Tanzania, UTC+3), plus it deleted a *reversal*
-- journal entry (614d4ec2, "Reversal (test invoice deleted): Invoice
-- INV-73247416") without also removing the original entry it was
-- reversing — leaving accounts 1104/4002/2106 overstated by exactly
-- INV-73247416's original posting (verified live: 1104 +11,800, 4002
-- +10,000, 2106 +1,800 after 104 ran, matching its lines exactly).
--
-- This migration finishes the job: reverses that leftover posting, then
-- removes the second/earlier "FXL" test customer and everything under
-- it — TRP-648376 and INV-73247416 — found via a full-schema sweep by
-- name/id, not just by date. No other table references either row.
--
-- No temp tables this time: the previous run hit "relation does not
-- exist" on a second execution, consistent with this SQL runner not
-- guaranteeing one connection across a whole pasted script. Every id is
-- inlined directly instead.
--
-- Run once, in the Supabase SQL editor.

BEGIN;

-- 1. Reverse the leftover posting from JE-2026-000001 (0e7b137a...),
--    INV-73247416's original entry — same math as 104's step 1.
UPDATE accounts a
   SET current_balance = COALESCE(a.current_balance, 0) -
         CASE WHEN a.type = 'debit' THEN l.d - l.c ELSE l.c - l.d END,
       updated_at = now()
  FROM (
    SELECT account_code, SUM(debit_amount) AS d, SUM(credit_amount) AS c
      FROM journal_entry_lines
     WHERE journal_entry_id = '0e7b137a-5da3-4a32-bccb-666ce6ebe917'
     GROUP BY account_code
  ) l
 WHERE a.code = l.account_code;

-- 2. Delete the invoice, then the now-unreferenced journal entry
--    (trigger disabled only for this one row, same as 104).
DELETE FROM invoices WHERE id = '2a81c60e-6a31-4c4f-b07b-06c702029ca2';

ALTER TABLE journal_entries DISABLE TRIGGER trg_guard_posted_journal;
DELETE FROM journal_entry_lines WHERE journal_entry_id = '0e7b137a-5da3-4a32-bccb-666ce6ebe917';
DELETE FROM journal_entries WHERE id = '0e7b137a-5da3-4a32-bccb-666ce6ebe917';
ALTER TABLE journal_entries ENABLE TRIGGER trg_guard_posted_journal;

-- 3. The trip and the second FXL customer — confirmed no other table
--    references either (trip_revenue for this trip was already removed
--    by 104, via its own source_invoice_id).
DELETE FROM trips WHERE id = 'e645da8f-9fb0-4802-bad2-7dd78577b245';
DELETE FROM customers WHERE id = 'd8b0eb29-2443-44ab-aea4-94c06ec467d5';

COMMIT;
