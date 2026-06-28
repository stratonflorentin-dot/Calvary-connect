-- Finance Module Database Setup for Supabase
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Create Chart of Accounts Table
-- ============================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses')),
  currency TEXT DEFAULT 'TZS',
  balance DECIMAL(15, 2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. Create Taxes Table
-- ============================================
CREATE TABLE IF NOT EXISTS taxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_name TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency TEXT DEFAULT 'TZS',
  type TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Create Bank Accounts Table
-- ============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  currency TEXT DEFAULT 'TZS',
  balance DECIMAL(15, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. Enable RLS on Finance Tables
-- ============================================
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Create RLS Policies for Finance Tables
-- ============================================

-- Chart of Accounts policies
CREATE POLICY "Allow read access to chart_of_accounts" ON chart_of_accounts
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access to chart_of_accounts" ON chart_of_accounts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to chart_of_accounts" ON chart_of_accounts
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to chart_of_accounts" ON chart_of_accounts
  FOR DELETE USING (true);

-- Taxes policies
CREATE POLICY "Allow read access to taxes" ON taxes
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access to taxes" ON taxes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to taxes" ON taxes
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to taxes" ON taxes
  FOR DELETE USING (true);

-- Bank Accounts policies
CREATE POLICY "Allow read access to bank_accounts" ON bank_accounts
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access to bank_accounts" ON bank_accounts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to bank_accounts" ON bank_accounts
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to bank_accounts" ON bank_accounts
  FOR DELETE USING (true);

-- ============================================
-- 6. Fix RLS Policies for Existing Tables
-- ============================================

-- Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;

CREATE POLICY "Allow read access to invoices" ON invoices
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access to invoices" ON invoices
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to invoices" ON invoices
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to invoices" ON invoices
  FOR DELETE USING (true);

-- Expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses" ON expenses;

CREATE POLICY "Allow read access to expenses" ON expenses
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access to expenses" ON expenses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to expenses" ON expenses
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to expenses" ON expenses
  FOR DELETE USING (true);

-- Income
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view income" ON income;
DROP POLICY IF EXISTS "Users can insert income" ON income;
DROP POLICY IF EXISTS "Users can update income" ON income;
DROP POLICY IF EXISTS "Users can delete income" ON income;

CREATE POLICY "Allow read access to income" ON income
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access to income" ON income
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to income" ON income
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete access to income" ON income
  FOR DELETE USING (true);

-- ============================================
-- 7. Insert Sample Chart of Accounts Data
-- ============================================
INSERT INTO chart_of_accounts (code, name, type, currency, balance) VALUES
  ('1000', 'Cash', 'Assets', 'TZS', 0),
  ('1100', 'Accounts Receivable', 'Assets', 'TZS', 0),
  ('1200', 'Inventory', 'Assets', 'TZS', 0),
  ('2000', 'Accounts Payable', 'Liabilities', 'TZS', 0),
  ('2100', 'Accrued Expenses', 'Liabilities', 'TZS', 0),
  ('3000', 'Owner Equity', 'Equity', 'TZS', 0),
  ('4000', 'Service Revenue', 'Revenue', 'TZS', 0),
  ('4100', 'Interest Income', 'Revenue', 'TZS', 0),
  ('5000', 'Fuel Expenses', 'Expenses', 'TZS', 0),
  ('5100', 'Maintenance Expenses', 'Expenses', 'TZS', 0),
  ('5200', 'Salary Expenses', 'Expenses', 'TZS', 0),
  ('5300', 'Office Expenses', 'Expenses', 'TZS', 0)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 8. Create Updated At Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_taxes_updated_at BEFORE UPDATE ON taxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
