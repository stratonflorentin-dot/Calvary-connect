-- Create comprehensive financial data system for fleet management (without foreign key constraints)

-- Financial categories table
CREATE TABLE IF NOT EXISTS financial_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'revenue')),
  description TEXT,
  parent_id UUID REFERENCES financial_categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default financial categories
INSERT INTO financial_categories (name, type, description) VALUES
-- Expense Categories
('Fuel', 'expense', 'Vehicle fuel and gasoline expenses'),
('Maintenance', 'expense', 'Vehicle maintenance and repair costs'),
('Insurance', 'expense', 'Vehicle insurance premiums'),
('Salaries', 'expense', 'Driver and staff salaries'),
('Licenses & Permits', 'expense', 'Vehicle licenses and permits'),
('Tires', 'expense', 'Tire purchase and replacement'),
('Parts & Supplies', 'expense', 'Spare parts and supplies'),
('Depreciation', 'expense', 'Vehicle depreciation costs'),
('Parking & Tolls', 'expense', 'Parking fees and tolls'),
('Training', 'expense', 'Driver training and certification'),
('Office Expenses', 'expense', 'Administrative and office costs'),
('Utilities', 'expense', 'Office and facility utilities'),
('Marketing', 'expense', 'Marketing and advertising expenses'),
('Legal & Professional', 'expense', 'Legal and professional services'),
('Other Expenses', 'expense', 'Miscellaneous expenses'),
-- Revenue Categories
('Transport Revenue', 'revenue', 'Revenue from transportation services'),
('Delivery Services', 'revenue', 'Revenue from delivery services'),
('Leasing Revenue', 'revenue', 'Revenue from vehicle leasing'),
('Service Fees', 'revenue', 'Service and maintenance fees'),
('Cargo Revenue', 'revenue', 'Cargo transportation revenue'),
('Passenger Revenue', 'revenue', 'Passenger transportation revenue'),
('Other Revenue', 'revenue', 'Other miscellaneous revenue')
ON CONFLICT (name) DO NOTHING;

-- Expenses table (without foreign key constraints)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID,
  vehicle_id UUID,
  driver_id UUID,
  trip_id UUID,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  receipt_number TEXT,
  vendor TEXT,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'other')),
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue table (without foreign key constraints)
CREATE TABLE IF NOT EXISTS revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID,
  vehicle_id UUID,
  driver_id UUID,
  trip_id UUID,
  client_id UUID,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  invoice_number TEXT UNIQUE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'other')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
  revenue_date DATE NOT NULL,
  due_date DATE,
  paid_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget table (without foreign key constraints)
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID,
  vehicle_id UUID,
  department TEXT,
  budget_name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  period_type TEXT CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  spent_amount DECIMAL(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial reports table (without foreign key constraints)
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('profit_loss', 'cash_flow', 'balance_sheet', 'budget_variance', 'expense_summary', 'revenue_summary')),
  title TEXT NOT NULL,
  description TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency TEXT DEFAULT 'USD',
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  total_expenses DECIMAL(12, 2) DEFAULT 0,
  net_profit DECIMAL(12, 2) DEFAULT 0,
  report_data JSONB,
  generated_by UUID,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice table (without foreign key constraints)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  vehicle_id UUID,
  driver_id UUID,
  trip_id UUID,
  items JSONB NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_rate DECIMAL(5, 4) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date DATE NOT NULL,
  due_date DATE,
  paid_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all financial tables
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial categories
CREATE POLICY "Users can view financial categories" ON financial_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/Operator can manage financial categories" ON financial_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- RLS Policies for expenses
CREATE POLICY "Users can view expenses" ON expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountant/Admin can manage expenses" ON expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- RLS Policies for revenue
CREATE POLICY "Users can view revenue" ON revenue
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountant/Admin can manage revenue" ON revenue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- RLS Policies for budgets
CREATE POLICY "Users can view budgets" ON budgets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountant/Admin can manage budgets" ON budgets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- RLS Policies for financial reports
CREATE POLICY "Users can view financial reports" ON financial_reports
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountant/Admin can manage financial reports" ON financial_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices" ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Accountant/Admin can manage invoices" ON invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo', 'accountant')
    )
  );

-- Create indexes for performance with proper existence checking
DO $$
BEGIN
    -- Expenses indexes - only create if table and columns exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'category_id') THEN
            CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'vehicle_id') THEN
            CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_id ON expenses(vehicle_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'expense_date') THEN
            CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);
        END IF;
    END IF;

    -- Revenue indexes - only create if table and columns exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'category_id') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_category_id ON revenue(category_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'vehicle_id') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_vehicle_id ON revenue(vehicle_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'revenue_date') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_revenue_date ON revenue(revenue_date);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'payment_status') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_payment_status ON revenue(payment_status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_revenue_created_at ON revenue(created_at DESC);
        END IF;
    END IF;

    -- Budgets indexes - only create if table and columns exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'category_id') THEN
            CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'vehicle_id') THEN
            CREATE INDEX IF NOT EXISTS idx_budgets_vehicle_id ON budgets(vehicle_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'start_date') THEN
            CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(start_date, end_date);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budgets' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
        END IF;
    END IF;

    -- Invoices indexes - only create if table and columns exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'due_date') THEN
            CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'issue_date') THEN
            CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
        END IF;
    END IF;
END $$;

-- Functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_financial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_financial_categories_updated_at
  BEFORE UPDATE ON financial_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_updated_at();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_updated_at();

CREATE TRIGGER update_revenue_updated_at
  BEFORE UPDATE ON revenue
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_updated_at();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_financial_updated_at();

-- Function to calculate budget variance
CREATE OR REPLACE FUNCTION calculate_budget_variance(p_budget_id UUID)
RETURNS TABLE (
  budget_amount DECIMAL,
  spent_amount DECIMAL,
  variance DECIMAL,
  variance_percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.amount as budget_amount,
    COALESCE(SUM(e.amount), 0) as spent_amount,
    b.amount - COALESCE(SUM(e.amount), 0) as variance,
    CASE 
      WHEN b.amount = 0 THEN 0
      ELSE ROUND(((b.amount - COALESCE(SUM(e.amount), 0)) / b.amount * 100), 2)
    END as variance_percentage
  FROM budgets b
  LEFT JOIN expenses e ON e.category_id = b.category_id 
    AND e.expense_date BETWEEN b.start_date AND b.end_date
    AND e.status = 'approved'
  WHERE b.id = p_budget_id
  GROUP BY b.id, b.amount;
END;
$$ LANGUAGE plpgsql;

-- Note: Foreign key constraints can be added later manually if needed
-- This approach ensures the financial system works regardless of existing table structures

-- Success message
SELECT '✅ Financial data system created successfully!' as status,
       'Complete expense, revenue, budget, and invoice management system is ready without foreign key dependencies.' as message;
