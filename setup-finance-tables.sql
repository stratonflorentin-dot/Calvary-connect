-- ============================================================================
-- FINANCE LEDGER TABLES SETUP
-- Run this in Supabase SQL Editor to create all finance tables
-- ============================================================================

-- ============================================================================
-- PURCHASES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    receipt_id TEXT NOT NULL,
    price_before_vat NUMERIC NOT NULL,
    vat NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for purchases
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_select_all" ON purchases;
CREATE POLICY "purchases_select_all"
  ON purchases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "purchases_insert_authenticated" ON purchases;
CREATE POLICY "purchases_insert_authenticated"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "purchases_update_authenticated" ON purchases;
CREATE POLICY "purchases_update_authenticated"
  ON purchases FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "purchases_delete_authenticated" ON purchases;
CREATE POLICY "purchases_delete_authenticated"
  ON purchases FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- SALES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_all" ON sales;
CREATE POLICY "sales_select_all"
  ON sales FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "sales_insert_authenticated" ON sales;
CREATE POLICY "sales_insert_authenticated"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "sales_update_authenticated" ON sales;
CREATE POLICY "sales_update_authenticated"
  ON sales FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "sales_delete_authenticated" ON sales;
CREATE POLICY "sales_delete_authenticated"
  ON sales FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE,
    client_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    vat_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC,
    due_date DATE NOT NULL,
    issue_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'pending',
    description TEXT,
    trip_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_all" ON invoices;
CREATE POLICY "invoices_select_all"
  ON invoices FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "invoices_insert_authenticated" ON invoices;
CREATE POLICY "invoices_insert_authenticated"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "invoices_update_authenticated" ON invoices;
CREATE POLICY "invoices_update_authenticated"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "invoices_delete_authenticated" ON invoices;
CREATE POLICY "invoices_delete_authenticated"
  ON invoices FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- FUEL REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_name TEXT,
    vehicle_id TEXT,
    fuel_station TEXT NOT NULL,
    verification_id TEXT,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for fuel_requests
ALTER TABLE fuel_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fuel_requests_select_all" ON fuel_requests;
CREATE POLICY "fuel_requests_select_all"
  ON fuel_requests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "fuel_requests_insert_authenticated" ON fuel_requests;
CREATE POLICY "fuel_requests_insert_authenticated"
  ON fuel_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "fuel_requests_update_authenticated" ON fuel_requests;
CREATE POLICY "fuel_requests_update_authenticated"
  ON fuel_requests FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fuel_requests_delete_authenticated" ON fuel_requests;
CREATE POLICY "fuel_requests_delete_authenticated"
  ON fuel_requests FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- TAXES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    period TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for taxes
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "taxes_select_all" ON taxes;
CREATE POLICY "taxes_select_all"
  ON taxes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "taxes_insert_authenticated" ON taxes;
CREATE POLICY "taxes_insert_authenticated"
  ON taxes FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "taxes_update_authenticated" ON taxes;
CREATE POLICY "taxes_update_authenticated"
  ON taxes FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "taxes_delete_authenticated" ON taxes;
CREATE POLICY "taxes_delete_authenticated"
  ON taxes FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- REPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    month TEXT,
    year TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_all" ON reports;
CREATE POLICY "reports_select_all"
  ON reports FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "reports_insert_authenticated" ON reports;
CREATE POLICY "reports_insert_authenticated"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "reports_update_authenticated" ON reports;
CREATE POLICY "reports_update_authenticated"
  ON reports FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reports_delete_authenticated" ON reports;
CREATE POLICY "reports_delete_authenticated"
  ON reports FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- MONTHLY REPORTS TABLE (for accountant view)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monthly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    month TEXT NOT NULL,
    year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies for monthly_reports
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_reports_select_all" ON monthly_reports;
CREATE POLICY "monthly_reports_select_all"
  ON monthly_reports FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "monthly_reports_insert_authenticated" ON monthly_reports;
CREATE POLICY "monthly_reports_insert_authenticated"
  ON monthly_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "monthly_reports_update_authenticated" ON monthly_reports;
CREATE POLICY "monthly_reports_update_authenticated"
  ON monthly_reports FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "monthly_reports_delete_authenticated" ON monthly_reports;
CREATE POLICY "monthly_reports_delete_authenticated"
  ON monthly_reports FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 'All finance ledger tables created successfully!' as status;
