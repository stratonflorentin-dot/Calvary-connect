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

-- 4. Refresh PostgREST schema cache so new columns/tables are visible
NOTIFY pgrst, 'reload schema';
