-- Phase 6: customers has never had a policy from the authoritative
-- supabase/migrations/ tree — only competing legacy patches touch it,
-- with three different policy names across database/migrations/004 and
-- two database/patches/sales scripts, all "any authenticated user, full
-- access" (not anon-open, so it didn't show up in Phase 2's anon-key
-- sweep, but a DRIVER or MECHANIC role can currently read/edit customer
-- PII and credit terms same as SALESMAN/ACCOUNTANT/CEO/ADMIN can).
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

REVOKE ALL ON customers FROM anon;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to customers" ON customers;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON customers;
DROP POLICY IF EXISTS "Users can view own customer profile" ON customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON customers;

CREATE POLICY customers_all ON customers FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN', 'ACCOUNTANT'));

INSERT INTO public.schema_migrations (version) VALUES ('043_lock_down_customers_rls.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
