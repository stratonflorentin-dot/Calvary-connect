-- Deep-upgrades the existing fuel_anomalies/fuel_logs anomaly detector into
-- a real fuel fraud investigation engine, per the approved plan. Extends
-- what already exists (fuel_anomalies, fuel_logs, the audit_trail pattern,
-- the current_user_role() RLS pattern) rather than building a second,
-- parallel fraud system. No FINANCE/PROCUREMENT/PAYROLL/INVENTORY
-- scaffolding is added — `category` defaults to 'FUEL' and nothing else
-- populates it yet.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. fuel_anomalies: widen status lifecycle + add investigation columns
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fuel_anomalies DROP CONSTRAINT IF EXISTS fuel_anomalies_status_check;
ALTER TABLE public.fuel_anomalies ADD CONSTRAINT fuel_anomalies_status_check
  CHECK (status IN ('open', 'under_review', 'investigating', 'reviewed', 'resolved', 'dismissed', 'confirmed', 'confirmed_fraud'));
-- 'reviewed'/'confirmed' (the original values) are kept alongside the new
-- 'under_review'/'investigating'/'resolved'/'confirmed_fraud' states rather
-- than renamed, so any existing rows/queries against the old values keep
-- working untouched.

ALTER TABLE public.fuel_anomalies
  ADD COLUMN IF NOT EXISTS rule_code text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'FUEL',
  ADD COLUMN IF NOT EXISTS risk_score numeric,
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS driver_response jsonb,
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS finance_adjustment_journal_entry_id uuid REFERENCES public.journal_entries(id);

ALTER TABLE public.fuel_anomalies DROP CONSTRAINT IF EXISTS fuel_anomalies_confidence_check;
ALTER TABLE public.fuel_anomalies ADD CONSTRAINT fuel_anomalies_confidence_check
  CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low'));

-- driver_id had no FK; adding one now since the new driver-facing RLS
-- policy below relies on it for referential integrity.
ALTER TABLE public.fuel_anomalies DROP CONSTRAINT IF EXISTS fuel_anomalies_driver_id_fkey;
ALTER TABLE public.fuel_anomalies ADD CONSTRAINT fuel_anomalies_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.user_profiles(id);

-- Backfill rule_code for the 4 pre-existing anomaly_type values so every
-- row (old and new) is queryable by the same key going forward.
UPDATE public.fuel_anomalies SET rule_code = CASE anomaly_type
  WHEN 'impossible_volume' THEN 'TANK_CAPACITY_EXCEEDED'
  WHEN 'efficiency_outlier' THEN 'FUEL_CONSUMPTION_HIGH'
  WHEN 'frequency_outlier' THEN 'RAPID_REFUELING'
  WHEN 'price_outlier' THEN 'FUEL_PRICE_ANOMALY'
  ELSE anomaly_type
