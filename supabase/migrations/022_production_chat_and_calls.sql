-- =============================================================================
-- Calvary Connect — Production Migration 022
-- Chat RLS Fix (42P17) + Call Tables + find_or_create_direct_chat RPC
-- Project: qaqonhjeqtlatqsrqcnx
--
-- Run this ENTIRE script in the Supabase SQL Editor.
-- It is fully idempotent — safe to run multiple times.
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Starting migration 022 — %', NOW(); END $$;

-- =============================================================================
-- SECTION 1: Fix chat_channel_members FK to reference auth.users
-- =============================================================================
ALTER TABLE IF EXISTS chat_channel_members
  DROP CONSTRAINT IF EXISTS chat_channel_members_user_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_channel_members'
  ) THEN
    BEGIN
      ALTER TABLE chat_channel_members
        ADD CONSTRAINT chat_channel_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE 'chat_channel_members FK set to auth.users';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'FK already exists — skipping';
    END;
  END IF;
END $$;

-- =============================================================================
-- SECTION 2: Drop ALL old recursive chat policies
-- =============================================================================

-- chat_channel_members
DROP POLICY IF EXISTS chat_channel_members_select ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_insert ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_update ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_delete ON chat_channel_members;
DROP POLICY IF EXISTS "Members can view their own membership" ON chat_channel_members;
DROP POLICY IF EXISTS "Users can join channels" ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_read ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_write ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_update ON chat_channel_members;
DROP POLICY IF EXISTS "Chat members read" ON chat_channel_members;
DROP POLICY IF EXISTS "Chat members write" ON chat_channel_members;

-- chat_channels
DROP POLICY IF EXISTS chat_channels_select ON chat_channels;
DROP POLICY IF EXISTS chat_channels_insert ON chat_channels;
DROP POLICY IF EXISTS chat_channels_update ON chat_channels;
DROP POLICY IF EXISTS chat_channels_delete ON chat_channels;
DROP POLICY IF EXISTS "Users can view channels they are member of" ON chat_channels;
DROP POLICY IF EXISTS "Users can create channels" ON chat_channels;
DROP POLICY IF EXISTS "Chat channels read" ON chat_channels;
DROP POLICY IF EXISTS "Chat channels create" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated can view channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated can create channels" ON chat_channels;

-- chat_messages
DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages in their channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their channels" ON chat_messages;
DROP POLICY IF EXISTS "Chat messages read" ON chat_messages;
DROP POLICY IF EXISTS "Chat messages send" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated can send messages" ON chat_messages;

-- chat_reactions
DROP POLICY IF EXISTS chat_reactions_select ON chat_reactions;
DROP POLICY IF EXISTS chat_reactions_insert ON chat_reactions;
DROP POLICY IF EXISTS chat_reactions_update ON chat_reactions;
DROP POLICY IF EXISTS chat_reactions_delete ON chat_reactions;
DROP POLICY IF EXISTS "Users can view reactions" ON chat_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON chat_reactions;
DROP POLICY IF EXISTS "Chat reactions read" ON chat_reactions;
DROP POLICY IF EXISTS "Chat reactions write" ON chat_reactions;

DO $$ BEGIN RAISE NOTICE 'Old recursive policies dropped'; END $$;

-- =============================================================================
-- SECTION 3: Create SECURITY DEFINER helper — NO RLS on this function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_chat_channel_member(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_channel_member(UUID, UUID) TO authenticated;

DO $$ BEGIN RAISE NOTICE 'is_chat_channel_member helper created'; END $$;

-- =============================================================================
-- SECTION 4: Create new non-recursive RLS policies
-- =============================================================================

-- Enable RLS
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- chat_channel_members: simple user_id = auth.uid() only — NO recursion
CREATE POLICY chat_channel_members_select ON chat_channel_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY chat_channel_members_insert ON chat_channel_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_channel_members_update ON chat_channel_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY chat_channel_members_delete ON chat_channel_members
  FOR DELETE USING (user_id = auth.uid());

-- chat_channels: use SECURITY DEFINER helper — no recursion
CREATE POLICY chat_channels_select ON chat_channels
  FOR SELECT USING (
    public.is_chat_channel_member(id, auth.uid())
  );

CREATE POLICY chat_channels_insert ON chat_channels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY chat_channels_update ON chat_channels
  FOR UPDATE USING (
    public.is_chat_channel_member(id, auth.uid())
  );

-- chat_messages: use SECURITY DEFINER helper
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    public.is_chat_channel_member(channel_id, auth.uid())
  );

CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    public.is_chat_channel_member(channel_id, auth.uid()) AND
    sender_id = auth.uid()
  );

CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (sender_id = auth.uid());

-- chat_reactions: use SECURITY DEFINER helper
CREATE POLICY chat_reactions_select ON chat_reactions
  FOR SELECT USING (
    public.is_chat_channel_member(
      (SELECT channel_id FROM chat_messages WHERE id = message_id),
      auth.uid()
    )
  );

