-- "THERE SHOULD A ADD BUTTON TO ASSIGN MORE TRUCKS ,DRIVERS AND TRAILERS IN
-- THAT TRIP" — a single trip/job can require several separate trucks (each
-- with its own driver, optionally its own trailer), not just one. The
-- `trips` table's own driver_id/truck_id/trailer_id columns stay exactly as
-- they are (the trip's primary/lead assignment — zero risk to every existing
-- report, dashboard, and dispatch query that already reads them). This adds
-- a new table for ADDITIONAL assignments on top of that primary one.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS trip_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES user_profiles(id),
  truck_id uuid REFERENCES vehicles(id),
  trailer_id uuid REFERENCES vehicles(id),
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_assignments_trip_id ON trip_assignments(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_assignments_driver_id ON trip_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_assignments_truck_id ON trip_assignments(truck_id);
CREATE INDEX IF NOT EXISTS idx_trip_assignments_trailer_id ON trip_assignments(trailer_id);

ALTER TABLE trip_assignments ENABLE ROW LEVEL SECURITY;

-- Mirrors trips_read/trips_write/trips_update from 058_performance_hardening.sql.
DROP POLICY IF EXISTS trip_assignments_read ON trip_assignments;
CREATE POLICY trip_assignments_read ON trip_assignments FOR SELECT
  USING (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text, 'HR'::text])
    OR driver_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_assignments.trip_id AND trips.driver_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS trip_assignments_write ON trip_assignments;
CREATE POLICY trip_assignments_write ON trip_assignments FOR INSERT
  WITH CHECK (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text])
  );

DROP POLICY IF EXISTS trip_assignments_update ON trip_assignments;
CREATE POLICY trip_assignments_update ON trip_assignments FOR UPDATE
  USING (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text])
  )
  WITH CHECK (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text])
  );

DROP POLICY IF EXISTS trip_assignments_delete ON trip_assignments;
CREATE POLICY trip_assignments_delete ON trip_assignments FOR DELETE
  USING (
    (select current_user_role()) = ANY (ARRAY['CEO'::text, 'ADMIN'::text, 'OPERATOR'::text, 'SALESMAN'::text, 'ACCOUNTANT'::text])
  );

NOTIFY pgrst, 'reload schema';
