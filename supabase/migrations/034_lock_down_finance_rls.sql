-- Lock down finance-table access control.
--
-- Two problems found in the live schema, both far more severe than plain
-- "USING (true)" policies:
--   1. database/migrations/001-master-production-setup.sql created every
--      finance table with a "Public manage X" policy (FOR ALL USING(true)
--      WITH CHECK(true), no TO authenticated clause) — open to anon too.
--   2. Several ad-hoc "fix" scripts that were run directly against prod via
--      the Supabase SQL editor (database/patches/MASTER_FIX_SCRIPT.sql,
--      database/patches/rls/fix_all_rls.sql, fix_rls_aggressive.sql, etc.)
--      went further and DISABLED RLS OUTRIGHT on bank_accounts, invoices,
--      expenses, journal_entries, journal_entry_lines, accounts, plus
--      GRANT ALL ... TO authenticated, anon, postgres — meaning an
--      unauthenticated request with only the public anon key can currently
--      read/write/delete these tables directly, RLS policies notwithstanding.
--
-- This migration re-enables RLS, revokes the anon grant, and replaces every
-- open policy with a real one: SELECT stays open to any authenticated user
-- (dashboards/reports need it), writes are restricted to CEO/ADMIN/ACCOUNTANT
-- — matching the already-correct pattern used by payments/fiscal_periods in
-- 006_finance_foundation.sql, and matching route-config.ts's own access
-- model (every /finance/* route is already CEO/ADMIN/ACCOUNTANT-only).
--
-- Always uses current_user_role() (SECURITY DEFINER, defined in
-- 006_finance_foundation.sql), never an inlined `user_profiles` subquery —
-- inlined subqueries in RLS policies caused recursive-RLS outages before
-- (migrations 017/019/020/021/025/026).
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bank_accounts', 'bank_statements', 'bank_reconciliations',
    'invoices', 'expenses', 'accounts',
    'journal_entries', 'journal_entry_lines',
    'exchange_rates', 'driver_allowances'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- bank_accounts
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public manage bank" ON bank_accounts;
DROP POLICY IF EXISTS bank_accounts_read ON bank_accounts;
DROP POLICY IF EXISTS bank_accounts_write ON bank_accounts;

CREATE POLICY bank_accounts_read ON bank_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY bank_accounts_write ON bank_accounts
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY bank_accounts_update ON bank_accounts
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY bank_accounts_delete ON bank_accounts
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- bank_statements
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public manage bank statements" ON bank_statements;
DROP POLICY IF EXISTS bank_statements_read ON bank_statements;
DROP POLICY IF EXISTS bank_statements_write ON bank_statements;

CREATE POLICY bank_statements_read ON bank_statements
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY bank_statements_write ON bank_statements
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY bank_statements_update ON bank_statements
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY bank_statements_delete ON bank_statements
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- bank_reconciliations (was fully open: USING(true)/WITH CHECK(true), no role gate)
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS bank_reconciliations_read ON bank_reconciliations;
DROP POLICY IF EXISTS bank_reconciliations_write ON bank_reconciliations;

CREATE POLICY bank_reconciliations_read ON bank_reconciliations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY bank_reconciliations_write ON bank_reconciliations
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY bank_reconciliations_update ON bank_reconciliations
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));

-- ────────────────────────────────────────────────────────────────────────────
-- invoices (also serves as vendor bills via type = 'payable')
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public manage invoices" ON invoices;
DROP POLICY IF EXISTS invoices_read ON invoices;
DROP POLICY IF EXISTS invoices_write ON invoices;

CREATE POLICY invoices_read ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY invoices_write ON invoices
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY invoices_update ON invoices
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY invoices_delete ON invoices
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- expenses
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public manage finance" ON expenses;
DROP POLICY IF EXISTS expenses_read ON expenses;
DROP POLICY IF EXISTS expenses_write ON expenses;

CREATE POLICY expenses_read ON expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY expenses_write ON expenses
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY expenses_update ON expenses
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY expenses_delete ON expenses
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- accounts (chart of accounts)
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public manage coa" ON accounts;
DROP POLICY IF EXISTS accounts_read ON accounts;
DROP POLICY IF EXISTS accounts_write ON accounts;

CREATE POLICY accounts_read ON accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY accounts_write ON accounts
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY accounts_update ON accounts
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY accounts_delete ON accounts
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- journal_entries / journal_entry_lines
-- (guard_posted_journal() trigger from 006_finance_foundation.sql already
--  blocks mutating/deleting posted entries — untouched here)
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public manage journal" ON journal_entries;
DROP POLICY IF EXISTS journal_entries_read ON journal_entries;
DROP POLICY IF EXISTS journal_entries_write ON journal_entries;

CREATE POLICY journal_entries_read ON journal_entries
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY journal_entries_write ON journal_entries
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY journal_entries_update ON journal_entries
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY journal_entries_delete ON journal_entries
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

DROP POLICY IF EXISTS "Public manage journal lines" ON journal_entry_lines;
DROP POLICY IF EXISTS journal_entry_lines_read ON journal_entry_lines;
DROP POLICY IF EXISTS journal_entry_lines_write ON journal_entry_lines;

CREATE POLICY journal_entry_lines_read ON journal_entry_lines
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY journal_entry_lines_write ON journal_entry_lines
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY journal_entry_lines_update ON journal_entry_lines
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY journal_entry_lines_delete ON journal_entry_lines
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- exchange_rates: 008_coa_integration.sql added exchange_rates_write as
-- FOR INSERT WITH CHECK(true), which OR-combines with the pre-existing
-- admin-only "Admins can manage exchange rates" policy and wins — anyone
-- can currently insert FX rates. Also replace the inlined user_profiles
-- subquery from 002_multi_currency_accounting.sql with current_user_role().
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS exchange_rates_write ON exchange_rates;
DROP POLICY IF EXISTS "Admins can manage exchange rates" ON exchange_rates;

CREATE POLICY exchange_rates_write ON exchange_rates
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY exchange_rates_update ON exchange_rates
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
CREATE POLICY exchange_rates_delete ON exchange_rates
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));
-- "Users can view exchange rates" (SELECT, any authenticated) is already
-- correct and untouched.

-- ────────────────────────────────────────────────────────────────────────────
-- driver_allowances: "Admins can manage allowances" checked auth.role(),
-- which is the Postgres/JWT role claim ('authenticated'), not the
-- application role — it never matched 'ADMIN'/'ACCOUNTANT'/'CEO'/'HR' and
-- so failed closed. Fixed to use current_user_role(). The existing
-- "Drivers can view their own allowances" (driver_id = auth.uid()) is
-- correct and untouched.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage allowances" ON driver_allowances;

CREATE POLICY "Admins can manage allowances" ON driver_allowances
  FOR ALL USING (current_user_role() IN ('ADMIN','ACCOUNTANT','CEO','HR'));

NOTIFY pgrst, 'reload schema';
