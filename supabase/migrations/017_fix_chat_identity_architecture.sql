-- Fix Internal Chat Identity Architecture
-- Root cause: chat_channel_members.user_id references users(id) instead of auth.users(id)
-- This causes RLS failures and prevents user discovery
-- Run in Supabase SQL Editor

-- ============================================================================
-- PHASE 1: Fix chat_channel_members foreign key reference
-- ============================================================================

-- Drop existing foreign key constraint
ALTER TABLE chat_channel_members DROP CONSTRAINT IF EXISTS chat_channel_members_user_id_fkey;

-- Add correct foreign key to auth.users
ALTER TABLE chat_channel_members 
ADD CONSTRAINT chat_channel_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- PHASE 2: Create security helper function to prevent recursion
-- ============================================================================

-- Helper function to check if user is channel member (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION is_chat_channel_member(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channel_members 
    WHERE channel_id = p_channel_id 
    AND user_id = p_user_id
  );
$$;

-- ============================================================================
-- PHASE 3: Fix RLS policies for chat_channel_members
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS chat_channel_members_select ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_insert ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_update ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_delete ON chat_channel_members;
DROP POLICY IF EXISTS "Members can view their own membership" ON chat_channel_members;
DROP POLICY IF EXISTS "Users can join channels" ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_read ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_write ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_update ON chat_channel_members;

-- Create non-recursive SELECT policy
CREATE POLICY chat_channel_members_select ON chat_channel_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    is_chat_channel_member(channel_id, auth.uid())
  );

-- Create INSERT policy
CREATE POLICY chat_channel_members_insert ON chat_channel_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_channels 
      WHERE id = channel_id 
      AND created_by = auth.uid()
    )
  );

-- Create UPDATE policy
CREATE POLICY chat_channel_members_update ON chat_channel_members
  FOR UPDATE USING (user_id = auth.uid());

-- Create DELETE policy
CREATE POLICY chat_channel_members_delete ON chat_channel_members
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- PHASE 4: Fix RLS policies for chat_channels
-- ============================================================================

-- Drop existing policies
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

-- Create non-recursive SELECT policy using helper function
CREATE POLICY chat_channels_select ON chat_channels
  FOR SELECT USING (
    is_chat_channel_member(id, auth.uid())
  );

-- Create INSERT policy
CREATE POLICY chat_channels_insert ON chat_channels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create UPDATE policy
CREATE POLICY chat_channels_update ON chat_channels
  FOR UPDATE USING (
    created_by = auth.uid() OR
    is_chat_channel_member(id, auth.uid())
  );

-- Create DELETE policy
CREATE POLICY chat_channels_delete ON chat_channels
  FOR DELETE USING (
    created_by = auth.uid() OR
    is_chat_channel_member(id, auth.uid())
  );

-- ============================================================================
-- PHASE 5: Fix RLS policies for chat_messages
-- ============================================================================

-- Drop existing policies
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

-- Create non-recursive SELECT policy using helper function
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    is_chat_channel_member(channel_id, auth.uid())
  );

-- Create INSERT policy
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    is_chat_channel_member(channel_id, auth.uid()) AND
    sender_id = auth.uid()
  );

-- Create UPDATE policy
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Create DELETE policy
CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (sender_id = auth.uid());

-- ============================================================================
-- PHASE 6: Skip backfill - no users table exists to backfill from
-- ============================================================================
-- Note: The 'users' table does not exist in this database schema.
-- Only user_profiles and auth.users exist. Since there's no existing
-- chat data to migrate, we skip the backfill phase.

-- ============================================================================
-- PHASE 7: Add function to find or create direct chat channel
-- ============================================================================

CREATE OR REPLACE FUNCTION find_or_create_direct_chat(user1_id UUID, user2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id UUID;
  v_channel_ids UUID[];
BEGIN
  -- Validate inputs
  IF user1_id IS NULL OR user2_id IS NULL THEN
    RAISE EXCEPTION 'Both user IDs are required';
  END IF;
  
  IF user1_id = user2_id THEN
    RAISE EXCEPTION 'Cannot create direct chat with yourself';
  END IF;
  
  -- Find existing direct chat between these two users
  SELECT ARRAY_AGG(DISTINCT ccm.channel_id)
  INTO v_channel_ids
  FROM chat_channel_members ccm
  WHERE ccm.user_id IN (user1_id, user2_id)
  GROUP BY ccm.channel_id
  HAVING COUNT(DISTINCT ccm.user_id) = 2;
  
  -- If channel exists, return it
  IF v_channel_ids IS NOT NULL AND array_length(v_channel_ids, 1) > 0 THEN
    RETURN v_channel_ids[1];
  END IF;
  
  -- Create new direct channel with transaction safety
  BEGIN
    -- Create channel
    INSERT INTO chat_channels (type, created_by)
    VALUES ('direct', user1_id)
    RETURNING id INTO v_channel_id;
    
    -- Add both users as members
    INSERT INTO chat_channel_members (channel_id, user_id)
    VALUES (v_channel_id, user1_id), (v_channel_id, user2_id);
    
    RETURN v_channel_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create direct chat: %', SQLERRM;
  END;
END;
$$;

-- ============================================================================
-- PHASE 8: Notify PostgREST to reload schema
-- ============================================================================
NOTIFY pgrst, 'reload schema';
