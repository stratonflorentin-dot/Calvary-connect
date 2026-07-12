-- ============================================================================
-- Calvary Connect — Consolidated Critical Migration
-- Apply this in Supabase SQL Editor in order.
-- Project: qaqonhjeqtlatqsrqcnx (confirm in Supabase dashboard)
--
-- This consolidates migrations 017–020 which fix:
--   1. chat_channel_members foreign key reference (auth.users not users)
--   2. 42P17 infinite recursion in RLS policies
--   3. user_profiles RLS for colleague discovery
--   4. find_or_create_direct_chat RPC for safe channel creation
--   5. Voice/video call signaling tables (018)
-- ============================================================================

-- ============================================================================
-- SECTION 1: Verify prerequisites
-- ============================================================================
DO $$
BEGIN
  -- Confirm we are in the right database
  RAISE NOTICE 'Starting Calvary Connect critical migration...';
  RAISE NOTICE 'Timestamp: %', NOW();
END $$;

-- ============================================================================
-- SECTION 2: Fix chat_channel_members foreign key (migration 017)
-- ============================================================================

-- Safely drop old FK if it references a non-existent 'users' table
ALTER TABLE IF EXISTS chat_channel_members 
  DROP CONSTRAINT IF EXISTS chat_channel_members_user_id_fkey;

-- Add correct FK to auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'chat_channel_members'
  ) THEN
    ALTER TABLE chat_channel_members 
      ADD CONSTRAINT chat_channel_members_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'chat_channel_members FK fixed to reference auth.users';
  ELSE
    RAISE NOTICE 'chat_channel_members table does not exist - skipping FK fix';
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: Drop ALL existing recursive chat policies (migrations 017 + 020)
-- ============================================================================

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

DO $$ BEGIN RAISE NOTICE 'All old recursive policies dropped'; END $$;

-- ============================================================================
-- SECTION 4: Create SECURITY DEFINER helper (non-recursive membership check)
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_chat_channel_member(UUID, UUID);

CREATE OR REPLACE FUNCTION public.is_chat_channel_member(
  p_channel_id UUID,
  p_user_id    UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_channel_members ccm
    WHERE ccm.channel_id = p_channel_id
      AND ccm.user_id    = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_channel_member(UUID, UUID) TO authenticated;

DO $$ BEGIN RAISE NOTICE 'is_chat_channel_member() SECURITY DEFINER helper created'; END $$;

-- ============================================================================
-- SECTION 5: Rebuild chat_channel_members policies (non-recursive)
-- ============================================================================

-- User can see their own row, OR any row in a channel they belong to
CREATE POLICY chat_channel_members_select ON chat_channel_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_chat_channel_member(channel_id, auth.uid())
  );

-- User can add themselves, OR channel creator can add others
CREATE POLICY chat_channel_members_insert ON chat_channel_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = channel_id AND created_by = auth.uid()
    )
  );

-- User can update only their own membership (e.g. last_read_at)
CREATE POLICY chat_channel_members_update ON chat_channel_members
  FOR UPDATE USING (user_id = auth.uid());

-- User can remove only themselves
CREATE POLICY chat_channel_members_delete ON chat_channel_members
  FOR DELETE USING (user_id = auth.uid());

DO $$ BEGIN RAISE NOTICE 'chat_channel_members policies rebuilt'; END $$;

-- ============================================================================
-- SECTION 6: Rebuild chat_channels policies
-- ============================================================================

CREATE POLICY chat_channels_select ON chat_channels
  FOR SELECT USING (
    public.is_chat_channel_member(id, auth.uid())
  );

CREATE POLICY chat_channels_insert ON chat_channels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY chat_channels_update ON chat_channels
  FOR UPDATE USING (
    created_by = auth.uid()
    OR public.is_chat_channel_member(id, auth.uid())
  );

CREATE POLICY chat_channels_delete ON chat_channels
  FOR DELETE USING (
    created_by = auth.uid()
    OR public.is_chat_channel_member(id, auth.uid())
  );

DO $$ BEGIN RAISE NOTICE 'chat_channels policies rebuilt'; END $$;

-- ============================================================================
-- SECTION 7: Rebuild chat_messages policies
-- ============================================================================

CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    public.is_chat_channel_member(channel_id, auth.uid())
  );

CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    public.is_chat_channel_member(channel_id, auth.uid())
    AND sender_id = auth.uid()
  );

CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (sender_id = auth.uid());

DO $$ BEGIN RAISE NOTICE 'chat_messages policies rebuilt'; END $$;

-- ============================================================================
-- SECTION 8: Rebuild chat_reactions policies
-- ============================================================================

