-- SALES & COMMERCIAL MODULE SCHEMA
-- Logistics-focused CRM with quotations, contracts, rate sheets, and pipeline
-- ============================================

-- Customers table (enhanced for logistics)
DROP TABLE IF EXISTS customers CASCADE;
CREATE TABLE customers (
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

-- Bookings table (enhanced for logistics)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE DEFAULT 'BK-' || substr(gen_random_uuid()::text, 1, 8),
  customer_id UUID REFERENCES customers(id),
  service_type TEXT CHECK (service_type IN ('local_transport', 'cross_border', 'lowbed', 'reefer', 'loose_cargo')),
  cargo_type TEXT NOT NULL,
  cargo_weight_mt DECIMAL(10,2),
  cargo_description TEXT,
  container_size TEXT CHECK (container_size IN ('20ft', '40ft', '45ft')),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km INTEGER,
  pickup_date DATE NOT NULL,
  delivery_date DATE,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_name TEXT,
  trailer_plate TEXT,
  escort_required BOOLEAN DEFAULT false,
  border_crossing TEXT,
  customs_agent TEXT,
  waybill_number TEXT,
  manifest_number TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'TZS',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dispatched', 'in_transit', 'at_border', 'cleared', 'delivered', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'credit')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Route quotations (logistics-specific pricing)
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

-- Transport contracts
CREATE TABLE IF NOT EXISTS transport_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE DEFAULT 'CNT-' || substr(gen_random_uuid()::text, 1, 8),
  customer_id UUID REFERENCES customers(id),
  quotation_id UUID REFERENCES route_quotations(id),
  contract_type TEXT CHECK (contract_type IN ('spot', 'long_term', 'project_based')),
  service_types TEXT[] DEFAULT '{}',
  routes JSONB DEFAULT '[]',
  start_date DATE NOT NULL,
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

-- Rate sheets for quick quoting
DROP TABLE IF EXISTS rate_sheets CASCADE;
CREATE TABLE rate_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  service_type TEXT NOT NULL,
  distance_km INTEGER,
  container_20ft DECIMAL(12,2),
  container_40ft DECIMAL(12,2),
  loose_rate_mt DECIMAL(12,2),
  lowbed_rate DECIMAL(12,2),
  reefer_surcharge DECIMAL(5,2),
  border_clearance_fee DECIMAL(12,2),
  transit_days INTEGER,
  effective_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customer activities feed
CREATE TABLE IF NOT EXISTS customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  activity_type TEXT CHECK (activity_type IN ('booking', 'quotation', 'contract', 'payment', 'complaint', 'follow_up')),
  description TEXT,
  amount DECIMAL(12,2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sales opportunities / pipeline
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

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
DROP TRIGGER IF EXISTS update_route_quotations_updated_at ON route_quotations;
DROP TRIGGER IF EXISTS update_transport_contracts_updated_at ON transport_contracts;
DROP TRIGGER IF EXISTS update_sales_opportunities_updated_at ON sales_opportunities;

-- Create triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_route_quotations_updated_at BEFORE UPDATE ON route_quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transport_contracts_updated_at BEFORE UPDATE ON transport_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_opportunities_updated_at BEFORE UPDATE ON sales_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_opportunities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all access to customers" ON customers;
DROP POLICY IF EXISTS "Allow all access to bookings" ON bookings;
DROP POLICY IF EXISTS "Allow all access to route_quotations" ON route_quotations;
DROP POLICY IF EXISTS "Allow all access to transport_contracts" ON transport_contracts;
DROP POLICY IF EXISTS "Allow all access to rate_sheets" ON rate_sheets;
DROP POLICY IF EXISTS "Allow all access to customer_activities" ON customer_activities;
DROP POLICY IF EXISTS "Allow all access to sales_opportunities" ON sales_opportunities;

-- Create permissive policies for authenticated users
CREATE POLICY "Allow all access to customers" ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to bookings" ON bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to route_quotations" ON route_quotations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to transport_contracts" ON transport_contracts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to rate_sheets" ON rate_sheets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to customer_activities" ON customer_activities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to sales_opportunities" ON sales_opportunities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- SEED DATA: Cross-Border Routes
-- ============================================

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

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_region ON customers(region);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(pickup_date);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON route_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON route_quotations(status);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON transport_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON transport_contracts(status);
CREATE INDEX IF NOT EXISTS idx_activities_customer ON customer_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_customer ON sales_opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON sales_opportunities(stage);

-- ============================================
-- VERIFY SETUP
-- ============================================

SELECT 'Sales Module Tables Created Successfully' as status;
