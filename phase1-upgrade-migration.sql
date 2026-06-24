-- ============================================================
-- Calvary Connect — Phase 1 Upgrade Migration
-- LogiPro Feature Parity: Compliance, POD, Fuel, Invoicing
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─── 1. Vehicle Document Compliance Columns ────────────────
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS road_license_expiry        timestamptz,
  ADD COLUMN IF NOT EXISTS fitness_expiry             timestamptz,
  ADD COLUMN IF NOT EXISTS tra_cert_expiry            timestamptz,
  ADD COLUMN IF NOT EXISTS comesa_expiry              timestamptz,
  ADD COLUMN IF NOT EXISTS goods_transit_expiry       timestamptz,
  ADD COLUMN IF NOT EXISTS tatoa_expiry               timestamptz,
  ADD COLUMN IF NOT EXISTS fire_extinguisher_expiry   timestamptz,
  ADD COLUMN IF NOT EXISTS insurance_expiry           timestamptz; -- may already exist

-- Vehicle fuel tracking
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS fuel_type         text DEFAULT 'diesel',
  ADD COLUMN IF NOT EXISTS fuel_capacity     numeric(10,2),
  ADD COLUMN IF NOT EXISTS current_fuel_level numeric(10,2);

-- ─── 2. Trip POD Columns ───────────────────────────────────
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS pod_recipient       text,
  ADD COLUMN IF NOT EXISTS pod_notes          text,
  ADD COLUMN IF NOT EXISTS pod_photo_url      text,
  ADD COLUMN IF NOT EXISTS pod_uploaded_at    timestamptz,
  ADD COLUMN IF NOT EXISTS pod_gps_lat        double precision,
  ADD COLUMN IF NOT EXISTS pod_gps_lng        double precision,
  ADD COLUMN IF NOT EXISTS cargo_weight       numeric(10,3),
  ADD COLUMN IF NOT EXISTS cargo_volume       numeric(10,3),
  ADD COLUMN IF NOT EXISTS declared_value     numeric(15,2),
  ADD COLUMN IF NOT EXISTS is_cross_border    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS border_point       text,
  ADD COLUMN IF NOT EXISTS waybill_number     text;

-- ─── 3. Proof of Delivery Table ───────────────────────────
CREATE TABLE IF NOT EXISTS proof_of_delivery (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                uuid REFERENCES trips(id) ON DELETE CASCADE,
  delivered_at           timestamptz NOT NULL DEFAULT now(),
  recipient_name         text NOT NULL,
  recipient_signature_url text,
  delivery_photo_url     text,
  photos                 text[],            -- array of photo URLs
  delivery_notes         text,
  gps_lat                double precision,
  gps_lng                double precision,
  delivery_location      text,
  delivered_by           text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE (trip_id)
);

-- Enable Row‑Level Security for POD
ALTER TABLE proof_of_delivery ENABLE ROW LEVEL SECURITY;

-- Policy for POD (apply to authenticated and anon users – adjust as needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'pod_all'
      AND polrelid = 'proof_of_delivery'::regclass
  ) THEN
    CREATE POLICY "pod_all"
      ON proof_of_delivery
      FOR ALL
      TO authenticated, anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─── 4. Fuel Log Table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          uuid REFERENCES vehicles(id),
  trip_id             uuid REFERENCES trips(id),
  driver_id           uuid,
  fuel_date           date NOT NULL DEFAULT CURRENT_DATE,
  litres              numeric(10,3) NOT NULL,
  cost_per_litre      numeric(10,2),
  total_cost          numeric(15,2),
  odometer_before     numeric(12,2),
  odometer_after      numeric(12,2),
  distance_km         numeric(10,2)
    GENERATED ALWAYS AS (odometer_after - odometer_before) STORED,
  efficiency_km_l     numeric(8,3)
    GENERATED ALWAYS AS (
      CASE WHEN litres > 0 AND odometer_after IS NOT NULL AND odometer_before IS NOT NULL
           THEN (odometer_after - odometer_before) / litres
           ELSE NULL END
    ) STORED,
  fuel_station        text,
  fuel_card_used      boolean DEFAULT false,
  fuel_card_number    text,
  receipt_url         text,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'fuel_logs_all'
      AND polrelid = 'fuel_logs'::regclass
  ) THEN
    CREATE POLICY "fuel_logs_all"
      ON fuel_logs
      FOR ALL
      TO authenticated, anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─── 5. Invoice TRA Columns ───────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vat_applicable  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS vat_amount      numeric(15,2),
  ADD COLUMN IF NOT EXISTS wht_applicable  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS wht_amount      numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_payable   numeric(15,2),
  ADD COLUMN IF NOT EXISTS payment_terms   text DEFAULT 'Net 30 Days',
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS line_items      jsonb,
  ADD COLUMN IF NOT EXISTS trip_number     text,
  ADD COLUMN IF NOT EXISTS origin          text,
  ADD COLUMN IF NOT EXISTS destination     text,
  ADD COLUMN IF NOT EXISTS paid_at         timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method  text,
  ADD COLUMN IF NOT EXISTS payment_ref     text;

