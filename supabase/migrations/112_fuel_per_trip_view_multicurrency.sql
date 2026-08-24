-- view_fuel_per_trip (migration 065) sums vehicle_costs.amount per trip with
-- no regard for vehicle_costs.currency, so a trip fueled in both TZS and USD
-- would blend the two into one meaningless number, and every consumer of
-- this view (src/app/api/reports/fuel-per-trip, the Fuel Per Trip page)
-- labels the result "TZS" unconditionally. Fixed by grouping per trip AND
-- currency — a trip with fuel logged in only one currency (the overwhelming
-- common case) is unaffected and still returns exactly one row; a trip with
-- genuinely mixed-currency fuel entries now returns one row per currency
-- instead of a blended figure.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- CREATE OR REPLACE VIEW can only append new columns at the end, not insert
-- them in the middle — Postgres errors ("cannot change name of view column")
-- if an existing column's position shifts. currency is appended last rather
-- than placed next to plate_number for that reason; it changes nothing
-- semantically since PostgREST/the app read columns by name, not position.
CREATE OR REPLACE VIEW view_fuel_per_trip AS
SELECT
  t.id AS trip_id,
  t.trip_number,
  t.origin,
  t.destination,
  t.status,
  t.distance_km,
  t.created_at AS trip_date,
  v.id AS vehicle_id,
  v.plate_number,
  COUNT(vc.id) AS fuel_entry_count,
  COALESCE(SUM(vc.liters), 0) AS total_liters,
  COALESCE(SUM(vc.amount), 0) AS total_fuel_cost,
  CASE WHEN COUNT(vc.id) > 0 AND COALESCE(t.distance_km, 0) > 0
    THEN ROUND((SUM(vc.liters) / t.distance_km) * 100, 2)
    ELSE NULL END AS liters_per_100km,
  CASE WHEN COUNT(vc.id) > 0 AND COALESCE(t.distance_km, 0) > 0
    THEN ROUND(SUM(vc.amount) / t.distance_km, 2)
    ELSE NULL END AS fuel_cost_per_km,
  COALESCE(vc.currency, 'TZS') AS currency
FROM trips t
LEFT JOIN vehicles v ON v.id = COALESCE(t.vehicle_id, t.truck_id)
LEFT JOIN vehicle_costs vc ON vc.trip_id = t.id AND vc.cost_type = 'fuel'
GROUP BY t.id, t.trip_number, t.origin, t.destination, t.status, t.distance_km, t.created_at, v.id, v.plate_number, vc.currency;

ALTER VIEW view_fuel_per_trip SET (security_invoker = true);

INSERT INTO public.schema_migrations (version) VALUES ('112_fuel_per_trip_view_multicurrency.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
