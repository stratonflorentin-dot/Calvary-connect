-- chart_of_accounts and client_balances have both been dead for a while:
--
-- chart_of_accounts: 053_lock_down_open_policies_pass2.sql already locked
-- its RLS with no policy after calling it "a dead table (0 references in
-- src/)"; 059_trip_advances_tra_vfd_wht_depreciation.sql calls `accounts`
-- "the real, live-posted ledger" and this table "a decoy." Re-confirmed
-- here: still 0 references in src/, and nothing else in the schema
-- foreign-keys to it.
--
-- client_balances: 048_lock_down_rls_disabled_tables.sql already locked its
-- RLS with no policy as one of 17 confirmed-dead tables. Real customer/
-- vendor balances come from v_customer_balances / v_ar_aging / v_vat_position
-- (006_finance_foundation.sql), computed from invoices/payments/allocations,
-- not from a mutable balances table.
--
-- Both have sat locked-but-present since those migrations rather than being
-- dropped outright. Doing that now instead of continuing to carry two
-- unused, RLS-locked tables.
--
-- Idempotent: safe to run more than once.

DROP TABLE IF EXISTS public.chart_of_accounts CASCADE;
DROP TABLE IF EXISTS public.client_balances CASCADE;

NOTIFY pgrst, 'reload schema';
