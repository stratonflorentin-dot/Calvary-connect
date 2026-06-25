-- Create rate_sheets table for editable transport routes and pricing

CREATE TABLE IF NOT EXISTS public.rate_sheets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  route_name VARCHAR(255) NOT NULL UNIQUE,
  origin VARCHAR(255) DEFAULT 'DAR PORT',
  destination VARCHAR(255) NOT NULL,
  container_20ft DECIMAL(10, 2) NOT NULL,
  container_40ft DECIMAL(10, 2) NOT NULL,
  loose_cargo DECIMAL(10, 2) NOT NULL,
  truck_type VARCHAR(50) DEFAULT 'C28',
  transit_days INTEGER DEFAULT 3,
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.rate_sheets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read active rate sheets
CREATE POLICY "Anyone can view active rate sheets"
  ON public.rate_sheets
  FOR SELECT
  USING (is_active = true);

-- RLS Policy: Only authenticated users can modify (assuming admin role)
-- RLS Policy: Only users with role CEO, ADMIN or SALESMAN (from user_profiles) may insert/update/delete
-- Assumes a `user_profiles` table with `uid` and `role` columns.
-- Use a focused policy for INSERT/UPDATE/DELETE that works with Supabase auth helpers.
-- Role-based policies: split per command because Postgres doesn't accept commas after FOR
CREATE POLICY "Role-based insert for rate_sheets"
  ON public.rate_sheets
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      (SELECT role FROM public.user_profiles WHERE user_profiles.id = auth.uid()) IN ('CEO', 'ADMIN', 'SALESMAN')
      OR auth.role() = 'service_role'
    )
  );

CREATE POLICY "Role-based update for rate_sheets"
  ON public.rate_sheets
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND (
      (SELECT role FROM public.user_profiles WHERE user_profiles.id = auth.uid()) IN ('CEO', 'ADMIN', 'SALESMAN')
      OR auth.role() = 'service_role'
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      (SELECT role FROM public.user_profiles WHERE user_profiles.id = auth.uid()) IN ('CEO', 'ADMIN', 'SALESMAN')
      OR auth.role() = 'service_role'
    )
  );

CREATE POLICY "Role-based delete for rate_sheets"
  ON public.rate_sheets
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND (
      (SELECT role FROM public.user_profiles WHERE user_profiles.id = auth.uid()) IN ('CEO', 'ADMIN', 'SALESMAN')
      OR auth.role() = 'service_role'
    )
  );

-- Optional: allow service_role (server-side) to bypass role checks when needed.

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_sheets_active ON public.rate_sheets(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_sheets_route_name ON public.rate_sheets(route_name);
-- Ensure a UNIQUE index exists for route_name so ON CONFLICT(route_name) works
CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_sheets_route_name ON public.rate_sheets(route_name);

-- Audit table to track changes to rate sheets (who changed rates and when)
CREATE TABLE IF NOT EXISTS public.rate_sheet_edits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rate_sheet_id UUID,
  operation VARCHAR(10) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  edited_by UUID,
  editor_role VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Function to log changes into rate_sheet_edits. Runs as owner to ensure inserts succeed.
CREATE OR REPLACE FUNCTION public.log_rate_sheet_changes()
RETURNS trigger AS $$
DECLARE
  usr_role TEXT := NULL;
  v_uid UUID := NULL;
BEGIN
  -- Capture invoking user id and role (works with Supabase auth helpers in RLS/context)
  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    SELECT role INTO usr_role FROM public.user_profiles WHERE id = v_uid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rate_sheet_edits(rate_sheet_id, operation, old_data, new_data, edited_by, editor_role)
    VALUES (NEW.id, 'INSERT', NULL, to_jsonb(NEW), v_uid, usr_role);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.rate_sheet_edits(rate_sheet_id, operation, old_data, new_data, edited_by, editor_role)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_uid, usr_role);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.rate_sheet_edits(rate_sheet_id, operation, old_data, new_data, edited_by, editor_role)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), NULL, v_uid, usr_role);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Trigger to call the logging function after changes
DROP TRIGGER IF EXISTS trg_rate_sheet_audit ON public.rate_sheets;
CREATE TRIGGER trg_rate_sheet_audit
AFTER INSERT OR UPDATE OR DELETE ON public.rate_sheets
FOR EACH ROW EXECUTE FUNCTION public.log_rate_sheet_changes();

-- Ensure expected pricing columns exist (helpful when this script runs against older schemas)
ALTER TABLE public.rate_sheets
  ADD COLUMN IF NOT EXISTS container_20ft DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS container_40ft DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loose_cargo DECIMAL(10,2) DEFAULT 0;

-- Ensure other expected columns exist
ALTER TABLE public.rate_sheets
  ADD COLUMN IF NOT EXISTS truck_type VARCHAR(50) DEFAULT 'C28',
  ADD COLUMN IF NOT EXISTS transit_days INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';

-- Insert default rate sheet data
INSERT INTO public.rate_sheets (route_name, destination, container_20ft, container_40ft, loose_cargo, truck_type, transit_days, currency)
VALUES
  ('KIGALI - RWANDA', 'Kigali', 3100, 3100, 3100, 'C28', 3, 'USD'),
  ('LUSAKA - ZAMBIA', 'Lusaka', 4000, 4000, 4000, 'C28', 5, 'USD'),
  ('SOLWEZI - ZAMBIA', 'Solwezi', 4800, 4800, 4800, 'C28', 6, 'USD'),
  ('BUJUMBURA - BURUNDI', 'Bujumbura', 3200, 3200, 3200, 'C28', 3, 'USD'),
  ('LILONGWE - MALAWI', 'Lilongwe', 4000, 4000, 4000, 'C28', 4, 'USD'),
  ('BLANTYRE - MALAWI', 'Blantyre', 4400, 4400, 4400, 'C28', 4, 'USD'),
  ('KITWE - ZAMBIA', 'Kitwe', 4000, 4000, 4400, 'C28', 5, 'USD'),
  ('GOMA - DRC', 'Goma', 4400, 4400, 4400, 'C28', 4, 'USD'),
  ('BUKAVU - DRC', 'Bukavu', 4800, 4800, 4800, 'C28', 5, 'USD'),
  ('LUBUMBASHI - DRC', 'Lubumbashi', 6400, 6400, 6400, 'C28', 7, 'USD'),
  ('KOLWEZI - DRC', 'Kolwezi', 7200, 7200, 7200, 'C28', 8, 'USD'),
  ('LIKASI - DRC', 'Likasi', 8500, 8500, 8500, 'C28', 9, 'USD')
ON CONFLICT (route_name) DO NOTHING;
