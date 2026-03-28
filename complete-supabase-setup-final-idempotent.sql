-- Complete Fleet Management System - Supabase Database Setup (Final Idempotent Version)
-- Run this script in your Supabase SQL Editor to create all necessary tables
-- This version handles existing policies, objects, and column existence gracefully

-- ===========================================
-- CORE USER MANAGEMENT TABLES
-- ===========================================

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'operator', 'driver', 'mechanic', 'ceo', 'accountant')),
  phone TEXT,
  address TEXT,
  license_number TEXT,
  hire_date DATE,
  salary DECIMAL(10, 2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- FLEET MANAGEMENT TABLES
-- ===========================================

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plate_number TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  type TEXT DEFAULT 'truck' CHECK (type IN ('truck', 'van', 'car', 'motorcycle', 'bus')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'sold', 'decommissioned')),
  mileage INTEGER DEFAULT 0,
  fuel_capacity DECIMAL(5, 2),
  fuel_type TEXT DEFAULT 'diesel' CHECK (fuel_type IN ('diesel', 'gasoline', 'electric', 'hybrid')),
  last_service_date DATE,
  next_service_date DATE,
  insurance_expiry DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES user_profiles(id),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  distance_km INTEGER,
  fuel_consumed DECIMAL(8, 2),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- MAINTENANCE & PARTS TABLES
-- ===========================================

-- Maintenance requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id),
  user_id UUID REFERENCES user_profiles(id),
  part_name TEXT,
  quantity INTEGER DEFAULT 1,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity_available INTEGER DEFAULT 0,
  unit TEXT,
  min_stock_level INTEGER DEFAULT 0,
  max_stock_level INTEGER,
  unit_cost DECIMAL(10, 2),
  supplier TEXT,
  location TEXT,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  last_restocked TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- FINANCIAL MANAGEMENT TABLES
-- ===========================================

-- Financial categories table
CREATE TABLE IF NOT EXISTS financial_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'revenue')),
  description TEXT,
  parent_id UUID REFERENCES financial_categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES financial_categories(id),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES user_profiles(id),
  trip_id UUID REFERENCES trips(id),
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  receipt_number TEXT,
  vendor TEXT,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'other')),
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue table
CREATE TABLE IF NOT EXISTS revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES financial_categories(id),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES user_profiles(id),
  trip_id UUID REFERENCES trips(id),
  client_id UUID,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  invoice_number TEXT UNIQUE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'other')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
  revenue_date DATE NOT NULL,
  due_date DATE,
  paid_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES financial_categories(id),
  vehicle_id UUID REFERENCES vehicles(id),
  department TEXT,
  budget_name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  period_type TEXT CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  spent_amount DECIMAL(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- NOTIFICATIONS & COMMUNICATION
-- ===========================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- VEHICLE TRACKING
-- ===========================================

-- Vehicle locations table
CREATE TABLE IF NOT EXISTS vehicle_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  speed DECIMAL(5, 2),
  heading DECIMAL(5, 2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INSERT DEFAULT DATA
-- ===========================================

-- Insert default financial categories
INSERT INTO financial_categories (name, type, description) VALUES
-- Expense Categories
('Fuel', 'expense', 'Vehicle fuel and gasoline expenses'),
('Maintenance', 'expense', 'Vehicle maintenance and repair costs'),
('Insurance', 'expense', 'Vehicle insurance premiums'),
('Salaries', 'expense', 'Driver and staff salaries'),
('Licenses & Permits', 'expense', 'Vehicle licenses and permits'),
('Tires', 'expense', 'Tire purchase and replacement'),
('Parts & Supplies', 'expense', 'Spare parts and supplies'),
('Depreciation', 'expense', 'Vehicle depreciation costs'),
('Parking & Tolls', 'expense', 'Parking fees and tolls'),
('Training', 'expense', 'Driver training and certification'),
('Office Expenses', 'expense', 'Administrative and office costs'),
('Utilities', 'expense', 'Office and facility utilities'),
('Marketing', 'expense', 'Marketing and advertising expenses'),
('Legal & Professional', 'expense', 'Legal and professional services'),
('Other Expenses', 'expense', 'Miscellaneous expenses'),
-- Revenue Categories
('Transport Revenue', 'revenue', 'Revenue from transportation services'),
('Delivery Services', 'revenue', 'Revenue from delivery services'),
('Leasing Revenue', 'revenue', 'Revenue from vehicle leasing'),
('Service Fees', 'revenue', 'Service and maintenance fees'),
('Cargo Revenue', 'revenue', 'Cargo transportation revenue'),
('Passenger Revenue', 'revenue', 'Passenger transportation revenue'),
('Other Revenue', 'revenue', 'Other miscellaneous revenue')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on all tables
DO $$
BEGIN
    -- Enable RLS only if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_profiles' AND rowsecurity = true) THEN
        ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'vehicles' AND rowsecurity = true) THEN
        ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'trips' AND rowsecurity = true) THEN
        ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'maintenance_requests' AND rowsecurity = true) THEN
        ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'inventory' AND rowsecurity = true) THEN
        ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'financial_categories' AND rowsecurity = true) THEN
        ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'expenses' AND rowsecurity = true) THEN
        ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'revenue' AND rowsecurity = true) THEN
        ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'budgets' AND rowsecurity = true) THEN
        ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'notifications' AND rowsecurity = true) THEN
        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'vehicle_locations' AND rowsecurity = true) THEN
        ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ===========================================
-- CREATE RLS POLICIES (Idempotent)
-- ===========================================