-- ─── 6. Driver Document Tracking ──────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS license_class         text,          -- C, D, etc.
  ADD COLUMN IF NOT EXISTS license_expiry        timestamptz,
  ADD COLUMN IF NOT EXISTS medical_cert_expiry   timestamptz,
  ADD COLUMN IF NOT EXISTS cross_border_pass_expiry timestamptz,
  ADD COLUMN IF NOT EXISTS nssf_number           text,
  ADD COLUMN IF NOT EXISTS driver_tin            text,
  ADD COLUMN IF NOT EXISTS next_of_kin_name      text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone     text;

-- ─── 7. Waybill Sequence ──────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS waybill_seq START 1000 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_waybill_number()
RETURNS text AS $$
  SELECT 'WB-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(nextval('waybill_seq')::text, 5, '0');
$$ LANGUAGE SQL;

-- ─── 8. Indexes for performance ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle   ON fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_trip      ON fuel_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_date      ON fuel_logs(fuel_date);
CREATE INDEX IF NOT EXISTS idx_pod_trip            ON proof_of_delivery(trip_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_ins_expiry ON vehicles(insurance_expiry);
CREATE INDEX IF NOT EXISTS idx_vehicles_road_lic   ON vehicles(road_license_expiry);

-- ─── 9. Compliance Alert View ────────────────────────────
CREATE OR REPLACE VIEW vehicle_compliance_alerts AS
SELECT
  v.id,
  v.plate_number,
  v.make,
  v.model,
  v.type,
  v.status,
  v.insurance_expiry,
  v.road_license_expiry,
  v.fitness_expiry,
  v.tra_cert_expiry,
  v.comesa_expiry,
  v.tatoa_expiry,
  -- Days until expiry (negative = already expired)
  EXTRACT(DAY FROM (v.insurance_expiry - NOW()))::int      AS insurance_days_left,
  EXTRACT(DAY FROM (v.road_license_expiry - NOW()))::int   AS road_license_days_left,
  EXTRACT(DAY FROM (v.fitness_expiry - NOW()))::int        AS fitness_days_left,
  EXTRACT(DAY FROM (v.tra_cert_expiry - NOW()))::int       AS tra_cert_days_left,
  -- Overall compliance status
  CASE
    WHEN v.insurance_expiry < NOW() OR v.road_license_expiry < NOW() OR v.fitness_expiry < NOW() THEN 'EXPIRED'
    WHEN v.insurance_expiry < NOW() + INTERVAL '14 days'
      OR v.road_license_expiry < NOW() + INTERVAL '14 days'
      OR v.fitness_expiry < NOW() + INTERVAL '14 days' THEN 'CRITICAL'
    WHEN v.insurance_expiry < NOW() + INTERVAL '60 days'
      OR v.road_license_expiry < NOW() + INTERVAL '60 days'
      OR v.fitness_expiry < NOW() + INTERVAL '60 days' THEN 'WARNING'
    ELSE 'COMPLIANT'
  END AS compliance_status
FROM vehicles v
WHERE v.status NOT IN ('sold', 'decommissioned');

-- ─── 10. Fuel Efficiency Summary View ────────────────────
CREATE OR REPLACE VIEW fleet_fuel_summary AS
SELECT
  v.plate_number,
  v.make,
  v.model,
  COUNT(fl.id)                        AS fuel_fill_count,
  SUM(fl.litres)                      AS total_litres,
  SUM(fl.total_cost)                  AS total_fuel_cost,
  SUM(fl.distance_km)                 AS total_distance_km,
  AVG(fl.efficiency_km_l)             AS avg_efficiency_km_l,
  MIN(fl.efficiency_km_l)             AS min_efficiency_km_l,
  MAX(fl.efficiency_km_l)             AS max_efficiency_km_l,
  MAX(fl.fuel_date)                   AS last_fill_date
FROM vehicles v
LEFT JOIN fuel_logs fl ON fl.vehicle_id = v.id
GROUP BY v.id, v.plate_number, v.make, v.model;
