-- Associate telematics samples with the active trip so that trip distance and
-- fuel level can be reported from the truck's real telemetry feed.
ALTER TABLE public.vehicle_telemetry_history
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_telemetry_trip_vehicle_time
  ON public.vehicle_telemetry_history (trip_id, vehicle_id, recorded_at)
  WHERE trip_id IS NOT NULL;

INSERT INTO public.schema_migrations (version)
VALUES ('141_trip_fuel_telemetry_tracking.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
