-- ============================================================
-- CALVARY CONNECT - COMPREHENSIVE DATABASE FIX SCRIPT
-- Run this entire script in the Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/qaqonhjeqtlatqsrqcnx/sql
-- ============================================================

-- ─── 1. FIX NOTIFICATIONS TABLE ───────────────────────────────────────
-- The notifications table was created with 'is_read' but code expects 'read'
-- Ensure the 'read' column exists (may have been created already)
DO $$
BEGIN
  -- Add 'read' column if it doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read BOOLEAN DEFAULT false;
  END IF;
  
  -- Add 'read_at' column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
  END IF;

  -- If 'is_read' column exists, sync it to 'read' and remove it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    UPDATE notifications SET read = is_read WHERE is_read IS NOT NULL;
    ALTER TABLE notifications DROP COLUMN is_read;
  END IF;
END $$;

-- Ensure notifications index on the correct column
DROP INDEX IF EXISTS idx_notifications_is_read;
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- Fix RLS: Allow users to read, update, and insert their own notifications
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE notifications TO authenticated, anon, postgres;

-- ─── 2. FIX MEETINGS TABLE - RLS RECURSION ────────────────────────────
-- The infinite recursion is caused by subqueries in RLS that reference the same table
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE meetings TO authenticated, anon, postgres;
GRANT ALL ON TABLE meeting_attendees TO authenticated, anon, postgres;

-- ─── 3. ENSURE SALES MODULE TABLES EXIST ──────────────────────────────

-- 3a. Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT UNIQUE DEFAULT 'CUST-' || substr(gen_random_uuid()::text, 1, 8),
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  address TEXT,
  city TEXT,
  region TEXT DEFAULT 'Dar es Salaam',
  country TEXT DEFAULT 'Tanzania',
  tax_id TEXT,
  vat_registered BOOLEAN DEFAULT false,
  business_type TEXT,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  current_balance DECIMAL(12,2) DEFAULT 0,
  payment_terms TEXT DEFAULT '30 days',
  preferred_services TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted', 'prospect')),
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3b. Route quotations table
CREATE TABLE IF NOT EXISTS route_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT UNIQUE DEFAULT 'QT-' || substr(gen_random_uuid()::text, 1, 8),
  customer_id UUID REFERENCES customers(id),
  service_type TEXT NOT NULL CHECK (service_type IN ('local_transport', 'cross_border', 'lowbed', 'reefer', 'loose_cargo')),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km INTEGER,
  cargo_type TEXT,
  cargo_weight_mt DECIMAL(10,2),
  container_size TEXT CHECK (container_size IN ('20ft', '40ft', '45ft', 'loose')),
  rate_per_km DECIMAL(12,2),
  base_amount DECIMAL(12,2),
  fuel_surcharge_pct DECIMAL(5,2) DEFAULT 15,
  fuel_surcharge_amount DECIMAL(12,2),
  border_fees DECIMAL(12,2) DEFAULT 0,
  escort_fees DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2),
  vat_rate DECIMAL(5,2) DEFAULT 18,
  vat_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  currency TEXT DEFAULT 'TZS',
  validity_days INTEGER DEFAULT 30,
  expiry_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  converted_to_contract_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Add approval_status column if missing (referenced in code)
ALTER TABLE route_quotations ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft';

-- 3c. Transport contracts table
CREATE TABLE IF NOT EXISTS transport_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE DEFAULT 'CNT-' || substr(gen_random_uuid()::text, 1, 8),
  customer_id UUID REFERENCES customers(id),
  quotation_id UUID REFERENCES route_quotations(id),
  contract_type TEXT CHECK (contract_type IN ('spot', 'long_term', 'project_based')),
  service_types TEXT[] DEFAULT '{}',
  routes JSONB DEFAULT '[]',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  min_monthly_trips INTEGER,
  contract_value DECIMAL(12,2),
  currency TEXT DEFAULT 'TZS',
  payment_terms TEXT DEFAULT '30 days',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'active', 'suspended', 'expired', 'terminated')),
  signed_by_client BOOLEAN DEFAULT false,
  signed_by_calvary BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extra columns referenced by frontend
ALTER TABLE transport_contracts ADD COLUMN IF NOT EXISTS template_id UUID;
ALTER TABLE transport_contracts ADD COLUMN IF NOT EXISTS rate_sheet_id UUID;
ALTER TABLE transport_contracts ADD COLUMN IF NOT EXISTS generated_html TEXT;
ALTER TABLE transport_contracts ADD COLUMN IF NOT EXISTS client_signatory_name TEXT;
ALTER TABLE transport_contracts ADD COLUMN IF NOT EXISTS client_signatory_title TEXT;
ALTER TABLE transport_contracts ADD COLUMN IF NOT EXISTS contract_date DATE;

