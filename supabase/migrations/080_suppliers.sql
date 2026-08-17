-- Suppliers master table. Confirmed genuinely absent before this: no
-- suppliers/vendors table exists anywhere in this schema — vendor_bills
-- (059_trip_advances_tra_vfd_wht_depreciation.sql) has a plain freeform
-- subcontractor_name with no FK target, by that migration's own admission.
-- Mirrors the shape/pattern of customers (043_lock_down_customers_rls.sql).

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text UNIQUE,
  company_name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  city text,
  country text DEFAULT 'Tanzania',
  tax_id text,
  vrn text,
  payment_terms text DEFAULT '30 days',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

INSERT INTO document_sequences (doc_type, prefix, next_number, padding)
VALUES ('supplier', 'SUP-', 1, 5)
ON CONFLICT (doc_type) DO NOTHING;

CREATE OR REPLACE FUNCTION assign_supplier_code()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.supplier_code IS NULL THEN
    NEW.supplier_code := next_doc_number('supplier');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_code ON suppliers;
CREATE TRIGGER trg_assign_supplier_code
  BEFORE INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION assign_supplier_code();

CREATE OR REPLACE FUNCTION set_suppliers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION set_suppliers_updated_at();

-- RLS: same commercial-sensitivity treatment as customers (single FOR ALL
-- policy, not the fully-open fuel_stations-style reference-data pattern) —
-- supplier contacts/terms are business-sensitive. Operations needs to see
-- and pick suppliers when raising purchase orders, unlike customers which
-- is sales-only, so OPERATOR is included here where it isn't on customers.
REVOKE ALL ON suppliers FROM anon;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_all ON suppliers FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT'));

NOTIFY pgrst, 'reload schema';
