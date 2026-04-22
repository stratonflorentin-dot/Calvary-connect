-- ADD CURRENCY COLUMN TO INVOICES TABLE
-- Run this in Supabase SQL Editor

-- Add currency column with default TZS
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';

-- Update existing invoices to TZS
UPDATE invoices SET currency = 'TZS' WHERE currency IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency);

SELECT 'Currency column added to invoices table' as status;
