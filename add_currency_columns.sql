-- ADD CURRENCY COLUMNS TO INVOICES AND EXPENSES TABLES
-- Run this in Supabase SQL Editor

-- Add currency column to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
UPDATE invoices SET currency = 'TZS' WHERE currency IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency);

-- Add currency column to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
UPDATE expenses SET currency = 'TZS' WHERE currency IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_currency ON expenses(currency);

SELECT 'Currency columns added to invoices and expenses tables' as status;
