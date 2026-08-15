-- Real per-trip fuel report. The existing /admin/reports/fleet/fuel report
-- (src/app/api/reports/fuel/route.ts) is per-VEHICLE, not per-trip, and
-- fabricates data it doesn't have: liters = totalFuelCost / 3000 (a
-- hardcoded guess at price-per-liter) and a default distance of 120km when
-- no real distance is recorded. This view uses only real data: vehicle_costs
-- (cost_type = 'fuel', with the liters/odometer_reading columns added in
-- migration 061) joined to trips, grouped per trip — no fabricated figures.
--
-- security_invoker = true from the start (migration 064 fixed four earlier
-- views that were missing this and could bypass RLS for any authenticated
-- reader — not repeating that here).
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

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
  -- Both guarded on "at least one fuel entry exists", not just "distance is
  -- known" — a trip with zero logged fuel entries should read as "no data
  -- yet" (NULL), not a misleading confirmed "0.00 per km".
  CASE WHEN COUNT(vc.id) > 0 AND COALESCE(t.distance_km, 0) > 0
    THEN ROUND((SUM(vc.liters) / t.distance_km) * 100, 2)
    ELSE NULL END AS liters_per_100km,
  CASE WHEN COUNT(vc.id) > 0 AND COALESCE(t.distance_km, 0) > 0
    THEN ROUND(SUM(vc.amount) / t.distance_km, 2)
    ELSE NULL END AS fuel_cost_per_km
FROM trips t
LEFT JOIN vehicles v ON v.id = COALESCE(t.vehicle_id, t.truck_id)
LEFT JOIN vehicle_costs vc ON vc.trip_id = t.id AND vc.cost_type = 'fuel'
GROUP BY t.id, t.trip_number, t.origin, t.destination, t.status, t.distance_km, t.created_at, v.id, v.plate_number;

ALTER VIEW view_fuel_per_trip SET (security_invoker = true);

INSERT INTO public.schema_migrations (version) VALUES ('065_fuel_per_trip_view.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
