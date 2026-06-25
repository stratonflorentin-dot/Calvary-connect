-- FIX: User Profiles RLS INSERT Policy Violation
-- Run this in Supabase SQL Editor to fix the insert error

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile by email" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "All users can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow all operations" ON user_profiles;
DROP POLICY IF EXISTS "Service role bypass" ON user_profiles;

-- 2. Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create INSERT policy that allows authenticated users to insert profiles
CREATE POLICY "Authenticated users can insert profiles" 
  ON user_profiles
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 4. Create SELECT policy for viewing profiles
CREATE POLICY "Authenticated users can view all profiles" 
  ON user_profiles
  FOR SELECT 
  TO authenticated 
  USING (true);

-- 5. Create UPDATE policy for own profile
CREATE POLICY "Users can update own profile" 
  ON user_profiles
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id OR email = auth.email());

-- 6. Create admin policy for all operations
CREATE POLICY "Admins can manage all profiles" 
  ON user_profiles
  FOR ALL 
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('ADMIN', 'CEO', 'HR')
    OR auth.jwt() ->> 'email' IN ('stratonflorentin@gmail.com', 'calvaryadmin466@gmail.com')
    OR auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE COALESCE(raw_user_meta_data->>'role', '') IN ('ADMIN', 'CEO', 'HR', 'admin', 'ceo', 'hr')
    )
  );

-- 7. Verify policies are created
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;
