-- AI Intelligence Layer, phase 1: no LLM call anywhere in this app is
-- currently logged (audit_trail only diffs business-entity mutations —
-- old_value/new_value on create/update/approve/etc, not "the AI was asked X
-- and answered Y"). This is a distinct concept, not a duplicate of
-- audit_trail: provenance for AI reasoning, not entity state changes.
--
-- Written server-side only (via supabaseAdmin(), same as
-- /api/fuel/detect-anomalies already does) — never from the client.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id),
  flow_name text NOT NULL,
  entity_type text,
  entity_id text,
  request_summary text,
  tools_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  records_queried jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text CHECK (confidence IN ('high', 'medium', 'low')),
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_log_entity ON ai_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created_at ON ai_audit_log(created_at DESC);

ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_audit_log_read ON ai_audit_log;
CREATE POLICY ai_audit_log_read ON ai_audit_log FOR SELECT
  USING ((select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text]));

-- No INSERT/UPDATE/DELETE policy for `authenticated` — every write goes
-- through supabaseAdmin() (service role), which bypasses RLS entirely, same
-- as fuel_anomalies' own detection writes do.

NOTIFY pgrst, 'reload schema';
