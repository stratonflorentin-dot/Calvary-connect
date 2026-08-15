-- generate_entry_number() declared a local variable named `entry_number`
-- that collides with the journal_entries.entry_number column it queries in
-- the same statement, making every reference ambiguous
-- ("column reference \"entry_number\" is ambiguous"). Found while QA-testing
-- migration 059: every posting function in this system calls this helper
-- (post_invoice_journal_entry, post_credit_note, post_payroll_period,
-- post_vehicle_acquisition, post_bank_transaction, and the new
-- post_trip_advance / reconcile_trip_advance / post_subcontractor_bill /
-- run_monthly_depreciation) — none of them could ever have successfully
-- posted a journal entry. journal_entries currently has 0 rows, which is
-- why this had never been hit in production yet.
--
-- Fixed by renaming the local variables with a v_ prefix, the convention
-- already used everywhere else in this schema, and qualifying the queried
-- column with a table alias.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.generate_entry_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_year TEXT;
    v_sequence_num INTEGER;
    v_entry_number TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('generate_entry_number'));

    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

    SELECT COALESCE(MAX(CAST(SUBSTRING(je.entry_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO v_sequence_num
    FROM journal_entries je
    WHERE je.entry_number LIKE 'JE-' || v_year || '-%';

    v_entry_number := 'JE-' || v_year || '-' || LPAD(v_sequence_num::TEXT, 6, '0');
    RETURN v_entry_number;
END;
$function$;

INSERT INTO public.schema_migrations (version) VALUES ('060_fix_generate_entry_number_ambiguous_column.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
