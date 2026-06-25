-- Quick diagnostic script to check what's wrong with fleet data loading

-- Check if vehicles table exists
SELECT 
    'vehicles' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles') THEN 
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'vehicles') || ' columns'
        ELSE '0 columns'
    END as column_count
UNION ALL
SELECT 
    'user_profiles' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles') THEN 
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'user_profiles') || ' columns'
        ELSE '0 columns'
    END as column_count
ORDER BY table_name;

-- Check vehicles table structure if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        RAISE NOTICE 'Vehicles table columns: %', 
            (SELECT string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
            FROM information_schema.columns 
            WHERE table_name = 'vehicles');
        
        RAISE NOTICE 'Sample vehicles count: %', (SELECT COUNT(*) FROM vehicles);
    ELSE
        RAISE NOTICE 'Vehicles table does not exist';
    END IF;
END $$;
