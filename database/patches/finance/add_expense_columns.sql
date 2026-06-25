-- ADD MISSING COLUMNS TO EXPENSES TABLE
-- Run this in Supabase SQL Editor

-- Add account_code column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_code VARCHAR(20);

-- Add payment_method column
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash';

-- Add journal_entry_id column (optional - for linking to journal entries)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS journal_entry_id UUID;

-- Add foreign key constraint (optional - only if you want strict referential integrity)
-- ALTER TABLE expenses ADD CONSTRAINT fk_expenses_account 
--     FOREIGN KEY (account_code) REFERENCES accounts(code);

-- Update RLS policies to allow the new columns
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_account_code ON expenses(account_code);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);

-- Status
SELECT 'Added columns to expenses table: account_code, payment_method, journal_entry_id' as status;
