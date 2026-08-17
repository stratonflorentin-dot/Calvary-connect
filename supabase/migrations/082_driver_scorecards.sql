-- Persisted driver scorecard. LogiPRO's own published formula
-- (completion 40 + on_time 30 + no_abandonments 20 + compliance 10) has a
-- proven live defect: the no-abandonment and compliance components award
-- full marks by default, so a driver with zero trips still floors at
-- 30/100 — "AVG SCORE 30" for an untested fleet is meaningless.
--
-- This table intentionally uses only 3 components we can actually back
-- with real data (completion rate, on-time rate, compliance rate — see
-- src/lib/compliance/status.ts). There is no incidents/abandonment table
-- anywhere in this schema (confirmed: src/app/api/reports/driver-performance
-- /route.ts already tracks this honestly via incidentsTracked: false rather
-- than fabricating a count), so a 4th "no abandonments" component is not
-- included at all rather than defaulted to full marks. overall_score is
-- NULL whenever nothing measurable exists for a driver, never a floor.

CREATE TABLE IF NOT EXISTS driver_scorecards (
  driver_id uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  completion_rate numeric,      -- 0-100, null if the driver has no trips at all
  completed_trips int NOT NULL DEFAULT 0,
  cancelled_trips int NOT NULL DEFAULT 0,
  on_time_rate numeric,         -- 0-100, null if no trip has both an estimate and a delivery signal
  on_time_sample_size int NOT NULL DEFAULT 0,
  compliance_rate numeric,      -- 0-100, share of critical documents (license, medical) that are not expired/due today/never filed
  overall_score numeric,        -- 0-100 weighted average of whichever components above are non-null; null if none are
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid REFERENCES user_profiles(id)
);

REVOKE ALL ON driver_scorecards FROM anon;
ALTER TABLE driver_scorecards ENABLE ROW LEVEL SECURITY;

-- Read: the same roles that can already see fleet/driver-performance
-- reports (FLEET_REPORT_ROLES in src/app/api/reports/helpers.ts), plus the
-- driver themself viewing their own score, plus OPERATOR/MECHANIC who
-- manage day-to-day driver assignment.
CREATE POLICY driver_scorecards_read ON driver_scorecards FOR SELECT
  USING (
    driver_id = auth.uid()
    OR current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'HR', 'OPERATOR', 'MECHANIC')
  );

-- Write only via the service-role recompute route (src/app/api/reports/
-- driver-scorecards/route.ts) — no direct client INSERT/UPDATE policy, so
-- a score can't be self-reported or edited by hand.

NOTIFY pgrst, 'reload schema';
