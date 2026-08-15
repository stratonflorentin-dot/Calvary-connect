-- Second half of the full-system check: Supabase's performance advisor
-- (791 raw findings) plus one more real security bug found while reading
-- through them. Confirmed every change below against the live schema
-- (exact current policy/index definitions pulled via execute_sql) before
-- writing it — not applied blind from advisor text.
--
-- 1. fuel_requests still had a fully-open "Public manage fuel" policy
--    (USING(true)/WITH CHECK(true)) left over from the original
--    001-master-production-setup.sql, sitting alongside the correctly
--    role-scoped fuel_requests_read/fuel_requests_write added in migration
--    053/054. Postgres ORs every matching policy together, so the open one
--    made the scoped ones meaningless — any authenticated user, any role,
--    could read or write any fuel request. Same bug class as the pass
--    already done in migrations 048/053 for 16+ other tables; this one
--    was missed because fuel_requests wasn't touched again until 054,
--    which only replaced fuel_requests_all and never noticed the
--    still-open leftover next to it. Dropped.
--
-- 2. auth_rls_initplan: 20 policies across 9 high-traffic tables (trips,
--    user_profiles, rate_sheets, invoices, expenses, journal_entries,
--    journal_entry_lines, accounts, vehicles, fuel_logs,
--    maintenance_records, payslips, vehicle_documents) call auth.uid(),
--    auth.role(), or current_user_role() (itself a STABLE wrapper around
--    auth.uid()) directly in the policy condition. Postgres re-evaluates
--    an unwrapped auth.<fn>() call for every row a query touches instead
--    of once per query, which on trips/invoices/journal_entries — queried
--    constantly by dispatch and the finance module — is a real per-query
--    cost, not a theoretical one. Wrapped every occurrence in
--    `(select auth.<fn>())`; Postgres caches a wrapped call as an initplan
--    evaluated once, and the logic is otherwise byte-for-byte identical to
--    what's live today (confirmed via pg_policies before writing this).
--
-- 3. unindexed_foreign_keys: added indexes for FK columns actually used in
--    dispatch/invoicing/accounting joins that had none (confirmed via
--    pg_indexes — not assumed from the advisor text): trips
--    (truck_id/trailer_id/escort_car_id/hose_id), invoices
--    (customer_id/journal_entry_id/quotation_id/contract_id),
--    journal_entries (trip_id/booking_id), expenses
--    (trip_id/journal_entry_id), maintenance_records
--    (vehicle_id/trip_id — maintenance_records had NO index at all on
--    vehicle_id, despite "this vehicle's maintenance history" being the
--    table's single most common lookup), fuel_logs (driver_id), vehicles
--    (current_driver_id).
--
-- 4. duplicate_index: 4 exact-duplicate index pairs (same table, same
--    columns) confirmed via pg_indexes — dropped the newer/less-used name
--    in each pair, kept the other: vehicles (idx_vehicles_plate, keeping
--    idx_vehicles_plate_number), journal_entry_lines (idx_jel_account_code
--    and idx_je_lines_entry, keeping idx_journal_lines_account and
--    idx_journal_lines_entry), invoices (idx_invoices_due, keeping
--    idx_invoices_due_date).
--
-- Not done here: the ~190 remaining unused_index findings sit on
-- rarely-hit admin/reporting tables (audit_logs, monthly_reports,
-- sensor_readings, etc.) or on confirmed-dead legacy tables (contracts,
-- revenue, vehicle_expenses, drivers, fuel_approvals, and similar
-- duplicates of live tables) — no read-latency impact either way, so left
-- alone rather than bulk-dropping indexes speculatively.
--
-- Deliberately NOT touched: maintenance_records has two overlapping ALL
-- policies — "Admins manage maintenance" (CEO/ADMIN/HR/OPERATOR) and
-- maintenance_records_all (CEO/ADMIN/ACCOUNTANT/OPERATOR/MECHANIC). Unlike
-- fuel_requests' policy above, this isn't a wide-open USING(true) — both
-- are real role checks, just from two different migration eras, and OR'd
-- together the effective access today is the union of both role lists
-- (HR can currently write maintenance records via the first policy; ACCOUNTANT/
-- MECHANIC can via the second). Consolidating them is a real access-control
-- decision (does HR keep maintenance write access or not?), not a
-- mechanical performance fix, so it's left for a separate, explicit
-- decision rather than resolved unilaterally here.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- ============ 1. fuel_requests: drop the open leftover policy ============
DROP POLICY IF EXISTS "Public manage fuel" ON fuel_requests;

-- ============ 2. auth_rls_initplan: wrap auth.*() calls ============

DROP POLICY IF EXISTS accounts_read ON accounts;
CREATE POLICY accounts_read ON accounts FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS expenses_read ON expenses;
CREATE POLICY expenses_read ON expenses FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS fuel_logs_read ON fuel_logs;
CREATE POLICY fuel_logs_read ON fuel_logs FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS invoices_read ON invoices;
CREATE POLICY invoices_read ON invoices FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS journal_entries_read ON journal_entries;
CREATE POLICY journal_entries_read ON journal_entries FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS journal_entry_lines_read ON journal_entry_lines;
CREATE POLICY journal_entry_lines_read ON journal_entry_lines FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage maintenance" ON maintenance_records;
CREATE POLICY "Admins manage maintenance" ON maintenance_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.role = ANY (ARRAY['ADMIN'::text, 'HR'::text, 'CEO'::text, 'OPERATOR'::text])
  ));

