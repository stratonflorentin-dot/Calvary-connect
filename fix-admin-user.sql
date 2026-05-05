-- Fix admin user - lookup ID from auth.users by email
DO $$
DECLARE
  admin_id UUID;
BEGIN
  -- Get the user ID from auth.users by email
  SELECT id INTO admin_id FROM auth.users WHERE email = 'stratonflorentin@gmail.com' LIMIT 1;
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'User with email stratonflorentin@gmail.com not found in auth.users. Please sign up first.';
  END IF;
  
  -- Insert or update the admin profile
  INSERT INTO user_profiles (id, email, name, role, status, created_at)
  VALUES (
    admin_id,
    'stratonflorentin@gmail.com',
    'Straton Florentin',
    'CEO',
    'active',
    now()
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    role = 'CEO', 
    status = 'active', 
    name = 'Straton Florentin',
    email = 'stratonflorentin@gmail.com';
    
  RAISE NOTICE 'Admin user created/updated with ID: %', admin_id;
END $$;

-- Verify
SELECT id, email, name, role, status FROM user_profiles 
WHERE email = 'stratonflorentin@gmail.com';
