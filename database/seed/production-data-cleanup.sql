-- ==========================================================================
-- PRODUCTION DATA CLEANUP FOR CALVARY CONNECT
-- Purpose: remove demo/test/dummy records from operational tables only.
-- Run in Supabase SQL Editor after backing up your database.
--
-- Why this version is safer:
-- Different setup scripts created slightly different table schemas.
-- For example, some trips tables have cargo_type but not cargo.
-- This script scans the full row as JSON instead of hard-coding every column.
-- ==========================================================================

BEGIN;

DO $$
DECLARE
  demo_pattern TEXT := '(dummy|dumyy|demo|test|sample|mock|placeholder|unknown unknown)';
BEGIN
  -- Financial operations
  IF to_regclass('public.bank_accounts') IS NOT NULL THEN
    DELETE FROM bank_accounts b
    WHERE LOWER(to_jsonb(b)::TEXT) ~ demo_pattern;
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL THEN
    DELETE FROM invoices i
    WHERE LOWER(to_jsonb(i)::TEXT) ~ demo_pattern;
  END IF;

  IF to_regclass('public.expenses') IS NOT NULL THEN
    DELETE FROM expenses e
    WHERE LOWER(to_jsonb(e)::TEXT) ~ demo_pattern
       OR CASE
            WHEN COALESCE(to_jsonb(e)->>'amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN (to_jsonb(e)->>'amount')::NUMERIC = 0
            ELSE FALSE
          END;
  END IF;

  IF to_regclass('public.sales') IS NOT NULL THEN
    DELETE FROM sales s
    WHERE LOWER(to_jsonb(s)::TEXT) ~ demo_pattern;
  END IF;

  IF to_regclass('public.purchases') IS NOT NULL THEN
    DELETE FROM purchases p
    WHERE LOWER(to_jsonb(p)::TEXT) ~ demo_pattern;
  END IF;

  -- Fleet operations
  IF to_regclass('public.trips') IS NOT NULL THEN
    DELETE FROM trips t
    WHERE LOWER(to_jsonb(t)::TEXT) ~ demo_pattern;
  END IF;

  IF to_regclass('public.vehicles') IS NOT NULL THEN
    DELETE FROM vehicles v
    WHERE LOWER(to_jsonb(v)::TEXT) ~ demo_pattern;
  END IF;

  IF to_regclass('public.customers') IS NOT NULL THEN
    DELETE FROM customers c
    WHERE LOWER(to_jsonb(c)::TEXT) ~ demo_pattern;
  END IF;

  -- Reports and workflow records
  IF to_regclass('public.reports') IS NOT NULL THEN
    DELETE FROM reports r
    WHERE LOWER(to_jsonb(r)::TEXT) ~ demo_pattern;
  END IF;
END $$;

COMMIT;

SELECT 'Production cleanup complete. Demo/dummy operational records removed.' AS status;
