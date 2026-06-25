-- Truck Insurance Management System
-- Production-ready migration for fleet insurance, TIRA compliance, COMESA coverage,
-- claims, renewal tracking, document metadata, and dashboard reporting.

-- ==================== EXTENSIONS ====================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== HELPER FUNCTIONS ====================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid()),
    ''
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_insurance()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() IN ('ADMIN', 'HR', 'CEO');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_view_insurance()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() IN ('ADMIN', 'HR', 'CEO', 'ACCOUNTANT', 'OPERATOR');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.calculate_insurance_status(DATE) CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_insurance_status(policy_expiry_date DATE)
RETURNS VARCHAR(50) AS $$
BEGIN
  IF policy_expiry_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF policy_expiry_date <= CURRENT_DATE + 30 THEN
    RETURN 'expiring_soon';
  ELSE
    RETURN 'active';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== MAIN TABLES ====================

CREATE TABLE IF NOT EXISTS public.truck_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insurer_name VARCHAR(255) NOT NULL,
  policy_number VARCHAR(120),
  policy_type VARCHAR(50) NOT NULL CHECK (
    policy_type IN ('third_party', 'third_party_cargo', 'comprehensive', 'cross_border')
  ),
  tira_reference_number VARCHAR(100) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  annual_premium NUMERIC(14, 2) NOT NULL CHECK (annual_premium >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'TZS',
  assigned_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  route_coverage_area VARCHAR(255),
  covered_countries TEXT[] NOT NULL DEFAULT ARRAY['Tanzania'],
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'expiring_soon', 'expired', 'cancelled')
  ),
  is_cross_border BOOLEAN NOT NULL DEFAULT FALSE,
  has_comesa_yellow_card BOOLEAN NOT NULL DEFAULT FALSE,
  comesa_yellow_card_number VARCHAR(120),
  comesa_expiry_date DATE,
  policy_document_url TEXT,
  policy_document_name TEXT,
  policy_document_uploaded_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT truck_insurance_valid_dates CHECK (expiry_date >= start_date),
  CONSTRAINT truck_insurance_cross_border_comesa CHECK (
    is_cross_border = FALSE
    OR has_comesa_yellow_card = TRUE
    OR policy_type = 'cross_border'
  ),
  CONSTRAINT truck_insurance_comesa_details CHECK (
    has_comesa_yellow_card = FALSE
    OR comesa_yellow_card_number IS NOT NULL
  )
);

ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS policy_number VARCHAR(120);
ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS covered_countries TEXT[] DEFAULT ARRAY['Tanzania']::TEXT[];
ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS comesa_yellow_card_number VARCHAR(120);
ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS comesa_expiry_date DATE;
ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS policy_document_name TEXT;
ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS policy_document_uploaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.truck_insurance ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;

UPDATE public.truck_insurance
SET currency = COALESCE(currency, 'TZS'),
    covered_countries = COALESCE(covered_countries, ARRAY['Tanzania']::TEXT[]);

ALTER TABLE public.truck_insurance ALTER COLUMN currency SET DEFAULT 'TZS';
ALTER TABLE public.truck_insurance ALTER COLUMN covered_countries SET DEFAULT ARRAY['Tanzania']::TEXT[];
ALTER TABLE public.truck_insurance ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.truck_insurance ALTER COLUMN covered_countries SET NOT NULL;

ALTER TABLE public.truck_insurance DROP CONSTRAINT IF EXISTS truck_insurance_status_check;
ALTER TABLE public.truck_insurance ADD CONSTRAINT truck_insurance_status_check
  CHECK (status IN ('active', 'expiring_soon', 'expired', 'cancelled')) NOT VALID;

ALTER TABLE public.truck_insurance DROP CONSTRAINT IF EXISTS truck_insurance_valid_dates;
ALTER TABLE public.truck_insurance ADD CONSTRAINT truck_insurance_valid_dates
  CHECK (expiry_date >= start_date) NOT VALID;

