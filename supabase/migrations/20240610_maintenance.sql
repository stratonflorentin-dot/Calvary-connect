-- Maintenance Module Migration
-- Create maintenance_records table
CREATE TABLE IF NOT EXISTS maintenance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_number TEXT UNIQUE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'scheduled' CHECK (type IN ('scheduled','preventive','repair','breakdown','inspection')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','scheduled','in_progress','completed','postponed','cancelled')),
  scheduled_date DATE,
  completed_date DATE,
  technician TEXT,
  workshop TEXT,
  estimated_cost DECIMAL(15,2),
  actual_cost DECIMAL(15,2),
  currency TEXT DEFAULT 'TZS',
  notes TEXT,
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read maintenance" ON maintenance_records
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage maintenance" ON maintenance_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN','HR','CEO','OPERATOR')
    )
  );

-- Auto-generate record_number
CREATE OR REPLACE FUNCTION generate_maintenance_number()
RETURNS TRIGGER AS $$
DECLARE 
  seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(record_number, 10) AS INT)), 0) + 1 
  INTO seq 
  FROM maintenance_records 
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  NEW.record_number := 'MR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_maintenance_number ON maintenance_records;
CREATE TRIGGER set_maintenance_number 
BEFORE INSERT ON maintenance_records 
FOR EACH ROW EXECUTE FUNCTION generate_maintenance_number();
