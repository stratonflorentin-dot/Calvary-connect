-- Test if maintenance_requests table exists and is accessible
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'maintenance_requests'
    ) THEN 'maintenance_requests table exists'
    ELSE 'maintenance_requests table missing'
  END as table_check;

-- Test if we can query the table
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM maintenance_requests LIMIT 1) THEN 'maintenance_requests accessible'
    ELSE 'maintenance_requests not accessible or empty'
  END as access_check;

-- Show table structure if it exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'maintenance_requests' AND table_schema = 'public'
ORDER BY ordinal_position;
