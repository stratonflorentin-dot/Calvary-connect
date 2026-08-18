-- This chart of accounts pins one currency per account (accounts.currency),
-- and post_journal_entry() correctly rejects a line whose currency doesn't
-- match its account — the alternative (letting one account blend balances
-- across currencies into a single current_balance number) is exactly the
-- "summed across currencies = meaningless number" bug fixed repeatedly
-- elsewhere this session. The real fix for "I need to post a USD entry"
-- is a USD sibling account, same pattern this chart already uses for
-- 5001 "Fuel Expense" / 5001-USD "Fuel Expense (USD)" — that pair was the
-- only one that existed anywhere in the chart before this migration.
--
-- Creates USD siblings for every active, postable TZS account under
-- REVENUE / COST_OF_SALES / OPERATING_EXPENSES / OTHER_EXPENSES — the
-- categories a USD-denominated trip, invoice, or bill actually posts
-- against. Deliberately not extended to ASSETS/LIABILITIES/EQUITY, which
-- rarely need a second currency and already have their own real USD
-- accounts where it matters (1002 Bank Account USD).
insert into accounts (code, name, category, type, account_type, currency, is_postable, is_active, parent_code, sub_category, description, date, balance, current_balance, opening_balance, is_bank_account)
select
  a.code || '-USD',
  a.name || ' (USD)',
  a.category,
  a.type,
  a.account_type,
  'USD',
  a.is_postable,
  a.is_active,
  a.parent_code,
  null,
  a.description,
  current_date,
  0,
  0,
  0,
  false
from accounts a
where a.category in ('REVENUE', 'COST_OF_SALES', 'OPERATING_EXPENSES', 'OTHER_EXPENSES')
  and a.is_postable = true
  and a.is_active = true
  and a.currency = 'TZS'
  and not exists (select 1 from accounts existing where existing.code = a.code || '-USD');

NOTIFY pgrst, 'reload schema';
