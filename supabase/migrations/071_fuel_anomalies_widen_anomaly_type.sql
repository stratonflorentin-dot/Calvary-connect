-- fuel_anomalies.anomaly_type is NOT NULL with a CHECK limited to the 4
-- original values (efficiency_outlier, impossible_volume, frequency_outlier,
-- price_outlier). The new rules added in 070 use rule_code as their primary
-- identifier, but anomaly_type still has to hold *something* on insert.
-- Widen the CHECK to also accept the new rule_code values directly (new
-- rules just set anomaly_type = rule_code), keeping the 4 legacy lowercase
-- values working unchanged for existing rows/queries.
ALTER TABLE public.fuel_anomalies DROP CONSTRAINT IF EXISTS fuel_anomalies_anomaly_type_check;
ALTER TABLE public.fuel_anomalies ADD CONSTRAINT fuel_anomalies_anomaly_type_check
  CHECK (anomaly_type IN (
    'efficiency_outlier', 'impossible_volume', 'frequency_outlier', 'price_outlier',
    'GPS_MISMATCH', 'OFF_ROUTE_FUELING', 'FUEL_CARD_MISMATCH', 'FUEL_DUPLICATE_RECEIPT',
    'TANK_CAPACITY_EXCEEDED', 'FUEL_CONSUMPTION_HIGH', 'ODOMETER_ROLLBACK', 'RAPID_REFUELING',
    'EXCESSIVE_FUELING', 'FUEL_PRICE_ANOMALY', 'STATIONARY_LOCATION_MISMATCH',
    'POSSIBLE_SIPHONING', 'EXCESSIVE_IDLING'
  ));

NOTIFY pgrst, 'reload schema';
