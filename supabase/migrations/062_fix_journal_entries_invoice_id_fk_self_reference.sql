-- post_invoice_journal_entry() is a BEFORE INSERT trigger on invoices that
-- inserts a journal_entries row with invoice_id = NEW.id — but NEW.id
-- doesn't exist in `invoices` yet at that point (the row hasn't been
-- written; that's what BEFORE means). journal_entries_invoice_id_fkey was
-- an immediate (non-deferrable) FK, so this failed on every single invoice
-- insert with "violates foreign key constraint" — found via QA-testing
-- migration 061's view_trip_profitability, which needed a real posted
-- invoice to test against, and couldn't get one. This is why `invoices` has
-- stayed at 0 rows: invoice creation has been broken, not just untested.
--
-- Fixed by deferring the check to transaction commit, by which point the
-- invoices row exists (Postgres finishes the actual INSERT right after the
-- BEFORE trigger returns, still within the same transaction). No function
-- logic changes needed — reference_id already carries the same value for
-- joins that don't need a real FK.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE journal_entries
  ALTER CONSTRAINT journal_entries_invoice_id_fkey DEFERRABLE INITIALLY DEFERRED;

INSERT INTO public.schema_migrations (version) VALUES ('062_fix_journal_entries_invoice_id_fk_self_reference.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
