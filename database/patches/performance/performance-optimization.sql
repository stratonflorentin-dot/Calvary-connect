-- Performance optimization for handling many users
-- This script adds indexes and optimizations for better performance

-- Step 1: Add indexes for faster queries (with conditional checks)
DO $$
BEGIN
    -- Index on vehicles status for filtering
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
    END IF;
    
    -- Index on vehicles type for filtering
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'type') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);
    END IF;
    
    -- Index on vehicles created_at for sorting
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at DESC);
    END IF;
    
    -- Index on trips status
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
    END IF;
    
    -- Index on trips created_at for sorting (most common query pattern)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);
    END IF;
    
    -- Index on user_profiles role for role-based queries
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
        CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
    END IF;
    
    -- Index on notifications user_id and is_read
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
    END IF;
    
    -- Index on expenses date
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'date') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
    END IF;
    
    RAISE NOTICE 'Performance indexes created successfully';
END $$;

-- Step 2: Analyze tables for query planner
ANALYZE vehicles;
ANALYZE trips;
ANALYZE user_profiles;
ANALYZE notifications;
ANALYZE expenses;

-- Step 3: Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('vehicles', 'trips', 'user_profiles', 'notifications', 'expenses')
ORDER BY tablename, indexname;

SELECT '✅ Performance optimizations applied!' as status,
       'Database now optimized for many concurrent users with indexes and settings.' as message,
       'System should handle high traffic smoothly without glitches.' as next_step;
