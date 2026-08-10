-- Phase 2 correction, found while building Phase 5 (payroll leave tracking).
--
-- database/migrations/001-master-production-setup.sql (the original
-- baseline setup script) created ~30 tables with a literal
-- `FOR ALL USING (true) WITH CHECK (true)` policy — "Public manage X" —
-- meaning zero restriction for anyone who reaches the table at all.
-- Migration 034 already replaced this for the finance tables (expenses,
-- invoices, bank_accounts, bank_statements, accounts, journal_entries,
-- journal_entry_lines all correctly return 42501 today). This migration
-- covers the rest that 034 didn't touch and that Phase 2's anon-key
-- sweep couldn't already rule out.
--
-- Why Phase 2 missed these: that sweep's safety check was "does an
-- ENABLE ROW LEVEL SECURITY statement exist anywhere in the repo for
-- this table" — true for all of these, since 001 has it. It never
-- checked whether the attached POLICY actually restricts anything.
-- These tables came back "200 []" (not 42501) in that sweep, which
-- Phase 2's own report flagged as ambiguous — could mean a real
-- restrictive policy correctly returning zero rows, or a wide-open
-- policy on a table that happens to be empty right now. This migration
-- resolves that ambiguity by making it restrictive either way, instead
-- of leaving it as a question mark.
--
-- user_profiles and trips are NOT included here even though 001 also
-- gave them "USING (true)": both have real data today, and Phase 2's
-- anon test on both came back zero rows, not real rows — if 001's open
-- policy were still what's live, anon would have gotten real data back,
-- the same way it did for vehicles/audit_logs/company_settings before
-- migration 038. Getting zero rows against non-empty tables is strong
-- evidence a later, real, restrictive policy already replaced 001's for
-- these two specifically, so left alone rather than risk a conflicting
-- policy on tables everyone depends on.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

REVOKE ALL ON
  sales, purchases, taxes, allowances, maintenance_requests, spare_parts,
  parts_requests, meetings, performance_reviews, insurance_policies,
  reports, departments, leave_requests, attendance_logs, payroll_runs,
  vehicle_inspections, tire_tracking, quotations, delivery_notes,
  cash_requests
FROM anon;

DROP POLICY IF EXISTS "Public manage sales" ON sales;
DROP POLICY IF EXISTS "Public manage purchases" ON purchases;
DROP POLICY IF EXISTS "Public manage taxes" ON taxes;
DROP POLICY IF EXISTS "Public manage allowances" ON allowances;
DROP POLICY IF EXISTS "Public manage maintenance" ON maintenance_requests;
DROP POLICY IF EXISTS "Public manage spare parts" ON spare_parts;
DROP POLICY IF EXISTS "Public manage parts requests" ON parts_requests;
DROP POLICY IF EXISTS "Public manage meetings" ON meetings;
DROP POLICY IF EXISTS "Public manage performance" ON performance_reviews;
DROP POLICY IF EXISTS "Public manage insurance" ON insurance_policies;
DROP POLICY IF EXISTS "Public manage reports" ON reports;
DROP POLICY IF EXISTS "Public manage departments" ON departments;
DROP POLICY IF EXISTS "Public manage leave" ON leave_requests;
DROP POLICY IF EXISTS "Public manage attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Public manage payroll" ON payroll_runs;
DROP POLICY IF EXISTS "Public manage inspections" ON vehicle_inspections;
DROP POLICY IF EXISTS "Public manage tires" ON tire_tracking;
DROP POLICY IF EXISTS "Public manage quotes" ON quotations;
DROP POLICY IF EXISTS "Public manage delivery" ON delivery_notes;
DROP POLICY IF EXISTS "Public manage cash" ON cash_requests;

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_requests ENABLE ROW LEVEL SECURITY;