DROP POLICY IF EXISTS "Authenticated users can read maintenance" ON maintenance_records;
CREATE POLICY "Authenticated users can read maintenance" ON maintenance_records FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Employees view own payslips" ON payslips;
CREATE POLICY "Employees view own payslips" ON payslips FOR SELECT
  USING ((select auth.uid()) = employee_id);

DROP POLICY IF EXISTS "Role-based delete for rate_sheets" ON rate_sheets;
CREATE POLICY "Role-based delete for rate_sheets" ON rate_sheets FOR DELETE
  USING (
    (select auth.role()) = 'authenticated'
    AND (
      (SELECT user_profiles.role FROM user_profiles WHERE user_profiles.id = (select auth.uid())) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'SALESMAN'::text])
      OR (select auth.role()) = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Role-based insert for rate_sheets" ON rate_sheets;
CREATE POLICY "Role-based insert for rate_sheets" ON rate_sheets FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'authenticated'
    AND (
      (SELECT user_profiles.role FROM user_profiles WHERE user_profiles.id = (select auth.uid())) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'SALESMAN'::text])
      OR (select auth.role()) = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Role-based update for rate_sheets" ON rate_sheets;
CREATE POLICY "Role-based update for rate_sheets" ON rate_sheets FOR UPDATE
  USING (
    (select auth.role()) = 'authenticated'
    AND (
      (SELECT user_profiles.role FROM user_profiles WHERE user_profiles.id = (select auth.uid())) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'SALESMAN'::text])
      OR (select auth.role()) = 'service_role'
    )
  )
  WITH CHECK (
    (select auth.role()) = 'authenticated'
    AND (
      (SELECT user_profiles.role FROM user_profiles WHERE user_profiles.id = (select auth.uid())) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'SALESMAN'::text])
      OR (select auth.role()) = 'service_role'
    )
  );

DROP POLICY IF EXISTS trips_read ON trips;
CREATE POLICY trips_read ON trips FOR SELECT
  USING (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text, 'HR'::text])
    OR driver_id = (select auth.uid())
  );

DROP POLICY IF EXISTS trips_write ON trips;
CREATE POLICY trips_write ON trips FOR INSERT
  WITH CHECK (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text])
    OR driver_id = (select auth.uid())
  );

DROP POLICY IF EXISTS trips_update ON trips;
CREATE POLICY trips_update ON trips FOR UPDATE
  USING (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text])
    OR driver_id = (select auth.uid())
  )
  WITH CHECK (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text])
    OR driver_id = (select auth.uid())
  );

DROP POLICY IF EXISTS user_profiles_insert ON user_profiles;
CREATE POLICY user_profiles_insert ON user_profiles FOR INSERT
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
CREATE POLICY user_profiles_select ON user_profiles FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS user_profiles_update ON user_profiles;
CREATE POLICY user_profiles_update ON user_profiles FOR UPDATE
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Auth read vehicle_documents" ON vehicle_documents;
CREATE POLICY "Auth read vehicle_documents" ON vehicle_documents FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS vehicles_read ON vehicles;
CREATE POLICY vehicles_read ON vehicles FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

-- ============ 3. unindexed_foreign_keys ============
CREATE INDEX IF NOT EXISTS idx_trips_truck_id ON trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_trailer_id ON trips(trailer_id);
CREATE INDEX IF NOT EXISTS idx_trips_escort_car_id ON trips(escort_car_id);
CREATE INDEX IF NOT EXISTS idx_trips_hose_id ON trips(hose_id);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_journal_entry_id ON invoices(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation_id ON invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract_id ON invoices(contract_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_trip_id ON journal_entries(trip_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_booking_id ON journal_entries(booking_id);

CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_journal_entry_id ON expenses(journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_records_vehicle_id ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_trip_id ON maintenance_records(trip_id);

CREATE INDEX IF NOT EXISTS idx_fuel_logs_driver_id ON fuel_logs(driver_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_current_driver_id ON vehicles(current_driver_id);

-- ============ 4. duplicate_index cleanup ============
DROP INDEX IF EXISTS idx_vehicles_plate;
DROP INDEX IF EXISTS idx_jel_account_code;
DROP INDEX IF EXISTS idx_je_lines_entry;
DROP INDEX IF EXISTS idx_invoices_due;

INSERT INTO public.schema_migrations (version) VALUES ('058_performance_hardening.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
