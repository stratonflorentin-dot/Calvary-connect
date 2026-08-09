-- ============================================================================
-- 011: Fleet Finance Integration
-- ----------------------------------------------------------------------------
-- The fleet-finance UI (src/app/finance/fleet-finance/*) already queries
-- `vehicle_costs` and `trip_revenue`, and the fuel-costs / maintenance-costs
-- pages already insert/update rows in `vehicle_costs` directly. Neither
-- table exists in any migration — this creates them to match exactly what
-- that existing frontend code expects, rather than inventing a new shape.
--
-- It also fixes a silent join bug: vehicle-profitability's frontend code
-- filters trips by `t.vehicle_id`, but the trips table's actual FK column
-- is `truck_id` (see database/migrations/001-master-production-setup.sql).
-- Every vehicle's trip count / distance / cost-per-km currently computes
-- as zero because of this mismatch. Fixed by adding a real `vehicle_id`
-- column, backfilling it from `truck_id`, and a trigger to keep the two in
-- sync going forward (existing trip-creation code writes `truck_id`, so
-- that stays the column of record; `vehicle_id` mirrors it).
--
-- This repo has ~15 overlapping "setup" scripts under database/migrations
-- and database/patches (simple-setup, quick-setup, safe-setup, 001-008,
-- ready-to-copy, etc.) that don't all agree with each other, so every
-- change below is written defensively (IF NOT EXISTS / information_schema
-- checks) rather than assuming a specific one is authoritative on your
-- live database.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. trips.vehicle_id — fix the truck_id/vehicle_id mismatch
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE trips ADD COLUMN vehicle_id UUID REFERENCES vehicles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'distance_km'
  ) THEN
    ALTER TABLE trips ADD COLUMN distance_km DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Backfill from truck_id (the actual FK trip-creation code writes to)
UPDATE trips SET vehicle_id = truck_id WHERE vehicle_id IS NULL AND truck_id IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_trip_vehicle_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.truck_id IS NOT NULL AND (NEW.vehicle_id IS NULL OR NEW.vehicle_id <> NEW.truck_id) THEN
    NEW.vehicle_id := NEW.truck_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_trip_vehicle_id ON trips;
CREATE TRIGGER trg_sync_trip_vehicle_id
  BEFORE INSERT OR UPDATE OF truck_id ON trips
  FOR EACH ROW EXECUTE FUNCTION sync_trip_vehicle_id();

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. vehicle_costs
--    Matches the shape already used by fuel-costs/maintenance-costs pages
--    (which insert directly with { vehicle_id, amount, currency, date,
--    description, cost_type, trip_id? }). Kept as direct manual/UI entry —
--    NOT auto-synced from `expenses`, since those pages are the intended
--    entry point and syncing from expenses too would double-count.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  cost_type text NOT NULL CHECK (cost_type IN ('fuel', 'maintenance', 'tyre', 'insurance', 'other')),
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TZS',
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  trip_id uuid REFERENCES trips(id),
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_costs_vehicle ON vehicle_costs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_costs_trip ON vehicle_costs(trip_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_costs_type ON vehicle_costs(cost_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_costs_date ON vehicle_costs(date);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. trip_revenue
--    Unlike vehicle_costs, nothing in the codebase writes to trip_revenue —
--    only the two fleet-finance report pages read it. `invoices` (which
--    already has trip_id + amount + status, and already drives the real
--    accounting journal entries per ERP_PHASE_1_COMPLETION.md) is the
--    actual source of truth for revenue, so trip_revenue is auto-populated
--    from it via trigger instead of requiring a second, parallel manual
--    entry — one fewer place for revenue and the books to drift apart.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  date date NOT NULL DEFAULT CURRENT_DATE,
  customer_name text,
  source_invoice_id uuid REFERENCES invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_revenue_trip ON trip_revenue(trip_id);

-- SECURITY DEFINER: this trigger fires on every invoice insert/update, from
-- whichever finance-role user is doing that (already RLS-gated on invoices
-- itself). Without SECURITY DEFINER, the trigger's own INSERT into
-- trip_revenue would additionally need an INSERT policy on trip_revenue for
-- every such role — SECURITY DEFINER keeps trip_revenue locked to
-- trigger-only writes (see the read-only RLS policy below) instead of
-- opening it up for direct client inserts.
CREATE OR REPLACE FUNCTION sync_trip_revenue_from_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.trip_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO trip_revenue (trip_id, amount, currency, date, customer_name, source_invoice_id)
  VALUES (
    NEW.trip_id,
    COALESCE(NEW.total_amount, NEW.amount, 0),
    COALESCE(NEW.currency, 'TZS'),
    COALESCE(NEW.created_at::date, CURRENT_DATE),
    NEW.customer_name,
    NEW.id
  )
  ON CONFLICT (source_invoice_id) DO UPDATE SET
    trip_id = EXCLUDED.trip_id,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    customer_name = EXCLUDED.customer_name,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_trip_revenue ON invoices;
CREATE TRIGGER trg_sync_trip_revenue
  AFTER INSERT OR UPDATE OF total_amount, amount, trip_id, customer_name ON invoices
  FOR EACH ROW EXECUTE FUNCTION sync_trip_revenue_from_invoice();

-- Backfill trip_revenue from every existing invoice that already has a trip_id
INSERT INTO trip_revenue (trip_id, amount, currency, date, customer_name, source_invoice_id)
SELECT
  i.trip_id,
  COALESCE(i.total_amount, i.amount, 0),
  COALESCE(i.currency, 'TZS'),
  COALESCE(i.created_at::date, CURRENT_DATE),
  i.customer_name,
  i.id
FROM invoices i
WHERE i.trip_id IS NOT NULL
ON CONFLICT (source_invoice_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RLS — same finance/operations role model as the rest of the module
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE vehicle_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance/Ops manage vehicle costs" ON vehicle_costs;
CREATE POLICY "Finance/Ops manage vehicle costs" ON vehicle_costs
  FOR ALL USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'OPERATOR', 'MECHANIC'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'OPERATOR', 'MECHANIC'));

DROP POLICY IF EXISTS "Finance/Ops read trip revenue" ON trip_revenue;
CREATE POLICY "Finance/Ops read trip revenue" ON trip_revenue
  FOR SELECT USING (current_user_role() IN ('CEO', 'ADMIN', 'ACCOUNTANT', 'OPERATOR'));

-- trip_revenue is written only by the trigger (SECURITY DEFINER-free — runs
-- as the inserting user's privileges on invoices, which are already
-- finance-gated), so no direct INSERT/UPDATE policy is granted here.
