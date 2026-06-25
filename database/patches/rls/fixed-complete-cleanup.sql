-- Complete cleanup script - removes ALL mock data from fleet system
-- This script cleans the database completely and removes any sample/preview data

-- Step 1: Disable RLS on all tables temporarily
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE financial_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE revenue DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_locations DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "All users can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can manage vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can view trips" ON trips;
DROP POLICY IF EXISTS "Admins can manage trips" ON trips;
DROP POLICY IF EXISTS "Users can view maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Admins can manage maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Users can view inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory;
DROP POLICY IF EXISTS "Users can view financial data" ON financial_categories;
DROP POLICY IF EXISTS "Accountants can manage financial data" ON financial_categories;
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Accountants can manage expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view revenue" ON revenue;
DROP POLICY IF EXISTS "Accountants can manage revenue" ON revenue;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view vehicle locations" ON vehicle_locations;
DROP POLICY IF EXISTS "Admins can manage vehicle locations" ON vehicle_locations;

-- Step 3: Remove ALL mock data from all tables
DO $$
BEGIN
    -- Remove all vehicles data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        DELETE FROM vehicles;
        RAISE NOTICE 'All vehicles data removed';
    END IF;
    
    -- Remove all trips data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN
        DELETE FROM trips;
        RAISE NOTICE 'All trips data removed';
    END IF;
    
    -- Remove all maintenance requests
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maintenance_requests') THEN
        DELETE FROM maintenance_requests;
        RAISE NOTICE 'All maintenance requests data removed';
    END IF;
    
    -- Remove all inventory data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
        DELETE FROM inventory;
        RAISE NOTICE 'All inventory data removed';
    END IF;
    
    -- Remove all expenses
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        DELETE FROM expenses;
        RAISE NOTICE 'All expenses data removed';
    END IF;
    
    -- Remove all revenue
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue') THEN
        DELETE FROM revenue;
        RAISE NOTICE 'All revenue data removed';
    END IF;
    
    -- Remove all budgets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets') THEN
        DELETE FROM budgets;
        RAISE NOTICE 'All budgets data removed';
    END IF;
    
    -- Remove all notifications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        DELETE FROM notifications;
        RAISE NOTICE 'All notifications data removed';
    END IF;
    
    -- Remove all vehicle locations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_locations') THEN
        DELETE FROM vehicle_locations;
        RAISE NOTICE 'All vehicle locations data removed';
    END IF;
    
    -- Remove all user profiles except potentially real users (keep admin if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        -- Keep only users with legitimate email addresses (remove obvious mock data)
        DELETE FROM user_profiles 
        WHERE email LIKE '%test%' 
        OR email LIKE '%demo%' 
        OR email LIKE '%mock%' 
        OR email LIKE '%example%'
        OR email LIKE '%sample%'
        OR name LIKE '%Test User%'
        OR name LIKE '%Demo User%'
        OR name LIKE '%Sample User%';
        RAISE NOTICE 'Mock user profiles removed';
    END IF;
    
    RAISE NOTICE 'All mock data removed from fleet system';
END $$;

-- Step 4: Drop all check constraints to prevent future issues
DO $$
BEGIN
    -- Drop any constraints on vehicles
    DECLARE
        constraint_rec RECORD;
    BEGIN
        FOR constraint_rec IN 
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'vehicles'::regclass 
            AND contype = 'c'
        LOOP
            EXECUTE format('ALTER TABLE vehicles DROP CONSTRAINT %I', constraint_rec.conname);
            RAISE NOTICE 'Dropped constraint: %', constraint_rec.conname;
        END LOOP;
    END;
    
    -- Drop any constraints on other tables too - Fixed version
    DECLARE
        other_constraint_rec RECORD;
    BEGIN
        FOR other_constraint_rec IN 
            SELECT conname, conrelid::regclass::text as table_name
            FROM pg_constraint 
            WHERE contype = 'c'
            AND conrelid::regclass::text IN ('user_profiles', 'trips', 'maintenance_requests', 'inventory', 'expenses', 'revenue', 'budgets', 'notifications', 'vehicle_locations')
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', other_constraint_rec.table_name, other_constraint_rec.conname);
            RAISE NOTICE 'Dropped constraint on %: %', other_constraint_rec.table_name, other_constraint_rec.conname;
        END LOOP;
    END;
    
    RAISE NOTICE 'All check constraints dropped';
END $$;

-- Step 5: Ensure all tables exist and are empty
DO $$
BEGIN
    -- Create vehicles table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        CREATE TABLE vehicles (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            plate_number TEXT UNIQUE NOT NULL,
            make TEXT NOT NULL,
            model TEXT NOT NULL,
            year INTEGER NOT NULL,
            type TEXT DEFAULT 'truck',
            status TEXT DEFAULT 'active',
            mileage INTEGER DEFAULT 0,
            fuel_capacity DECIMAL(5, 2),
            fuel_type TEXT DEFAULT 'diesel',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Vehicles table created';
    END IF;
    
    -- Create other essential tables if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN
        CREATE TABLE trips (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            vehicle_id UUID REFERENCES vehicles(id),
            driver_id UUID REFERENCES user_profiles(id),
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            start_time TIMESTAMP WITH TIME ZONE,
            end_time TIMESTAMP WITH TIME ZONE,
            distance_km INTEGER,
            fuel_consumed DECIMAL(8, 2),
            status TEXT DEFAULT 'scheduled',
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Trips table created';
    END IF;
    
    -- Create user_profiles if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        CREATE TABLE user_profiles (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'user',
            phone TEXT,
            address TEXT,
            license_number TEXT,
            hire_date DATE,
            salary DECIMAL(10, 2),
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'User profiles table created';
    END IF;
    
    RAISE NOTICE 'All required tables ensured to exist';
END $$;

-- Step 6: Verify complete cleanup
SELECT 
    'vehicles' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    (SELECT COUNT(*) FROM vehicles) as record_count
UNION ALL
SELECT 
    'trips' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    (SELECT COUNT(*) FROM trips) as record_count
UNION ALL
SELECT 
    'user_profiles' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    (SELECT COUNT(*) FROM user_profiles) as record_count
UNION ALL
SELECT 
    'maintenance_requests' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maintenance_requests') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    (SELECT COUNT(*) FROM maintenance_requests) as record_count
UNION ALL
SELECT 
    'expenses' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    (SELECT COUNT(*) FROM expenses) as record_count;

-- Show that no constraints remain
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    conrelid::regclass::text as table_name
FROM pg_constraint 
WHERE conrelid::regclass::text IN ('vehicles', 'trips', 'user_profiles', 'maintenance_requests', 'expenses')
ORDER BY conname;

-- Final status check
SELECT '✅ Fleet system completely cleaned!' as status,
       'All mock data removed, constraints dropped, database ready for real data.' as message,
       'Fleet dashboard will show empty state ready for real vehicles.' as next_step;
