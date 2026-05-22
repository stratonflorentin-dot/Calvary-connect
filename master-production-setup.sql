-- ==========================================================================
-- CALVARY CONNECT - MASTER PRODUCTION DATABASE SETUP
-- Version: 2026.05.22
-- Target: Supabase / PostgreSQL
-- ==========================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- 1. BASE TABLES (Users & Core Entities)

-- User Profiles (Integrated with Supabase Auth)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('CEO', 'ADMIN', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR', 'SALESMAN', 'WAREHOUSE_STAFF')),
    phone TEXT,
    avatar_url TEXT,
    employee_id TEXT,
    department TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited', 'pending')),
    status_reason TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles
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
    current_driver_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    insurance_expiry DATE,
    registration_expiry DATE,
    last_maintenance_date DATE,
    next_maintenance_due DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trailers (Specific extension of vehicles if needed, or use vehicles table with subtype)
-- For this schema, we use the vehicles table with 'TRAILER' type.

-- 2. CUSTOMERS & CRM

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(200) NOT NULL,
    trading_name VARCHAR(200),
    tax_id VARCHAR(50),
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    billing_address JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    credit_limit DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SALES & BOOKINGS

-- Rate Sheets
CREATE TABLE IF NOT EXISTS rate_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_name TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    service_type TEXT DEFAULT 'local_transport',
    container_20ft DECIMAL(15,2) DEFAULT 0,
    container_40ft DECIMAL(15,2) DEFAULT 0,
    loose_rate_mt DECIMAL(15,2) DEFAULT 0,
    transit_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quotations
CREATE TABLE IF NOT EXISTS route_quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    service_type TEXT DEFAULT 'local_transport',
    total_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
    notes TEXT,
    validity_days INTEGER DEFAULT 30,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES route_quotations(id) ON DELETE SET NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    cargo_type TEXT,
    cargo_weight DECIMAL(12,2),
    preferred_pickup_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'assigned', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. FLEET OPERATIONS (Trips)

CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_number VARCHAR(50) UNIQUE NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    driver_id UUID REFERENCES user_profiles(id),
    truck_id UUID REFERENCES vehicles(id),
    trailer_id UUID REFERENCES vehicles(id),
    booking_id UUID REFERENCES bookings(id),
    client_id UUID REFERENCES customers(id),
    cargo_type TEXT,
    cargo_weight REAL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
    revenue DECIMAL(15,2) DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. FINANCE & ACCOUNTING

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
    code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- ASSETS, LIABILITIES, EQUITY, REVENUE, COST_OF_SALES, OPERATING_EXPENSES, OTHER_EXPENSES
    sub_category VARCHAR(100),
    type VARCHAR(10) NOT NULL CHECK (type IN ('debit', 'credit')),
    description TEXT,
    parent_code VARCHAR(20) REFERENCES accounts(code),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    branch VARCHAR(100),
    account_type VARCHAR(50) DEFAULT 'current',
    currency VARCHAR(10) DEFAULT 'TZS',
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal Entries (Header)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    reference_type VARCHAR(50), -- TRIP, INVOICE, EXPENSE, PAYMENT, MANUAL
    reference_id UUID,
    total_debit DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_credit DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'posted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL REFERENCES accounts(code),
    debit_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    credit_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    description TEXT,
    line_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    client_id UUID REFERENCES customers(id),
    trip_id UUID REFERENCES trips(id),
    amount DECIMAL(15, 2) NOT NULL,
    vat_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    currency VARCHAR(10) DEFAULT 'TZS',
    description TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_number VARCHAR(50) UNIQUE,
    category VARCHAR(50) NOT NULL, -- Fuel, Maintenance, Spare Parts, Insurance, etc.
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_name VARCHAR(100),
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES user_profiles(id),
    trip_id UUID REFERENCES trips(id),
    receipt_url TEXT,
    payment_method VARCHAR(20) DEFAULT 'cash',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    approved_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank Statements (Transactions)
CREATE TABLE IF NOT EXISTS bank_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    balance DECIMAL(15, 2),
    reconciled BOOLEAN DEFAULT false,
    account_code VARCHAR(20) REFERENCES accounts(code),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. MAINTENANCE & INVENTORY

-- Maintenance Requests
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES user_profiles(id),
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REPORTED', 'DIAGNOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    estimated_cost DECIMAL(15,2),
    actual_cost DECIMAL(15,2),
    assigned_mechanic_id UUID REFERENCES user_profiles(id),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    truck_condition_after_service TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spare Parts
CREATE TABLE IF NOT EXISTS spare_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    part_number TEXT UNIQUE,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER DEFAULT 5,
    unit_price DECIMAL(15,2),
    supplier TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts Requests
CREATE TABLE IF NOT EXISTS parts_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID REFERENCES spare_parts(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES user_profiles(id),
    quantity INTEGER NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id),
    maintenance_request_id UUID REFERENCES maintenance_requests(id),
    urgency TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'COMPLETED')),
    approved_by UUID REFERENCES user_profiles(id),
    issued_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AUDIT & SYSTEM

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_name VARCHAR(100),
    user_role VARCHAR(50),
    action VARCHAR(20) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    change_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. INDEXES

CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_trips_number ON trips(trip_number);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_statements_account ON bank_statements(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_id ON journal_entry_lines(journal_entry_id);

-- 9. FUNCTIONS & TRIGGERS

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPC for logging audit changes
CREATE OR REPLACE FUNCTION log_audit_change(
    p_user_id UUID,
    p_user_name TEXT,
    p_user_role TEXT,
    p_action TEXT,
    p_table_name TEXT,
    p_record_id UUID,
    p_old_data JSONB,
    p_new_data JSONB,
    p_change_summary TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, user_name, user_role, action, table_name, 
        record_id, old_data, new_data, change_summary
    ) VALUES (
        p_user_id, p_user_name, p_user_role, p_action, p_table_name,
        p_record_id, p_old_data, p_new_data, p_change_summary
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. SEED DATA

-- Accounts
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('1000', 'ASSETS', 'ASSETS', 'Total Assets', 'debit', 'Total Assets Group'),
('1100', 'Current Assets', 'ASSETS', 'Current Assets', 'debit', 'Current Assets Group'),
('1101', 'Cash on Hand', 'ASSETS', 'Current Assets', 'debit', 'Cash in office'),
('1102', 'Bank Account', 'ASSETS', 'Current Assets', 'debit', 'Main bank account'),
('1103', 'Mobile Money Account', 'ASSETS', 'Current Assets', 'debit', 'M-Pesa, Tigo Pesa, Airtel Money'),
('1104', 'Accounts Receivable', 'ASSETS', 'Current Assets', 'debit', 'Client debts'),
('4000', 'REVENUE', 'REVENUE', 'Total Revenue', 'credit', 'Total Revenue Group'),
('4101', 'Local Transport Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Local delivery income'),
('5000', 'COST OF SALES', 'COST_OF_SALES', 'Total Direct Costs', 'debit', 'Total Direct Costs Group'),
('5101', 'Fuel Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Fuel costs'),
('6000', 'OPERATING EXPENSES', 'OPERATING_EXPENSES', 'Total Operating Expenses', 'debit', 'Total Operating Expenses Group'),
('6101', 'Office Rent', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Office rent')
ON CONFLICT (code) DO NOTHING;

-- 11. ROW LEVEL SECURITY (RLS)

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Basic Policies (CEO/ADMIN bypass)
CREATE POLICY "Admins have full access" ON user_profiles FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN'));
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view vehicles" ON vehicles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Operations can manage vehicles" ON vehicles FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR'));

CREATE POLICY "Authenticated users can view trips" ON trips FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Operations can manage trips" ON trips FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN'));

CREATE POLICY "Accounting can manage financial tables" ON invoices FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT'));
CREATE POLICY "Accounting can manage expenses" ON expenses FOR ALL USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'OPERATOR'));

COMMIT;
