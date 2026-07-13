-- ============================================================================
-- Calvary Connect — Migration 024: Purge Bad GPS Data & Enforce Accuracy
-- ============================================================================
-- Context: A 50,000m accuracy network/IP geolocation record was found in
-- driver_locations. This migration removes all invalid GPS readings and
-- enforces accuracy constraints at the database level.
-- ============================================================================

-- 1. Remove invalid driver location records:
--    a) accuracy above 100m (network IP geolocation, not real GPS)
--    b) null-island coordinates (0, 0)
--    c) coordinates exactly at (0, 0) which are initialization defaults
DELETE FROM driver_locations
WHERE
  (accuracy IS NOT NULL AND accuracy > 100)
  OR (latitude = 0 AND longitude = 0)
  OR latitude IS NULL
  OR longitude IS NULL;

-- 2. Add DB-level accuracy constraint to prevent future bad writes
--    (only enforce when accuracy is provided)
DO $$ BEGIN
  ALTER TABLE driver_locations
    ADD CONSTRAINT dl_max_accuracy
    CHECK (accuracy IS NULL OR accuracy <= 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Ensure altitude and altitude_accuracy columns exist
DO $$ BEGIN
  ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS altitude double precision;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS altitude_accuracy double precision;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'truck';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. Auto-mark stale driver records as inactive.
--    If a driver_locations row hasn't been updated in more than 10 minutes,
--    mark it inactive so status correctly shows OFFLINE.
UPDATE driver_locations
SET is_active = false
WHERE
  is_active = true
  AND last_updated < now() - interval '10 minutes';

-- 5. Function: compute freshness status from last_updated timestamp
CREATE OR REPLACE FUNCTION get_driver_location_status(p_last_updated timestamptz, p_is_active boolean)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  stale_seconds integer;
BEGIN
  IF p_last_updated IS NULL OR NOT p_is_active THEN
    RETURN 'OFFLINE';
  END IF;

  stale_seconds := EXTRACT(EPOCH FROM (now() - p_last_updated))::integer;

  IF stale_seconds <= 30 THEN
    RETURN 'LIVE';
  ELSIF stale_seconds <= 120 THEN
    RETURN 'DELAYED';
  ELSIF stale_seconds <= 600 THEN
    RETURN 'STALE';
  ELSE
    RETURN 'OFFLINE';
  END IF;
END;
$$;

-- 6. Scheduled cleanup: mark locations older than 10 min as inactive
--    (This runs immediately as a one-time fix; schedule via pg_cron for production)
UPDATE driver_locations
SET is_active = false
WHERE last_updated < now() - interval '10 minutes'
  AND is_active = true;

-- 7. Ensure driver_location_history has all required indexes
CREATE INDEX IF NOT EXISTS idx_dlh_driver_recorded
  ON driver_location_history (driver_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_dlh_trip
  ON driver_location_history (trip_id, recorded_at)
  WHERE trip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dl_last_updated
  ON driver_locations (last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_dl_is_active
  ON driver_locations (is_active, last_updated DESC);

-- 8. Verify realtime is enabled for live map updates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE driver_location_history;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
