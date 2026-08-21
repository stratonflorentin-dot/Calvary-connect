-- Live failure generating a Shipment's contract: "permission denied for
-- table users". Root cause traced to audit_log() (001_erp_workflow_tables.sql),
-- the AFTER INSERT/UPDATE/DELETE trigger on leads/customers/quotations/
-- contracts/bookings/trips/invoices — it falls back to
-- COALESCE(auth.uid(), (SELECT id FROM auth.users LIMIT 1)) whenever
-- auth.uid() comes back null, and the authenticated role has no SELECT
-- grant on auth.users. This is the exact issue 099_fix_audit_log_trigger_
-- privileges.sql already fixed (SECURITY DEFINER elevates the function to
-- run with the owner's privileges, which can read auth.users) — it just
-- resurfaced on contracts because 099 hadn't been applied yet, or because
-- contracts specifically was also missing its own base table grant (RLS
-- policies alone don't grant access — Postgres needs the underlying GRANT
-- too, and no migration anywhere ever issued one for contracts).
--
-- Re-applies 099's fix (idempotent, harmless if already applied) and adds
-- the missing grant.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER FUNCTION public.audit_log() SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;

NOTIFY pgrst, 'reload schema';