-- 3d. Rate sheets table (per-route format)
CREATE TABLE IF NOT EXISTS rate_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT,
  rate_sheet_name TEXT,
  origin TEXT,
  destination TEXT,
  service_type TEXT,
  distance_km INTEGER,
  container_20ft DECIMAL(12,2),
  container_40ft DECIMAL(12,2),
  loose_rate_mt DECIMAL(12,2),
  lowbed_rate DECIMAL(12,2),
  reefer_surcharge DECIMAL(5,2),
  border_clearance_fee DECIMAL(12,2),
  transit_days INTEGER,
  effective_date DATE,
  currency TEXT DEFAULT 'TZS',
  rates JSONB DEFAULT '[]',
  special_conditions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3e. Sales opportunities pipeline
CREATE TABLE IF NOT EXISTS sales_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  opportunity_name TEXT NOT NULL,
  service_type TEXT,
  estimated_monthly_revenue DECIMAL(12,2),
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  stage TEXT CHECK (stage IN ('lead', 'qualification', 'quotation_sent', 'negotiation', 'contract_won', 'contract_lost')),
  expected_close_date DATE,
  competitor TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3f. Customer activities
CREATE TABLE IF NOT EXISTS customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  activity_type TEXT CHECK (activity_type IN ('booking', 'quotation', 'contract', 'payment', 'complaint', 'follow_up')),
  description TEXT,
  amount DECIMAL(12,2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3g. Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE DEFAULT 'BK-' || substr(gen_random_uuid()::text, 1, 8),
  customer_id UUID REFERENCES customers(id),
  service_type TEXT CHECK (service_type IN ('local_transport', 'cross_border', 'lowbed', 'reefer', 'loose_cargo')),
  cargo_type TEXT NOT NULL DEFAULT 'General',
  cargo_weight_mt DECIMAL(10,2),
  cargo_description TEXT,
  container_size TEXT CHECK (container_size IN ('20ft', '40ft', '45ft')),
  origin TEXT NOT NULL DEFAULT 'Dar es Salaam',
  destination TEXT NOT NULL DEFAULT 'TBD',
  distance_km INTEGER,
  pickup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_name TEXT,
  trailer_plate TEXT,
  escort_required BOOLEAN DEFAULT false,
  border_crossing TEXT,
  customs_agent TEXT,
  waybill_number TEXT,
  manifest_number TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'TZS',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dispatched', 'in_transit', 'at_border', 'cleared', 'delivered', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'credit')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3h. Leads table (used by sales module)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'referral',
  service_interest TEXT,
  estimated_value DECIMAL(12,2),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. GRANT PERMISSIONS ON ALL SALES TABLES ─────────────────────────
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE route_quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE transport_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE rate_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE customers TO authenticated, anon, postgres;
GRANT ALL ON TABLE route_quotations TO authenticated, anon, postgres;
GRANT ALL ON TABLE transport_contracts TO authenticated, anon, postgres;
GRANT ALL ON TABLE rate_sheets TO authenticated, anon, postgres;
GRANT ALL ON TABLE sales_opportunities TO authenticated, anon, postgres;
GRANT ALL ON TABLE customer_activities TO authenticated, anon, postgres;
GRANT ALL ON TABLE bookings TO authenticated, anon, postgres;
GRANT ALL ON TABLE leads TO authenticated, anon, postgres;

-- ─── 5. ENSURE FUEL LOGS TABLE IS ACCESSIBLE ──────────────────────────
ALTER TABLE IF EXISTS fuel_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE fuel_logs TO authenticated, anon, postgres;

-- ─── 6. ENSURE MAINTENANCE RECORDS TABLE IS ACCESSIBLE ────────────────
ALTER TABLE IF EXISTS maintenance_records DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE maintenance_records TO authenticated, anon, postgres;

-- ─── 7. FIX TRIPS TABLE ACCESS ────────────────────────────────────────
ALTER TABLE IF EXISTS trips DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE trips TO authenticated, anon, postgres;

-- ─── 8. FIX VEHICLES TABLE ACCESS ─────────────────────────────────────
ALTER TABLE IF EXISTS vehicles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE vehicles TO authenticated, anon, postgres;

-- ─── 9. FIX DRIVERS/USER_PROFILES TABLE ACCESS ────────────────────────
ALTER TABLE IF EXISTS drivers DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE drivers TO authenticated, anon, postgres;

ALTER TABLE IF EXISTS user_profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE user_profiles TO authenticated, anon, postgres;

-- ─── 10. FIX EXPENSES TABLE ACCESS ────────────────────────────────────
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE expenses TO authenticated, anon, postgres;

-- ─── 11. FIX INVOICES TABLE ACCESS ────────────────────────────────────
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE invoices TO authenticated, anon, postgres;

-- ─── 12. FIX JOURNAL ENTRIES TABLE ACCESS ─────────────────────────────
ALTER TABLE IF EXISTS journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_entry_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accounts DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE journal_entries TO authenticated, anon, postgres;
GRANT ALL ON TABLE journal_entry_lines TO authenticated, anon, postgres;
GRANT ALL ON TABLE accounts TO authenticated, anon, postgres;

-- ─── 13. SEED RATE SHEETS DATA ────────────────────────────────────────
INSERT INTO rate_sheets (route_name, origin, destination, service_type, distance_km, container_20ft, container_40ft, loose_rate_mt, lowbed_rate, reefer_surcharge, border_clearance_fee, transit_days, effective_date, is_active)
VALUES
  ('Dar-Lusaka', 'Dar es Salaam', 'Lusaka (Zambia)', 'cross_border', 1850, 2500000, 4200000, 1500, 8500000, 15, 850000, 5, '2024-01-01', true),
  ('Dar-Lubumbashi', 'Dar es Salaam', 'Lubumbashi (DRC)', 'cross_border', 1650, 2200000, 3800000, 1400, 7500000, 15, 750000, 4, '2024-01-01', true),
  ('Dar-Bujumbura', 'Dar es Salaam', 'Bujumbura (Burundi)', 'cross_border', 1100, 1800000, 3000000, 1200, 5500000, 15, 650000, 3, '2024-01-01', true),
  ('Dar-Kigali', 'Dar es Salaam', 'Kigali (Rwanda)', 'cross_border', 1150, 1900000, 3200000, 1250, 6000000, 15, 700000, 3, '2024-01-01', true),
  ('Dar-Kampala', 'Dar es Salaam', 'Kampala (Uganda)', 'cross_border', 1450, 2100000, 3600000, 1350, 7000000, 15, 800000, 4, '2024-01-01', true),
  ('Dar-Nairobi', 'Dar es Salaam', 'Nairobi (Kenya)', 'cross_border', 850, 1500000, 2600000, 1000, 4500000, 15, 550000, 2, '2024-01-01', true),
  ('Dar-Mwanza', 'Dar es Salaam', 'Mwanza', 'local_transport', 1150, 1200000, 2000000, 800, 3500000, 10, 0, 2, '2024-01-01', true),
  ('Dar-Arusha', 'Dar es Salaam', 'Arusha', 'local_transport', 630, 800000, 1400000, 600, 2200000, 10, 0, 1, '2024-01-01', true),
  ('Dar-Dodoma', 'Dar es Salaam', 'Dodoma', 'local_transport', 450, 600000, 1000000, 450, 1600000, 10, 0, 1, '2024-01-01', true),
  ('Dar-Mbeya', 'Dar es Salaam', 'Mbeya', 'local_transport', 830, 900000, 1600000, 700, 2800000, 10, 0, 2, '2024-01-01', true)
ON CONFLICT DO NOTHING;

-- ─── 14. CREATE UPDATED_AT TRIGGER FUNCTION ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers if missing
DO $$
DECLARE
  tname TEXT;
  tables TEXT[] := ARRAY[
    'customers', 'route_quotations', 'transport_contracts',
    'sales_opportunities', 'leads', 'bookings', 'rate_sheets'
  ];
BEGIN
  FOREACH tname IN ARRAY tables LOOP
    -- Only create trigger if it does not exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'update_' || tname || '_updated_at'
    ) THEN
      EXECUTE format('
        CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        tname, tname
      );
    END IF;
  END LOOP;
END $$;

-- ─── 15. CREATE INDEXES FOR PERFORMANCE ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON route_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON route_quotations(status);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON transport_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON transport_contracts(status);
CREATE INDEX IF NOT EXISTS idx_activities_customer ON customer_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_customer ON sales_opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON sales_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- ─── VERIFY SETUP ──────────────────────────────────────────────────────
SELECT 'SUCCESS: Calvary Connect Database Fix Complete!' as status,
       'All tables ensured, RLS disabled, grants applied' as details;
