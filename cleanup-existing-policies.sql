-- Clean up existing RLS policies before running setup
-- Run this script first, then run your main setup script

-- Drop all existing RLS policies
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

-- Also drop any existing triggers that might conflict
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
DROP TRIGGER IF EXISTS update_maintenance_requests_updated_at ON maintenance_requests;
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
DROP TRIGGER IF EXISTS update_revenue_updated_at ON revenue;
DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;

SELECT '✅ Cleanup complete! Now you can run your main setup script without conflicts.' as status;
