-- ============================================================================
-- Migration 025: Fix RLS 42P17 infinite recursion on chat_channel_members
-- ============================================================================
-- This migration addresses the 42P17 infinite recursion error that is blocking
-- chat functionality. The error occurs when RLS policies on chat_channel_members
-- recursively reference the same table through the helper function.
--
-- Root cause: The is_chat_channel_member() helper function queries chat_channel_members,
-- and the RLS policy uses this helper, creating a circular dependency.
--
-- Solution: Simplify the RLS policies to avoid the circular dependency by using
-- direct checks instead of the helper function for chat_channel_members itself.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Drop all existing RLS policies on chat_channel_members
-- ============================================================================

DROP POLICY IF EXISTS chat_channel_members_select ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_insert ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_update ON chat_channel_members;
DROP POLICY IF EXISTS chat_channel_members_delete ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_read ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_write ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_update ON chat_channel_members;
DROP POLICY IF EXISTS "Chat members read" ON chat_channel_members;
DROP POLICY IF EXISTS "Chat members write" ON chat_channel_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON chat_channel_members;
DROP POLICY IF EXISTS "Users can insert memberships" ON chat_channel_members;
DROP POLICY IF EXISTS "Users can update their own memberships" ON chat_channel_members;
DROP POLICY IF EXISTS "Users can delete their own memberships" ON chat_channel_members;

DO $$ BEGIN RAISE NOTICE 'All chat_channel_members policies dropped'; END $$;

-- ============================================================================
-- SECTION 2: Create simplified non-recursive policies
-- ============================================================================

-- SELECT: Users can see their own memberships
CREATE POLICY chat_channel_members_select ON chat_channel_members
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: Users can insert their own memberships
CREATE POLICY chat_channel_members_insert ON chat_channel_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own memberships (e.g., last_read_at)
CREATE POLICY chat_channel_members_update ON chat_channel_members
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can delete their own memberships
CREATE POLICY chat_channel_members_delete ON chat_channel_members
  FOR DELETE USING (user_id = auth.uid());

DO $$ BEGIN RAISE NOTICE 'Simplified non-recursive policies created'; END $$;

-- ============================================================================
-- SECTION 3: Verify RLS is enabled
-- ============================================================================

ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN RAISE NOTICE 'RLS enabled on chat_channel_members'; END $$;

-- ============================================================================
-- SECTION 4: Test the policies
-- ============================================================================

-- This should work for authenticated users
DO $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE NOTICE 'Testing SELECT policy for user %', auth.uid();
    PERFORM 1 FROM chat_channel_members WHERE user_id = auth.uid() LIMIT 1;
    RAISE NOTICE 'SELECT policy test passed';
  ELSE
    RAISE NOTICE 'Skipping policy test (not authenticated)';
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'Migration 025 completed successfully'; END $$;
