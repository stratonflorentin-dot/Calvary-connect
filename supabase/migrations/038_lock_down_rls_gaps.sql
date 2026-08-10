-- Phase 2 RLS audit: lock down every table found readable/writable by anon
-- with no enforcement at all.
--
-- Method: tested all 110 tables in the live schema with the anon key
-- directly against PostgREST (not service role — anon is what an
-- unauthenticated request actually gets). Two buckets came back exposed:
--
--   A) Currently has data and anon could read it right now:
--      vehicles, audit_logs, company_settings, financial_categories,
--      maintenance_records, notifications, rate_sheets, route_constraints
--
--   B) Currently empty (so the anon test returned "[]", not real rows),
--      but has zero ENABLE ROW LEVEL SECURITY statement anywhere in the
--      repo (supabase/migrations or database/migrations) — a live hole
--      waiting for its first row, same root cause as migration 034:
--      ai_agent_messages, ai_agent_runs, bookings, clients,
--      contract_templates, contracts, customer_activities,
--      driver_locations, fuel_records, fuel_tracking, income,
--      insurance_claims, monthly_reports, route_quotations,
--      sales_opportunities, transport_contracts, truck_insurance,
--      vehicle_deletion_audit, vehicle_service_records
--
-- A number of table B's (rate_sheets, ai_agent_messages, ai_agent_runs,
-- clients, contract_templates, contracts, customer_activities,
-- fuel_records, fuel_tracking, income, insurance_claims,
-- route_quotations, sales_opportunities, transport_contracts,
-- truck_insurance, vehicle_deletion_audit, vehicle_service_records) have
-- NO CREATE TABLE statement anywhere in this repo at all — they exist
-- live only because someone created them by hand in the Supabase SQL
-- editor/dashboard. That's the inverse of the "written but never
-- applied" bug this whole audit started from: "applied but never
-- written down." Flagging for the Phase 3 legacy-script review — for
-- now, every policy below is written using ONLY current_user_role()
-- (no reference to any other column), so it can't fail from guessing a
-- column name wrong on a table whose real schema was never committed.
--
-- Two tables have a confirmed, useful ownership column from their own
-- CREATE TABLE statement, so those get a tighter self-access clause on
-- top of the role check: notifications.user_id, driver_locations.driver_id.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- ────────────────────────────────────────────────────────────────────────────
-- Belt-and-suspenders: revoke anon's blanket grant before RLS is even
-- evaluated (matches the pattern in 034/037 — RLS alone should be enough,
-- but a table that somehow gets RLS disabled again later still can't be
-- read by anon without ALSO re-granting it).
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON
  vehicles, audit_logs, company_settings, financial_categories,
  maintenance_records, notifications, rate_sheets, route_constraints,
  ai_agent_messages, ai_agent_runs, bookings, clients, contract_templates,
  contracts, customer_activities, driver_locations, fuel_records,
  fuel_tracking, income, insurance_claims, monthly_reports,
  route_quotations, sales_opportunities, transport_contracts,
  truck_insurance, vehicle_deletion_audit, vehicle_service_records
FROM anon;

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_deletion_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_service_records ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- Fleet / operations — read broadly (used across dashboards, reports,
-- fuel-anomaly detection), write restricted to the roles that actually
-- operate the fleet.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS vehicles_read ON vehicles;
CREATE POLICY vehicles_read ON vehicles
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS vehicles_write ON vehicles;
CREATE POLICY vehicles_write ON vehicles
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','MECHANIC'));

DROP POLICY IF EXISTS maintenance_records_all ON maintenance_records;
CREATE POLICY maintenance_records_all ON maintenance_records
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'));

DROP POLICY IF EXISTS vehicle_service_records_all ON vehicle_service_records;
CREATE POLICY vehicle_service_records_all ON vehicle_service_records
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'));

DROP POLICY IF EXISTS fuel_records_all ON fuel_records;
CREATE POLICY fuel_records_all ON fuel_records
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'));

DROP POLICY IF EXISTS fuel_tracking_all ON fuel_tracking;
CREATE POLICY fuel_tracking_all ON fuel_tracking
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'));

DROP POLICY IF EXISTS truck_insurance_all ON truck_insurance;
CREATE POLICY truck_insurance_all ON truck_insurance
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','MECHANIC'));

DROP POLICY IF EXISTS route_constraints_read ON route_constraints;
CREATE POLICY route_constraints_read ON route_constraints
  FOR SELECT USING (current_user_role() IN ('CEO','ADMIN','OPERATOR'));
DROP POLICY IF EXISTS route_constraints_write ON route_constraints;
CREATE POLICY route_constraints_write ON route_constraints
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN'));

-- Sensitive audit trail of vehicle deletions — CEO/ADMIN only.
DROP POLICY IF EXISTS vehicle_deletion_audit_all ON vehicle_deletion_audit;
CREATE POLICY vehicle_deletion_audit_all ON vehicle_deletion_audit
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN'));

