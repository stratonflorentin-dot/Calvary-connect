-- AI Report Notebook — persistent file sources (Excel / PDF connector)
--
-- The notebook at /reports/notebook lets managers chat with Gemini about
-- live company data. This table stores user-uploaded files (Excel / CSV /
-- PDF) as first-class notebook sources so they persist across sessions and
-- can be combined with live report sources in the same analysis.
--
-- Excel content is stored as `sheets` jsonb (array of { name, rows, total_rows });
-- PDF content as `pages` jsonb (array of { page, text }). A full Gemini
-- analysis generated at upload time is stored in `analysis`.
--
-- Access: CEO / ADMIN / ACCOUNTANT / HR — same guard as the fleet report
-- routes. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS notebook_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_name text,
  kind text NOT NULL CHECK (kind IN ('excel', 'pdf')),
  sheets jsonb,
  pages jsonb,
  row_count int NOT NULL DEFAULT 0,
  analysis text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notebook_sources_created ON notebook_sources(created_at DESC);

REVOKE ALL ON notebook_sources FROM anon;
ALTER TABLE notebook_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notebook_sources_all ON notebook_sources;
CREATE POLICY notebook_sources_all ON notebook_sources FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));

INSERT INTO public.schema_migrations (version) VALUES ('138_notebook_sources.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