CREATE POLICY chat_reactions_insert ON chat_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    public.is_chat_channel_member(
      (SELECT channel_id FROM chat_messages WHERE id = message_id),
      auth.uid()
    )
  );

CREATE POLICY chat_reactions_delete ON chat_reactions
  FOR DELETE USING (user_id = auth.uid());

DO $$ BEGIN RAISE NOTICE 'New non-recursive RLS policies created'; END $$;

-- =============================================================================
-- SECTION 5: user_profiles RLS — allow colleagues to discover each other
-- =============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_insert ON user_profiles;
DROP POLICY IF EXISTS user_profiles_update ON user_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON user_profiles;

CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY user_profiles_insert ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE USING (id = auth.uid());

DO $$ BEGIN RAISE NOTICE 'user_profiles RLS policies created'; END $$;

-- =============================================================================
-- SECTION 6: find_or_create_direct_chat RPC
-- Takes only p_other_user_id; resolves current user from auth.uid() internally
-- =============================================================================

DROP FUNCTION IF EXISTS public.find_or_create_direct_chat(UUID, UUID);
DROP FUNCTION IF EXISTS public.find_or_create_direct_chat(UUID);

CREATE OR REPLACE FUNCTION public.find_or_create_direct_chat(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user UUID;
  v_channel_id UUID;
BEGIN
  v_current_user := auth.uid();

  -- Validate authentication
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Reject self-chat
  IF v_current_user = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create a direct chat with yourself';
  END IF;

  -- Validate recipient exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'Recipient user does not exist';
  END IF;

  -- Find existing direct channel that contains EXACTLY both users
  SELECT ccm1.channel_id INTO v_channel_id
  FROM chat_channel_members ccm1
  JOIN chat_channel_members ccm2 ON ccm1.channel_id = ccm2.channel_id
  JOIN chat_channels cc ON cc.id = ccm1.channel_id
  WHERE ccm1.user_id = v_current_user
    AND ccm2.user_id = p_other_user_id
    AND cc.type = 'direct'
    AND (
      SELECT COUNT(*) FROM chat_channel_members WHERE channel_id = ccm1.channel_id
    ) = 2
  LIMIT 1;

  -- Return existing channel if found
  IF v_channel_id IS NOT NULL THEN
    RETURN v_channel_id;
  END IF;

  -- Create new direct channel
  INSERT INTO chat_channels (name, type, created_by)
  VALUES (NULL, 'direct', v_current_user)
  RETURNING id INTO v_channel_id;

  -- Insert both memberships atomically
  INSERT INTO chat_channel_members (channel_id, user_id)
  VALUES (v_channel_id, v_current_user), (v_channel_id, p_other_user_id);

  RETURN v_channel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_direct_chat(UUID) TO authenticated;

DO $$ BEGIN RAISE NOTICE 'find_or_create_direct_chat RPC created'; END $$;

-- =============================================================================
-- SECTION 7: Call tables (call_sessions + call_signaling)
-- =============================================================================

CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES chat_channels(id) ON DELETE SET NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'ringing', 'accepted', 'declined', 'ended', 'missed', 'busy', 'failed'
  )),
  started_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  end_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- call_signaling table (the code uses this name — NOT call_signals)
CREATE TABLE IF NOT EXISTS call_signaling (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'offer', 'answer', 'ice_candidate', 'ringing', 'accepted', 'declined', 'busy', 'ended'
  )),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON call_sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_receiver ON call_sessions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_created ON call_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_signaling_call ON call_signaling(call_id);
CREATE INDEX IF NOT EXISTS idx_call_signaling_type ON call_signaling(signal_type);
CREATE INDEX IF NOT EXISTS idx_call_signaling_created ON call_signaling(created_at ASC);

DO $$ BEGIN RAISE NOTICE 'Call tables created/verified'; END $$;

-- =============================================================================
-- SECTION 8: Call table RLS
-- =============================================================================

ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_signaling ENABLE ROW LEVEL SECURITY;

