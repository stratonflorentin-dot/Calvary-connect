-- Supabase's advisor flagged 22 tables with Row Level Security DISABLED
-- entirely (not just an open policy — RLS off means Postgres ignores
-- policies and enforces nothing, so every row is readable/writable by
-- anyone holding the public anon key, no login required).
--
-- `trips` is the worst of these: 62 references across 39 files make it the
-- single most-used table in the app (dispatch, trip history, POD, customer
-- tracking, financial reports), and it already had a leftover
-- "Public manage trips" USING(true) policy from
-- 001-master-production-setup.sql that was never migrated to a real policy
-- during this session's Phase 2 RLS sweep (038/040/043) — RLS being fully
-- disabled on the table meant that policy was never even being enforced.
--
-- Five of the 22 are confirmed live via grep against src/: trips,
-- vehicle_locations (GPS tracking, src/lib/location-service.ts),
-- inventory (src/app/inventory/page.tsx), shipments (a dashboard stat in
-- src/hooks/use-dashboard.ts), meeting_attendees (src/app/hr/meetings).
-- These get real role-scoped policies below, matching each table's actual
-- consumers in route-config.ts.
--
-- The remaining 17 (revenue, budgets, fuel_approvals, client_balances,
-- vendor_balances, trip_accounting, route_profitability, sensors,
-- sensor_readings, compliance_documents, event_log,
-- mobile_money_transactions, sustainability_metrics, whatsapp_messages,
-- geofences, maintenance_schedules, drivers) have zero references in src/
-- — consistent with this codebase's recurring pattern of legacy/duplicate
-- tables (drivers duplicates user_profiles WHERE role='DRIVER'; fuel_approvals
-- duplicates fuel_requests). Nothing in the app queries them, so they get
-- RLS enabled with NO policy — safe default-deny (the service-role key used
-- by API routes/server actions bypasses RLS regardless, so this can't break
-- anything the app actually does) rather than leaving them open to the
-- whole internet for no reason. Not dropped — no destructive action without
-- explicit confirmation.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- ============ trips ============
-- Roles mirror the union of /trips, /dispatch, /track and /trip-history in
-- route-config.ts, plus drivers scoped to their own assigned trips (proof
-- of delivery, driver-view.tsx all read/write a driver's own trips).
REVOKE ALL ON trips FROM anon;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public manage trips" ON trips;
DROP POLICY IF EXISTS trips_all ON trips;
CREATE POLICY trips_all ON trips FOR ALL
  USING (
    current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT')
    OR driver_id = auth.uid()
  )
  WITH CHECK (
    current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT')
    OR driver_id = auth.uid()
  );

-- ============ vehicle_locations ============
-- Drivers self-report their own vehicle's position (src/lib/location-service.ts
-- writes with the calling driver's own id); dispatch/ops/finance roles read
-- everyone's for the live map and customer tracking.
REVOKE ALL ON vehicle_locations FROM anon;
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicle_locations_all ON vehicle_locations;
CREATE POLICY vehicle_locations_all ON vehicle_locations FOR ALL
  USING (
    current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'HR', 'SALESMAN', 'ACCOUNTANT')
    OR driver_id = auth.uid()
  )
  WITH CHECK (
    current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'HR', 'SALESMAN', 'ACCOUNTANT')
    OR driver_id = auth.uid()
  );

-- ============ inventory ============
-- Matches /inventory in route-config.ts exactly.
REVOKE ALL ON inventory FROM anon;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_all ON inventory;
CREATE POLICY inventory_all ON inventory FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC', 'WAREHOUSE_STAFF'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC', 'WAREHOUSE_STAFF'));

-- ============ shipments ============
-- Same office-staff set as trips, minus driver scoping (no driver-side
-- reference to this table was found — it appears to be an older/parallel
-- table to trips, only read for a dashboard count today).
REVOKE ALL ON shipments FROM anon;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shipments_all ON shipments;
CREATE POLICY shipments_all ON shipments FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT'));

-- ============ meeting_attendees ============
-- meetings' own "Users can view meetings they are attendees of" policy
-- subqueries meeting_attendees, so attendees need read access to their own
-- row or that subquery silently returns nothing once RLS is enforced here.
-- Write stays HR-only, matching meetings_write.
REVOKE ALL ON meeting_attendees FROM anon;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meeting_attendees_read ON meeting_attendees;
CREATE POLICY meeting_attendees_read ON meeting_attendees FOR SELECT
  USING (
    user_id = auth.uid()
    OR current_user_role() IN ('CEO', 'ADMIN', 'HR')
  );
DROP POLICY IF EXISTS meeting_attendees_write ON meeting_attendees;
CREATE POLICY meeting_attendees_write ON meeting_attendees FOR INSERT
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'HR'));
DROP POLICY IF EXISTS meeting_attendees_update ON meeting_attendees;
CREATE POLICY meeting_attendees_update ON meeting_attendees FOR UPDATE
  USING (current_user_role() IN ('CEO', 'ADMIN', 'HR'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'HR'));
DROP POLICY IF EXISTS meeting_attendees_delete ON meeting_attendees;
CREATE POLICY meeting_attendees_delete ON meeting_attendees FOR DELETE
  USING (current_user_role() IN ('CEO', 'ADMIN', 'HR'));

-- ============ Dead/unreferenced tables: default-deny lockdown ============
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'revenue', 'budgets', 'fuel_approvals', 'client_balances', 'vendor_balances',
    'trip_accounting', 'route_profitability', 'sensors', 'sensor_readings',
    'compliance_documents', 'event_log', 'mobile_money_transactions',
    'sustainability_metrics', 'whatsapp_messages', 'geofences',
    'maintenance_schedules', 'drivers'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('REVOKE ALL ON %I FROM anon', t);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.schema_migrations (version) VALUES ('048_lock_down_rls_disabled_tables.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
