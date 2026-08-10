-- Phase 4: auto-populate vehicle_costs from approved fuel/maintenance
-- expenses, the same way 011 already auto-populates trip_revenue from
-- invoices.
--
-- Finding: fuel-request approval (WorkflowService.approveFuelRequest) and
-- maintenance completion (WorkflowService.completeMaintenance) already
-- capture exactly the cost data vehicle_costs needs — type, amount,
-- currency, vehicle_id, date, status — but write it into `expenses`
-- only. vehicle_costs stays empty for that data because its only two
-- writers are the manual fuel-costs/maintenance-costs UI pages
-- (src/app/finance/fleet-finance/{fuel-costs,maintenance-costs}). Those
-- are a completely separate path from the real driver → approval →
-- expense workflow.
--
-- Consequence: vehicle-profitability and route-profitability
-- (src/app/finance/fleet-finance/{vehicle,route}-profitability) read
-- ONLY vehicle_costs, so every fuel/maintenance cost that went through
-- the actual approval workflow is invisible to them unless someone
-- manually re-enters the same number a second time on the fuel-costs/
-- maintenance-costs pages. That's the real gap this closes.
--
-- Same anti-double-count design as trip_revenue: a unique
-- source_expense_id, keyed with ON CONFLICT, so re-running this
-- migration or a later UPDATE on the same expense never creates a
-- second row. Only fires for status IN ('approved','paid') — a
-- still-pending expense request isn't a cost yet.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE vehicle_costs ADD COLUMN IF NOT EXISTS source_expense_id uuid REFERENCES expenses(id);
-- Plain unique index, not partial: Postgres already lets unlimited NULLs
-- coexist under a normal unique constraint (each NULL is distinct), so
-- vehicle_costs rows from the manual fuel-costs/maintenance-costs pages
-- (which never set source_expense_id) are unaffected. A partial index
-- would need its WHERE predicate repeated on every ON CONFLICT clause
-- below to be usable for conflict inference — simpler to avoid that.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_costs_source_expense ON vehicle_costs(source_expense_id);

-- SECURITY DEFINER for the same reason as sync_trip_revenue_from_invoice:
-- keeps vehicle_costs' direct-insert policy scoped to the manual UI
-- pages' roles, without needing every role that can create an expense
-- to also have an INSERT grant on vehicle_costs.
CREATE OR REPLACE FUNCTION sync_vehicle_cost_from_expense()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  mapped_cost_type text;
BEGIN
  mapped_cost_type := CASE NEW.type
    WHEN 'fuel' THEN 'fuel'
    WHEN 'maintenance' THEN 'maintenance'
    WHEN 'repair' THEN 'maintenance'
    WHEN 'insurance' THEN 'insurance'
    ELSE NULL
  END;

  IF mapped_cost_type IS NULL OR NEW.vehicle_id IS NULL OR NEW.status NOT IN ('approved', 'paid') THEN
    RETURN NEW;
  END IF;

  INSERT INTO vehicle_costs (vehicle_id, cost_type, amount, currency, date, description, trip_id, source_expense_id)
  VALUES (
    NEW.vehicle_id,
    mapped_cost_type,
    COALESCE(NEW.amount, 0),
    COALESCE(NEW.currency, 'TZS'),
    COALESCE(NEW.date, NEW.created_at::date, CURRENT_DATE),
    NEW.description,
    NEW.trip_id,
    NEW.id
  )
  ON CONFLICT (source_expense_id) DO UPDATE SET
    cost_type = EXCLUDED.cost_type,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vehicle_cost_from_expense ON expenses;
CREATE TRIGGER trg_sync_vehicle_cost_from_expense
  AFTER INSERT OR UPDATE OF type, amount, currency, date, vehicle_id, status ON expenses
  FOR EACH ROW EXECUTE FUNCTION sync_vehicle_cost_from_expense();

-- Backfill: every already-approved/paid fuel/maintenance/repair/insurance
-- expense with a vehicle_id, that predates this trigger.
INSERT INTO vehicle_costs (vehicle_id, cost_type, amount, currency, date, description, trip_id, source_expense_id)
SELECT
  e.vehicle_id,
  CASE e.type
    WHEN 'fuel' THEN 'fuel'
    WHEN 'maintenance' THEN 'maintenance'
    WHEN 'repair' THEN 'maintenance'
    WHEN 'insurance' THEN 'insurance'
  END,
  COALESCE(e.amount, 0),
  COALESCE(e.currency, 'TZS'),
  COALESCE(e.date, e.created_at::date, CURRENT_DATE),
  e.description,
  e.trip_id,
  e.id
FROM expenses e
WHERE e.type IN ('fuel', 'maintenance', 'repair', 'insurance')
  AND e.vehicle_id IS NOT NULL
  AND e.status IN ('approved', 'paid')
ON CONFLICT (source_expense_id) DO NOTHING;

INSERT INTO public.schema_migrations (version) VALUES ('039_vehicle_costs_from_expenses.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
