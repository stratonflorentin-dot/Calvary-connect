-- Final fix for missing tables and columns

-- Bank Accounts Table
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

-- Bank Statements Table
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

-- Add all missing columns to existing tables
DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    -- Check and add columns to invoices table
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoices') THEN
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='trip_id') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE invoices ADD COLUMN trip_id UUID REFERENCES trips(id); END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='vat_amount') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE invoices ADD COLUMN vat_amount DECIMAL(15, 2) DEFAULT 0; END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='amount') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE invoices ADD COLUMN amount DECIMAL(15, 2); END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_terms') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE invoices ADD COLUMN payment_terms VARCHAR(50); END IF;
    END IF;
    
    -- Check and add columns to expenses table
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN category VARCHAR(50) DEFAULT 'Other'; END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='expense_number') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN expense_number VARCHAR(50); END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='vendor_name') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN vendor_name VARCHAR(100); END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='vehicle_id') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN vehicle_id UUID REFERENCES vehicles(id); END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='trip_id') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN trip_id UUID REFERENCES trips(id); END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='receipt_url') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN receipt_url TEXT; END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='payment_method') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash'; END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='status') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN status VARCHAR(20) DEFAULT 'pending'; END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='approved_by') INTO col_exists;
        IF NOT col_exists THEN ALTER TABLE expenses ADD COLUMN approved_by UUID; END IF;
        
        SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='date') INTO col_exists;
        IF NOT col_exists THEN 
            -- Check if expense_date exists, rename it if so
            SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='expense_date') INTO col_exists;
            IF col_exists THEN
                ALTER TABLE expenses RENAME COLUMN expense_date TO date;
            ELSE
                ALTER TABLE expenses ADD COLUMN date DATE DEFAULT CURRENT_DATE;
            END IF;
        END IF;
    ELSE
        -- Create expenses table if it doesn't exist
        CREATE TABLE expenses (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            expense_number VARCHAR(50) UNIQUE NOT NULL,
            category VARCHAR(50) NOT NULL,
            description TEXT NOT NULL,
            amount DECIMAL(15, 2) NOT NULL,
            date DATE NOT NULL DEFAULT CURRENT_DATE,
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
    END IF;
    
    -- Note: User will create bank accounts through the UI
END $$;

-- Safe index creation using DO blocks
DO $$
BEGIN
    -- Only create indexes if columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='bank_account_id') THEN
        CREATE INDEX IF NOT EXISTS idx_bank_statements_account ON bank_statements(bank_account_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='transaction_date') THEN
        CREATE INDEX IF NOT EXISTS idx_bank_statements_date ON bank_statements(transaction_date);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='client_name') THEN
        CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_name);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='status') THEN
        CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='trip_id') THEN
        CREATE INDEX IF NOT EXISTS idx_invoices_trip ON invoices(trip_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='date') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='status') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
    END IF;
END $$;

-- Verify results
SELECT 
    table_name,
    string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name IN ('bank_accounts', 'bank_statements', 'invoices', 'expenses')
GROUP BY table_name
ORDER BY table_name;
