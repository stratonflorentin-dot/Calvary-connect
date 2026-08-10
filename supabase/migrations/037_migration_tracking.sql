-- Migration deployment tracking.
--
-- Root cause of six separate "written but never applied" bugs this session
-- (007, 008, 031, 034, 035, 036 — one of them a live security hole where
-- anon could read bank_accounts/expenses/journal_entries directly): there
-- was no record anywhere of which files under supabase/migrations/ had
-- actually been run against this database. Every migration got verified by
-- hand, one at a time, via ad-hoc curl calls against PostgREST.
--
-- This adds a real ledger: schema_migrations(version, applied_at). From
-- this migration onward, every new migration file should end with an
-- INSERT into this table for its own filename (see the bottom of this
-- file for the pattern). A quick SELECT then tells you definitively what's
-- live, instead of re-deriving it from scratch each time.
--
-- This does NOT retroactively know what ran before today — migrations
-- 001-036 predate this table and were verified by direct inspection this
-- session (see the phase 1 audit report). Backfilling rows for those is
-- deliberately left to that audit's findings, not guessed here, since
-- "the file exists in the repo" is exactly the assumption that caused the
-- original problem.
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,          -- migration filename, e.g. '037_migration_tracking.sql'
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_migrations FROM anon;
GRANT SELECT ON public.schema_migrations TO authenticated;
GRANT INSERT ON public.schema_migrations TO authenticated;

DROP POLICY IF EXISTS schema_migrations_read ON public.schema_migrations;
CREATE POLICY schema_migrations_read ON public.schema_migrations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only CEO/ADMIN should be recording migrations as applied (matches who's
-- expected to be running the Supabase SQL editor in the first place).
DROP POLICY IF EXISTS schema_migrations_write ON public.schema_migrations;
CREATE POLICY schema_migrations_write ON public.schema_migrations
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN'));

-- Record this migration itself.
INSERT INTO public.schema_migrations (version) VALUES ('037_migration_tracking.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
