-- Fix trip creation and the "permission denied for table users" class of errors.
--
-- Root cause: a legacy public.users table exists but the API roles have no
-- grants on it, so PostgREST hides it AND any trigger/FK that touches it
-- fails the whole insert (seen on trips and chat_channels). Trips inserts
-- also failed because the client sent camelCase columns; the form now sends
-- the real snake_case columns, and this migration adds the few columns the
-- UI legitimately needs.
--
-- Run in the Supabase SQL editor. Idempotent.

-- 1. Grant API roles access to the legacy users table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated, service_role;
    GRANT SELECT ON TABLE public.users TO anon;
  END IF;
END $$;

-- 2. Columns the trip form and trip lists actually use
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimated_distance numeric;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimated_duration numeric;

-- 3. Trip type drives VAT: local trips carry VAT, transit trips are exempt.
--    Normalize any existing values and default new rows to 'local'.
UPDATE trips SET trip_type = 'local' WHERE trip_type IS NULL;
ALTER TABLE trips ALTER COLUMN trip_type SET DEFAULT 'local';

-- 4. Bank reconciliation support on existing tables
ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS matched_entity_type text;
ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS matched_entity_id uuid;
ALTER TABLE invoices            ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false;
ALTER TABLE expenses            ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id),
  period_end date NOT NULL,
  opening_balance numeric,
  closing_balance numeric,
  book_balance numeric,
  difference numeric,
  lines_reconciled int,
  reconciled_by uuid,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bank_reconciliations_read ON bank_reconciliations;
CREATE POLICY bank_reconciliations_read ON bank_reconciliations
  FOR SELECT USING (true);
DROP POLICY IF EXISTS bank_reconciliations_write ON bank_reconciliations;
CREATE POLICY bank_reconciliations_write ON bank_reconciliations
  FOR INSERT WITH CHECK (true);

-- 5. Refresh PostgREST schema cache so new columns/tables are visible
NOTIFY pgrst, 'reload schema';
