-- Fix missing tables and columns for Financial Command Center

-- Bank Accounts Table (create if not exists)
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Bank Statements Table (create if not exists)
CREATE TABLE IF NOT EXISTS bank_statements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    debit_amount DECIMAL(15, 2),
    credit_amount DECIMAL(15, 2),
    balance DECIMAL(15, 2),
    transaction_type VARCHAR(50),
    reconciled BOOLEAN DEFAULT false,
    account_code VARCHAR(20) REFERENCES accounts(code),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices Table - create if not exists, or add missing columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoices') THEN
        CREATE TABLE invoices (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            invoice_number VARCHAR(50) UNIQUE NOT NULL,
            client_name VARCHAR(100) NOT NULL,
            client_id UUID,
            trip_id UUID REFERENCES trips(id),
            amount DECIMAL(15, 2) NOT NULL,
            vat_amount DECIMAL(15, 2) DEFAULT 0,
            total_amount DECIMAL(15, 2) NOT NULL,
            issue_date DATE NOT NULL,
            due_date DATE NOT NULL,
            status VARCHAR(20) DEFAULT 'draft',
            payment_terms VARCHAR(50),
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- Add missing columns to existing invoices table
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id);
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15, 2) DEFAULT 0;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2);
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50);
    END IF;
END $$;

-- Expenses Table - create if not exists, or add missing columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN
        CREATE TABLE expenses (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            expense_number VARCHAR(50) UNIQUE NOT NULL,
            category VARCHAR(50) NOT NULL,
            description TEXT NOT NULL,
            amount DECIMAL(15, 2) NOT NULL,
            date DATE NOT NULL,
            vendor_name VARCHAR(100),
            vehicle_id UUID REFERENCES vehicles(id),
            trip_id UUID REFERENCES trips(id),
            receipt_url TEXT,
            payment_method VARCHAR(20) DEFAULT 'cash',
            status VARCHAR(20) DEFAULT 'pending',
            approved_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- Add missing columns to existing expenses table
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Other';
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_number VARCHAR(50);
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(100);
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id);
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id);
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash';
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by UUID;
        
        -- Update any rows with NULL category
        UPDATE expenses SET category = 'Other' WHERE category IS NULL;
        
        -- Generate expense_number for existing rows if missing
        UPDATE expenses 
        SET expense_number = 'EXP-' || EXTRACT(YEAR FROM created_at) || '-' || SUBSTRING(id::text, 1, 8)
        WHERE expense_number IS NULL;
    END IF;
END $$;

-- Insert sample bank accounts (only if they don't exist)
INSERT INTO bank_accounts (account_name, account_number, bank_name, branch, account_type, currency, opening_balance, current_balance) 
SELECT * FROM (VALUES
    ('Main Operating Account', '1234567890', 'CRDB Bank', 'Dar es Salaam', 'current', 'TZS', 5000000, 5000000),
    ('USD Account', '0987654321', 'CRDB Bank', 'Dar es Salaam', 'current', 'USD', 10000, 10000),
    ('Petty Cash', 'PETTY001', 'Internal', 'Head Office', 'mobile_money', 'TZS', 500000, 500000)
) AS v(account_name, account_number, bank_name, branch, account_type, currency, opening_balance, current_balance)
WHERE NOT EXISTS (SELECT 1 FROM bank_accounts WHERE account_number = v.account_number);

-- Indexes (safe to create if not exists)
CREATE INDEX IF NOT EXISTS idx_bank_statements_account ON bank_statements(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_date ON bank_statements(transaction_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_name);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_trip ON invoices(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- Verify tables and columns
SELECT 
    table_name,
    string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name IN ('bank_accounts', 'bank_statements', 'invoices', 'expenses')
GROUP BY table_name
ORDER BY table_name;
