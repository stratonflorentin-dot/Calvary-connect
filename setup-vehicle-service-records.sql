-- ============================================================================
-- VEHICLE SERVICE RECORDS TABLE
-- For mechanics to log services performed on vehicles
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_service_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    mechanic_id UUID NOT NULL REFERENCES auth.users(id),
    service_type TEXT NOT NULL, -- e.g., 'oil_change', 'tire_replacement', 'engine_repair'
    service_description TEXT NOT NULL,
    parts_used TEXT, -- JSON array of parts {name, quantity, cost}
    labor_hours NUMERIC DEFAULT 0,
    labor_cost NUMERIC DEFAULT 0,
    parts_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    mileage_at_service INTEGER,
    next_service_date DATE,
    next_service_mileage INTEGER,
    status TEXT DEFAULT 'completed', -- 'completed', 'in_progress', 'scheduled'
    notes TEXT,
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE vehicle_service_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "service_records_select_all" ON vehicle_service_records;
DROP POLICY IF EXISTS "service_records_insert_mechanic" ON vehicle_service_records;
DROP POLICY IF EXISTS "service_records_update_mechanic" ON vehicle_service_records;
DROP POLICY IF EXISTS "service_records_delete_mechanic" ON vehicle_service_records;

-- Select policy - all authenticated users can view
CREATE POLICY IF NOT EXISTS "service_records_select_all"
  ON vehicle_service_records FOR SELECT
  TO authenticated
  USING (true);

-- Insert policy - mechanics and admins only
CREATE POLICY IF NOT EXISTS "service_records_insert_mechanic"
  ON vehicle_service_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (
        raw_user_meta_data->>'role' = 'MECHANIC' 
        OR raw_user_meta_data->>'role' = 'ADMIN'
        OR raw_user_meta_data->>'role' = 'CEO'
      )
    )
  );

-- Update policy - only the mechanic who created or admin
CREATE POLICY IF NOT EXISTS "service_records_update_mechanic"
  ON vehicle_service_records FOR UPDATE
  TO authenticated
  USING (
    mechanic_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (
        raw_user_meta_data->>'role' = 'ADMIN'
        OR raw_user_meta_data->>'role' = 'CEO'
      )
    )
  );

-- Delete policy - only admin/CEO
CREATE POLICY IF NOT EXISTS "service_records_delete_mechanic"
  ON vehicle_service_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (
        raw_user_meta_data->>'role' = 'ADMIN'
        OR raw_user_meta_data->>'role' = 'CEO'
      )
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vehicle_service_vehicle_id ON vehicle_service_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_mechanic_id ON vehicle_service_records(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_date ON vehicle_service_records(service_date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_service_record_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS trigger_update_service_record_timestamp ON vehicle_service_records;
CREATE TRIGGER trigger_update_service_record_timestamp
    BEFORE UPDATE ON vehicle_service_records
    FOR EACH ROW
    EXECUTE FUNCTION update_service_record_timestamp();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 'Vehicle service records table created successfully!' as status;
