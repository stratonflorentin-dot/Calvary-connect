-- Check if user_profiles table exists and has data
SELECT 
  'user_profiles table exists' as check_type,
  COUNT(*) as record_count
FROM user_profiles;

-- Check current user's role
SELECT 
  'Current user role' as check_type,
  id,
  email,
  role
FROM user_profiles 
WHERE auth.uid() = id;

-- Check RLS policies on user_profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- Check if get_user_role function exists
SELECT 
  'get_user_role function exists' as check_type,
  EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_role'
  ) as function_exists;
