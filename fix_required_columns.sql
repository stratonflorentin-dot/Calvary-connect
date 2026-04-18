-- FIX REQUIRED COLUMN CONSTRAINTS
-- Run this in Supabase SQL Editor

-- Fix 1: Add default to expenses.type or make it nullable
ALTER TABLE expenses ALTER COLUMN type DROP NOT NULL;
-- OR add default:
-- ALTER TABLE expenses ALTER COLUMN type SET DEFAULT 'OTHER';

-- Fix 2: Check if invoices has 'items' column and fix it
DO $$
BEGIN
    -- Check if items column exists in invoices
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'items'
    ) THEN
        -- Make it nullable
        ALTER TABLE invoices ALTER COLUMN items DROP NOT NULL;
        RAISE NOTICE 'Made items column nullable in invoices';
    END IF;
    
    -- Also check for 'type' column in invoices (some schemas have this)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'type'
    ) THEN
        ALTER TABLE invoices ALTER COLUMN type DROP NOT NULL;
        RAISE NOTICE 'Made type column nullable in invoices';
    END IF;
END $$;

-- Alternative: Add defaults instead of making nullable
-- ALTER TABLE expenses ALTER COLUMN type SET DEFAULT 'OTHER';
-- ALTER TABLE invoices ALTER COLUMN items SET DEFAULT '[]'::jsonb;

-- Verify the changes
SELECT 
    table_name, 
    column_name, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('invoices', 'expenses') 
AND column_name IN ('type', 'items')
ORDER BY table_name, column_name;

SELECT 'Required column constraints fixed!' as status;
