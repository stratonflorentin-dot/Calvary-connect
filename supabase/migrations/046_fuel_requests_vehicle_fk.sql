-- fuel-approvals/page.tsx embeds vehicle:vehicles(plate_number, make, model)
-- off fuel_requests.vehicle_id — PostgREST reported "Could not find a
-- relationship between 'fuel_requests' and 'vehicles'". Migration 029
-- (the comprehensive missing-FK audit) never covered fuel_requests at all,
-- and this repo has multiple competing fuel_requests definitions, at least
-- one of which (database/migrations/008-real-database-setup.sql,
-- database/patches/finance/setup-finance-tables.sql) declares vehicle_id
-- as plain TEXT with no FK at all, instead of 001-master-production-setup.sql's
-- UUID REFERENCES vehicles(id). If that version is what's actually live,
-- there's no relationship for PostgREST to discover no matter how many
-- times the schema cache reloads.
--
-- Same safe pattern as 029: existence-checked before adding, plus a type
-- check/conversion since this table's real live column type wasn't
-- confirmed. If existing data isn't valid UUID text, the conversion is
-- skipped with a notice rather than failing the whole migration.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type FROM information_schema.columns
   WHERE table_name = 'fuel_requests' AND column_name = 'vehicle_id';

  IF v_type IS NOT NULL AND v_type IS DISTINCT FROM 'uuid' THEN
    BEGIN
      ALTER TABLE fuel_requests ALTER COLUMN vehicle_id TYPE uuid USING vehicle_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'fuel_requests.vehicle_id could not be converted to uuid (%), left as-is', SQLERRM;
    END;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_fuel_requests_vehicle_id' AND table_name = 'fuel_requests'
  ) AND (SELECT data_type FROM information_schema.columns
          WHERE table_name = 'fuel_requests' AND column_name = 'vehicle_id') = 'uuid'
  THEN
    ALTER TABLE fuel_requests ADD CONSTRAINT fk_fuel_requests_vehicle_id
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- driver_id -> user_profiles: not the reported error (only vehicles was),
-- but the same defensive check costs nothing and closes the same class of
-- gap if this table's live driver_id also lacks its FK.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_fuel_requests_driver_id' AND table_name = 'fuel_requests'
  ) AND (SELECT data_type FROM information_schema.columns
          WHERE table_name = 'fuel_requests' AND column_name = 'driver_id') = 'uuid'
  THEN
    ALTER TABLE fuel_requests ADD CONSTRAINT fk_fuel_requests_driver_id
      FOREIGN KEY (driver_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO public.schema_migrations (version) VALUES ('046_fuel_requests_vehicle_fk.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