-- Finance / commercial
DROP POLICY IF EXISTS sales_all ON sales;
CREATE POLICY sales_all ON sales FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','SALESMAN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','SALESMAN'));
DROP POLICY IF EXISTS purchases_all ON purchases;
CREATE POLICY purchases_all ON purchases FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
DROP POLICY IF EXISTS taxes_all ON taxes;
CREATE POLICY taxes_all ON taxes FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
DROP POLICY IF EXISTS cash_requests_all ON cash_requests;
CREATE POLICY cash_requests_all ON cash_requests FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));
DROP POLICY IF EXISTS quotations_all ON quotations;
CREATE POLICY quotations_all ON quotations FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','SALESMAN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN'));

-- Fleet / operations
DROP POLICY IF EXISTS maintenance_requests_all ON maintenance_requests;
CREATE POLICY maintenance_requests_all ON maintenance_requests FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'));
DROP POLICY IF EXISTS spare_parts_all ON spare_parts;
CREATE POLICY spare_parts_all ON spare_parts FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'));
DROP POLICY IF EXISTS parts_requests_all ON parts_requests;
CREATE POLICY parts_requests_all ON parts_requests FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'));
DROP POLICY IF EXISTS vehicle_inspections_all ON vehicle_inspections;
CREATE POLICY vehicle_inspections_all ON vehicle_inspections FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'));
DROP POLICY IF EXISTS tire_tracking_all ON tire_tracking;
CREATE POLICY tire_tracking_all ON tire_tracking FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'));
DROP POLICY IF EXISTS delivery_notes_all ON delivery_notes;
CREATE POLICY delivery_notes_all ON delivery_notes FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','WAREHOUSE_STAFF'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','WAREHOUSE_STAFF'));
DROP POLICY IF EXISTS insurance_policies_all ON insurance_policies;
CREATE POLICY insurance_policies_all ON insurance_policies FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR'));

-- HR
DROP POLICY IF EXISTS allowances_all ON allowances;
CREATE POLICY allowances_all ON allowances FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','HR','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','HR','ACCOUNTANT'));
DROP POLICY IF EXISTS performance_reviews_all ON performance_reviews;
CREATE POLICY performance_reviews_all ON performance_reviews FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','HR'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','HR'));
DROP POLICY IF EXISTS attendance_logs_all ON attendance_logs;
CREATE POLICY attendance_logs_all ON attendance_logs FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','HR'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','HR'));
DROP POLICY IF EXISTS payroll_runs_all ON payroll_runs;
CREATE POLICY payroll_runs_all ON payroll_runs FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','HR','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','HR','ACCOUNTANT'));
-- Employees can see and submit their own leave; HR/CEO/ADMIN manage all.
-- employee_id is confirmed from leave_requests' own CREATE TABLE statement
-- (001-master-production-setup.sql).
DROP POLICY IF EXISTS leave_requests_self ON leave_requests;
CREATE POLICY leave_requests_self ON leave_requests FOR ALL
  USING (employee_id = auth.uid() OR current_user_role() IN ('CEO','ADMIN','HR'))
  WITH CHECK (employee_id = auth.uid() OR current_user_role() IN ('CEO','ADMIN','HR'));

-- Org-wide reference data — broadly readable, HR/CEO/ADMIN write
DROP POLICY IF EXISTS departments_read ON departments;
CREATE POLICY departments_read ON departments FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS departments_write ON departments;
CREATE POLICY departments_write ON departments FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','HR'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','HR'));
DROP POLICY IF EXISTS meetings_read ON meetings;
CREATE POLICY meetings_read ON meetings FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS meetings_write ON meetings;
CREATE POLICY meetings_write ON meetings FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','HR'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','HR'));

-- Generic reports table — unclear consumer, conservative default
DROP POLICY IF EXISTS reports_all ON reports;
CREATE POLICY reports_all ON reports FOR ALL
  USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));

INSERT INTO public.schema_migrations (version) VALUES ('040_lock_down_baseline_open_policies.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
