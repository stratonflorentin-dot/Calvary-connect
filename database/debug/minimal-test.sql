-- Minimal Database Test
-- Run this to test basic connectivity

-- Test 1: Check if we can connect at all
SELECT 'Connection test' as test_result, NOW() as test_time;

-- Test 2: Check if vehicles table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'vehicles'
    ) THEN 'vehicles table exists'
    ELSE 'vehicles table missing'
  END as table_check;

-- Test 3: Try to query vehicles (this will show RLS issues)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM vehicles LIMIT 1) THEN 'vehicles accessible'
    ELSE 'vehicles not accessible'
  END as access_check;