-- Drop existing policies if they exist, then recreate them
DO $$
BEGIN
    -- User profiles policies
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
    
    CREATE POLICY "Users can view own profile" ON user_profiles
      FOR SELECT USING (auth.uid() = id);

    CREATE POLICY "Admins can manage all profiles" ON user_profiles
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'ceo')
        )
      );

    -- Vehicles policies
    DROP POLICY IF EXISTS "All users can view vehicles" ON vehicles;
    DROP POLICY IF EXISTS "Admins can manage vehicles" ON vehicles;
    
    CREATE POLICY "All users can view vehicles" ON vehicles
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Admins can manage vehicles" ON vehicles
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'operator', 'ceo')
        )
      );

    -- Trips policies
    DROP POLICY IF EXISTS "Users can view trips" ON trips;
    DROP POLICY IF EXISTS "Admins can manage trips" ON trips;
    
    CREATE POLICY "Users can view trips" ON trips
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Admins can manage trips" ON trips
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'operator', 'ceo')
        )
      );

    -- Maintenance requests policies
    DROP POLICY IF EXISTS "Users can view maintenance requests" ON maintenance_requests;
    DROP POLICY IF EXISTS "Admins can manage maintenance requests" ON maintenance_requests;
    
    CREATE POLICY "Users can view maintenance requests" ON maintenance_requests
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Admins can manage maintenance requests" ON maintenance_requests
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'operator', 'mechanic', 'ceo')
        )
      );

    -- Inventory policies
    DROP POLICY IF EXISTS "Users can view inventory" ON inventory;
    DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory;
    
    CREATE POLICY "Users can view inventory" ON inventory
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Admins can manage inventory" ON inventory
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'operator', 'ceo')
        )
      );

    -- Financial policies
    DROP POLICY IF EXISTS "Users can view financial data" ON financial_categories;
    DROP POLICY IF EXISTS "Accountants can manage financial data" ON financial_categories;
    
    CREATE POLICY "Users can view financial data" ON financial_categories
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Accountants can manage financial data" ON financial_categories
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
        )
      );

    -- Expenses policies
    DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
    DROP POLICY IF EXISTS "Accountants can manage expenses" ON expenses;
    
    CREATE POLICY "Users can view expenses" ON expenses
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Accountants can manage expenses" ON expenses
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
        )
      );

    -- Revenue policies
    DROP POLICY IF EXISTS "Users can view revenue" ON revenue;
    DROP POLICY IF EXISTS "Accountants can manage revenue" ON revenue;
    
    CREATE POLICY "Users can view revenue" ON revenue
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Accountants can manage revenue" ON revenue
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
        )
      );

    -- Notifications policies
    DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
    DROP POLICY IF EXISTS "Admins can manage all notifications" ON notifications;
    
    CREATE POLICY "Users can view own notifications" ON notifications
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "Users can manage own notifications" ON notifications
      FOR ALL USING (auth.uid() = user_id);

    CREATE POLICY "Admins can manage all notifications" ON notifications
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'ceo')
        )
      );

    -- Vehicle locations policies
    DROP POLICY IF EXISTS "Users can view vehicle locations" ON vehicle_locations;
    DROP POLICY IF EXISTS "Admins can manage vehicle locations" ON vehicle_locations;
    
    CREATE POLICY "Users can view vehicle locations" ON vehicle_locations
      FOR SELECT USING (auth.uid() IS NOT NULL);

    CREATE POLICY "Admins can manage vehicle locations" ON vehicle_locations
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'operator', 'ceo')
        )
      );
END $$;

-- ===========================================
-- CREATE INDEXES FOR PERFORMANCE (with column existence checks)
-- ===========================================

DO $$
BEGIN
    -- User profiles indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'email') THEN
        CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
        CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
    END IF;

    -- Vehicles indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'plate_number') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
    END IF;

    -- Trips indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'driver_id') THEN
        CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
    END IF;

    -- Maintenance requests indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_requests' AND column_name = 'vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_maintenance_requests_vehicle_id ON maintenance_requests(vehicle_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_requests' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
    END IF;

    -- Financial indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'category_id') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_id ON expenses(vehicle_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'expense_date') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'category_id') THEN
        CREATE INDEX IF NOT EXISTS idx_revenue_category_id ON revenue(category_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_revenue_vehicle_id ON revenue(vehicle_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'revenue_date') THEN
        CREATE INDEX IF NOT EXISTS idx_revenue_revenue_date ON revenue(revenue_date);
    END IF;

    -- Budgets indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'category_id') THEN
        CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_budgets_vehicle_id ON budgets(vehicle_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
    END IF;

    -- Notifications indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    END IF;

    -- Vehicle locations indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_locations' AND column_name = 'vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id ON vehicle_locations(vehicle_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_locations' AND column_name = 'timestamp') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicle_locations_timestamp ON vehicle_locations(timestamp);
    END IF;
END $$;

-- ===========================================
-- CREATE FUNCTIONS AND TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at (drop existing if they exist)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
DROP TRIGGER IF EXISTS update_maintenance_requests_updated_at ON maintenance_requests;
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
DROP TRIGGER IF EXISTS update_revenue_updated_at ON revenue;
DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_revenue_updated_at
  BEFORE UPDATE ON revenue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- SUCCESS MESSAGE
-- ===========================================

SELECT '✅ Fleet Management System Setup Complete!' as status,
       'All tables, indexes, RLS policies, and triggers have been created or updated successfully.' as message;
