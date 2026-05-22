-- ==========================================================================
-- CALVARY CONNECT - MASTER PRODUCTION DATABASE SETUP (VERSION 5.0)
-- Version: 2026.05.22.v5
-- Target: Supabase / PostgreSQL
-- Improvements: Guaranteed 'created_at' for ALL tables + Reordered for safety
-- ==========================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- 1. CORE SCHEMA (Using ADD COLUMN IF NOT EXISTS for existing tables)

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (id UUID PRIMARY KEY REFERENCES auth.users(id));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS plate_number TEXT UNIQUE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS make TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mileage INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_capacity INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_driver_id UUID REFERENCES user_profiles(id);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Trips
CREATE TABLE IF NOT EXISTS trips (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_number VARCHAR(50) UNIQUE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS truck_id UUID REFERENCES vehicles(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS revenue DECIMAL(15,2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Customers
CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number VARCHAR(50) UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (code VARCHAR(20) PRIMARY KEY);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS type VARCHAR(10);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(100);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) UNIQUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_number VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Maintenance Requests
CREATE TABLE IF NOT EXISTS maintenance_requests (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id);
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Spare Parts
CREATE TABLE IF NOT EXISTS spare_parts (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS table_name VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(20);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. DATA MIGRATIONS (Safe Dynamic SQL)

DO $$ 
BEGIN 
    -- Fix trip_number if it exists but is null
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='trip_number') THEN
        EXECUTE 'UPDATE trips SET trip_number = ''TRP-'' || TO_CHAR(COALESCE(created_at, NOW()), ''YYYYMMDD'') || ''-'' || SUBSTRING(id::text, 1, 4) WHERE trip_number IS NULL';
    END IF;

    -- Fix driver_id type if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='driver_id' AND data_type='text') THEN
        ALTER TABLE trips ALTER COLUMN driver_id TYPE UUID USING driver_id::UUID;
    END IF;
END $$;

-- 3. INDEXES (After all columns are guaranteed to exist)

CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_trips_number ON trips(trip_number);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);

-- 4. SEED DATA

INSERT INTO accounts (code, name, category, type) VALUES
('1000', 'ASSETS', 'ASSETS', 'debit'),
('1100', 'Current Assets', 'ASSETS', 'debit'),
('1101', 'Cash on Hand', 'ASSETS', 'debit'),
('1102', 'Bank Account', 'ASSETS', 'debit'),
('4000', 'REVENUE', 'REVENUE', 'credit'),
('4101', 'Local Transport Revenue', 'REVENUE', 'credit'),
('5000', 'COST OF SALES', 'COST_OF_SALES', 'debit'),
('5101', 'Fuel Expense', 'COST_OF_SALES', 'debit'),
('6000', 'OPERATING EXPENSES', 'OPERATING_EXPENSES', 'debit')
ON CONFLICT (code) DO NOTHING;

-- 5. RLS POLICIES (Reset)

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Operations can manage vehicles" ON vehicles;
DROP POLICY IF EXISTS "Authenticated users can view trips" ON trips;
DROP POLICY IF EXISTS "Operations can manage trips" ON trips;

CREATE POLICY "Admins have full access" ON user_profiles FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN'));
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Authenticated users can view vehicles" ON vehicles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Operations can manage vehicles" ON vehicles FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR'));
CREATE POLICY "Authenticated users can view trips" ON trips FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Operations can manage trips" ON trips FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN'));

COMMIT;
