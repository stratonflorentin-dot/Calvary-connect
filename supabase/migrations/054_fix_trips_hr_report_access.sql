-- Regression from migration 048/053: /admin/reports/fleet/driver-performance
-- (and route-profitability, fuel, revenue-by-vehicle — all four, allowedRoles
-- CEO/ADMIN/ACCOUNTANT/HR in route-config.ts) started failing with
-- "permission denied for table trips" after trips got real RLS.
--
-- Root cause turned out to be two separate bugs, both fixed together here
-- with the app-code half in the same commit as this migration:
--
-- 1. Those 4 report API routes (src/app/api/reports/*) used the plain
-- browser-oriented `@/lib/supabase` client server-side — a module-level
-- singleton with no cookie/session handling, so every query executed as
-- the literal `anon` role. This was invisible while trips/fuel_requests
-- had no real RLS (or, before that, USING(true)); it broke for EVERY
-- role, not just HR, the moment real RLS went on. Fixed by switching
-- those routes to the Bearer-token + role-check + service-role pattern
-- already used elsewhere (payroll/statutory, email/send) — see
-- src/app/api/reports/helpers.ts.
--
-- 2. Separately, migration 048's trips_all policy genuinely never
-- included HR at all, even though HR is one of the roles route-config.ts
-- grants access to these same 4 reports. Splitting trips into a read
-- policy (broader — CEO/ADMIN/OPERATOR/SALESMAN/ACCOUNTANT/HR, matching
-- who actually needs to SELECT trips across dispatch/sales/reports) and a
-- write policy (unchanged — HR doesn't dispatch or edit trips) is more
-- correct than the original single FOR ALL policy regardless of bug #1.
-- fuel_requests (migration 053) had the same HR gap for the same reason
-- and gets the same split.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

DROP POLICY IF EXISTS trips_all ON trips;
DROP POLICY IF EXISTS trips_read ON trips;
CREATE POLICY trips_read ON trips FOR SELECT
  USING (
    current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT', 'HR')
    OR driver_id = auth.uid()
  );
DROP POLICY IF EXISTS trips_write ON trips;
CREATE POLICY trips_write ON trips FOR INSERT
  WITH CHECK (
    current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT')
    OR driver_id = auth.uid()
  );
DROP POLICY IF EXISTS trips_update ON trips;
CREATE POLICY trips_update ON trips FOR UPDATE
  USING (
    current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT')
    OR driver_id = auth.uid()
  )
  WITH CHECK (
    current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT')
    OR driver_id = auth.uid()
  );
DROP POLICY IF EXISTS trips_delete ON trips;
CREATE POLICY trips_delete ON trips FOR DELETE
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'SALESMAN', 'ACCOUNTANT'));

DROP POLICY IF EXISTS fuel_requests_all ON fuel_requests;
DROP POLICY IF EXISTS fuel_requests_read ON fuel_requests;
CREATE POLICY fuel_requests_read ON fuel_requests FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'MECHANIC', 'HR'));
DROP POLICY IF EXISTS fuel_requests_write ON fuel_requests;
CREATE POLICY fuel_requests_write ON fuel_requests FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'MECHANIC'));

INSERT INTO public.schema_migrations (version) VALUES ('054_fix_trips_hr_report_access.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
