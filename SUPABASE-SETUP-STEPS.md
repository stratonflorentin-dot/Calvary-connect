# 🚀 Supabase Database Setup - Step by Step

## ⚠️ IMPORTANT: Use the FIXED Setup

Use the content from `fixed-setup.sql` file - NOT the other files!
This version fixes the JWT role issue you're experiencing.

---

## 📋 Step 1: Open Supabase Dashboard

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project (or create new one)

## 🗃️ Step 2: Open SQL Editor

1. In the left sidebar, click **"SQL Editor"**
2. Click **"New query"** to open a new query window
3. You should see a blank SQL editor

## 📋 Step 3: Copy and Paste the Fixed SQL

**Copy the entire content below** (from fixed-setup.sql):

```sql
-- Fixed Supabase Database Setup for Fleet Management System
-- This version fixes the JWT role issue

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CEO', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plate_number TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TRUCK', 'TRAILER', 'ESCORT_CAR', 'HOSE')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_service')),
  mileage INTEGER DEFAULT 0,
  fuel_capacity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  driver_id TEXT,
  truck_id UUID REFERENCES vehicles(id),
  trailer_id UUID REFERENCES vehicles(id),
  escort_car_id UUID REFERENCES vehicles(id),
  hose_id UUID REFERENCES vehicles(id),
  cargo_type TEXT,
  cargo_weight REAL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('FUEL', 'MAINTENANCE', 'TOLL', 'FOOD', 'OTHER')),
  amount REAL NOT NULL,
  description TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maintenance Requests Table
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id TEXT,
  issue_description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spare Parts Table
CREATE TABLE IF NOT EXISTS spare_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  part_number TEXT UNIQUE,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 5,
  unit_price REAL,
  supplier TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts Requests Table
CREATE TABLE IF NOT EXISTS parts_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID REFERENCES spare_parts(id),
  requested_by TEXT,
  quantity INTEGER NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allowances Table
CREATE TABLE IF NOT EXISTS allowances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DAILY_ALLOWANCE', 'TRIP_ALLOWANCE', 'MEAL_ALLOWANCE', 'ACCOMMODATION')),
  amount REAL NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowances ENABLE ROW LEVEL SECURITY;

-- Create a function to get user role from user_profiles
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Fixed RLS Policies - Using user_profiles table instead of JWT
-- User Profiles
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (get_user_role() = 'CEO');

-- Vehicles
CREATE POLICY "Authenticated users can view vehicles" ON vehicles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage vehicles" ON vehicles FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Trips
CREATE POLICY "Authenticated users can view trips" ON trips FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage trips" ON trips FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Expenses
CREATE POLICY "Authenticated users can view expenses" ON expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage expenses" ON expenses FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Maintenance Requests
CREATE POLICY "Authenticated users can view maintenance requests" ON maintenance_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage maintenance requests" ON maintenance_requests FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Spare Parts
CREATE POLICY "Authenticated users can view spare parts" ON spare_parts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage spare parts" ON spare_parts FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Parts Requests
CREATE POLICY "Authenticated users can view parts requests" ON parts_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage parts requests" ON parts_requests FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Allowances
CREATE POLICY "Authenticated users can view allowances" ON allowances FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage allowances" ON allowances FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Insert sample vehicles
INSERT INTO vehicles (plate_number, make, model, year, type, status) VALUES
('ABC-123', 'Volvo', 'FH16', 2022, 'TRUCK', 'available'),
('DEF-456', 'Great Dane', 'Drop Deck', 2021, 'TRAILER', 'available'),
('GHI-789', 'Ford', 'Explorer', 2023, 'ESCORT_CAR', 'available'),
('JKL-012', 'Generic', 'Hose Kit', 2022, 'HOSE', 'available')
ON CONFLICT (plate_number) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);

-- Setup complete message
SELECT '✅ Fleet Management Database Setup Complete!' as status,
       'Tables created, RLS policies applied, sample data inserted.' as message;
```

## 🚀 Step 4: Run the SQL

1. **Paste** the entire SQL content above into the SQL Editor
2. **Click** the **"Run"** button (or press Ctrl+Enter)
3. **Wait** for the setup to complete
4. **You should see**: "✅ Fleet Management Database Setup Complete!" message

## 🎯 Step 5: Verify Setup

After running the SQL, you should see:
- ✅ All tables created in the sidebar
- ✅ Sample data inserted (4 vehicles)
- ✅ No error messages

## 🔐 Step 6: Configure Authentication

1. In Supabase Dashboard, go to **Authentication** > **Settings**
2. **Enable** "Email" authentication
3. **Add** admin user manually if needed:
   - Email: `stratonflorentin@gmail.com`
   - Password: `Tony@5002`

## 🚀 Step 7: Test Your Application

1. **Refresh** your application at http://localhost:9002
2. **Sign up** with: stratonflorentin@gmail.com / Tony@5002
3. **Demo banner should disappear**
4. **Test adding vehicles, trips, expenses**

## 🎉 Success Indicators

✅ **Database Tables Created**: All 7 tables with proper relationships
✅ **RLS Policies Applied**: Role-based security enabled
✅ **Sample Data Inserted**: 4 vehicles ready for testing
✅ **JWT Role Issue Fixed**: Using user_profiles table for role management
✅ **Authentication Ready**: Email signup/login configured

## 🛠️ Troubleshooting

**If you still see "Supabase Setup Required":**
1. Make sure you used the `fixed-setup.sql` content
2. Check that all tables were created successfully
3. Verify RLS policies were applied
4. Refresh your browser and try signing up again

**If authentication fails:**
1. Check email auth is enabled in Supabase
2. Verify admin user exists in user_profiles table
3. Check password requirements in Supabase settings

---

**🎯 Your Fleet Management System will be fully operational after completing these steps!**
