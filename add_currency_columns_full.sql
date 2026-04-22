-- ADD CURRENCY COLUMNS TO ALL LEDGER TABLES
-- Run this in Supabase SQL Editor

-- Add currency column to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
UPDATE invoices SET currency = 'TZS' WHERE currency IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency);

-- Add currency column to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
UPDATE expenses SET currency = 'TZS' WHERE currency IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_currency ON expenses(currency);

-- Add currency column to journal_entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
UPDATE journal_entries SET currency = 'TZS' WHERE currency IS NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_currency ON journal_entries(currency);

-- Add status column to journal_entries (for drafts)
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'posted';
UPDATE journal_entries SET status = 'posted' WHERE is_posted = true AND status IS NULL;
UPDATE journal_entries SET status = 'draft' WHERE is_posted = false AND status IS NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

SELECT 'Currency and status columns added to all tables' as status;
