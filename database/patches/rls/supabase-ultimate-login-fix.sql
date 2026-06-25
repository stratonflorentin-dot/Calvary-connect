-- =========================================================================
-- ULTIMATE SUPABASE LOGIN & SIGNUP FIX
-- Run this script in the Supabase SQL Editor to resolve all 500 Auth errors
-- and RLS deadlocks.
-- =========================================================================

-- 1. GUARANTEE ALL ACTIVITY & TRACKING COLUMNS EXIST ON USER_PROFILES
ALTER TABLE IF EXISTS user_profiles 
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- 2. CREATE A ROBUST TRY-CATCH FOR THE LOGIN RECORDER TRIGGER
CREATE OR REPLACE FUNCTION record_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- We wrap the trigger logic in an EXCEPTION block to ensure that
  -- if any schema, constraint, or database error occurs, it is caught
  -- and logged as a warning, and NEVER blocks the user's login session.
  BEGIN
    UPDATE user_profiles
    SET 
      last_login_at = NOW(),
      last_activity_at = NOW(),
      login_count = COALESCE(login_count, 0) + 1,
      status = CASE 
        WHEN status IN ('invited', 'dormant') THEN 'active'
        ELSE COALESCE(status, 'active') 
      END,
      status_reason = CASE 
        WHEN status IN ('invited', 'dormant') THEN 'Reactivated on login'
        ELSE status_reason 
      END,
      updated_at = NOW()
    WHERE id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log warning internally to pg_log and allow the login transaction to succeed
    RAISE WARNING 'Error updating user profile in record_user_login trigger: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the login trigger
DROP TRIGGER IF EXISTS on_user_login ON auth.sessions;
CREATE TRIGGER on_user_login
  AFTER INSERT ON auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION record_user_login();


-- 3. CREATE A ROBUST TRY-CATCH FOR THE SIGNUP AUTO-LINK TRIGGER
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  profile_exists BOOLEAN;
BEGIN
  -- Wrap in an EXCEPTION block so that signup is NEVER blocked by trigger errors
  BEGIN
    -- Check if a pre-added profile exists with this email
    SELECT EXISTS(
      SELECT 1 FROM user_profiles 
      WHERE email = NEW.email 
      AND (id IS NULL OR id != NEW.id)
    ) INTO profile_exists;
    
    IF profile_exists THEN
      -- Update the pre-added profile with the real auth ID
      UPDATE user_profiles 
      SET id = NEW.id,
          status = 'active',
          updated_at = NOW()
      WHERE email = NEW.email;
    ELSE
      -- Create new profile if none exists
      INSERT INTO user_profiles (id, email, name, role, status, created_at, updated_at)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'OPERATOR'),
        'active',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error auto-linking profile in handle_new_user_signup trigger: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the signup trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_signup();


-- 4. UPDATE USER_PROFILES RLS POLICIES FOR SECURE & FLUID ACCESS
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile by email" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create role helper function to bypass RLS inside policies safely
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM user_profiles WHERE id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users can view own profile by ID or email
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR email = auth.email()
  );

-- Admins, CEO, and HR can manage all profiles
CREATE POLICY "Admins can manage all profiles" ON user_profiles
  FOR ALL 
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('ADMIN', 'CEO', 'HR'));

-- Users can update own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (
    auth.uid() = id 
    OR email = auth.email()
  );


-- 5. RUN AN INSTANT BATCH FIX ON EXISTING UNLINKED USERS
UPDATE user_profiles
SET id = (
  SELECT id FROM auth.users 
  WHERE auth.users.email = user_profiles.email
  LIMIT 1
)
WHERE id IS NULL 
OR id NOT IN (SELECT id FROM auth.users)
AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = user_profiles.email);

-- Ensure RLS is active
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
