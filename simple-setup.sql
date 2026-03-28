-- Simplified Database Setup for Fleet Management
-- This version focuses on getting basic tables working first

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

-- Enable Row Level Security (simplified)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Simplified RLS Policies
CREATE POLICY "Enable all access to user_profiles" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Enable all access to vehicles" ON vehicles FOR ALL USING (true);
CREATE POLICY "Enable all access to trips" ON trips FOR ALL USING (true);

-- Insert sample vehicles
INSERT INTO vehicles (plate_number, make, model, year, type, status) VALUES
('ABC-123', 'Volvo', 'FH16', 2022, 'TRUCK', 'available'),
('DEF-456', 'Great Dane', 'Drop Deck', 2021, 'TRAILER', 'available'),
('GHI-789', 'Ford', 'Explorer', 2023, 'ESCORT_CAR', 'available'),
('JKL-012', 'Generic', 'Hose Kit', 2022, 'HOSE', 'available')
ON CONFLICT (plate_number) DO NOTHING;

-- Setup complete message
SELECT '✅ Simplified Database Setup Complete!' as status,
       'Basic tables created with open access policies.' as message;
