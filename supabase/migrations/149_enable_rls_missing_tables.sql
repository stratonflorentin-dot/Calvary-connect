-- 149_enable_rls_missing_tables.sql
-- Security: close the RLS gaps the scanner flagged on three tables. Kept surgical
-- on purpose — only the tables the scan reports as unprotected are touched, so we
-- never add a second permissive policy next to an existing one (Postgres ORs
-- policies together, which would *loosen* access; see migration 053's notes).
--
--   * vendor_balances  — table-without-rls      (no RLS, no policy)
--   * fx_rates         — table-without-rls      (no RLS, no policy)
--   * rate_sheet_edits — policy-without-rls-enabled + overly-permissive insert
--
-- Convention follows migration 006: reads open to any authenticated user, writes
-- restricted to finance roles via current_user_role(); every policy names
-- `TO authenticated` (avoids the PUBLIC default) and uses a real predicate
-- (never `USING (true)`). Privileged server writes use the service role, which
-- bypasses RLS, so server-action behavior is unchanged.
--
-- Apply in the Supabase SQL editor. Idempotent.

-- ========================== vendor_balances (AP) ==========================
DO $$
BEGIN
  IF to_regclass('public.vendor_balances') IS NOT NULL THEN
    ALTER TABLE public.vendor_balances ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS vendor_balances_read ON public.vendor_balances;
    CREATE POLICY vendor_balances_read ON public.vendor_balances
      FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS vendor_balances_write ON public.vendor_balances;
    CREATE POLICY vendor_balances_write ON public.vendor_balances
      FOR ALL TO authenticated
      USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'))
      WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));
  END IF;
END $$;

-- ============================== fx_rates ==================================
DO $$
BEGIN
  IF to_regclass('public.fx_rates') IS NOT NULL THEN
    ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS fx_rates_read ON public.fx_rates;
    CREATE POLICY fx_rates_read ON public.fx_rates
      FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS fx_rates_write ON public.fx_rates;
    CREATE POLICY fx_rates_write ON public.fx_rates
      FOR ALL TO authenticated
      USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'))
      WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));
  END IF;
END $$;

-- =========================== rate_sheet_edits =============================
-- Audit log. RLS was never enabled, so its existing policies were inert; the
-- old open insert policy ("System can insert rate sheet edits", USING true /
-- no role) is replaced with a scoped, append-only pair.
DO $$
BEGIN
  IF to_regclass('public.rate_sheet_edits') IS NOT NULL THEN
    ALTER TABLE public.rate_sheet_edits ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "System can insert rate sheet edits" ON public.rate_sheet_edits;

    DROP POLICY IF EXISTS rate_sheet_edits_insert ON public.rate_sheet_edits;
    CREATE POLICY rate_sheet_edits_insert ON public.rate_sheet_edits
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS rate_sheet_edits_select ON public.rate_sheet_edits;
    CREATE POLICY rate_sheet_edits_select ON public.rate_sheet_edits
      FOR SELECT TO authenticated
      USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'SALES_MANAGER'));
    -- No UPDATE/DELETE policy: audit rows are immutable to app clients.
  END IF;
END $$;
