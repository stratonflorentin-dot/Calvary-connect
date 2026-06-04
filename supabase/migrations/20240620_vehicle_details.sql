-- Add vehicle detail columns
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_code TEXT; -- VH-001, VH-002
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Truck';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS make TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cargo_capacity_tons DECIMAL(8,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gvw_kg DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tare_weight_kg DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tank_capacity_litres INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS dimensions TEXT; -- "6800x2500x3900"
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer_km INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chassis_number TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'YARD';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(15,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS warranty_expiry DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rate_per_km DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS weekly_rate DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS monthly_rate DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_interval_km INTEGER DEFAULT 5000;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_service_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_service_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100; -- 0-100

-- Create vehicle_documents table
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, -- 'insurance','fitness_certificate','road_licence','comesa_yellow_card','tgl','third_party'
  doc_name TEXT NOT NULL,
  expiry_date DATE,
  issued_date DATE,
  document_number TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'valid', -- computed by trigger: 'no_expiry', 'expired', 'expiring', 'valid'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vehicle_id, doc_type)
);

-- Create function to update document status based on expiry_date
CREATE OR REPLACE FUNCTION update_vehicle_document_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.expiry_date IS NULL THEN 'no_expiry'
    WHEN NEW.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN NEW.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'
    ELSE 'valid'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update status on insert/update
DROP TRIGGER IF EXISTS trigger_update_vehicle_document_status ON vehicle_documents;
CREATE TRIGGER trigger_update_vehicle_document_status
  BEFORE INSERT OR UPDATE ON vehicle_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_document_status();

-- Drop and recreate vehicle_inspections table (ensures clean state)
DROP TABLE IF EXISTS vehicle_inspections CASCADE;

CREATE TABLE vehicle_inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  trip_id UUID, -- reference to trips(id) - can be null
  inspected_by UUID, -- reference to auth.users(id) - can be null
  inspection_type TEXT DEFAULT 'pre_trip', -- pre_trip, post_trip
  overall_status TEXT DEFAULT 'pass', -- pass, fail, conditional
  checklist JSONB, -- { tyres: pass, brakes: pass, lights: pass, ... }
  notes TEXT,
  inspected_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Auth read vehicle_documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Auth read vehicle_inspections" ON vehicle_inspections;
DROP POLICY IF EXISTS "Admin manage vehicle_documents" ON vehicle_documents;
DROP POLICY IF EXISTS "Admin manage vehicle_inspections" ON vehicle_inspections;

-- Create RLS policies
CREATE POLICY "Auth read vehicle_documents" ON vehicle_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth read vehicle_inspections" ON vehicle_inspections
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manage vehicle_documents" ON vehicle_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

CREATE POLICY "Admin manage vehicle_inspections" ON vehicle_inspections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_status ON vehicle_documents(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle_id ON vehicle_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_inspected_at ON vehicle_inspections(inspected_at);
