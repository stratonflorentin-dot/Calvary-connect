-- Fix PostgreSQL 42P17: Infinite Recursion in RLS Policies
-- Root cause: chat_channel_members policies query the same table causing recursion
-- This migration audits, removes recursive policies, and creates safe non-recursive policies
-- Run in Supabase SQL Editor for project: qaqonhjeqtlatqsrqcnx

-- ============================================================================
-- STEP 1: AUDIT EXISTING POLICIES (for verification)
-- ============================================================================

-- Log existing policies before changes
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    RAISE NOTICE '=== AUDITING EXISTING CHAT POLICIES ===';
    FOR policy_record IN 
        SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN (
            'chat_channels',
            'chat_channel_members',
            'chat_messages',
            'chat_reactions'
        )
        ORDER BY tablename, policyname
    LOOP
        RAISE NOTICE 'Table: %, Policy: %, Cmd: %', 
            policy_record.tablename, 
            policy_record.policyname, 
            policy_record.cmd;
        RAISE NOTICE 'Qual: %', policy_record.qual;
        RAISE NOTICE 'With Check: %', policy_record.with_check;
    END LOOP;
    RAISE NOTICE '=== END AUDIT ===';
END $$;

-- ============================================================================
-- STEP 2: DROP ALL EXISTING RECURSIVE POLICIES
-- ============================================================================

-- Drop all chat_channel_members policies
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

-- Drop all chat_channels policies
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

-- Drop all chat_messages policies
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

-- Drop all chat_reactions policies
DROP POLICY IF EXISTS chat_reactions_select ON chat_reactions;
DROP POLICY IF EXISTS chat_reactions_insert ON chat_reactions;
DROP POLICY IF EXISTS chat_reactions_update ON chat_reactions;
DROP POLICY IF EXISTS chat_reactions_delete ON chat_reactions;
DROP POLICY IF EXISTS "Users can view reactions" ON chat_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON chat_reactions;
DROP POLICY IF EXISTS "Chat reactions read" ON chat_reactions;
DROP POLICY IF EXISTS "Chat reactions write" ON chat_reactions;

-- ============================================================================
-- STEP 3: CREATE SAFE MEMBERSHIP HELPER FUNCTION
-- ============================================================================

-- Drop existing helper if exists
DROP FUNCTION IF EXISTS public.is_chat_channel_member(UUID, UUID);

-- Create non-recursive helper with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_chat_channel_member(
    p_channel_id UUID,
    p_user_id UUID
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
        AND ccm.user_id = p_user_id
    );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_chat_channel_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_channel_member(UUID, UUID) TO anon;

-- ============================================================================
-- STEP 4: CREATE SAFE chat_channel_members POLICIES
-- ============================================================================

-- SELECT: Users can view their own memberships and memberships of channels they belong to
CREATE POLICY chat_channel_members_select ON chat_channel_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_chat_channel_member(channel_id, auth.uid())
  );

-- INSERT: Users can add themselves to channels they have access to create
CREATE POLICY chat_channel_members_insert ON chat_channel_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_channels 
      WHERE id = channel_id 
      AND created_by = auth.uid()
    )
  );

-- UPDATE: Users can update their own membership (e.g., last_read_at)
CREATE POLICY chat_channel_members_update ON chat_channel_members
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can remove themselves from channels
CREATE POLICY chat_channel_members_delete ON chat_channel_members
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- STEP 5: CREATE SAFE chat_channels POLICIES
-- ============================================================================

-- SELECT: Users can view channels they are members of
CREATE POLICY chat_channels_select ON chat_channels
  FOR SELECT USING (
    public.is_chat_channel_member(id, auth.uid())
  );

-- INSERT: Authenticated users can create channels
CREATE POLICY chat_channels_insert ON chat_channels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Channel creator or members can update channels
CREATE POLICY chat_channels_update ON chat_channels
  FOR UPDATE USING (
    created_by = auth.uid() OR
    public.is_chat_channel_member(id, auth.uid())
  );

-- DELETE: Channel creator or members can delete channels
CREATE POLICY chat_channels_delete ON chat_channels
  FOR DELETE USING (
    created_by = auth.uid() OR
    public.is_chat_channel_member(id, auth.uid())
  );

-- ============================================================================
-- STEP 6: CREATE SAFE chat_messages POLICIES
-- ============================================================================

-- SELECT: Users can view messages in channels they belong to
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    public.is_chat_channel_member(channel_id, auth.uid())
  );

-- INSERT: Users can send messages to channels they belong to
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    public.is_chat_channel_member(channel_id, auth.uid()) AND
    sender_id = auth.uid()
  );

-- UPDATE: Users can edit their own messages
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

-- DELETE: Users can delete their own messages
CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (sender_id = auth.uid());

-- ============================================================================
-- STEP 7: CREATE SAFE chat_reactions POLICIES
-- ============================================================================

-- SELECT: Users can view reactions on messages in channels they belong to
CREATE POLICY chat_reactions_select ON chat_reactions
  FOR SELECT USING (
    public.is_chat_channel_member(
      (SELECT channel_id FROM public.chat_messages WHERE id = message_id),
      auth.uid()
    )
  );

-- INSERT: Users can add reactions to messages in channels they belong to
CREATE POLICY chat_reactions_insert ON chat_reactions
  FOR INSERT WITH CHECK (
    public.is_chat_channel_member(
      (SELECT channel_id FROM public.chat_messages WHERE id = message_id),
      auth.uid()
    ) AND
    user_id = auth.uid()
  );

-- UPDATE: Users can update their own reactions
CREATE POLICY chat_reactions_update ON chat_reactions
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can delete their own reactions
CREATE POLICY chat_reactions_delete ON chat_reactions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- STEP 8: VERIFY HELPER FUNCTION WORKS
-- ============================================================================

DO $$
DECLARE
    v_test_result BOOLEAN;
BEGIN
    -- Test the helper function with NULL values (should return false, not error)
    SELECT public.is_chat_channel_member(NULL::UUID, NULL::UUID) INTO v_test_result;
    RAISE NOTICE 'Helper function test with NULL: %', v_test_result;
    
    -- Test with invalid UUID (should return false, not error)
    SELECT public.is_chat_channel_member('00000000-0000-0000-0000-000000000000'::UUID, '00000000-0000-0000-0000-000000000000'::UUID) INTO v_test_result;
    RAISE NOTICE 'Helper function test with invalid UUID: %', v_test_result;
    
    RAISE NOTICE 'Helper function verification complete';
END $$;

-- ============================================================================
-- STEP 9: NOTIFY PostgREST TO RELOAD SCHEMA
-- ============================================================================
NOTIFY pgrst, 'reload schema';
