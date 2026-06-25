-- Create vehicle locations table for live tracking
CREATE TABLE IF NOT EXISTS vehicle_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES user_profiles(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  heading DECIMAL(5, 2), -- Vehicle heading in degrees (0-360)
  speed DECIMAL(5, 2), -- Speed in km/h
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'idle', 'maintenance', 'breakdown')),
  is_online BOOLEAN DEFAULT true,
  alert_status TEXT CHECK (alert_status IN ('none', 'breakdown', 'emergency', 'off_route', 'low_fuel')),
  location_accuracy DECIMAL(5, 2), -- GPS accuracy in meters
  battery_level INTEGER, -- Vehicle battery percentage (if available)
  fuel_level DECIMAL(5, 2), -- Fuel level percentage
  odometer DECIMAL(10, 2), -- Current odometer reading
  engine_status TEXT, -- Engine on/off status
  last_trip_id UUID REFERENCES trips(id), -- Current or last trip
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view vehicle locations" ON vehicle_locations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/Operator can manage vehicle locations" ON vehicle_locations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id ON vehicle_locations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_driver_id ON vehicle_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_updated_at ON vehicle_locations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_status ON vehicle_locations(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_is_online ON vehicle_locations(is_online);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_vehicle_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_vehicle_locations_updated_at
  BEFORE UPDATE ON vehicle_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_locations_updated_at();

-- Create a function to get the latest location for each vehicle
CREATE OR REPLACE FUNCTION get_latest_vehicle_locations()
RETURNS TABLE (
  vehicle_id UUID,
  driver_id UUID,
  latitude DECIMAL,
  longitude DECIMAL,
  heading DECIMAL,
  speed DECIMAL,
  status TEXT,
  is_online BOOLEAN,
  alert_status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  driver_name TEXT,
  vehicle_plate TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vl.vehicle_id,
    vl.driver_id,
    vl.latitude,
    vl.longitude,
    vl.heading,
    vl.speed,
    vl.status,
    vl.is_online,
    vl.alert_status,
    vl.updated_at,
    up.name as driver_name,
    v.plate_number as vehicle_plate
  FROM vehicle_locations vl
  LEFT JOIN user_profiles up ON vl.driver_id = up.id
  LEFT JOIN vehicles v ON vl.vehicle_id = v.id
  WHERE vl.updated_at = (
    SELECT MAX(updated_at) 
    FROM vehicle_locations vl2 
    WHERE vl2.vehicle_id = vl.vehicle_id
  );
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT '✅ Vehicle locations table created successfully!' as status,
       'Live tracking system is now ready for real-time vehicle monitoring.' as message;
