-- Fuel/oil fraud detection: adds a table to store flagged anomalous fuel
-- log entries (impossible fills, efficiency outliers, suspiciously frequent
-- refuels, overpriced litres) and locks down fuel_logs itself.
--
-- fuel_logs (database/migrations/003-phase1-upgrade-migration.sql:79-104)
-- has the same wide-open RLS problem fixed for other finance tables in
-- migration 034: "fuel_logs_all" is FOR ALL USING(true) TO authenticated,
-- anon — i.e. any signed-in OR anonymous request can insert/edit/delete
-- fuel entries. Building fraud detection on a table anyone can freely
-- tamper with defeats the point, so this migration locks it down the same
-- way: current_user_role() gated for OPERATOR/ACCOUNTANT/ADMIN/CEO (the
-- roles that actually log fuel per src/components/financial/fuel-management.tsx),
-- SELECT open to any authenticated user (drivers/dashboards need to read it).
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

DROP POLICY IF EXISTS "fuel_logs_all" ON fuel_logs;

ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuel_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON fuel_logs TO authenticated;

DROP POLICY IF EXISTS fuel_logs_read ON fuel_logs;
DROP POLICY IF EXISTS fuel_logs_write ON fuel_logs;
CREATE POLICY fuel_logs_read ON fuel_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fuel_logs_write ON fuel_logs
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','ACCOUNTANT'));
CREATE POLICY fuel_logs_update ON fuel_logs
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','ACCOUNTANT'));
CREATE POLICY fuel_logs_delete ON fuel_logs
  FOR DELETE USING (current_user_role() IN ('CEO','ADMIN'));

CREATE TABLE IF NOT EXISTS fuel_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id uuid,
  fuel_log_id uuid NOT NULL REFERENCES fuel_logs(id) ON DELETE CASCADE,
  anomaly_type text NOT NULL CHECK (anomaly_type IN (
    'efficiency_outlier', 'impossible_volume', 'frequency_outlier', 'price_outlier'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  expected_value numeric,
  actual_value numeric,
  deviation_pct numeric,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','confirmed')),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fuel_log_id, anomaly_type)
);

CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_vehicle ON fuel_anomalies(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_status ON fuel_anomalies(status);

ALTER TABLE fuel_anomalies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuel_anomalies FROM anon;
GRANT SELECT, INSERT, UPDATE ON fuel_anomalies TO authenticated;

DROP POLICY IF EXISTS fuel_anomalies_read ON fuel_anomalies;
DROP POLICY IF EXISTS fuel_anomalies_write ON fuel_anomalies;
DROP POLICY IF EXISTS fuel_anomalies_update ON fuel_anomalies;
CREATE POLICY fuel_anomalies_read ON fuel_anomalies
  FOR SELECT USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','ACCOUNTANT'));
CREATE POLICY fuel_anomalies_write ON fuel_anomalies
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','ACCOUNTANT'));
CREATE POLICY fuel_anomalies_update ON fuel_anomalies
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','ACCOUNTANT'));

NOTIFY pgrst, 'reload schema';
