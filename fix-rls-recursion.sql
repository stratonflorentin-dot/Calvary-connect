-- Fix infinite recursion in RLS policies
-- This script fixes the circular reference issue in user_profiles policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;

-- Create fixed policies without circular references
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON user_profiles
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'ceo')
    )
  );

-- Fix other policies that might have similar issues
DROP POLICY IF EXISTS "All users can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can manage vehicles" ON vehicles;

CREATE POLICY "All users can view vehicles" ON vehicles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage vehicles" ON vehicles
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'operator', 'ceo')
    )
  );

-- Fix trips policies
DROP POLICY IF EXISTS "Users can view trips" ON trips;
DROP POLICY IF EXISTS "Admins can manage trips" ON trips;

CREATE POLICY "Users can view trips" ON trips
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage trips" ON trips
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'operator', 'ceo')
    )
  );

-- Fix maintenance requests policies
DROP POLICY IF EXISTS "Users can view maintenance requests" ON maintenance_requests;
DROP POLICY IF EXISTS "Admins can manage maintenance requests" ON maintenance_requests;

CREATE POLICY "Users can view maintenance requests" ON maintenance_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage maintenance requests" ON maintenance_requests
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'operator', 'mechanic', 'ceo')
    )
  );

-- Fix inventory policies
DROP POLICY IF EXISTS "Users can view inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory;

CREATE POLICY "Users can view inventory" ON inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage inventory" ON inventory
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'operator', 'ceo')
    )
  );

-- Fix financial policies
DROP POLICY IF EXISTS "Users can view financial data" ON financial_categories;
DROP POLICY IF EXISTS "Accountants can manage financial data" ON financial_categories;

CREATE POLICY "Users can view financial data" ON financial_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountants can manage financial data" ON financial_categories
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- Fix expenses policies
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Accountants can manage expenses" ON expenses;

CREATE POLICY "Users can view expenses" ON expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountants can manage expenses" ON expenses
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- Fix revenue policies
DROP POLICY IF EXISTS "Users can view revenue" ON revenue;
DROP POLICY IF EXISTS "Accountants can manage revenue" ON revenue;

CREATE POLICY "Users can view revenue" ON revenue
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountants can manage revenue" ON revenue
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- Fix notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON notifications;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications" ON notifications
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'ceo')
    )
  );

-- Fix vehicle locations policies
DROP POLICY IF EXISTS "Users can view vehicle locations" ON vehicle_locations;
DROP POLICY IF EXISTS "Admins can manage vehicle locations" ON vehicle_locations;

CREATE POLICY "Users can view vehicle locations" ON vehicle_locations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage vehicle locations" ON vehicle_locations
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('admin', 'operator', 'ceo')
    )
  );

SELECT '✅ Fixed infinite recursion in RLS policies!' as status,
       'All policies updated to use auth.users instead of self-referencing user_profiles.' as message;
