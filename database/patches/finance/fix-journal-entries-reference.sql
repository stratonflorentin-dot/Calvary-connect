-- Fix: Add missing 'reference' column to journal_entries table
-- This allows the Journal Entry dialog to save reference data

-- Add the missing reference column
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS reference VARCHAR(100);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference 
ON journal_entries(reference);

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'journal_entries' 
ORDER BY ordinal_position;
