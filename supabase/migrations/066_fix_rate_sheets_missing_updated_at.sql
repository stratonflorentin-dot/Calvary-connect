-- The update_rate_sheets_updated_at trigger (BEFORE UPDATE, calls
-- update_updated_at_column()) unconditionally sets NEW.updated_at, but
-- rate_sheets never had an updated_at column — so every UPDATE on the
-- table (editing a rate sheet, or soft-deleting one via is_active=false)
-- fails with: record "new" has no field "updated_at".
ALTER TABLE public.rate_sheets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.rate_sheets
  SET updated_at = created_at
  WHERE created_at IS NOT NULL;
