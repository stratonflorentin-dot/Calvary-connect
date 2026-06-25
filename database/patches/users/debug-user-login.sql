-- DEBUG: Check specific user login issues

-- 1. List all auth users and their linked profiles
SELECT 
  u.id as auth_user_id,
  u.email as auth_email,
  p.id as profile_id,
  p.email as profile_email,
  p.name as profile_name,
  p.role,
  p.status,
  CASE 
    WHEN p.id IS NULL THEN 'NO PROFILE'
    WHEN p.id = u.id THEN 'LINKED'
    ELSE 'MISMATCH'
  END as link_status
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id OR u.email = p.email
ORDER BY u.created_at DESC;

-- 2. List unlinked profiles (pre-added users who haven't signed up)
SELECT 
  p.*,
  'Pre-added, not yet signed up' as status_note
FROM user_profiles p
LEFT JOIN auth.users u ON p.id = u.id OR p.email = u.email
WHERE u.id IS NULL
ORDER BY p.created_at DESC;

-- 3. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 4. Check if user_profiles table has RLS enabled
SELECT 
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'user_profiles';

-- 5. Check for users with NULL roles
SELECT 
  id,
  email,
  name,
  role,
  'NEEDS ROLE ASSIGNED' as warning
FROM user_profiles
WHERE role IS NULL OR role = '';

-- 6. Quick fix for a specific user (replace with actual email)
-- UPDATE user_profiles 
-- SET id = (SELECT id FROM auth.users WHERE email = 'user@example.com'),
--     status = 'active'
-- WHERE email = 'user@example.com';
