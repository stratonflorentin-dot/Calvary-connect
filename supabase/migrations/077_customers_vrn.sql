-- Add VRN (VAT Registration Number) alongside the existing TIN (tax_id) on
-- customers — both are standard Tanzanian business tax identifiers and
-- customer-facing documents (invoices, contracts) commonly need to show
-- both, not just one.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vrn text;

COMMENT ON COLUMN customers.vrn IS 'VAT Registration Number (Tanzania) — distinct from tax_id (TIN)';

NOTIFY pgrst, 'reload schema';
