-- Some trucks already carry Cartrack or Wialon GPS units. Before any live
-- sync can be built, each vehicle needs to record which provider (if any)
-- tracks it and that provider's device/unit identifier — nothing in this
-- schema currently links a vehicle to an external tracker at all.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS gps_provider text,
  ADD COLUMN IF NOT EXISTS gps_device_id text,
  ADD COLUMN IF NOT EXISTS gps_last_synced_at timestamptz;

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_gps_provider_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_gps_provider_check
  CHECK (gps_provider IS NULL OR gps_provider IN ('cartrack', 'wialon'));

-- A given provider's device id should map to at most one vehicle.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_gps_provider_device
  ON public.vehicles (gps_provider, gps_device_id)
  WHERE gps_provider IS NOT NULL AND gps_device_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
