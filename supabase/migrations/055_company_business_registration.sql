-- Settings' Company tab was missing Tanzanian business-registration fields
-- (business type, year established, BRELA registration number, business
-- license number) — company_settings only has company_name, tax_id,
-- address, base_currency, logo_url, legal_name, phone, email,
-- vat_registration, timezone (checked live migrations 000/010, no later
-- migration added these). Found while comparing against a reference
-- system's Settings page that already had a "Business Registration"
-- section.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS year_established INTEGER;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS business_registration_no TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS business_license_number TEXT;

INSERT INTO public.schema_migrations (version) VALUES ('055_company_business_registration.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
