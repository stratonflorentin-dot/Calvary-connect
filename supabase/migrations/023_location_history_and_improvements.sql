-- ============================================================================
-- Calvary Connect — Migration 023: Location History & GPS Improvements
-- ============================================================================

-- 0. Create driver_locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  altitude double precision,
  altitude_accuracy double precision,
  speed double precision,
  heading double precision,
  is_active boolean DEFAULT true,
  last_updated timestamptz NOT NULL DEFAULT now(),
  vehicle_type text DEFAULT 'truck',
  CONSTRAINT dl_valid_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT dl_valid_longitude CHECK (longitude BETWEEN -180 AND 180)
);

-- 1. Add accuracy column to driver_locations if missing
DO $$ BEGIN
  ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS accuracy double precision;
  ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS altitude double precision;
  ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS altitude_accuracy double precision;
  ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'truck';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Create location history (append-only)
CREATE TABLE IF NOT EXISTS driver_location_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  altitude double precision,
  altitude_accuracy double precision,
  speed double precision,
  heading double precision,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  server_received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT valid_longitude CHECK (longitude BETWEEN -180 AND 180)
);

-- 3. Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dlh_driver_recorded
  ON driver_location_history (driver_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_dlh_trip
  ON driver_location_history (trip_id, recorded_at)
  WHERE trip_id IS NOT NULL;



-- 4. Validation constraints already added in CREATE TABLE above

-- 5. Enable RLS on location history
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own history
DO $$ BEGIN
  CREATE POLICY dlh_driver_insert ON driver_location_history
    FOR INSERT TO authenticated
    WITH CHECK (driver_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drivers can read their own history
DO $$ BEGIN
  CREATE POLICY dlh_driver_select ON driver_location_history
    FOR SELECT TO authenticated
    USING (driver_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Managers read all history (via service role — no extra policy needed)

-- 6. Function to insert location + history atomically
CREATE OR REPLACE FUNCTION upsert_driver_location(
  p_driver_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision DEFAULT NULL,
  p_altitude double precision DEFAULT NULL,
  p_altitude_accuracy double precision DEFAULT NULL,
  p_speed double precision DEFAULT NULL,
  p_heading double precision DEFAULT NULL,
  p_trip_id uuid DEFAULT NULL,
  p_vehicle_type text DEFAULT 'truck'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Validate coordinates
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180
  THEN
    RAISE EXCEPTION 'Invalid coordinates: %, %', p_latitude, p_longitude;
  END IF;

  -- Reject null-island (0,0)
  IF p_latitude = 0 AND p_longitude = 0 THEN
    RAISE EXCEPTION 'Null-island coordinates rejected';
  END IF;

  -- Upsert current location
  INSERT INTO driver_locations (
    driver_id, latitude, longitude, accuracy, altitude,
    altitude_accuracy, speed, heading, is_active, last_updated, vehicle_type
  ) VALUES (
    p_driver_id, p_latitude, p_longitude, p_accuracy, p_altitude,
    p_altitude_accuracy, p_speed, p_heading, true, now(), p_vehicle_type
  )
  ON CONFLICT (driver_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy = EXCLUDED.accuracy,
    altitude = EXCLUDED.altitude,
    altitude_accuracy = EXCLUDED.altitude_accuracy,
    speed = EXCLUDED.speed,
    heading = EXCLUDED.heading,
    is_active = true,
    last_updated = now(),
    vehicle_type = EXCLUDED.vehicle_type;

  -- Append to history
  INSERT INTO driver_location_history (
    driver_id, trip_id, latitude, longitude, accuracy,
    altitude, altitude_accuracy, speed, heading, recorded_at, server_received_at
  ) VALUES (
    p_driver_id, p_trip_id, p_latitude, p_longitude, p_accuracy,
    p_altitude, p_altitude_accuracy, p_speed, p_heading, now(), now()
  );
END;
$$;

-- 7. Retention: auto-purge history older than 90 days (run via cron)
-- SELECT cron.schedule('purge-location-history', '0 3 * * *',
--   $$DELETE FROM driver_location_history WHERE recorded_at < now() - interval '90 days'$$
-- );

-- 8. Enable Realtime on driver_locations for live map updates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
