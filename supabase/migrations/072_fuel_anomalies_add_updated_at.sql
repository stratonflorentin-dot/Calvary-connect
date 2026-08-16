-- The generic workflow engine (src/lib/workflow/engine.ts applyTransition)
-- unconditionally writes `updated_at` on every transition for every entity
-- kind. fuel_anomalies never had that column — this is the exact same class
-- of bug already found and fixed for rate_sheets (migration
-- 066_fix_rate_sheets_missing_updated_at.sql) earlier today, caught here
-- before wiring fuel_anomaly into the workflow engine rather than after.
ALTER TABLE public.fuel_anomalies ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.fuel_anomalies SET updated_at = created_at WHERE created_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
