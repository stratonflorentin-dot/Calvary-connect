-- COMPLETE ACCOUNTING SETUP FOR LOGISTICS
-- Run this entire file in Supabase SQL Editor
-- DO NOT use \i commands - paste the full content

-- ============================================
-- PART 1: CREATE TABLES (from create_chart_of_accounts.sql)
-- ============================================

-- ACCOUNTS TABLE - Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    sub_category VARCHAR(50),
    type VARCHAR(20) NOT NULL,
    description TEXT,
    parent_code VARCHAR(20) REFERENCES accounts(code),
    is_active BOOLEAN DEFAULT true,
    is_bank_account BOOLEAN DEFAULT false,
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- JOURNAL ENTRIES TABLE
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_number VARCHAR(50) UNIQUE,
    entry_date DATE NOT NULL,
    reference VARCHAR(100), -- User-provided reference (e.g., Receipt #123)
    reference_type VARCHAR(50), -- System reference type (e.g., 'trip', 'invoice')
    reference_id UUID, -- System reference ID
    source VARCHAR(50), -- Source of entry (e.g., 'manual', 'auto', 'import')
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

-- JOURNAL ENTRY LINES
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

-- CLIENT BALANCES (AR AGING)
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

-- VENDOR BALANCES (AP)
CREATE TABLE IF NOT EXISTS vendor_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_name VARCHAR(100) NOT NULL,
    vendor_code VARCHAR(20) UNIQUE,
    vendor_type VARCHAR(50),
    total_billed DECIMAL(15, 2) DEFAULT 0,
    total_paid DECIMAL(15, 2) DEFAULT 0,
    current_balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRIP ACCOUNTING LINK
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

-- VEHICLE EXPENSE TRACKING
CREATE TABLE IF NOT EXISTS vehicle_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    expense_type VARCHAR(50) NOT NULL,
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

-- ROUTE PROFITABILITY
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
    avg_fuel_consumption DECIMAL(8, 2) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FUEL CONSUMPTION TRACKING
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
    consumption_per_km DECIMAL(6, 3),
    account_code VARCHAR(20) DEFAULT '5101',
    vendor_id UUID REFERENCES vendor_balances(id),
    receipt_url TEXT,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
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

-- TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- TRIGGERS (drop if exists first to prevent errors)
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_balances_updated_at ON client_balances;
CREATE TRIGGER update_client_balances_updated_at BEFORE UPDATE ON client_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_balances_updated_at ON vendor_balances;
CREATE TRIGGER update_vendor_balances_updated_at BEFORE UPDATE ON vendor_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_accounting_updated_at ON trip_accounting;
CREATE TRIGGER update_trip_accounting_updated_at BEFORE UPDATE ON trip_accounting
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 2: SEED ACCOUNTS (from seed_chart_of_accounts.sql)
-- ============================================

-- ASSETS (1000–1999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('1000', 'ASSETS', 'ASSETS', 'Total Assets', 'debit', 'Total Assets Group', NULL),
('1100', 'Current Assets', 'ASSETS', 'Current Assets', 'debit', 'Current Assets Group', '1000'),
('1101', 'Cash on Hand', 'ASSETS', 'Current Assets', 'debit', 'Cash in office', '1100'),
('1102', 'Bank Account', 'ASSETS', 'Current Assets', 'debit', 'Main bank account', '1100'),
('1103', 'Mobile Money Account', 'ASSETS', 'Current Assets', 'debit', 'M-Pesa, Tigo Pesa, Airtel Money', '1100'),
('1104', 'Accounts Receivable', 'ASSETS', 'Current Assets', 'debit', 'Client debts', '1100'),
('1105', 'Prepaid Expenses', 'ASSETS', 'Current Assets', 'debit', 'Insurance, licenses paid in advance', '1100'),
('1106', 'Fuel Inventory', 'ASSETS', 'Current Assets', 'debit', 'Stored fuel', '1100'),
('1107', 'Spare Parts Inventory', 'ASSETS', 'Current Assets', 'debit', 'Vehicle parts stock', '1100'),
('1108', 'VAT Receivable', 'ASSETS', 'Current Assets', 'debit', 'VAT to be claimed', '1100'),
('1200', 'Fixed Assets', 'ASSETS', 'Fixed Assets', 'debit', 'Fixed Assets Group', '1000'),
('1201', 'Trucks and Trailers', 'ASSETS', 'Fixed Assets', 'debit', 'Fleet vehicles', '1200'),
('1202', 'Motor Vehicles', 'ASSETS', 'Fixed Assets', 'debit', 'Staff and utility vehicles', '1200'),
('1203', 'Office Equipment', 'ASSETS', 'Fixed Assets', 'debit', 'Office furniture and machines', '1200'),
('1204', 'Computers and IT Equipment', 'ASSETS', 'Fixed Assets', 'debit', 'Laptops, servers, networking', '1200'),
('1205', 'Warehouse Equipment', 'ASSETS', 'Fixed Assets', 'debit', 'Forklifts, racks, etc.', '1200'),
('1206', 'Furniture and Fixtures', 'ASSETS', 'Fixed Assets', 'debit', 'Office and warehouse furniture', '1200'),
('1207', 'GPS Tracking Devices', 'ASSETS', 'Fixed Assets', 'debit', 'Tracking hardware', '1200'),
('1300', 'Accumulated Depreciation', 'ASSETS', 'Depreciation', 'credit', 'Depreciation Group', '1000'),
('1301', 'Accumulated Depreciation, Trucks', 'ASSETS', 'Depreciation', 'credit', 'Depreciation for Trucks', '1300'),
('1302', 'Accumulated Depreciation, Vehicles', 'ASSETS', 'Depreciation', 'credit', 'Depreciation for Vehicles', '1300'),
('1303', 'Accumulated Depreciation, Equipment', 'ASSETS', 'Depreciation', 'credit', 'Depreciation for Equipment', '1300')
ON CONFLICT (code) DO NOTHING;

-- LIABILITIES (2000–2999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('2000', 'LIABILITIES', 'LIABILITIES', 'Total Liabilities', 'credit', 'Total Liabilities Group', NULL),
('2100', 'Current Liabilities', 'LIABILITIES', 'Current Liabilities', 'credit', 'Short-term obligations', '2000'),
('2101', 'Accounts Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Supplier debts', '2100'),
('2102', 'Fuel Creditors', 'LIABILITIES', 'Current Liabilities', 'credit', 'Fuel station debts', '2100'),
('2103', 'Driver Allowances Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Owed to drivers', '2100'),
('2104', 'Salaries Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Owed to staff', '2100'),
('2105', 'Tax Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Income tax obligations', '2100'),
('2106', 'VAT Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'VAT to be paid', '2100'),
('2107', 'NHIF Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Health insurance contributions', '2100'),
('2108', 'NSSF Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Social security contributions', '2100'),
('2200', 'Long Term Liabilities', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'Long-term obligations', '2000'),
('2201', 'Truck Loan', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'Financing for trucks', '2200'),
('2202', 'Vehicle Financing', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'Financing for other vehicles', '2200'),
('2203', 'Bank Loan', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'General bank loans', '2200'),
('2204', 'Lease Obligations', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'Long-term leases', '2200')
ON CONFLICT (code) DO NOTHING;

-- EQUITY (3000–3999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('3000', 'EQUITY', 'EQUITY', 'Total Equity', 'credit', 'Total Equity Group', NULL),
('3101', 'Owner Capital', 'EQUITY', 'Equity', 'credit', 'Owner investment', '3000'),
('3102', 'Retained Earnings', 'EQUITY', 'Equity', 'credit', 'Past profits', '3000'),
('3103', 'Current Year Profit', 'EQUITY', 'Equity', 'credit', 'Profit for current period', '3000'),
('3104', 'Drawings', 'EQUITY', 'Equity', 'debit', 'Owner withdrawals', '3000')
ON CONFLICT (code) DO NOTHING;

-- REVENUE (4000–4999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('4000', 'REVENUE', 'REVENUE', 'Total Revenue', 'credit', 'Total Revenue Group', NULL),
('4101', 'Local Transport Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Local delivery income', '4000'),
('4102', 'Cross Border Transport Revenue', 'REVENUE', 'Core Revenue', 'credit', 'International freight income', '4000'),
('4103', 'Container Transport Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from container hauling', '4000'),
('4104', 'Loose Cargo Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from non-containerized cargo', '4000'),
('4105', 'Express Delivery Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from urgent deliveries', '4000'),
('4106', 'Warehousing Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Storage and warehouse income', '4000'),
('4107', 'Loading and Offloading Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Handling charges', '4000'),
('4108', 'Customs Clearing Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Customs documentation income', '4000'),
('4200', 'Other Income', 'REVENUE', 'Other Income', 'credit', 'Other Income Group', '4000'),
('4201', 'Fuel Surcharge Income', 'REVENUE', 'Other Income', 'credit', 'Fuel price adjustments', '4200'),
('4202', 'Commission Income', 'REVENUE', 'Other Income', 'credit', 'Brokerage or commission', '4200'),
('4203', 'Rental Income', 'REVENUE', 'Other Income', 'credit', 'Asset rental income', '4200'),
('4204', 'Other Operating Income', 'REVENUE', 'Other Income', 'credit', 'Miscellaneous operating income', '4200')
ON CONFLICT (code) DO NOTHING;

-- COST OF SALES / DIRECT LOGISTICS COSTS (5000–5999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('5000', 'COST OF SALES', 'COST_OF_SALES', 'Total Direct Costs', 'debit', 'Total Direct Costs Group', NULL),
('5101', 'Fuel Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Fuel costs', '5000'),
('5102', 'Driver Salaries', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Base driver pay', '5000'),
('5103', 'Driver Allowances', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Trip-based allowances', '5000'),
('5104', 'Truck Repairs', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Trip maintenance', '5000'),
('5105', 'Tire Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Tire replacement', '5000'),
('5106', 'Lubricants and Oil', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Engine oil, grease', '5000'),
('5107', 'Border and Port Charges', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Entry/exit fees', '5000'),
('5108', 'Cargo Handling Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Loading/unloading costs', '5000'),
('5109', 'Toll Fees', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Road tolls', '5000'),
('5110', 'Vehicle Insurance', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Trip insurance', '5000'),
('5111', 'GPS Tracking Costs', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Tracking subscription', '5000'),
('5112', 'Trip Loading Expenses', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Misc trip setup', '5000'),
('5113', 'Freight Subcontractor Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Payments to third-party carriers', '5000')
ON CONFLICT (code) DO NOTHING;

-- OPERATING EXPENSES (6000–6999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('6000', 'OPERATING EXPENSES', 'OPERATING_EXPENSES', 'Total Operating Expenses', 'debit', 'Total Operating Expenses Group', NULL),
('6101', 'Office Rent', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Office rent', '6000'),
('6102', 'Electricity and Water', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Utilities', '6000'),
('6103', 'Internet Expense', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Data costs', '6000'),
('6104', 'Telephone Expense', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Airtime and lines', '6000'),
('6105', 'Office Supplies', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Stationery, etc.', '6000'),
('6106', 'Cleaning Expense', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Office cleaning', '6000'),
('6107', 'Security Expense', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Security guards/systems', '6000'),
('6201', 'Office Salaries', 'OPERATING_EXPENSES', 'Personnel', 'debit', 'Admin staff pay', '6000'),
('6202', 'Staff Welfare', 'OPERATING_EXPENSES', 'Personnel', 'debit', 'Tea, lunch, etc.', '6000'),
('6203', 'Staff Training', 'OPERATING_EXPENSES', 'Personnel', 'debit', 'Capacity building', '6000'),
('6204', 'Recruitment Expense', 'OPERATING_EXPENSES', 'Personnel', 'debit', 'Hiring costs', '6000'),
('6301', 'Advertising Expense', 'OPERATING_EXPENSES', 'Marketing', 'debit', 'Promotions', '6000'),
('6302', 'Branding Expense', 'OPERATING_EXPENSES', 'Marketing', 'debit', 'Logo, signs, etc.', '6000'),
('6303', 'Website Expense', 'OPERATING_EXPENSES', 'Marketing', 'debit', 'Hosting and design', '6000'),
('6304', 'Social Media Marketing', 'OPERATING_EXPENSES', 'Marketing', 'debit', 'Ads on platforms', '6000'),
('6401', 'Legal Fees', 'OPERATING_EXPENSES', 'Professional', 'debit', 'Legal services', '6000'),
('6402', 'Audit Fees', 'OPERATING_EXPENSES', 'Professional', 'debit', 'Financial audits', '6000'),
('6403', 'Consultancy Fees', 'OPERATING_EXPENSES', 'Professional', 'debit', 'Expert advice', '6000'),
('6501', 'Bank Charges', 'OPERATING_EXPENSES', 'Financial', 'debit', 'Bank transaction fees', '6000'),
('6502', 'Loan Interest', 'OPERATING_EXPENSES', 'Financial', 'debit', 'Interest on loans', '6000'),
('6503', 'Foreign Exchange Loss', 'OPERATING_EXPENSES', 'Financial', 'debit', 'Currency fluctuations', '6000')
ON CONFLICT (code) DO NOTHING;

-- TAXES AND COMPLIANCE (7000–7999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('7000', 'TAXES AND COMPLIANCE', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'Total Taxes Group', NULL),
('7101', 'Corporate Tax Expense', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'Income tax', '7000'),
('7102', 'Withholding Tax', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'WHT obligations', '7000'),
('7103', 'Business License Fees', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'Annual licenses', '7000'),
('7104', 'Road License Fees', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'Vehicle licenses', '7000'),
('7105', 'Regulatory Compliance Fees', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'LATRA, etc.', '7000')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- PART 3: FUNCTIONS (from accounting_functions.sql)
-- ============================================

-- Generate journal entry number
CREATE OR REPLACE FUNCTION generate_entry_number()
RETURNS TEXT AS $$
DECLARE
    year TEXT;
    sequence_num INTEGER;
    entry_number TEXT;
BEGIN
    year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM journal_entries
    WHERE entry_number LIKE 'JE-' || year || '-%';
    entry_number := 'JE-' || year || '-' || LPAD(sequence_num::TEXT, 6, '0');
    RETURN entry_number;
END;
$$ LANGUAGE plpgsql;

-- Post journal entry
CREATE OR REPLACE FUNCTION post_journal_entry(entry_id UUID)
RETURNS VOID AS $$
DECLARE
    line RECORD;
BEGIN
    FOR line IN 
        SELECT account_code, debit_amount, credit_amount 
        FROM journal_entry_lines 
        WHERE journal_entry_id = entry_id
    LOOP
        UPDATE accounts
        SET current_balance = current_balance + line.debit_amount - line.credit_amount,
            updated_at = NOW()
        WHERE code = line.account_code;
    END LOOP;
    UPDATE journal_entries
    SET is_posted = true, posted_at = NOW()
    WHERE id = entry_id;
END;
$$ LANGUAGE plpgsql;

-- Create trip revenue entry
CREATE OR REPLACE FUNCTION create_trip_revenue_entry(
    p_trip_id UUID,
    p_revenue_amount DECIMAL,
    p_client_name TEXT,
    p_revenue_account TEXT DEFAULT '4101',
    p_ar_account TEXT DEFAULT '1104'
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
BEGIN
    v_entry_number := generate_entry_number();
    INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, total_debit, total_credit)
    VALUES (v_entry_number, CURRENT_DATE, 'TRIP', p_trip_id, 'Revenue from trip for ' || p_client_name, p_revenue_amount, p_revenue_amount)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, p_ar_account, p_revenue_amount, 0, 'Receivable from ' || p_client_name, 1);
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, p_revenue_account, 0, p_revenue_amount, 'Trip revenue', 2);
    
    PERFORM post_journal_entry(v_entry_id);
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Record client payment
CREATE OR REPLACE FUNCTION record_client_payment(
    p_client_name TEXT,
    p_amount DECIMAL,
    p_payment_method TEXT DEFAULT 'BANK'
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_cash_account TEXT;
BEGIN
    v_cash_account := CASE p_payment_method
        WHEN 'CASH' THEN '1101'
        WHEN 'MOBILE' THEN '1103'
        ELSE '1102'
    END;
    v_entry_number := generate_entry_number();
    INSERT INTO journal_entries (entry_number, entry_date, reference_type, description, total_debit, total_credit)
    VALUES (v_entry_number, CURRENT_DATE, 'PAYMENT', 'Payment received from ' || p_client_name, p_amount, p_amount)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, v_cash_account, p_amount, 0, 'Payment received', 1);
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '1104', 0, p_amount, 'From ' || p_client_name, 2);
    
    PERFORM post_journal_entry(v_entry_id);
    
    UPDATE client_balances
    SET total_paid = total_paid + p_amount,
        current_balance = current_balance - p_amount,
        last_payment_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE client_name = p_client_name;
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 4: VIEWS
-- ============================================

CREATE OR REPLACE VIEW trial_balance AS
SELECT 
    a.code,
    a.name,
    a.category,
    a.type,
    CASE WHEN a.type = 'debit' THEN a.current_balance ELSE 0 END as debit_balance,
    CASE WHEN a.type = 'credit' THEN -a.current_balance ELSE 0 END as credit_balance
FROM accounts a
WHERE a.is_active = true
ORDER BY a.code;

CREATE OR REPLACE VIEW profit_loss_summary AS
SELECT 
    'REVENUE' as section,
    SUM(CASE WHEN type = 'credit' THEN current_balance ELSE -current_balance END) as amount
FROM accounts WHERE category = 'REVENUE'
UNION ALL
SELECT 'COST_OF_SALES', SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END)
FROM accounts WHERE category = 'COST_OF_SALES'
UNION ALL
SELECT 'GROSS_PROFIT', 
    (SELECT SUM(CASE WHEN type = 'credit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'REVENUE')
    - (SELECT SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'COST_OF_SALES')
UNION ALL
SELECT 'OPERATING_EXPENSES', SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END)
FROM accounts WHERE category = 'OPERATING_EXPENSES'
UNION ALL
SELECT 'NET_PROFIT',
    (SELECT SUM(CASE WHEN type = 'credit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'REVENUE')
    - (SELECT SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'COST_OF_SALES')
    - (SELECT SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'OPERATING_EXPENSES');

-- ============================================
-- SETUP COMPLETE
-- ============================================
SELECT 'Chart of Accounts setup complete! Total accounts created: ' || COUNT(*) as status
FROM accounts;
