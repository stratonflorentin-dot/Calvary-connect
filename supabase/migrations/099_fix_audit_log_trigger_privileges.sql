-- audit_log() (the AFTER INSERT/UPDATE/DELETE trigger on leads, customers,
-- quotations, contracts, bookings, trips, invoices — 001_erp_workflow_tables.sql)
-- was defined as a plain trigger function, not SECURITY DEFINER. That means
-- it runs with the *calling session's* own privileges, unlike every other
-- privileged writer in this codebase (post_journal_entry, post_bank_transaction,
-- current_user_role, etc. are all SECURITY DEFINER). If the calling role
-- lacks a grant on audit_trail, the trigger's own insert fails and rolls
-- back the entire parent statement — surfacing as "permission denied",
-- which is easy to misread as a problem with the parent table (trips) or
-- the user's session, when it's actually about the audit table.
--
-- Matches the existing SECURITY DEFINER + explicit search_path pattern
-- used everywhere else in this codebase for trusted, privileged writers.
ALTER FUNCTION public.audit_log() SECURITY DEFINER SET search_path = public;

-- Explicit, idempotent grants — belt-and-suspenders in case either table's
-- default privileges were ever narrower than intended. Safe to re-run.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT, INSERT ON public.audit_trail TO authenticated;

NOTIFY pgrst, 'reload schema';
