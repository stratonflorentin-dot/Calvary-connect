-- FIX MISSING COLUMNS ERROR
-- Run this in Supabase SQL Editor to add missing columns

-- Add description column to invoices table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'description'
    ) THEN
        ALTER TABLE invoices ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column to invoices table';
    ELSE
        RAISE NOTICE 'description column already exists in invoices';
    END IF;
END $$;

-- Add source column to journal_entries table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'journal_entries' AND column_name = 'source'
    ) THEN
        ALTER TABLE journal_entries ADD COLUMN source VARCHAR(50);
        RAISE NOTICE 'Added source column to journal_entries table';
    ELSE
        RAISE NOTICE 'source column already exists in journal_entries';
    END IF;
END $$;

-- Also add missing columns commonly needed

-- Add invoice_number to invoices if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'invoice_number'
    ) THEN
        ALTER TABLE invoices ADD COLUMN invoice_number VARCHAR(50) UNIQUE;
        RAISE NOTICE 'Added invoice_number column to invoices';
    END IF;
END $$;

-- Add vat_amount and total_amount to invoices if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'vat_amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN vat_amount NUMERIC DEFAULT 0;
        RAISE NOTICE 'Added vat_amount column to invoices';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN total_amount NUMERIC;
        RAISE NOTICE 'Added total_amount column to invoices';
    END IF;
END $$;

-- Add trip_id to invoices if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'trip_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN trip_id UUID;
        RAISE NOTICE 'Added trip_id column to invoices';
    END IF;
END $$;

-- Add issue_date to invoices if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'issue_date'
    ) THEN
        ALTER TABLE invoices ADD COLUMN issue_date DATE DEFAULT CURRENT_DATE;
        RAISE NOTICE 'Added issue_date column to invoices';
    END IF;
END $$;

-- Update existing invoices to set total_amount if null
UPDATE invoices SET total_amount = amount + COALESCE(vat_amount, 0) WHERE total_amount IS NULL;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Missing columns fix complete!' as status;
