-- 149_enable_rls_missing_tables.sql
-- Security: enable Row Level Security on internal finance/sales tables that were
-- created (in legacy database/patches/* and early finance migrations) without RLS.
--
-- Without RLS, any request bearing the public anon key can read/write these tables
-- directly through PostgREST, bypassing the application. These are all internal
-- business tables, so the baseline policy is "authenticated users only"
-- (auth.uid() IS NOT NULL) — this matches the convention already used across the
-- schema (e.g. leads, proof_of_delivery, exchange_rates) and is deliberately NOT
-- a `USING (true)` blanket policy.
--
-- Privileged server-side writes run with the service_role key, which bypasses RLS,
-- so tightening these policies does not change existing server-action behavior.
-- rate_sheet_edits is an append-only audit log: authenticated INSERT (so the
-- SECURITY INVOKER audit trigger keeps working) + SELECT, but no UPDATE/DELETE.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'client_balances',
    'contract_lines',
    'document_sequences',
    'fiscal_periods',
    'follow_ups',
    'payments',
    'route_profitability',
    'trip_accounting',
    'vendor_balances'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip %, table does not exist', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      || 'USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      t || '_authenticated_all', t
    );
  END LOOP;
END $$;

-- rate_sheet_edits: append-only audit log.
DO $$
BEGIN
  IF to_regclass('public.rate_sheet_edits') IS NOT NULL THEN
    ALTER TABLE public.rate_sheet_edits ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS rate_sheet_edits_select ON public.rate_sheet_edits;
    CREATE POLICY rate_sheet_edits_select ON public.rate_sheet_edits
      FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS rate_sheet_edits_insert ON public.rate_sheet_edits;
    CREATE POLICY rate_sheet_edits_insert ON public.rate_sheet_edits
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
    -- No UPDATE/DELETE policy: audit rows are immutable to app clients.
  END IF;
END $$;
