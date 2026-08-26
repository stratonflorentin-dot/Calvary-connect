-- "Couldn't save quotation: value too long for type character varying(100)"
-- — confirmed live by reproducing the insert directly: quotations.
-- payment_terms and delivery_terms are both varchar(100), but Payment
-- Terms is a real free-text policy paragraph in this UI (see
-- src/app/quotations/new/page.tsx), routinely 300-500+ characters. Widened
-- to TEXT (unbounded) rather than a larger fixed cap, since there's no
-- real reason to bound this field's length at all.
--
-- terms_conditions and notes were checked live too and are already wide
-- enough (a 300-char test value passed); cargo_type's varchar(100) was
-- left alone — it's a short category label by design, not free text.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE quotations
  ALTER COLUMN payment_terms TYPE TEXT,
  ALTER COLUMN delivery_terms TYPE TEXT;

NOTIFY pgrst, 'reload schema';
