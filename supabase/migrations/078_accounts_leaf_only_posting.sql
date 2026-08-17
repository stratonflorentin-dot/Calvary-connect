-- Leaf-only posting on the chart of accounts.
--
-- Nothing currently stops a journal entry line from targeting a
-- section/group header account (e.g. "5000 COST OF SALES / DIRECT
-- LOGISTICS COSTS") instead of a real leaf account underneath it — the
-- live accounts.parent_code column is only populated for a handful of
-- blocks (1000s, 1100s) and isn't a real enforced hierarchy, so this
-- can't be derived automatically for the whole chart. This migration adds
-- the mechanism and seeds only the accounts that are unambiguously pure
-- category headers by name alone (ASSETS, LIABILITIES, EQUITY, REVENUE,
-- COST OF SALES, OPERATING EXPENSES, TAXES AND COMPLIANCE) — the "x000"
-- tier. The "xx00" tier (1100, 1200, 2100, 6100, ...) is left postable
-- because several of those names read like real, currently-used leaf
-- accounts (e.g. "6100 Vehicle Repairs & Maintenance"), not headers, and
-- guessing wrong would silently block a legitimate live posting. Flag
-- any further header accounts by hand from the Chart of Accounts page.

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_postable boolean NOT NULL DEFAULT true;

UPDATE accounts SET is_postable = false
 WHERE code IN ('1000','2000','3000','4000','5000','6000','7000');

COMMENT ON COLUMN accounts.is_postable IS
  'false = a section/category header — journal entries may not post directly to it (enforced in post_journal_entry).';

-- Extend post_journal_entry (045_fix_journal_currency_integrity.sql) with a
-- postability guard, same shape as the existing currency-mismatch guard
-- right above it: fail loudly at posting time rather than silently letting
-- a header account accumulate a balance.
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry journal_entries;
  v_debits numeric;
  v_credits numeric;
  v_mismatch record;
  v_header record;
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

  -- Postability guard: no line may target a header/section account.
  SELECT l.account_code, a.name INTO v_header
    FROM journal_entry_lines l
    JOIN accounts a ON a.code = l.account_code
   WHERE l.journal_entry_id = p_id
     AND a.is_postable = false
   LIMIT 1;
  IF v_header.account_code IS NOT NULL THEN
    RAISE EXCEPTION 'Account % (%) is a header account and cannot be posted to directly — pick a specific account under it',
      v_header.account_code, v_header.name;
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

NOTIFY pgrst, 'reload schema';
