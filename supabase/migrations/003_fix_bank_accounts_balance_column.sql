-- Fix bank_accounts column naming inconsistency
-- The application code uses both 'balance' and 'current_balance'
-- We'll add 'balance' as an alias for 'current_balance' using a generated column

-- First, check if balance column already exists and drop it if it does (as a regular column)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'bank_accounts' 
        AND column_name = 'balance'
    ) THEN
        ALTER TABLE bank_accounts DROP COLUMN balance;
    END IF;
END $$;

-- Add balance as a generated column that mirrors current_balance
ALTER TABLE bank_accounts 
ADD COLUMN balance NUMERIC DEFAULT 0;

-- Create a trigger to keep balance and current_balance in sync
CREATE OR REPLACE FUNCTION sync_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- When current_balance changes, update balance
    IF TG_OP = 'UPDATE' AND NEW.current_balance IS DISTINCT FROM OLD.current_balance THEN
        NEW.balance := NEW.current_balance;
    -- When balance changes, update current_balance
    ELSIF TG_OP = 'UPDATE' AND NEW.balance IS DISTINCT FROM OLD.balance THEN
        NEW.current_balance := NEW.balance;
    -- On insert, ensure both are set
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.current_balance IS NULL AND NEW.balance IS NOT NULL THEN
            NEW.current_balance := NEW.balance;
        ELSIF NEW.balance IS NULL AND NEW.current_balance IS NOT NULL THEN
            NEW.balance := NEW.current_balance;
        ELSIF NEW.balance IS NULL AND NEW.current_balance IS NULL THEN
            NEW.balance := 0;
            NEW.current_balance := 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS sync_bank_account_balance_trigger ON bank_accounts;

-- Create trigger
CREATE TRIGGER sync_bank_account_balance_trigger
    BEFORE INSERT OR UPDATE ON bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION sync_bank_account_balance();

-- Update existing rows to set balance = current_balance
UPDATE bank_accounts 
SET balance = COALESCE(current_balance, 0)
WHERE balance IS NULL OR balance = 0;

-- Add comment explaining the column relationship
COMMENT ON COLUMN bank_accounts.balance IS 'Alias for current_balance, kept in sync via trigger for backward compatibility';
COMMENT ON COLUMN bank_accounts.current_balance IS 'Primary balance column, stores the actual account balance';
