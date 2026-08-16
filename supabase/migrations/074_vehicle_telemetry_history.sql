-- Real telemetry history, sourced from Cartrack/Wialon, for the fuel fraud
-- engine's POSSIBLE_SIPHONING and EXCESSIVE_IDLING rules (added in
-- migration 070/071 as real rule functions that correctly produced nothing
-- because no time-series of position/engine-status existed anywhere in
-- this database — vehicle_locations is a single upserted current-state row
-- per vehicle, not a history). This table is that missing history.
--
-- vehicle_locations stays as-is (the "current snapshot" cache the live map
-- reads) — this is additive, not a replacement.
CREATE TABLE IF NOT EXISTS public.vehicle_telemetry_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('cartrack', 'wialon')),
  recorded_at timestamptz NOT NULL,
  latitude double precision,
  longitude double precision,
  speed_kmh numeric,
  engine_on boolean,
  odometer_km numeric,
  fuel_level_pct numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_telemetry_history_vehicle_time
  ON public.vehicle_telemetry_history (vehicle_id, recorded_at DESC);

-- Dedupe on re-sync (same provider timestamp re-fetched shouldn't duplicate).
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_telemetry_history_dedupe
  ON public.vehicle_telemetry_history (vehicle_id, source, recorded_at);

ALTER TABLE public.vehicle_telemetry_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_telemetry_history_read ON public.vehicle_telemetry_history FOR SELECT
  USING (current_user_role() = ANY (ARRAY['CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT']));

CREATE POLICY vehicle_telemetry_history_write ON public.vehicle_telemetry_history FOR INSERT
  WITH CHECK (current_user_role() = ANY (ARRAY['CEO', 'ADMIN', 'OPERATOR']));

NOTIFY pgrst, 'reload schema';

-- vehicle_locations is designed as a one-row-per-vehicle current-state
-- snapshot (is_online/alert_status/last_trip_id are all "right now" fields)
-- but never had a unique constraint enforcing that — table is empty live,
-- so this is safe to add now, before the sync route below starts upserting
-- into it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id_unique
  ON public.vehicle_locations (vehicle_id);