-- Driver GPS pings: a driver may write/read their own row; dispatch/ops
-- can read everyone's. driver_id is the table's real PK/FK, confirmed
-- from its CREATE TABLE statement (023_location_history_and_improvements.sql).
DROP POLICY IF EXISTS driver_locations_self ON driver_locations;
CREATE POLICY driver_locations_self ON driver_locations
  FOR ALL USING (driver_id = auth.uid() OR current_user_role() IN ('CEO','ADMIN','OPERATOR'))
  WITH CHECK (driver_id = auth.uid() OR current_user_role() IN ('CEO','ADMIN','OPERATOR'));

-- ────────────────────────────────────────────────────────────────────────────
-- Finance / accounting reference + reporting data
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS financial_categories_read ON financial_categories;
CREATE POLICY financial_categories_read ON financial_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS financial_categories_write ON financial_categories;
CREATE POLICY financial_categories_write ON financial_categories
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));

DROP POLICY IF EXISTS income_all ON income;
CREATE POLICY income_all ON income
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));

DROP POLICY IF EXISTS insurance_claims_all ON insurance_claims;
CREATE POLICY insurance_claims_all ON insurance_claims
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR'));

DROP POLICY IF EXISTS monthly_reports_all ON monthly_reports;
CREATE POLICY monthly_reports_all ON monthly_reports
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'));

-- Company identity/config — broadly readable (currency, name shown across
-- the UI), only CEO/ADMIN can change it.
DROP POLICY IF EXISTS company_settings_read ON company_settings;
CREATE POLICY company_settings_read ON company_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS company_settings_write ON company_settings;
CREATE POLICY company_settings_write ON company_settings
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN'));

-- Change-history audit log — CEO/ADMIN read; insert stays open to any
-- authenticated user since app code logs actions taken by every role.
DROP POLICY IF EXISTS audit_logs_read ON audit_logs;
CREATE POLICY audit_logs_read ON audit_logs
  FOR SELECT USING (current_user_role() IN ('CEO','ADMIN'));
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────────────────────
-- Sales / commercial
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS bookings_all ON bookings;
CREATE POLICY bookings_all ON bookings
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN','OPERATOR','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN','OPERATOR','ACCOUNTANT'));

DROP POLICY IF EXISTS clients_all ON clients;
CREATE POLICY clients_all ON clients
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT'));

DROP POLICY IF EXISTS customer_activities_all ON customer_activities;
CREATE POLICY customer_activities_all ON customer_activities
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN'));

DROP POLICY IF EXISTS sales_opportunities_all ON sales_opportunities;
CREATE POLICY sales_opportunities_all ON sales_opportunities
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN'));

DROP POLICY IF EXISTS route_quotations_all ON route_quotations;
CREATE POLICY route_quotations_all ON route_quotations
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN'));

DROP POLICY IF EXISTS rate_sheets_read ON rate_sheets;
CREATE POLICY rate_sheets_read ON rate_sheets
  FOR SELECT USING (current_user_role() IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT'));
DROP POLICY IF EXISTS rate_sheets_write ON rate_sheets;
CREATE POLICY rate_sheets_write ON rate_sheets
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN'));

DROP POLICY IF EXISTS contract_templates_all ON contract_templates;
CREATE POLICY contract_templates_all ON contract_templates
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN'));

DROP POLICY IF EXISTS contracts_all ON contracts;
CREATE POLICY contracts_all ON contracts
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT'));

DROP POLICY IF EXISTS transport_contracts_all ON transport_contracts;
CREATE POLICY transport_contracts_all ON transport_contracts
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT'));

-- ────────────────────────────────────────────────────────────────────────────
-- User-facing notifications: everyone sees/marks-read their own; staff who
-- send notifications (HR, allowances, webhooks) can insert for any user.
-- user_id is confirmed from notifications' own CREATE TABLE statement
-- (001_erp_workflow_tables.sql).
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS notifications_read_own ON notifications;
CREATE POLICY notifications_read_own ON notifications
  FOR SELECT USING (user_id = auth.uid() OR current_user_role() IN ('CEO','ADMIN'));
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (user_id = auth.uid() OR current_user_role() IN ('CEO','ADMIN'))
  WITH CHECK (user_id = auth.uid() OR current_user_role() IN ('CEO','ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- AI agent feature — CEO/ADMIN only (internal ops tooling, not
-- role-general).
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS ai_agent_messages_all ON ai_agent_messages;
CREATE POLICY ai_agent_messages_all ON ai_agent_messages
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN'));

DROP POLICY IF EXISTS ai_agent_runs_all ON ai_agent_runs;
CREATE POLICY ai_agent_runs_all ON ai_agent_runs
  FOR ALL USING (current_user_role() IN ('CEO','ADMIN'))
  WITH CHECK (current_user_role() IN ('CEO','ADMIN'));

INSERT INTO public.schema_migrations (version) VALUES ('038_lock_down_rls_gaps.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
