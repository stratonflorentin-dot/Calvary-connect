-- Multi-Currency Accounting Migration
-- This migration adds currency support to maintain separate balances per currency
-- Following enterprise ERP standards (SAP, Oracle, Dynamics, Odoo)

-- 1. Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_currency TEXT NOT NULL, -- TZS, USD, KES, etc.
  to_currency TEXT NOT NULL, -- TZS, USD, KES, etc.
  rate NUMERIC NOT NULL, -- Exchange rate (1 from_currency = X to_currency)
  effective_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, effective_date)
);

-- 2. Add currency column to bank_accounts
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
ADD CONSTRAINT bank_accounts_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));

-- 3. Add currency column to invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
ADD CONSTRAINT invoices_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));

-- 4. Add currency column to expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
ADD CONSTRAINT expenses_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));

-- 5. Add currency column to journal_entries
ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
ADD CONSTRAINT journal_entries_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));

-- 6. Add currency column to payments (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
    ADD CONSTRAINT payments_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));
  END IF;
END $$;

-- 7. Add currency column to income/revenue tables
ALTER TABLE income
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
ADD CONSTRAINT income_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));

-- 8. Add currency tracking to trips (for multi-currency trips)
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
ADD CONSTRAINT trips_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));

-- 9. Add currency to quotations
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
ADD CONSTRAINT quotations_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));

-- 10. Add currency to contracts
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS',
ADD CONSTRAINT contracts_currency_check CHECK (currency IN ('TZS', 'USD', 'KES', 'ZMW', 'CDF', 'UGX', 'EUR'));

-- Indexes for currency queries
CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON bank_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency);
CREATE INDEX IF NOT EXISTS idx_expenses_currency ON expenses(currency);
CREATE INDEX IF NOT EXISTS idx_journal_entries_currency ON journal_entries(currency);
CREATE INDEX IF NOT EXISTS idx_income_currency ON income(currency);
CREATE INDEX IF NOT EXISTS idx_trips_currency ON trips(currency);
CREATE INDEX IF NOT EXISTS idx_quotations_currency ON quotations(currency);
CREATE INDEX IF NOT EXISTS idx_contracts_currency ON contracts(currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(effective_date);

-- Insert default exchange rates (these should be updated regularly)
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date) VALUES
  ('TZS', 'USD', 1/2600, CURRENT_DATE),
  ('USD', 'TZS', 2600, CURRENT_DATE),
  ('TZS', 'KES', 2600/129, CURRENT_DATE),
  ('KES', 'TZS', 129/2600, CURRENT_DATE),
  ('TZS', 'ZMW', 2600/26.5, CURRENT_DATE),
  ('ZMW', 'TZS', 26.5/2600, CURRENT_DATE),
  ('TZS', 'CDF', 2600/2850, CURRENT_DATE),
  ('CDF', 'TZS', 2850/2600, CURRENT_DATE),
  ('TZS', 'UGX', 2600/3730, CURRENT_DATE),
  ('UGX', 'TZS', 3730/2600, CURRENT_DATE),
  ('TZS', 'EUR', 1/2800, CURRENT_DATE),
  ('EUR', 'TZS', 2800, CURRENT_DATE),
  ('USD', 'EUR', 1.08, CURRENT_DATE),
  ('EUR', 'USD', 1/1.08, CURRENT_DATE)
ON CONFLICT (from_currency, to_currency, effective_date) DO NOTHING;

-- Row Level Security for exchange rates
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exchange rates" ON exchange_rates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage exchange rates" ON exchange_rates FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM user_profiles 
    WHERE role IN ('ADMIN', 'CEO', 'ACCOUNTANT')
  )
);

-- Function to get latest exchange rate
CREATE OR REPLACE FUNCTION get_exchange_rate(from_curr TEXT, to_curr TEXT)
RETURNS NUMERIC AS $$
DECLARE
  rate NUMERIC;
BEGIN
  SELECT rate INTO rate
  FROM exchange_rates
  WHERE from_currency = from_curr
    AND to_currency = to_curr
    AND effective_date <= CURRENT_DATE
  ORDER BY effective_date DESC
  LIMIT 1;
  
  RETURN COALESCE(rate, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to convert amount between currencies
CREATE OR REPLACE FUNCTION convert_currency(
  amount NUMERIC,
  from_curr TEXT,
  to_curr TEXT
) RETURNS NUMERIC AS $$
BEGIN
  IF from_curr = to_curr THEN
    RETURN amount;
  END IF;
  
  RETURN amount * get_exchange_rate(from_curr, to_curr);
END;
$$ LANGUAGE plpgsql;
