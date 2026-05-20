-- Run in Supabase SQL editor if driver_locations table or policies are missing.
-- See also: create-driver-locations-table.sql

CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL UNIQUE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy DECIMAL(10, 2),
  speed DECIMAL(10, 2),
  heading DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers_update_own_location" ON driver_locations;
DROP POLICY IF EXISTS "managers_view_all_locations" ON driver_locations;

CREATE POLICY "drivers_update_own_location"
  ON driver_locations FOR ALL TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "managers_view_all_locations"
  ON driver_locations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND UPPER(role) IN ('CEO', 'ADMIN', 'HR', 'OPERATOR')
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
