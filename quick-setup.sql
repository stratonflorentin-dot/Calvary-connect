-- Quick Setup for Your Supabase Fleet Management System
-- Copy this entire SQL and run it in your Supabase SQL Editor

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

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (role = 'CEO');

CREATE POLICY "Authenticated users can view vehicles" ON vehicles FOR SELECT USING (auth.role() IS NOT NULL);
CREATE POLICY "CEO and OPERATOR can manage vehicles" ON vehicles FOR ALL USING (auth.jwt()->'role' in ('CEO', 'OPERATOR'));

-- Insert sample data
INSERT INTO vehicles (plate_number, make, model, year, type, status) VALUES
('ABC-123', 'Volvo', 'FH16', 2022, 'TRUCK', 'available'),
('DEF-456', 'Great Dane', 'Drop Deck', 2021, 'TRAILER', 'available'),
('GHI-789', 'Ford', 'Explorer', 2023, 'ESCORT_CAR', 'available'),
('JKL-012', 'Generic', 'Hose Kit', 2022, 'HOSE', 'available')
ON CONFLICT (plate_number) DO NOTHING;
