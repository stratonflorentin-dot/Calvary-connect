-- Compliance & insurance workflow on the EXISTING schema.
--
-- Reused as-is: vehicle_documents (registration / road license / inspection /
-- permits), truck_insurance (insurance, existing /api/insurance),
-- vehicle_compliance_alerts (per-vehicle expiry view), notifications,
-- audit_logs, expenses (finance integration), vehicles.
--
-- Added below — the minimum the workflow needs, each with justification:
--   provider        who issued the document (field required by the form)
--   cost/currency   feeds the finance expense created on save
--   reminder_days   per-document reminder lead time
--   notes           free-form context
--   renewed_from    renewal history chain (renew duplicates, never overwrites)
--   created_by      audit trail
--   updated_at      audit trail
--   company_settings.logo_url  company logo shown across the app
--
-- Idempotent. Run after 009.

ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS cost numeric;
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TZS';
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS reminder_days int DEFAULT 30;
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS renewed_from uuid REFERENCES vehicle_documents(id);
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON vehicle_documents (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry  ON vehicle_documents (expiry_date);

-- Company profile fields printed on invoices/POD letterhead + the logo.
-- The settings page previously wrote columns that did not exist.
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS vat_registration text;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Africa/Dar_es_Salaam';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- App-session access (same posture as the rest of the system)
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicle_documents_read ON vehicle_documents;
CREATE POLICY vehicle_documents_read ON vehicle_documents FOR SELECT USING (true);
DROP POLICY IF EXISTS vehicle_documents_write ON vehicle_documents;
CREATE POLICY vehicle_documents_write ON vehicle_documents FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS vehicle_documents_update ON vehicle_documents;
CREATE POLICY vehicle_documents_update ON vehicle_documents FOR UPDATE USING (true);
DROP POLICY IF EXISTS vehicle_documents_delete ON vehicle_documents;
CREATE POLICY vehicle_documents_delete ON vehicle_documents FOR DELETE USING (true);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_settings_read ON company_settings;
CREATE POLICY company_settings_read ON company_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS company_settings_write ON company_settings;
CREATE POLICY company_settings_write ON company_settings FOR ALL USING (true) WITH CHECK (true);

-- Storage: allow the app session to upload/read compliance attachments and
-- the company logo. Additive policies — existing avatar policies still apply.
DROP POLICY IF EXISTS "compliance docs read" ON storage.objects;
CREATE POLICY "compliance docs read" ON storage.objects
  FOR SELECT USING (bucket_id = 'compliance-docs');
DROP POLICY IF EXISTS "compliance docs upload" ON storage.objects;
CREATE POLICY "compliance docs upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'compliance-docs');
DROP POLICY IF EXISTS "company logo upload" ON storage.objects;
CREATE POLICY "company logo upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND name LIKE 'company/%');
DROP POLICY IF EXISTS "company logo update" ON storage.objects;
CREATE POLICY "company logo update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND name LIKE 'company/%');

NOTIFY pgrst, 'reload schema';
