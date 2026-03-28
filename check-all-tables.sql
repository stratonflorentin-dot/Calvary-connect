-- Quick test to see what tables exist
SELECT 
  'maintenance_requests' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'maintenance_requests'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
UNION ALL
SELECT 
  'inventory' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'inventory'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
UNION ALL
SELECT 
  'vehicles' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'vehicles'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
UNION ALL
SELECT 
  'user_profiles' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_profiles'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
ORDER BY table_name;
