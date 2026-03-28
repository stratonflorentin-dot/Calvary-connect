-- Quick Database Test
-- Run this to check if tables exist and are accessible

-- Check if tables exist
SELECT 
  'vehicles' as vehicles_table,
  'trips' as trips_table,
  'user_profiles' as profiles_table,
  'maintenance_requests' as maintenance_table
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('vehicles', 'trips', 'user_profiles', 'maintenance_requests');

-- Test basic query on vehicles
SELECT COUNT(*) as vehicle_count FROM vehicles;

-- Test basic query on trips  
SELECT COUNT(*) as trip_count FROM trips;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive 
FROM pg_policies 
WHERE schemaname = 'public';
