-- invoices_status_check only allowed ('draft','sent','paid','overdue',
-- 'cancelled') — but the actual customer-invoices and vendor-bills pages
-- (both write to `invoices`; vendor-bills tags type='payable') set
-- status = 'pending' on every create and status = 'partial' on every part-
-- payment, and src/lib/finance/aging.ts (shared by both pages) treats
-- 'pending' / 'sent' / 'partial' / 'overdue' / 'unpaid' as the full set of
-- "open" statuses. Neither 'pending' nor 'partial' was in the constraint,
-- so invoice creation and partial-payment recording have both been failing
-- with a check-constraint violation in production. Found via QA-testing
-- migration 061's view_trip_profitability, right after fixing the
-- invoice_id FK self-reference bug in migration 062 — that fix was
-- necessary but not sufficient to actually create an invoice.
--
-- Fixed by widening the constraint to the full set of statuses the app
-- code actually uses, adding 'pending', 'partial' and 'unpaid' (the latter
-- referenced by aging.ts but not currently written by either page — kept
-- for forward compatibility since aging already treats it as open).
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY['draft', 'pending', 'sent', 'partial', 'paid', 'overdue', 'unpaid', 'cancelled']));

INSERT INTO public.schema_migrations (version) VALUES ('063_fix_invoices_status_check_constraint.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
