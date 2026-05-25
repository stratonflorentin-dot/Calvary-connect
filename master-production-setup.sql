-- ==========================================================================
-- CALVARY CONNECT - MASTER PRODUCTION DATABASE SETUP (VERSION 5.0)
-- Version: 2026.05.22.v5
-- Target: Supabase / PostgreSQL
-- Improvements: Guaranteed 'created_at' for ALL tables + Reordered for safety
-- ==========================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CORE SCHEMA (Using ADD COLUMN IF NOT EXISTS for existing tables)
-- We execute these without a single global transaction to prevent timeouts in Supabase SQL Editor.

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (id UUID PRIMARY KEY REFERENCES auth.users(id));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS license_expiry DATE;
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
ALTER TABLE trips ADD COLUMN IF NOT EXISTS price DECIMAL(15,2) DEFAULT 0;
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

-- Accounts (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (code VARCHAR(20) PRIMARY KEY);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS type VARCHAR(10);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS "group" VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(100);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS swift_code VARCHAR(20);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Bank Statements / Transactions
CREATE TABLE IF NOT EXISTS bank_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('credit', 'debit')),
    ref VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    reference_number VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(20) REFERENCES accounts(code),
    account_name VARCHAR(100),
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) UNIQUE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'receivable';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_cross_border BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS linked_revenue UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS linked_expense UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Sales / Revenue
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE DEFAULT CURRENT_DATE,
    client VARCHAR(200),
    description TEXT,
    amount DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    cargo_type VARCHAR(50),
    is_cross_border BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE DEFAULT CURRENT_DATE,
    vendor VARCHAR(200),
    description TEXT,
    amount DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_number VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor VARCHAR(200);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_cross_border BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS border_point VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fuel Requests
CREATE TABLE IF NOT EXISTS fuel_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES user_profiles(id),
    driver_name VARCHAR(200),
    amount DECIMAL(15, 2),
    fuel_type VARCHAR(50),
    station_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver Allowances
CREATE TABLE IF NOT EXISTS allowances (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES user_profiles(id);
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS worker_name VARCHAR(200);
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id);
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2);
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Taxes
CREATE TABLE IF NOT EXISTS taxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_name VARCHAR(100),
    type VARCHAR(50),
    amount DECIMAL(15, 2),
    due_date DATE,
    period VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maintenance Requests
CREATE TABLE IF NOT EXISTS maintenance_requests (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id);
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(15, 2);
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Spare Parts
CREATE TABLE IF NOT EXISTS spare_parts (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Parts Requests
CREATE TABLE IF NOT EXISTS parts_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID REFERENCES spare_parts(id),
    vehicle_id UUID REFERENCES vehicles(id),
    quantity_requested INTEGER,
    urgency VARCHAR(20),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200),
    description TEXT,
    date TIMESTAMP WITH TIME ZONE,
    participants JSONB, -- Array of participant names or IDs
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Reviews
CREATE TABLE IF NOT EXISTS performance_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES user_profiles(id),
    rating INTEGER,
    review_text TEXT,
    goals TEXT,
    review_date DATE,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insurance Policies
CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_name VARCHAR(200),
    policy_type VARCHAR(50),
    insurance_company VARCHAR(200),
    policy_number VARCHAR(100),
    premium_amount DECIMAL(15, 2),
    coverage_amount DECIMAL(15, 2),
    start_date DATE,
    end_date DATE,
    renewal_date DATE,
    vehicle_id UUID REFERENCES vehicles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200),
    type VARCHAR(50),
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS table_name VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(20);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(200);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
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

-- 4. SEED DATA (Executed in smaller chunks if needed, but keeping grouped for now)

INSERT INTO accounts (code, name, category, type) VALUES
-- 1000 ASSETS
('1000', 'ASSETS', 'ASSETS', 'debit'),
('1100', 'Current Assets', 'ASSETS', 'debit'),
('1101', 'Cash on Hand', 'ASSETS', 'debit'),
('1102', 'Bank Account', 'ASSETS', 'debit'),
('1103', 'Mobile Money Account', 'ASSETS', 'debit'),
('1104', 'Accounts Receivable', 'ASSETS', 'debit'),
('1105', 'Prepaid Expenses', 'ASSETS', 'debit'),
('1106', 'Fuel Inventory', 'ASSETS', 'debit'),
('1107', 'Spare Parts Inventory', 'ASSETS', 'debit'),
('1108', 'VAT Receivable', 'ASSETS', 'debit'),
('1200', 'Fixed Assets', 'ASSETS', 'debit'),
('1201', 'Trucks and Trailers', 'ASSETS', 'debit'),
('1202', 'Motor Vehicles', 'ASSETS', 'debit'),
('1203', 'Office Equipment', 'ASSETS', 'debit'),
('1204', 'Computers and IT Equipment', 'ASSETS', 'debit'),
('1205', 'Warehouse Equipment', 'ASSETS', 'debit'),
('1206', 'Furniture and Fixtures', 'ASSETS', 'debit'),
('1207', 'GPS Tracking Devices', 'ASSETS', 'debit'),
('1300', 'Accumulated Depreciation', 'ASSETS', 'credit'),
('1301', 'Accumulated Depreciation, Trucks', 'ASSETS', 'credit'),
('1302', 'Accumulated Depreciation, Vehicles', 'ASSETS', 'credit'),
('1303', 'Accumulated Depreciation, Equipment', 'ASSETS', 'credit'),

