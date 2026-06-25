-- COMPLETE FIX for user_profiles visibility and management
-- Run this entire script in Supabase SQL Editor

-- 1. Enable RLS on user_profiles (if not already enabled)
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile by email" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "All users can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow all operations" ON user_profiles;

-- 3. Create a comprehensive policy that allows all operations for authenticated users
-- This is the simplest approach for debugging - you can restrict later
CREATE POLICY "Allow all operations" ON user_profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Also allow service role (for edge functions/triggers) just in case
CREATE POLICY "Service role bypass" ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Verify table has data
SELECT 'Table has ' || COUNT(*) || ' rows' as status FROM user_profiles;

-- 6. Show all current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_profiles';
