-- =========================================================================
-- SUPABASE RLS USER VISIBILITY & RECURSION FIX
-- Run this script in the Supabase SQL Editor to instantly restore full 
-- visibility to the User Management page and resolve RLS loop bugs.
-- =========================================================================

-- 1. ENABLE ROW LEVEL SECURITY ON USER_PROFILES
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. CLEAN UP ALL OLD, PROBLEMATIC POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile by email" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "All users can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow all operations" ON user_profiles;
DROP POLICY IF EXISTS "Service role bypass" ON user_profiles;

-- 3. CREATE HIGH-PERFORMANCE, RECURSION-FREE POLICIES

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
-- This uses recursion-free lookups directly into Supabase Auth data or JWT claims
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

-- POLICY D: Allow authenticated users to INSERT profiles (necessary for creating invitations)
CREATE POLICY "Authenticated users can insert profiles" 
  ON user_profiles
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 4. PERFORM BATCH CORRECTION TO ALIGN ROLES IN AUTH & PROFILES
-- Fixes any discrepancy where a user is an admin in profiles but not auth, or vice versa
UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', (SELECT role FROM public.user_profiles WHERE public.user_profiles.id = auth.users.id))
WHERE id IN (SELECT id FROM public.user_profiles);

-- 5. VERIFY SYSTEM HEALTH
SELECT 'Table has ' || COUNT(*) || ' rows' as status FROM user_profiles;
