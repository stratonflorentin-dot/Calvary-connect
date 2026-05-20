-- =========================================================================
-- SUPABASE RLS USER VISIBILITY & PRIVILEGES FIX (v2.0)
-- Run this script in the Supabase SQL Editor.
-- This removes any queries to `auth.users` inside RLS policies, which
-- cause permission-denied crashes for regular authenticated users.
-- =========================================================================

-- 1. CLEAN UP ALL OLD, PROBLEMATIC POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile by email" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "All users can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow all operations" ON user_profiles;
DROP POLICY IF EXISTS "Service role bypass" ON user_profiles;

-- 2. CREATE HIGH-PERFORMANCE, RECURSION-FREE, PRIVILEGE-SAFE POLICIES

-- POLICY A: Allow ANY authenticated user to view ALL user profiles
-- (Crucial for drivers to view operations, operators to view drivers, mechanics to view reports, and dashboards to load)
CREATE POLICY "Authenticated users can view all profiles" 
  ON user_profiles
  FOR SELECT 
  TO authenticated 
  USING (true);

-- POLICY B: Allow users to UPDATE their own profiles
CREATE POLICY "Users can update own profile" 
  ON user_profiles
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id OR email = auth.email());

-- POLICY C: Allow Admins/CEO/HR to perform ALL operations (INSERT, UPDATE, DELETE)
-- This uses ONLY JWT claims or specific admin emails to avoid querying auth.users (which crashes for authenticated clients).
CREATE POLICY "Admins can manage all profiles" 
  ON user_profiles
  FOR ALL 
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('ADMIN', 'CEO', 'HR')
    OR auth.jwt() ->> 'email' IN ('stratonflorentin@gmail.com', 'calvaryadmin466@gmail.com')
  );

-- POLICY D: Allow authenticated users to INSERT profiles (necessary for signup and inviting)
CREATE POLICY "Authenticated users can insert profiles" 
  ON user_profiles
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 3. ENSURE ROW LEVEL SECURITY IS ACTIVE
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. BATCH OPTIMIZE AUTH METADATA FOR ALL REGISTERED USERS
-- Runs with superuser/service_role security context to update auth.users metadata safely.
CREATE OR REPLACE FUNCTION sync_all_users_metadata()
RETURNS void AS $$
BEGIN
  UPDATE auth.users u
  SET raw_user_meta_data = 
    COALESCE(u.raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', p.role)
  FROM public.user_profiles p
  WHERE u.id = p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT sync_all_users_metadata();
