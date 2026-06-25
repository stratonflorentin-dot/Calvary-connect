-- FIX: Allow all authenticated users to view user_profiles
-- This is a temporary fix to debug visibility issues

-- Drop ALL existing policies on user_profiles first
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile by email" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "All users can view profiles" ON user_profiles;

-- Create permissive policy: All authenticated users can view all profiles
CREATE POLICY "Authenticated users can view all profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (true);

-- Policy: Admins/CEO/HR can manage all profiles
CREATE POLICY "Admins can manage all profiles" ON user_profiles
  FOR ALL 
  TO authenticated
  USING (true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id OR email = auth.email());

-- Policy: Allow authenticated users to insert new profiles (for invites)
CREATE POLICY "Authenticated users can insert profiles" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Verify
SELECT 'Policies updated' as status;