-- 2000 LIABILITIES
('2000', 'LIABILITIES', 'LIABILITIES', 'credit'),
('2100', 'Current Liabilities', 'LIABILITIES', 'credit'),
('2101', 'Accounts Payable', 'LIABILITIES', 'credit'),
('2102', 'Fuel Creditors', 'LIABILITIES', 'credit'),
('2103', 'Driver Allowances Payable', 'LIABILITIES', 'credit'),
('2104', 'Salaries Payable', 'LIABILITIES', 'credit'),
('2105', 'Tax Payable', 'LIABILITIES', 'credit'),
('2106', 'VAT Payable', 'LIABILITIES', 'credit'),
('2107', 'NHIF Payable', 'LIABILITIES', 'credit'),
('2108', 'NSSF Payable', 'LIABILITIES', 'credit'),
('2200', 'Long Term Liabilities', 'LIABILITIES', 'credit'),
('2201', 'Truck Loan', 'LIABILITIES', 'credit'),
('2202', 'Vehicle Financing', 'LIABILITIES', 'credit'),
('2203', 'Bank Loan', 'LIABILITIES', 'credit'),
('2204', 'Lease Obligations', 'LIABILITIES', 'credit'),

-- 3000 EQUITY
('3000', 'EQUITY', 'EQUITY', 'credit'),
('3101', 'Owner Capital', 'EQUITY', 'credit'),
('3102', 'Retained Earnings', 'EQUITY', 'credit'),
('3103', 'Current Year Profit', 'EQUITY', 'credit'),
('3104', 'Drawings', 'EQUITY', 'debit'),

-- 4000 REVENUE
('4000', 'REVENUE', 'REVENUE', 'credit'),
('4101', 'Local Transport Revenue', 'REVENUE', 'credit'),
('4102', 'Cross Border Transport Revenue', 'REVENUE', 'credit'),
('4103', 'Container Transport Revenue', 'REVENUE', 'credit'),
('4104', 'Loose Cargo Revenue', 'REVENUE', 'credit'),
('4105', 'Express Delivery Revenue', 'REVENUE', 'credit'),
('4106', 'Warehousing Revenue', 'REVENUE', 'credit'),
('4107', 'Loading and Offloading Revenue', 'REVENUE', 'credit'),
('4108', 'Customs Clearing Revenue', 'REVENUE', 'credit'),
('4200', 'Other Income', 'REVENUE', 'credit'),
('4201', 'Fuel Surcharge Income', 'REVENUE', 'credit'),
('4202', 'Commission Income', 'REVENUE', 'credit'),
('4203', 'Rental Income', 'REVENUE', 'credit'),
('4204', 'Other Operating Income', 'REVENUE', 'credit'),

-- 5000 COST OF SALES
('5000', 'COST OF SALES / DIRECT LOGISTICS COSTS', 'COST_OF_SALES', 'debit'),
('5101', 'Fuel Expense', 'COST_OF_SALES', 'debit'),
('5102', 'Driver Salaries', 'COST_OF_SALES', 'debit'),
('5103', 'Driver Allowances', 'COST_OF_SALES', 'debit'),
('5104', 'Truck Repairs', 'COST_OF_SALES', 'debit'),
('5105', 'Tire Expense', 'COST_OF_SALES', 'debit'),
('5106', 'Lubricants and Oil', 'COST_OF_SALES', 'debit'),
('5107', 'Border and Port Charges', 'COST_OF_SALES', 'debit'),
('5108', 'Cargo Handling Expense', 'COST_OF_SALES', 'debit'),
('5109', 'Toll Fees', 'COST_OF_SALES', 'debit'),
('5110', 'Vehicle Insurance', 'COST_OF_SALES', 'debit'),
('5111', 'GPS Tracking Costs', 'COST_OF_SALES', 'debit'),
('5112', 'Trip Loading Expenses', 'COST_OF_SALES', 'debit'),
('5113', 'Freight Subcontractor Expense', 'COST_OF_SALES', 'debit'),

