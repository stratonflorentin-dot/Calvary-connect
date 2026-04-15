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
    reference_type VARCHAR(50),
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
    account_code VARCHAR(20) DEFAULT '5001',
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

-- TRIGGERS
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

-- ============================================
-- PART 2: SEED ACCOUNTS (from seed_chart_of_accounts.sql)
-- ============================================

-- ASSETS
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('1001', 'Petty Cash', 'ASSETS', 'Current Assets', 'debit', 'Cash on Hand for small expenses'),
('1002', 'Bank Account', 'ASSETS', 'Current Assets', 'debit', 'Main operating bank account'),
('1003', 'Mobile Money', 'ASSETS', 'Current Assets', 'debit', 'M-Pesa, Tigo Pesa, Airtel Money balances'),
('1100', 'Accounts Receivable', 'ASSETS', 'Current Assets', 'debit', 'Money owed by clients for services'),
('1101', 'Transit Receivables', 'ASSETS', 'Current Assets', 'debit', 'Outstanding payments for transit freight'),
('1102', 'Local Delivery Receivables', 'ASSETS', 'Current Assets', 'debit', 'Outstanding payments for local deliveries'),
('1200', 'Prepaid Expenses', 'ASSETS', 'Current Assets', 'debit', 'Insurance premiums, licenses paid in advance'),
('1300', 'Fuel Inventory', 'ASSETS', 'Current Assets', 'debit', 'Fuel stored for fleet operations'),
('1301', 'Spare Parts Inventory', 'ASSETS', 'Current Assets', 'debit', 'Vehicle spare parts in stock'),
('1500', 'Vehicles', 'ASSETS', 'Non-Current Assets', 'debit', 'Trucks, vans, and other fleet vehicles'),
('1501', 'Trailers', 'ASSETS', 'Non-Current Assets', 'debit', 'Trailer assets'),
('1502', 'Office Equipment', 'ASSETS', 'Non-Current Assets', 'debit', 'Office furniture and equipment'),
('1503', 'IT Systems', 'ASSETS', 'Non-Current Assets', 'debit', 'Computers, servers, software'),
('1600', 'Accumulated Depreciation', 'ASSETS', 'Non-Current Assets', 'credit', 'Total depreciation of fixed assets');

