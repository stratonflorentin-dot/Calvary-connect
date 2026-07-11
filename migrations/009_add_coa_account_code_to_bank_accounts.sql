-- Add coa_account_code column to bank_accounts table to link bank accounts to chart of accounts
-- This migration is idempotent and safe to run multiple times

-- First, check if the column exists before adding to avoid errors
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'bank_accounts'
          AND column_name = 'coa_account_code'
    ) THEN
        ALTER TABLE public.bank_accounts
        ADD COLUMN coa_account_code TEXT;
    END IF;
END $$;

-- Add a comment to explain the column's purpose
COMMENT ON COLUMN public.bank_accounts.coa_account_code IS 'Optional link to the Chart of Accounts account code (accounts table)';

-- Add a foreign key constraint to ensure referential integrity (only if accounts table exists)
-- We'll check for the accounts table first to make this safe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'accounts'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_name = 'bank_accounts_coa_account_code_fkey'
        ) THEN
            ALTER TABLE public.bank_accounts
            ADD CONSTRAINT bank_accounts_coa_account_code_fkey
            FOREIGN KEY (coa_account_code)
            REFERENCES public.accounts(code)
            ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Optional: Add an index to speed up queries by coa_account_code
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'bank_accounts'
          AND indexname = 'idx_bank_accounts_coa_account_code'
    ) THEN
        CREATE INDEX idx_bank_accounts_coa_account_code
        ON public.bank_accounts(coa_account_code);
    END IF;
END $$;