-- 6000 OPERATING EXPENSES
('6000', 'OPERATING EXPENSES', 'OPERATING_EXPENSES', 'debit'),
('6101', 'Office Rent', 'OPERATING_EXPENSES', 'debit'),
('6102', 'Electricity and Water', 'OPERATING_EXPENSES', 'debit'),
('6103', 'Internet Expense', 'OPERATING_EXPENSES', 'debit'),
('6104', 'Telephone Expense', 'OPERATING_EXPENSES', 'debit'),
('6105', 'Office Supplies', 'OPERATING_EXPENSES', 'debit'),
('6106', 'Cleaning Expense', 'OPERATING_EXPENSES', 'debit'),
('6107', 'Security Expense', 'OPERATING_EXPENSES', 'debit'),
('6201', 'Office Salaries', 'OPERATING_EXPENSES', 'debit'),
('6202', 'Staff Welfare', 'OPERATING_EXPENSES', 'debit'),
('6203', 'Staff Training', 'OPERATING_EXPENSES', 'debit'),
('6204', 'Recruitment Expense', 'OPERATING_EXPENSES', 'debit'),
('6301', 'Advertising Expense', 'OPERATING_EXPENSES', 'debit'),
('6302', 'Branding Expense', 'OPERATING_EXPENSES', 'debit'),
('6303', 'Website Expense', 'OPERATING_EXPENSES', 'debit'),
('6401', 'Legal Fees', 'OPERATING_EXPENSES', 'debit'),
('6402', 'Audit Fees', 'OPERATING_EXPENSES', 'debit'),
('6403', 'Consultancy Fees', 'OPERATING_EXPENSES', 'debit'),
('6501', 'Bank Charges', 'OPERATING_EXPENSES', 'debit'),
('6502', 'Loan Interest', 'OPERATING_EXPENSES', 'debit'),
('6503', 'Foreign Exchange Loss', 'OPERATING_EXPENSES', 'debit'),

-- 7000 TAXES AND COMPLIANCE
('7000', 'TAXES AND COMPLIANCE', 'TAXES_AND_COMPLIANCE', 'debit'),
('7101', 'Corporate Tax Expense', 'TAXES_AND_COMPLIANCE', 'debit'),
('7102', 'Withholding Tax', 'TAXES_AND_COMPLIANCE', 'debit'),
('7103', 'Business License Fees', 'TAXES_AND_COMPLIANCE', 'debit'),
('7104', 'Road License Fees', 'TAXES_AND_COMPLIANCE', 'debit'),
('7105', 'Regulatory Compliance Fees', 'TAXES_AND_COMPLIANCE', 'debit')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    type = EXCLUDED.type;

-- 5. RLS POLICIES (Comprehensive)

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- DROP ALL EXISTING POLICIES FOR CLEAN RESET
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- ADMIN BYPASS (CEO, ADMIN, HR have full access to everything)
-- Note: In Supabase, you can't easily write one policy for all tables, so we define them per table.

-- USER PROFILES
CREATE POLICY "Admin full access" ON user_profiles FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'HR'));
CREATE POLICY "Users view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- VEHICLES
CREATE POLICY "Admin manage vehicles" ON vehicles FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'HR'));
CREATE POLICY "Public view vehicles" ON vehicles FOR SELECT USING (true);

-- TRIPS
CREATE POLICY "Admin manage trips" ON trips FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'HR', 'SALESMAN'));
CREATE POLICY "Public view trips" ON trips FOR SELECT USING (true);

-- FINANCE (Expenses, Invoices, Bank, Accounts, Sales, Taxes)
CREATE POLICY "Admin manage finance" ON expenses FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR', 'OPERATOR'));
CREATE POLICY "Admin manage invoices" ON invoices FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage bank" ON bank_accounts FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage bank statements" ON bank_statements FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage coa" ON accounts FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage journal" ON journal_entries FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage journal lines" ON journal_entry_lines FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage sales" ON sales FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage purchases" ON purchases FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage taxes" ON taxes FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR'));

-- OPERATIONS (Fuel, Allowances, Maintenance, Parts)
CREATE POLICY "Admin manage fuel" ON fuel_requests FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT'));
CREATE POLICY "Admin manage allowances" ON allowances FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'HR'));
CREATE POLICY "Admin manage maintenance" ON maintenance_requests FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'));
CREATE POLICY "Admin manage spare parts" ON spare_parts FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'));
CREATE POLICY "Admin manage parts requests" ON parts_requests FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'));

-- HR & PERFORMANCE
CREATE POLICY "Admin manage meetings" ON meetings FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'HR'));
CREATE POLICY "Admin manage performance" ON performance_reviews FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'HR'));
CREATE POLICY "Admin manage insurance" ON insurance_policies FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'HR'));
CREATE POLICY "Admin manage reports" ON reports FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'HR', 'ACCOUNTANT'));

-- AUDIT LOGS
CREATE POLICY "Admin view audit logs" ON audit_logs FOR SELECT USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'HR'));
CREATE POLICY "System insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);

-- 6. STORAGE SETUP (Avatars)

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Avatar Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "User Upload Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "User Update Avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
