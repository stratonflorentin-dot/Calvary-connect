-- ADD CURRENCY COLUMN TO ACCOUNTS TABLE
-- Run this in Supabase SQL Editor

-- Add currency column with default TZS
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';

-- Update existing accounts to TZS
UPDATE accounts SET currency = 'TZS' WHERE currency IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_currency ON accounts(currency);

SELECT 'Currency column added to accounts table' as status;
