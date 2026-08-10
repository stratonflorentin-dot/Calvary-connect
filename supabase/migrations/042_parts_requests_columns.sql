-- Phase 6: parts_requests is missing the two columns its own frontend
-- pages (src/app/spare-parts/page.tsx, src/app/parts-requests/page.tsx)
-- have always assumed exist: a free-text part/service name (the request
-- form lets a mechanic describe something not necessarily in spare_parts
-- inventory yet, e.g. "Full Trailer Repaint" — part_id alone can't
-- represent that), and who made the request. Neither page will ever have
-- worked correctly without these; this is the schema half of that fix,
-- application code is fixed in the same commit.
--
-- part_id stays as-is (nullable FK to spare_parts, for when the request
-- IS a known stocked item) — part_name is an addition, not a
-- replacement.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS part_name text;
ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES user_profiles(id);

INSERT INTO public.schema_migrations (version) VALUES ('042_parts_requests_columns.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
