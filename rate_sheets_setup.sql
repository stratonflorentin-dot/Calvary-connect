-- Create rate_sheets table for editable transport routes and pricing

CREATE TABLE IF NOT EXISTS public.rate_sheets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  route_name VARCHAR(255) NOT NULL UNIQUE,
  origin VARCHAR(255) DEFAULT 'DAR PORT',
  destination VARCHAR(255) NOT NULL,
  container_20ft DECIMAL(10, 2) NOT NULL,
  container_40ft DECIMAL(10, 2) NOT NULL,
  loose_cargo DECIMAL(10, 2) NOT NULL,
  truck_type VARCHAR(50) DEFAULT 'C28',
  transit_days INTEGER DEFAULT 3,
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.rate_sheets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read active rate sheets
CREATE POLICY "Anyone can view active rate sheets"
  ON public.rate_sheets
  FOR SELECT
  USING (is_active = true);

-- RLS Policy: Only authenticated users can modify (assuming admin role)
CREATE POLICY "Authenticated users can manage rate sheets"
  ON public.rate_sheets
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_sheets_active ON public.rate_sheets(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_sheets_route_name ON public.rate_sheets(route_name);

-- Insert default rate sheet data
INSERT INTO public.rate_sheets (route_name, destination, container_20ft, container_40ft, loose_cargo, truck_type, transit_days, currency)
VALUES
  ('KIGALI - RWANDA', 'Kigali', 3100, 3100, 3100, 'C28', 3, 'USD'),
  ('LUSAKA - ZAMBIA', 'Lusaka', 4000, 4000, 4000, 'C28', 5, 'USD'),
  ('SOLWEZI - ZAMBIA', 'Solwezi', 4800, 4800, 4800, 'C28', 6, 'USD'),
  ('BUJUMBURA - BURUNDI', 'Bujumbura', 3200, 3200, 3200, 'C28', 3, 'USD'),
  ('LILONGWE - MALAWI', 'Lilongwe', 4000, 4000, 4000, 'C28', 4, 'USD'),
  ('BLANTYRE - MALAWI', 'Blantyre', 4400, 4400, 4400, 'C28', 4, 'USD'),
  ('KITWE - ZAMBIA', 'Kitwe', 4000, 4000, 4400, 'C28', 5, 'USD'),
  ('GOMA - DRC', 'Goma', 4400, 4400, 4400, 'C28', 4, 'USD'),
  ('BUKAVU - DRC', 'Bukavu', 4800, 4800, 4800, 'C28', 5, 'USD'),
  ('LUBUMBASHI - DRC', 'Lubumbashi', 6400, 6400, 6400, 'C28', 7, 'USD'),
  ('KOLWEZI - DRC', 'Kolwezi', 7200, 7200, 7200, 'C28', 8, 'USD'),
  ('LIKASI - DRC', 'Likasi', 8500, 8500, 8500, 'C28', 9, 'USD')
ON CONFLICT (route_name) DO NOTHING;
