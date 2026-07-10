-- Integrate journal posting with the chart of accounts.
--
--   1. Normalize legacy category/type values on accounts (13 rows carried
--      lowercase 'asset' categories from an older seeding).
--   2. post_journal_entry now rolls posted lines into accounts.current_balance
--      so the Chart of Accounts reflects the ledger.
--   3. Let the app session read exchange_rates (RLS hid all rows from the
--      anon/offline session, so the FX page looked empty).
--
-- Run AFTER 006. Idempotent.

-- 1. Normalize account classification
UPDATE accounts SET category = 'ASSETS'
 WHERE lower(category) IN ('asset', 'assets') AND category <> 'ASSETS';

UPDATE accounts SET type = 'debit'
 WHERE type NOT IN ('debit', 'credit')
   AND category IN ('ASSETS', 'COST_OF_SALES', 'OPERATING_EXPENSES', 'OTHER_EXPENSES');

UPDATE accounts SET type = 'credit'
 WHERE type NOT IN ('debit', 'credit');

-- 2. Posting updates account balances
CREATE OR REPLACE FUNCTION public.post_journal_entry(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entry journal_entries;
  v_debits numeric;
  v_credits numeric;
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

  UPDATE journal_entries
     SET status = 'posted', is_posted = true,
         total_debit = v_debits, total_credit = v_credits,
         posted_at = now(), posted_by = auth.uid(), updated_at = now()
   WHERE id = p_id;

  -- Roll the posted lines into account balances (debit-normal accounts grow
  -- with debits, credit-normal with credits).
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

-- 3. FX rates must be readable (and writable) by the app session
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exchange_rates_read ON exchange_rates;
CREATE POLICY exchange_rates_read ON exchange_rates
  FOR SELECT USING (true);
DROP POLICY IF EXISTS exchange_rates_write ON exchange_rates;
CREATE POLICY exchange_rates_write ON exchange_rates
  FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
