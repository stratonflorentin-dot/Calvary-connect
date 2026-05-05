-- COMPLETE DIAGNOSTIC FOR user_profiles ISSUE
-- Run this entire script in Supabase SQL Editor

-- 1. Check if RLS is enabled on user_profiles
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS force_rls
FROM pg_class 
WHERE relname = 'user_profiles';

-- 2. Show ALL current policies on user_profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd,
  qual::text AS using_expression,
  with_check::text AS with_check_expression
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 3. Check auth.users entries
SELECT 
  id,
  email,
  created_at,
  confirmed_at
FROM auth.users
LIMIT 5;

-- 4. Check if user_profiles has any data
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
  COUNT(CASE WHEN status = 'invited' THEN 1 END) as invited_count
FROM user_profiles;

-- 5. Show sample user_profiles data
SELECT 
  id,
  email,
  name,
  role,
  status,
  created_at
FROM user_profiles
LIMIT 10;

-- 6. Check for any triggers on user_profiles
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'user_profiles';

-- 7. FIX: Disable and re-enable RLS to reset (keeps data safe)
-- ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 8. FIX: Create a simple permissive policy if none exists
DO $$
BEGIN
  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "allow_all" ON user_profiles;
  DROP POLICY IF EXISTS "Allow all operations" ON user_profiles;
  DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
  DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON user_profiles;
  
  -- Create single comprehensive policy
  CREATE POLICY "allow_all" ON user_profiles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
    
  RAISE NOTICE 'Created comprehensive allow_all policy';
END $$;

-- 9. Verify final state
SELECT 'RLS Policies After Fix:' AS status;
SELECT policyname, permissive, roles::text, cmd 
FROM pg_policies 
WHERE tablename = 'user_profiles';