-- Helper: is user a participant in this call?
CREATE OR REPLACE FUNCTION public.is_call_participant(p_call_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM call_sessions
    WHERE id = p_call_id
    AND (caller_id = p_user_id OR receiver_id = p_user_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_call_participant(UUID, UUID) TO authenticated;

-- Drop old call policies
DROP POLICY IF EXISTS call_sessions_select ON call_sessions;
DROP POLICY IF EXISTS call_sessions_insert ON call_sessions;
DROP POLICY IF EXISTS call_sessions_update ON call_sessions;
DROP POLICY IF EXISTS call_sessions_delete ON call_sessions;
DROP POLICY IF EXISTS call_signaling_select ON call_signaling;
DROP POLICY IF EXISTS call_signaling_insert ON call_signaling;

-- call_sessions policies
CREATE POLICY call_sessions_select ON call_sessions
  FOR SELECT USING (is_call_participant(id, auth.uid()));

CREATE POLICY call_sessions_insert ON call_sessions
  FOR INSERT WITH CHECK (caller_id = auth.uid());

CREATE POLICY call_sessions_update ON call_sessions
  FOR UPDATE USING (is_call_participant(id, auth.uid()));

CREATE POLICY call_sessions_delete ON call_sessions
  FOR DELETE USING (is_call_participant(id, auth.uid()));

-- call_signaling policies
CREATE POLICY call_signaling_select ON call_signaling
  FOR SELECT USING (is_call_participant(call_id, auth.uid()));

CREATE POLICY call_signaling_insert ON call_signaling
  FOR INSERT WITH CHECK (
    is_call_participant(call_id, auth.uid()) AND
    sender_id = auth.uid()
  );

DO $$ BEGIN RAISE NOTICE 'Call RLS policies created'; END $$;

-- =============================================================================
-- SECTION 9: Call RPC functions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.initiate_call(
  p_receiver_id UUID,
  p_call_type TEXT,
  p_channel_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call_id UUID;
  v_existing_call_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot call yourself';
  END IF;

  -- Check if receiver has an active call
  SELECT id INTO v_existing_call_id
  FROM call_sessions
  WHERE receiver_id = p_receiver_id
  AND status IN ('initiated', 'ringing', 'accepted')
  LIMIT 1;

  IF v_existing_call_id IS NOT NULL THEN
    INSERT INTO call_sessions (caller_id, receiver_id, channel_id, call_type, status, end_reason)
    VALUES (auth.uid(), p_receiver_id, p_channel_id, p_call_type, 'busy', 'receiver_busy')
    RETURNING id INTO v_call_id;
    RETURN v_call_id;
  END IF;

  INSERT INTO call_sessions (caller_id, receiver_id, channel_id, call_type, status)
  VALUES (auth.uid(), p_receiver_id, p_channel_id, p_call_type, 'initiated')
  RETURNING id INTO v_call_id;

  RETURN v_call_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_call(UUID, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.answer_call(p_call_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE call_sessions
  SET
    status = 'accepted',
    answered_at = NOW(),
    started_at = COALESCE(started_at, NOW()),
    updated_at = NOW()
  WHERE id = p_call_id
  AND receiver_id = auth.uid()
  AND status IN ('initiated', 'ringing');
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_call(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_call(p_call_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE call_sessions
  SET
    status = 'declined',
    ended_at = NOW(),
    end_reason = 'call_declined',
    updated_at = NOW()
  WHERE id = p_call_id
  AND receiver_id = auth.uid()
  AND status IN ('initiated', 'ringing');
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_call(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_call(p_call_id UUID, p_end_reason TEXT DEFAULT 'user_ended')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE call_sessions
  SET
    status = 'ended',
    ended_at = NOW(),
    duration_seconds = CASE
      WHEN answered_at IS NOT NULL THEN
        EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, answered_at)))::INTEGER
      ELSE 0
    END,
    end_reason = p_end_reason,
    updated_at = NOW()
  WHERE id = p_call_id
  AND (caller_id = auth.uid() OR receiver_id = auth.uid())
  AND status IN ('initiated', 'ringing', 'accepted');
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_call(UUID, TEXT) TO authenticated;

DO $$ BEGIN RAISE NOTICE 'Call RPC functions created'; END $$;

-- =============================================================================
-- SECTION 10: chat_messages — add call columns if missing
-- =============================================================================

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS call_id UUID REFERENCES call_sessions(id) ON DELETE SET NULL;

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'
    CHECK (message_type IN ('text', 'call_event'));

CREATE INDEX IF NOT EXISTS idx_chat_messages_call ON chat_messages(call_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(message_type);

-- =============================================================================
-- SECTION 11: Enable Realtime for call tables
-- =============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_signaling;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_channel_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN RAISE NOTICE 'Realtime publications configured'; END $$;

-- =============================================================================
-- SECTION 12: Reload schema
-- =============================================================================

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN RAISE NOTICE 'Migration 022 complete — %', NOW(); END $$;

-- =============================================================================
-- SECTION 13: Acceptance gate queries — run these to verify
-- =============================================================================

-- Gate 1: Verify no infinite recursion policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('chat_channels', 'chat_channel_members', 'chat_messages', 'call_sessions', 'call_signaling')
ORDER BY tablename, policyname;

-- Gate 2: Verify call tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('call_sessions', 'call_signaling')
ORDER BY table_name;

-- Gate 3: Verify RPC functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('find_or_create_direct_chat', 'initiate_call', 'answer_call', 'decline_call', 'end_call', 'is_chat_channel_member', 'is_call_participant')
ORDER BY routine_name;