ALTER TABLE public.truck_insurance DROP CONSTRAINT IF EXISTS truck_insurance_cross_border_comesa;
ALTER TABLE public.truck_insurance ADD CONSTRAINT truck_insurance_cross_border_comesa
  CHECK (is_cross_border = FALSE OR has_comesa_yellow_card = TRUE OR policy_type = 'cross_border') NOT VALID;

ALTER TABLE public.truck_insurance DROP CONSTRAINT IF EXISTS truck_insurance_comesa_details;
ALTER TABLE public.truck_insurance ADD CONSTRAINT truck_insurance_comesa_details
  CHECK (has_comesa_yellow_card = FALSE OR comesa_yellow_card_number IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_truck_insurance_vehicle_id
  ON public.truck_insurance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_truck_insurance_driver_id
  ON public.truck_insurance(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_truck_insurance_status
  ON public.truck_insurance(status);
CREATE INDEX IF NOT EXISTS idx_truck_insurance_expiry_date
  ON public.truck_insurance(expiry_date);
CREATE INDEX IF NOT EXISTS idx_truck_insurance_insurer
  ON public.truck_insurance(insurer_name);
CREATE INDEX IF NOT EXISTS idx_truck_insurance_cross_border
  ON public.truck_insurance(is_cross_border, has_comesa_yellow_card);
CREATE INDEX IF NOT EXISTS idx_truck_insurance_covered_countries
  ON public.truck_insurance USING gin(covered_countries);

CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_insurance_id UUID NOT NULL REFERENCES public.truck_insurance(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trip_id UUID,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  claim_date DATE NOT NULL,
  incident_date DATE,
  claim_type VARCHAR(50) NOT NULL CHECK (
    claim_type IN ('accident', 'theft', 'damage', 'third_party', 'cargo', 'windscreen', 'fire', 'other')
  ),
  claim_amount NUMERIC(14, 2) NOT NULL CHECK (claim_amount >= 0),
  approved_amount NUMERIC(14, 2) CHECK (approved_amount IS NULL OR approved_amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'TZS',
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'paid', 'resolved')
  ),
  insurer_claim_reference VARCHAR(120),
  police_report_number VARCHAR(120),
  resolution_notes TEXT,
  approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS trip_id UUID;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS incident_date DATE;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(14, 2);
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TZS';
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS insurer_claim_reference VARCHAR(120);
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS police_report_number VARCHAR(120);
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

UPDATE public.insurance_claims
SET currency = COALESCE(currency, 'TZS');

ALTER TABLE public.insurance_claims ALTER COLUMN currency SET DEFAULT 'TZS';
ALTER TABLE public.insurance_claims ALTER COLUMN currency SET NOT NULL;

ALTER TABLE public.insurance_claims DROP CONSTRAINT IF EXISTS insurance_claims_claim_type_check;
ALTER TABLE public.insurance_claims ADD CONSTRAINT insurance_claims_claim_type_check
  CHECK (claim_type IN ('accident', 'theft', 'damage', 'third_party', 'cargo', 'windscreen', 'fire', 'other')) NOT VALID;

ALTER TABLE public.insurance_claims DROP CONSTRAINT IF EXISTS insurance_claims_status_check;
ALTER TABLE public.insurance_claims ADD CONSTRAINT insurance_claims_status_check
  CHECK (status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'paid', 'resolved')) NOT VALID;

ALTER TABLE public.insurance_claims DROP CONSTRAINT IF EXISTS insurance_claims_claim_amount_check;
ALTER TABLE public.insurance_claims ADD CONSTRAINT insurance_claims_claim_amount_check
  CHECK (claim_amount >= 0) NOT VALID;

ALTER TABLE public.insurance_claims DROP CONSTRAINT IF EXISTS insurance_claims_approved_amount_check;
ALTER TABLE public.insurance_claims ADD CONSTRAINT insurance_claims_approved_amount_check
  CHECK (approved_amount IS NULL OR approved_amount >= 0) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy
  ON public.insurance_claims(truck_insurance_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_vehicle
  ON public.insurance_claims(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_driver
  ON public.insurance_claims(driver_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status
  ON public.insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_date
  ON public.insurance_claims(claim_date);

CREATE TABLE IF NOT EXISTS public.insurance_renewal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_insurance_id UUID NOT NULL REFERENCES public.truck_insurance(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(truck_insurance_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_insurance_renewal_tasks_due_date
  ON public.insurance_renewal_tasks(due_date, status);
CREATE INDEX IF NOT EXISTS idx_insurance_renewal_tasks_assigned_to
  ON public.insurance_renewal_tasks(assigned_to);

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION public.update_insurance_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> 'cancelled' THEN
    NEW.status = public.calculate_insurance_status(NEW.expiry_date);
  END IF;

  IF NEW.policy_document_url IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.policy_document_url IS DISTINCT FROM OLD.policy_document_url) THEN
    NEW.policy_document_uploaded_at = NOW();
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_insurance_status_trigger ON public.truck_insurance;
CREATE TRIGGER update_insurance_status_trigger
BEFORE INSERT OR UPDATE ON public.truck_insurance
FOR EACH ROW
EXECUTE FUNCTION public.update_insurance_status();

DROP TRIGGER IF EXISTS set_insurance_claims_updated_at ON public.insurance_claims;
CREATE TRIGGER set_insurance_claims_updated_at
BEFORE UPDATE ON public.insurance_claims
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_insurance_renewal_tasks_updated_at ON public.insurance_renewal_tasks;
CREATE TRIGGER set_insurance_renewal_tasks_updated_at
BEFORE UPDATE ON public.insurance_renewal_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_insurance_renewal_task()
RETURNS TRIGGER AS $$
DECLARE
  renewal_due_date DATE;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  renewal_due_date = NEW.expiry_date - 30;

  INSERT INTO public.insurance_renewal_tasks (
    truck_insurance_id,
    vehicle_id,
    due_date,
    priority,
    status,
    notes
  )
  VALUES (
    NEW.id,
    NEW.vehicle_id,
    renewal_due_date,
    CASE
      WHEN NEW.expiry_date <= CURRENT_DATE + 7 THEN 'critical'
      WHEN NEW.expiry_date <= CURRENT_DATE + 14 THEN 'high'
      ELSE 'normal'
    END,
    'open',
    'Renew insurance before expiry date: ' || NEW.expiry_date::TEXT
  )
  ON CONFLICT (truck_insurance_id, due_date) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_insurance_renewal_task_trigger ON public.truck_insurance;
CREATE TRIGGER create_insurance_renewal_task_trigger
AFTER INSERT OR UPDATE OF expiry_date, status ON public.truck_insurance
FOR EACH ROW
EXECUTE FUNCTION public.create_insurance_renewal_task();

-- ==================== REPORTING VIEWS ====================

DROP VIEW IF EXISTS public.insurance_dashboard_summary CASCADE;
DROP VIEW IF EXISTS public.cross_border_coverage_check CASCADE;
DROP VIEW IF EXISTS public.tira_compliance_report CASCADE;
DROP VIEW IF EXISTS public.expiring_insurance_policies CASCADE;
DROP VIEW IF EXISTS public.insurance_policy_register CASCADE;

CREATE OR REPLACE VIEW public.insurance_policy_register AS
SELECT
  ti.*,
  v.plate_number,
  v.make,
  v.model,
  ti.assigned_driver_id AS assigned_driver_reference,
  GREATEST((ti.expiry_date - CURRENT_DATE), -99999) AS days_until_expiry,
  CASE
    WHEN ti.policy_document_url IS NULL THEN 'missing_document'
    WHEN ti.last_verified_at IS NULL THEN 'needs_verification'
    WHEN ti.last_verified_at < NOW() - INTERVAL '90 days' THEN 'verification_stale'
    ELSE 'verified'
  END AS document_status
FROM public.truck_insurance ti
JOIN public.vehicles v ON ti.vehicle_id = v.id;

CREATE OR REPLACE VIEW public.expiring_insurance_policies AS
SELECT *
FROM public.insurance_policy_register
WHERE expiry_date <= CURRENT_DATE + 30
  AND expiry_date >= CURRENT_DATE - 30
  AND status <> 'cancelled'
ORDER BY expiry_date ASC;

CREATE OR REPLACE VIEW public.tira_compliance_report AS
SELECT
  v.id AS vehicle_id,
  v.plate_number,
  v.make,
  v.model,
  COUNT(ti.id) AS total_policies,
  COUNT(ti.id) FILTER (
    WHERE ti.policy_type IN ('third_party', 'third_party_cargo', 'comprehensive', 'cross_border')
      AND ti.expiry_date >= CURRENT_DATE
      AND ti.status <> 'cancelled'
  ) AS valid_policy_count,
  CASE
    WHEN COUNT(ti.id) FILTER (
      WHERE ti.policy_type IN ('third_party', 'third_party_cargo', 'comprehensive', 'cross_border')
        AND ti.expiry_date >= CURRENT_DATE
        AND ti.status <> 'cancelled'
    ) > 0 THEN TRUE
    ELSE FALSE
  END AS has_valid_coverage,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT ti.policy_type), NULL) AS policy_types,
  MAX(ti.expiry_date) AS latest_expiry,
  MIN(ti.expiry_date) FILTER (
    WHERE ti.expiry_date >= CURRENT_DATE AND ti.status <> 'cancelled'
  ) AS nearest_active_expiry
FROM public.vehicles v
LEFT JOIN public.truck_insurance ti ON v.id = ti.vehicle_id
GROUP BY v.id, v.plate_number, v.make, v.model;

CREATE OR REPLACE VIEW public.cross_border_coverage_check AS
SELECT
  ti.id,
  ti.vehicle_id,
  v.plate_number,
  ti.insurer_name,
  ti.policy_type,
  ti.covered_countries,
  ti.is_cross_border,
  ti.has_comesa_yellow_card,
  ti.comesa_yellow_card_number,
  ti.comesa_expiry_date,
  ti.expiry_date,
  CASE
    WHEN ti.is_cross_border AND NOT ti.has_comesa_yellow_card THEN 'MISSING_YELLOW_CARD'
    WHEN ti.is_cross_border AND ti.has_comesa_yellow_card AND ti.comesa_expiry_date < CURRENT_DATE THEN 'YELLOW_CARD_EXPIRED'
    WHEN ti.is_cross_border AND ti.has_comesa_yellow_card THEN 'COMPLIANT'
    ELSE 'NOT_CROSS_BORDER'
  END AS comesa_status
FROM public.truck_insurance ti
JOIN public.vehicles v ON ti.vehicle_id = v.id
WHERE ti.is_cross_border = TRUE
ORDER BY ti.expiry_date ASC;

CREATE OR REPLACE VIEW public.insurance_dashboard_summary AS
SELECT
  COUNT(*) AS total_policies,
  COUNT(*) FILTER (WHERE status = 'active') AS active_policies,
  COUNT(*) FILTER (WHERE status = 'expiring_soon') AS expiring_soon_policies,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_policies,
  COUNT(*) FILTER (WHERE is_cross_border) AS cross_border_policies,
  COUNT(*) FILTER (WHERE is_cross_border AND has_comesa_yellow_card) AS cross_border_with_yellow_card,
  COUNT(*) FILTER (WHERE is_cross_border AND NOT has_comesa_yellow_card) AS cross_border_missing_yellow_card,
  COALESCE(SUM(annual_premium), 0) AS total_annual_premium,
  COUNT(*) FILTER (WHERE policy_document_url IS NULL) AS missing_policy_documents
FROM public.truck_insurance
WHERE status <> 'cancelled';

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE public.truck_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_renewal_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insurance_select" ON public.truck_insurance;
DROP POLICY IF EXISTS "insurance_insert" ON public.truck_insurance;
DROP POLICY IF EXISTS "insurance_update" ON public.truck_insurance;
DROP POLICY IF EXISTS "insurance_delete" ON public.truck_insurance;

CREATE POLICY "insurance_select" ON public.truck_insurance
  FOR SELECT USING (public.can_view_insurance());

CREATE POLICY "insurance_insert" ON public.truck_insurance
  FOR INSERT WITH CHECK (public.can_manage_insurance());

CREATE POLICY "insurance_update" ON public.truck_insurance
  FOR UPDATE USING (public.can_manage_insurance())
  WITH CHECK (public.can_manage_insurance());

CREATE POLICY "insurance_delete" ON public.truck_insurance
  FOR DELETE USING (public.current_user_role() IN ('ADMIN', 'CEO'));

DROP POLICY IF EXISTS "insurance_claims_select" ON public.insurance_claims;
DROP POLICY IF EXISTS "insurance_claims_insert" ON public.insurance_claims;
DROP POLICY IF EXISTS "insurance_claims_update" ON public.insurance_claims;
DROP POLICY IF EXISTS "insurance_claims_delete" ON public.insurance_claims;

CREATE POLICY "insurance_claims_select" ON public.insurance_claims
  FOR SELECT USING (public.can_view_insurance());

CREATE POLICY "insurance_claims_insert" ON public.insurance_claims
  FOR INSERT WITH CHECK (public.can_manage_insurance());

CREATE POLICY "insurance_claims_update" ON public.insurance_claims
  FOR UPDATE USING (public.can_manage_insurance())
  WITH CHECK (public.can_manage_insurance());

CREATE POLICY "insurance_claims_delete" ON public.insurance_claims
  FOR DELETE USING (public.current_user_role() IN ('ADMIN', 'CEO'));

DROP POLICY IF EXISTS "insurance_renewal_tasks_select" ON public.insurance_renewal_tasks;
DROP POLICY IF EXISTS "insurance_renewal_tasks_insert" ON public.insurance_renewal_tasks;
DROP POLICY IF EXISTS "insurance_renewal_tasks_update" ON public.insurance_renewal_tasks;
DROP POLICY IF EXISTS "insurance_renewal_tasks_delete" ON public.insurance_renewal_tasks;

CREATE POLICY "insurance_renewal_tasks_select" ON public.insurance_renewal_tasks
  FOR SELECT USING (public.can_view_insurance());

CREATE POLICY "insurance_renewal_tasks_insert" ON public.insurance_renewal_tasks
  FOR INSERT WITH CHECK (public.can_manage_insurance());

CREATE POLICY "insurance_renewal_tasks_update" ON public.insurance_renewal_tasks
  FOR UPDATE USING (public.can_manage_insurance())
  WITH CHECK (public.can_manage_insurance());

CREATE POLICY "insurance_renewal_tasks_delete" ON public.insurance_renewal_tasks
  FOR DELETE USING (public.current_user_role() IN ('ADMIN', 'CEO'));

-- ==================== USEFUL QUERIES ====================

-- TIRA non-compliant fleet:
-- SELECT * FROM public.tira_compliance_report WHERE has_valid_coverage = FALSE;

-- Policies needing renewal action:
-- SELECT * FROM public.expiring_insurance_policies ORDER BY days_until_expiry ASC;

-- Cross-border insurance gaps:
-- SELECT * FROM public.cross_border_coverage_check WHERE comesa_status <> 'COMPLIANT';

-- Executive dashboard:
-- SELECT * FROM public.insurance_dashboard_summary;