-- LIABILITIES
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('2001', 'Accounts Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Money owed to vendors and suppliers'),
('2002', 'Fuel Creditors', 'LIABILITIES', 'Current Liabilities', 'credit', 'Outstanding fuel payments'),
('2003', 'Driver Allowances Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Driver wages and allowances owed'),
('2004', 'Salaries Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Outstanding staff salaries'),
('2005', 'Taxes Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'VAT, PAYE, and other taxes owed'),
('2006', 'Customs Duties Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Import duties and customs fees owed'),
('2500', 'Vehicle Loans', 'LIABILITIES', 'Long-Term Liabilities', 'credit', 'Loans for vehicle purchases'),
('2501', 'Bank Loans', 'LIABILITIES', 'Long-Term Liabilities', 'credit', 'General bank loans and overdrafts');

-- EQUITY
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('3001', 'Owner Capital', 'EQUITY', 'Equity', 'credit', 'Owner investments in the business'),
('3002', 'Retained Earnings', 'EQUITY', 'Equity', 'credit', 'Accumulated profits retained in business'),
('3003', 'Drawings', 'EQUITY', 'Equity', 'debit', 'Owner withdrawals from business');

-- REVENUE
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('4001', 'Transit Freight Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from international transit freight'),
('4002', 'Local Delivery Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from local delivery services'),
('4003', 'Clearing & Forwarding Fees', 'REVENUE', 'Core Revenue', 'credit', 'Customs clearing and forwarding income'),
('4004', 'Warehousing Fees', 'REVENUE', 'Core Revenue', 'credit', 'Storage and warehousing charges'),
('4100', 'Fuel Surcharge Income', 'REVENUE', 'Other Income', 'credit', 'Additional charges for fuel price fluctuations'),
('4101', 'Demurrage Charges', 'REVENUE', 'Other Income', 'credit', 'Charges for delays at loading/unloading'),
('4102', 'Late Delivery Penalties Collected', 'REVENUE', 'Other Income', 'credit', 'Penalties charged for late deliveries');

-- COST OF SALES
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('5001', 'Fuel Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Fuel costs directly tied to trips'),
('5002', 'Driver Wages - Trip Based', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Driver payments per trip'),
('5003', 'Turnboy/Assistant Wages', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Assistant crew wages for trips'),
('5004', 'Tolls & Road Charges', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Highway tolls and road fees'),
('5005', 'Vehicle Maintenance - Trip', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Maintenance costs directly from trips'),
('5006', 'Customs Clearing Costs', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Customs fees for transit goods'),
('5007', 'Insurance per Trip', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Insurance costs allocated per trip');

-- OPERATING EXPENSES
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('6001', 'Salaries - Office Staff', 'OPERATING_EXPENSES', 'Admin Expenses', 'debit', 'Office and administrative staff salaries'),
('6002', 'Rent', 'OPERATING_EXPENSES', 'Admin Expenses', 'debit', 'Office and warehouse rent'),
('6003', 'Utilities', 'OPERATING_EXPENSES', 'Admin Expenses', 'debit', 'Electricity, water, and other utilities'),
('6004', 'Internet & Software', 'OPERATING_EXPENSES', 'Admin Expenses', 'debit', 'Internet, software subscriptions, licenses'),
('6100', 'Vehicle Repairs & Maintenance', 'OPERATING_EXPENSES', 'Transport Overheads', 'debit', 'General fleet maintenance and repairs'),
('6101', 'Insurance - Annual', 'OPERATING_EXPENSES', 'Transport Overheads', 'debit', 'Annual vehicle and business insurance'),
('6102', 'Licensing & Permits', 'OPERATING_EXPENSES', 'Transport Overheads', 'debit', 'Vehicle licenses, road permits, certifications'),
('6103', 'Tracking System Costs', 'OPERATING_EXPENSES', 'Transport Overheads', 'debit', 'GPS tracking and fleet management systems'),
('6200', 'Marketing & Advertising', 'OPERATING_EXPENSES', 'Sales & Marketing', 'debit', 'Advertising, promotions, website'),
('6201', 'Client Entertainment', 'OPERATING_EXPENSES', 'Sales & Marketing', 'debit', 'Client meetings, entertainment expenses');

-- OTHER EXPENSES
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('7001', 'Bank Charges', 'OTHER_EXPENSES', 'Financial', 'debit', 'Bank fees, transaction charges'),
('7002', 'Interest Expense', 'OTHER_EXPENSES', 'Financial', 'debit', 'Interest on loans and overdrafts'),
('7003', 'Fines & Penalties', 'OTHER_EXPENSES', 'Financial', 'debit', 'Traffic fines, regulatory penalties'),
('7004', 'Loss on Damaged Goods', 'OTHER_EXPENSES', 'Financial', 'debit', 'Claims paid for damaged cargo');

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
    p_revenue_account TEXT DEFAULT '4002',
    p_ar_account TEXT DEFAULT '1100'
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
        WHEN 'CASH' THEN '1001'
        WHEN 'MOBILE' THEN '1003'
        ELSE '1002'
    END;
    v_entry_number := generate_entry_number();
    INSERT INTO journal_entries (entry_number, entry_date, reference_type, description, total_debit, total_credit)
    VALUES (v_entry_number, CURRENT_DATE, 'PAYMENT', 'Payment received from ' || p_client_name, p_amount, p_amount)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, v_cash_account, p_amount, 0, 'Payment received', 1);
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '1100', 0, p_amount, 'From ' || p_client_name, 2);
    
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
