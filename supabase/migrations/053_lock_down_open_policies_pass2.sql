-- Second RLS pass, found while writing an integration test for migration
-- 050's invoice-posting trigger. Phase 2 earlier in this project checked
-- whether the ANON key could reach a table; this is a different bug class
-- entirely: whether ANY authenticated user regardless of role — a DRIVER,
-- a MECHANIC — can read/write tables they have no business touching,
-- because a leftover `USING(true)` policy from
-- 001-master-production-setup.sql sits alongside a real, later-added,
-- correctly role-scoped policy. Postgres OR's every matching policy
-- together, so the open one makes the scoped one meaningless no matter how
-- well it's written. 16 tables have this pattern; most already have a
-- correct policy sitting right next to the bad one and just need the open
-- one dropped. Five had no good alternative at all and get a real policy
-- here: bank_reconciliations, chart_of_accounts (dead — 0 references in
-- src/, same as the tables migration 048 locked down with no policy),
-- contract_documents, fuel_requests, vehicle_documents.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- ============ Tables that already have a correct policy — just drop the leftover open one ============
DROP POLICY IF EXISTS "Public manage audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow delete access to bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow insert access to bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow read access to bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow update access to bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Public manage settings" ON company_settings;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON contract_templates;
DROP POLICY IF EXISTS "Allow delete access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow insert access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow read access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow update access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow delete access to income" ON income;
DROP POLICY IF EXISTS "Allow insert access to income" ON income;
DROP POLICY IF EXISTS "Allow read access to income" ON income;
DROP POLICY IF EXISTS "Allow update access to income" ON income;
DROP POLICY IF EXISTS "Allow delete access to invoices" ON invoices;
DROP POLICY IF EXISTS "Allow insert access to invoices" ON invoices;
DROP POLICY IF EXISTS "Allow read access to invoices" ON invoices;
DROP POLICY IF EXISTS "Allow update access to invoices" ON invoices;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "pod_all" ON proof_of_delivery;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON rate_sheets;
DROP POLICY IF EXISTS "Allow delete access to taxes" ON taxes;
DROP POLICY IF EXISTS "Allow insert access to taxes" ON taxes;
DROP POLICY IF EXISTS "Allow read access to taxes" ON taxes;
DROP POLICY IF EXISTS "Allow update access to taxes" ON taxes;
DROP POLICY IF EXISTS "Public manage vehicles" ON vehicles;

-- ============ bank_reconciliations: no good alternative existed ============
DROP POLICY IF EXISTS bank_reconciliations_read ON bank_reconciliations;
CREATE POLICY bank_reconciliations_read ON bank_reconciliations FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));
DROP POLICY IF EXISTS bank_reconciliations_write ON bank_reconciliations;
CREATE POLICY bank_reconciliations_write ON bank_reconciliations FOR INSERT
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT'));

-- ============ chart_of_accounts: dead table (0 references in src/), same pattern as migration 048's unreferenced tables ============
DROP POLICY IF EXISTS "Allow delete access to chart_of_accounts" ON chart_of_accounts;
DROP POLICY IF EXISTS "Allow insert access to chart_of_accounts" ON chart_of_accounts;
DROP POLICY IF EXISTS "Allow read access to chart_of_accounts" ON chart_of_accounts;
DROP POLICY IF EXISTS "Allow update access to chart_of_accounts" ON chart_of_accounts;

-- ============ contract_documents: no good alternative existed — matches contract_templates_all's role set ============
DROP POLICY IF EXISTS contract_documents_all ON contract_documents;
CREATE POLICY contract_documents_all ON contract_documents FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN'));

-- ============ fuel_requests: no good alternative existed — union of /fuel and /fuel-approvals role sets ============
DROP POLICY IF EXISTS fuel_requests_all ON fuel_requests;
CREATE POLICY fuel_requests_all ON fuel_requests FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'MECHANIC'));

-- ============ vehicle_documents: write side had no good alternative; read side already fine (any authenticated user) ============
-- "Admin manage vehicle_documents" checked role IN ('admin','manager') — lowercase values that
-- don't match this app's actual UserRole strings ('ADMIN', 'CEO', ...), so it was already dead/no-op.
DROP POLICY IF EXISTS "Admin manage vehicle_documents" ON vehicle_documents;
DROP POLICY IF EXISTS vehicle_documents_write ON vehicle_documents;
CREATE POLICY vehicle_documents_write ON vehicle_documents FOR INSERT
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'));
DROP POLICY IF EXISTS vehicle_documents_update ON vehicle_documents;
CREATE POLICY vehicle_documents_update ON vehicle_documents FOR UPDATE
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'));
DROP POLICY IF EXISTS vehicle_documents_delete ON vehicle_documents;
CREATE POLICY vehicle_documents_delete ON vehicle_documents FOR DELETE
  USING (current_user_role() IN ('CEO', 'ADMIN'));

INSERT INTO public.schema_migrations (version) VALUES ('053_lock_down_open_policies_pass2.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
