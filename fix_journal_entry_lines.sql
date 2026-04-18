-- FIX: Add missing account_name column to journal_entry_lines
-- Run this in Supabase SQL Editor

-- Add account_name column if it doesn't exist
ALTER TABLE journal_entry_lines 
ADD COLUMN IF NOT EXISTS account_name VARCHAR(100);

-- Alternative: If you want to remove it from inserts instead, update the code
-- to not send account_name. The account name can be looked up via account_code.

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'journal_entry_lines';

SELECT 'journal_entry_lines column fix complete!' as status;