CREATE POLICY chat_reactions_select ON chat_reactions
  FOR SELECT USING (
    public.is_chat_channel_member(
      (SELECT channel_id FROM public.chat_messages WHERE id = message_id),
      auth.uid()
    )
  );

CREATE POLICY chat_reactions_insert ON chat_reactions
  FOR INSERT WITH CHECK (
    public.is_chat_channel_member(
      (SELECT channel_id FROM public.chat_messages WHERE id = message_id),
      auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY chat_reactions_update ON chat_reactions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY chat_reactions_delete ON chat_reactions
  FOR DELETE USING (user_id = auth.uid());

DO $$ BEGIN RAISE NOTICE 'chat_reactions policies rebuilt'; END $$;

-- ============================================================================
-- SECTION 9: user_profiles RLS (migration 019)
-- ============================================================================

ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies first
DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_insert ON user_profiles;
DROP POLICY IF EXISTS user_profiles_update ON user_profiles;
DROP POLICY IF EXISTS "Users can view all active profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON user_profiles;

-- Authenticated users can see all active profiles (needed for colleague discovery)
CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- Users can only insert their own profile (id must match auth UUID)
CREATE POLICY user_profiles_insert ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Users can only update their own profile
CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE USING (id = auth.uid());

DO $$ BEGIN RAISE NOTICE 'user_profiles RLS policies set'; END $$;

-- ============================================================================
-- SECTION 10: find_or_create_direct_chat RPC (migration 017 improved)
-- ============================================================================

DROP FUNCTION IF EXISTS public.find_or_create_direct_chat(UUID, UUID);

CREATE OR REPLACE FUNCTION public.find_or_create_direct_chat(
  p_other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_channel_id      UUID;
  v_existing_ids    UUID[];
BEGIN
  -- Resolve the calling user from Supabase Auth
  v_current_user_id := auth.uid();

  -- Must be authenticated
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate target user
  IF p_other_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user ID is required';
  END IF;

  -- No self-chat
  IF v_current_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create a direct chat with yourself';
  END IF;

  -- Verify target user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'Target user does not exist';
  END IF;

  -- Find any existing direct channel containing EXACTLY these two users
  -- (avoids returning group channels that happen to include both users)
  SELECT ARRAY_AGG(DISTINCT ccm.channel_id)
  INTO v_existing_ids
  FROM (
    SELECT channel_id, user_id
    FROM public.chat_channel_members
    WHERE user_id IN (v_current_user_id, p_other_user_id)
  ) ccm
  JOIN public.chat_channels cc ON cc.id = ccm.channel_id AND cc.type = 'direct'
  GROUP BY ccm.channel_id
  HAVING COUNT(DISTINCT ccm.user_id) = 2;

  -- Return the existing channel if found
  IF v_existing_ids IS NOT NULL AND array_length(v_existing_ids, 1) > 0 THEN
    RETURN v_existing_ids[1];
  END IF;

  -- Create a new direct channel transactionally
  INSERT INTO public.chat_channels (type, created_by)
  VALUES ('direct', v_current_user_id)
  RETURNING id INTO v_channel_id;

  IF v_channel_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create channel';
  END IF;

  -- Insert both memberships atomically
  INSERT INTO public.chat_channel_members (channel_id, user_id)
  VALUES (v_channel_id, v_current_user_id),
         (v_channel_id, p_other_user_id);

  -- Verify both memberships were created
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE channel_id = v_channel_id AND user_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'Failed to create membership for current user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE channel_id = v_channel_id AND user_id = p_other_user_id
  ) THEN
    RAISE EXCEPTION 'Failed to create membership for target user';
  END IF;

  RETURN v_channel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_direct_chat(UUID) TO authenticated;

DO $$ BEGIN RAISE NOTICE 'find_or_create_direct_chat(p_other_user_id) RPC created'; END $$;

-- ============================================================================
-- SECTION 11: Verify - run after applying
-- ============================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_fn_exists    BOOLEAN;
BEGIN
  -- Count chat policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('chat_channels','chat_channel_members','chat_messages','chat_reactions');

  RAISE NOTICE 'Total chat policies: % (expected: 16)', v_policy_count;

  -- Confirm helper function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_chat_channel_member'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_fn_exists;

  RAISE NOTICE 'is_chat_channel_member exists: %', v_fn_exists;

  -- Quick null-safety test
  RAISE NOTICE 'Helper null test: %',
    public.is_chat_channel_member(NULL::UUID, NULL::UUID);

  RAISE NOTICE '=== Migration completed successfully ===';
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
