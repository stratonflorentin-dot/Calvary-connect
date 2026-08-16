-- EXCESSIVE_IDLING (and eventually POSSIBLE_SIPHONING once fuel-level
-- telemetry exists) are vehicle/time-window events, not tied to any single
-- fuel purchase — but fuel_log_id was NOT NULL with a UNIQUE(fuel_log_id,
-- anomaly_type) dedupe key, which only makes sense for purchase-tied
-- findings. Relaxing fuel_log_id and replacing the dedupe mechanism with an
-- explicit key the app computes per-rule (fuel_log_id-based for purchase
-- rules, vehicle+hour-bucket-based for time-window rules).

ALTER TABLE public.fuel_anomalies ALTER COLUMN fuel_log_id DROP NOT NULL;

ALTER TABLE public.fuel_anomalies DROP CONSTRAINT IF EXISTS fuel_anomalies_fuel_log_id_anomaly_type_key;

ALTER TABLE public.fuel_anomalies ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Backfill the dedupe key for existing (purchase-tied) rows so the new
-- unique index has something to enforce against immediately.
UPDATE public.fuel_anomalies SET dedupe_key = fuel_log_id::text || ':' || anomaly_type
WHERE dedupe_key IS NULL AND fuel_log_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_anomalies_dedupe_key
  ON public.fuel_anomalies (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