END
WHERE rule_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_rule_code ON public.fuel_anomalies(rule_code);
CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_risk_score ON public.fuel_anomalies(risk_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_driver_id ON public.fuel_anomalies(driver_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. fuel_logs: columns the new rules need (all nullable/additive)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fuel_logs
  ADD COLUMN IF NOT EXISTS capture_latitude double precision,
  ADD COLUMN IF NOT EXISTS capture_longitude double precision,
  ADD COLUMN IF NOT EXISTS capture_gps_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS receipt_number text;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. fuel_stations — genuinely new master data (none existed anywhere)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fuel_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  latitude double precision,
  longitude double precision,
  brand text,
  region text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. fuel_cards — genuinely new master data (none existed anywhere)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fuel_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number text NOT NULL UNIQUE,
  assigned_driver_id uuid REFERENCES public.user_profiles(id),
  assigned_vehicle_id uuid REFERENCES public.vehicles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
  daily_limit_litres numeric,
  weekly_limit_litres numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Now that fuel_stations/fuel_cards exist, link fuel_logs to them.
ALTER TABLE public.fuel_logs
  ADD COLUMN IF NOT EXISTS fuel_station_id uuid REFERENCES public.fuel_stations(id),
  ADD COLUMN IF NOT EXISTS fuel_card_id uuid REFERENCES public.fuel_cards(id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. fuel_fraud_rules — configurable thresholds/weights (replaces the
--    hardcoded constants in src/lib/fuel-fraud-detection.ts)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fuel_fraud_rules (
  rule_code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'FUEL',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  weight numeric NOT NULL DEFAULT 1,
  threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_by uuid REFERENCES public.user_profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.fuel_fraud_rules (rule_code, name, description, severity, weight, threshold) VALUES
  ('GPS_MISMATCH', 'GPS location mismatch', 'Fuel station location vs. captured/inferred truck GPS at time of purchase.', 'high', 3,
    '{"normal_km": 2, "review_km": 5, "suspicious_km": 10}'::jsonb),
  ('OFF_ROUTE_FUELING', 'Off-route fueling', 'Fuel station far from the trip''s straight-line origin-destination corridor.', 'medium', 2,
    '{"corridor_km": 15}'::jsonb),
  ('FUEL_CARD_MISMATCH', 'Fuel card mismatch', 'Card used by a driver/vehicle it is not assigned to, or a deactivated card.', 'high', 3, '{}'::jsonb),
  ('FUEL_DUPLICATE_RECEIPT', 'Duplicate fuel receipt', 'Same receipt number, or a near-identical transaction, logged more than once.', 'high', 3,
    '{"fuzzy_window_hours": 2}'::jsonb),
  ('TANK_CAPACITY_EXCEEDED', 'Tank capacity exceeded', 'Logged litres exceed the vehicle''s tank capacity.', 'high', 3, '{}'::jsonb),
  ('FUEL_CONSUMPTION_HIGH', 'Fuel consumption anomaly', 'Efficiency far outside this vehicle''s own trailing baseline.', 'medium', 2,
    '{"stddev_threshold": 2, "min_history": 4}'::jsonb),
  ('ODOMETER_ROLLBACK', 'Odometer anomaly', 'Rollback, negative/implausible distance, or repeated identical readings.', 'high', 3, '{}'::jsonb),
  ('RAPID_REFUELING', 'Rapid refueling', 'Refuels for the same vehicle logged too close together.', 'medium', 2,
    '{"min_hours_between_fills": 6}'::jsonb),
  ('EXCESSIVE_FUELING', 'Excessive fueling volume', 'Daily/weekly/trip litres or spend far above this truck/route''s history.', 'medium', 2,
    '{"stddev_threshold": 2}'::jsonb),
  ('FUEL_PRICE_ANOMALY', 'Fuel price anomaly', 'Price per litre far outside the recent fleet-wide rate.', 'low', 1,
    '{"stddev_threshold": 2}'::jsonb),
  ('STATIONARY_LOCATION_MISMATCH', 'Stationary location mismatch', 'Fuel purchased while the vehicle''s last known position is far from the station.', 'high', 3,
    '{"max_km": 5, "max_age_minutes": 30}'::jsonb),
  ('POSSIBLE_SIPHONING', 'Possible fuel siphoning', 'Rapid tank-level drop while stationary with the engine off and no fuel transaction. Requires vehicle telemetry history, which this fleet does not yet capture — dormant until it does.', 'high', 3,
    '{"min_loss_litres": 30}'::jsonb),
  ('EXCESSIVE_IDLING', 'Excessive idling', 'Engine on, speed zero, for an extended duration. Requires vehicle telemetry history, which this fleet does not yet capture — dormant until it does.', 'low', 1,
    '{"min_minutes": 30}'::jsonb)
ON CONFLICT (rule_code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. RLS: fuel_stations, fuel_cards, fuel_fraud_rules — reference data,
--    readable by any authenticated user, writable only by CEO/ADMIN/OPERATOR
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fuel_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_fraud_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY fuel_stations_read ON public.fuel_stations FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY fuel_stations_write ON public.fuel_stations FOR INSERT
  WITH CHECK (current_user_role() = ANY (ARRAY['CEO', 'ADMIN', 'OPERATOR']));
CREATE POLICY fuel_stations_update ON public.fuel_stations FOR UPDATE
  USING (current_user_role() = ANY (ARRAY['CEO', 'ADMIN', 'OPERATOR']));

CREATE POLICY fuel_cards_read ON public.fuel_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY fuel_cards_write ON public.fuel_cards FOR INSERT
  WITH CHECK (current_user_role() = ANY (ARRAY['CEO', 'ADMIN', 'OPERATOR']));
CREATE POLICY fuel_cards_update ON public.fuel_cards FOR UPDATE
  USING (current_user_role() = ANY (ARRAY['CEO', 'ADMIN', 'OPERATOR']));

CREATE POLICY fuel_fraud_rules_read ON public.fuel_fraud_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY fuel_fraud_rules_write ON public.fuel_fraud_rules FOR INSERT
  WITH CHECK (current_user_role() = ANY (ARRAY['CEO', 'ADMIN', 'OPERATOR']));
CREATE POLICY fuel_fraud_rules_update ON public.fuel_fraud_rules FOR UPDATE
  USING (current_user_role() = ANY (ARRAY['CEO', 'ADMIN', 'OPERATOR']));

-- ─────────────────────────────────────────────────────────────────────────
-- 7. fuel_anomalies: let a driver read (not modify) their own flagged rows
-- ─────────────────────────────────────────────────────────────────────────

CREATE POLICY fuel_anomalies_driver_read ON public.fuel_anomalies FOR SELECT
  USING (driver_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Driver-explanation RPC — the only way a driver can write to their own
--    fuel_anomalies row, and only into driver_response. Regular column-level
--    UPDATE access is never granted to drivers (no UPDATE RLS policy for
--    them), so this SECURITY DEFINER function is the sole write path,
--    preventing a driver from touching risk_score/status/evidence/etc.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_fuel_anomaly_explanation(
  p_anomaly_id uuid,
  p_explanation text,
  p_attachment_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT driver_id INTO v_owner FROM fuel_anomalies WHERE id = p_anomaly_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Anomaly not found';
  END IF;

  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to respond to this anomaly';
  END IF;

  UPDATE fuel_anomalies
  SET driver_response = jsonb_build_object(
        'explanation', p_explanation,
        'attachment_url', p_attachment_url,
        'submitted_at', now()
      )
  WHERE id = p_anomaly_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_fuel_anomaly_explanation(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
