-- Chart of Accounts (COA) for Logistics Operations
-- Run this migration to create the accounting schema

-- 1. ACCOUNTS TABLE - Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- ASSETS, LIABILITIES, EQUITY, REVENUE, COST_OF_SALES, OPERATING_EXPENSES, OTHER_EXPENSES
    sub_category VARCHAR(50), -- Current Assets, Non-Current Assets, etc.
    type VARCHAR(20) NOT NULL, -- debit or credit normal balance
    description TEXT,
    parent_code VARCHAR(20) REFERENCES accounts(code),
    is_active BOOLEAN DEFAULT true,
    is_bank_account BOOLEAN DEFAULT false,
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. JOURNAL ENTRIES TABLE
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_number VARCHAR(50) UNIQUE,
    entry_date DATE NOT NULL,
    reference_type VARCHAR(50), -- TRIP, INVOICE, PAYMENT, EXPENSE, etc.
    reference_id UUID,
    description TEXT NOT NULL,
    notes TEXT,
    total_debit DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_credit DECIMAL(15, 2) NOT NULL DEFAULT 0,
    is_posted BOOLEAN DEFAULT false,
    posted_at TIMESTAMP WITH TIME ZONE,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. JOURNAL ENTRY LINES (Individual debits/credits)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL REFERENCES accounts(code),
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    description TEXT,
    line_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CLIENT ACCOUNTS RECEIVABLE AGING
CREATE TABLE IF NOT EXISTS client_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(100) NOT NULL,
    client_code VARCHAR(20) UNIQUE,
    total_invoiced DECIMAL(15, 2) DEFAULT 0,
    total_paid DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    days_30 DECIMAL(15, 2) DEFAULT 0,
    days_60 DECIMAL(15, 2) DEFAULT 0,
    days_90 DECIMAL(15, 2) DEFAULT 0,
    days_90_plus DECIMAL(15, 2) DEFAULT 0,
    last_payment_date DATE,
    last_invoice_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. VENDOR ACCOUNTS PAYABLE
CREATE TABLE IF NOT EXISTS vendor_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_name VARCHAR(100) NOT NULL,
    vendor_code VARCHAR(20) UNIQUE,
    vendor_type VARCHAR(50), -- FUEL_SUPPLIER, MAINTENANCE, INSURANCE, etc.
    total_billed DECIMAL(15, 2) DEFAULT 0,
    total_paid DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TRIP ACCOUNTING LINK
CREATE TABLE IF NOT EXISTS trip_accounting (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    revenue_account_code VARCHAR(20) REFERENCES accounts(code),
    cost_account_code VARCHAR(20) REFERENCES accounts(code),
    revenue_amount DECIMAL(15, 2) DEFAULT 0,
    direct_costs DECIMAL(15, 2) DEFAULT 0,
    fuel_cost DECIMAL(15, 2) DEFAULT 0,
    driver_wages DECIMAL(15, 2) DEFAULT 0,
    tolls DECIMAL(15, 2) DEFAULT 0,
    maintenance_cost DECIMAL(15, 2) DEFAULT 0,
    profit_amount DECIMAL(15, 2) DEFAULT 0,
    profit_margin_percent DECIMAL(5, 2) DEFAULT 0,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. VEHICLE EXPENSE TRACKING
CREATE TABLE IF NOT EXISTS vehicle_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    expense_type VARCHAR(50) NOT NULL, -- FUEL, MAINTENANCE, INSURANCE, LICENSE, REPAIR, TIRES
    expense_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    account_code VARCHAR(20) REFERENCES accounts(code),
    vendor_id UUID REFERENCES vendor_balances(id),
    description TEXT,
    trip_id UUID REFERENCES trips(id),
    receipt_url TEXT,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. ROUTE PROFITABILITY
CREATE TABLE IF NOT EXISTS route_profitability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    route_code VARCHAR(20) UNIQUE,
    total_trips INTEGER DEFAULT 0,
    total_revenue DECIMAL(15, 2) DEFAULT 0,
    total_fuel_cost DECIMAL(15, 2) DEFAULT 0,
    total_driver_costs DECIMAL(15, 2) DEFAULT 0,
    total_tolls DECIMAL(15, 2) DEFAULT 0,
    total_maintenance DECIMAL(15, 2) DEFAULT 0,
    total_profit DECIMAL(15, 2) DEFAULT 0,
    avg_profit_per_trip DECIMAL(15, 2) DEFAULT 0,
    avg_fuel_consumption DECIMAL(8, 2) DEFAULT 0, -- liters per km
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. FUEL CONSUMPTION TRACKING
CREATE TABLE IF NOT EXISTS fuel_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id),
    fuel_date DATE NOT NULL,
    liters DECIMAL(10, 2) NOT NULL,
    cost_per_liter DECIMAL(8, 2) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    odometer_reading INTEGER,
    distance_km INTEGER,
    consumption_per_km DECIMAL(6, 3), -- liters/km
    account_code VARCHAR(20) DEFAULT '5001',
    vendor_id UUID REFERENCES vendor_balances(id),
    receipt_url TEXT,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_category ON accounts(category);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(account_code);
CREATE INDEX IF NOT EXISTS idx_trip_accounting_trip ON trip_accounting(trip_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_vehicle ON vehicle_expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_date ON vehicle_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_fuel_tracking_vehicle ON fuel_tracking(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_tracking_date ON fuel_tracking(fuel_date);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_balances_updated_at BEFORE UPDATE ON client_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_balances_updated_at BEFORE UPDATE ON vendor_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trip_accounting_updated_at BEFORE UPDATE ON trip_accounting
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
