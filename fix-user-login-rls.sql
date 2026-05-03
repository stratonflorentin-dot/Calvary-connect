-- FIX: User Login Role-Based Access Issue
-- Problem: RLS policy prevents users from accessing their profiles during login

-- ============================================
-- 1. UPDATE USER_PROFILES RLS POLICIES
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile by email" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create function to check user role (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM user_profiles WHERE id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policy: Users can view their own profile by ID OR EMAIL
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR email = auth.email()
  );

-- Policy: Admins/CEO/HR can manage all profiles
CREATE POLICY "Admins can manage all profiles" ON user_profiles
  FOR ALL 
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('ADMIN', 'CEO', 'HR'));

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id OR email = auth.email());

-- ============================================
-- 2. CREATE FUNCTION TO AUTO-LINK USER PROFILES
-- ============================================

-- Function to handle new user signups and link pre-added profiles
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  profile_exists BOOLEAN;
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
    
    RAISE NOTICE 'Linked pre-added profile for %', NEW.email;
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
    
    RAISE NOTICE 'Created new profile for %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users to auto-link profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_signup();

-- ============================================
-- 3. FIX EXISTING UNLINKED PROFILES
-- ============================================

-- Update any existing profiles where id doesn't match auth users
UPDATE user_profiles
SET id = (
  SELECT id FROM auth.users 
  WHERE auth.users.email = user_profiles.email
  LIMIT 1
)
WHERE id IS NULL 
OR id NOT IN (SELECT id FROM auth.users)
AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = user_profiles.email);

-- ============================================
-- 4. ENABLE RLS ON USER_PROFILES (if not already)
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. VERIFY SETUP
-- ============================================

SELECT 
  'RLS Policies Created' as status,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'user_profiles';

SELECT 
  'Trigger Created' as status,
  COUNT(*) as trigger_count
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

SELECT 
  'Linked Profiles' as status,
  COUNT(*) as linked_count
FROM user_profiles p
JOIN auth.users u ON p.id = u.id;

SELECT 
  'Unlinked Profiles (needs fixing)' as status,
  COUNT(*) as unlinked_count
FROM user_profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;
