-- Add RLS Policies for user_profiles
-- This allows authenticated users to read user_profiles for colleague discovery
-- Run in Supabase SQL Editor

-- ============================================================================
-- PHASE 1: Enable RLS if not already enabled
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 2: Drop existing policies if any
-- ============================================================================

DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_insert ON user_profiles;
DROP POLICY IF EXISTS user_profiles_update ON user_profiles;
DROP POLICY IF EXISTS user_profiles_delete ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- ============================================================================
-- PHASE 3: Create RLS policies for user_profiles
-- ============================================================================

-- Authenticated users can view all profiles (needed for colleague discovery)
CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can update their own profile
CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================================
-- PHASE 4: Notify PostgREST to reload schema
-- ============================================================================
NOTIFY pgrst, 'reload schema';
