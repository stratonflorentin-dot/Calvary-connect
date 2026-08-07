-- Company AI agent roster: run history and per-agent chat threads.
-- Idempotent and safe to run multiple times.

CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  summary TEXT,
  data JSONB,
  tokens_in INTEGER,
  tokens_out INTEGER,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent_id ON ai_agent_runs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_agent_user ON ai_agent_messages(agent_id, user_id, created_at);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- All application access to these tables goes through API routes using the
-- service-role client (which bypasses RLS), matching the pattern in
-- src/app/api/fuel/detect-anomalies/route.ts. These policies are defense in
-- depth in case the tables are ever queried with a user session. Role is
-- read from user_profiles (the actual runtime source of truth used by
-- src/hooks/use-role.ts and every API route's access check), not
-- auth.users metadata as in migrations/001, which predates that convention.

ALTER TABLE IF EXISTS ai_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_agent_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'ai_agent_runs_admin_all' AND polrelid = 'ai_agent_runs'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY ai_agent_runs_admin_all ON ai_agent_runs FOR ALL '
      || 'USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN (''CEO'',''ADMIN''))) '
      || 'WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN (''CEO'',''ADMIN'')))';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'ai_agent_messages_admin_all' AND polrelid = 'ai_agent_messages'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY ai_agent_messages_admin_all ON ai_agent_messages FOR ALL '
      || 'USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN (''CEO'',''ADMIN''))) '
      || 'WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN (''CEO'',''ADMIN'')))';
  END IF;
END
$$;
