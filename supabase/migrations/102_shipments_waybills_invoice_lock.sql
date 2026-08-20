-- Shipments had a real, rich schema already (customer/vehicle/driver, cargo,
-- progress_percent, border_crossings, ETA) but nothing linked it to
-- quotations, trips, or invoices, and there was no waybills table at all.
-- This wires up the connective tissue + adds Waybills + locks sent invoices.
--
-- NOTE: this file was reconstructed after the fact — it was originally
-- written and applied by hand via the SQL editor in the same session it
-- shipped in (commit aef9231), but the file itself was saved empty due to
-- a write error. Verified against the live database on 2026-08-20: every
-- statement below is idempotent and already matches what's actually live
-- (shipments.quotation_id/is_historical/created_by/cancelled_at/
-- cancellation_reason, quotations/trips/invoices.shipment_id, the waybills
-- table, the shipment/waybill document_sequences rows, and the
-- guard_sent_invoice trigger — confirmed live by a real PATCH test that
-- correctly got rejected with this trigger's exact error message). Safe to
-- run again if you're rebuilding a fresh database from these files.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Link shipments ⇄ quotations, trips → shipments, invoices → shipments
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES quotations(id),
  ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_quotation_id
  ON shipments(quotation_id) WHERE quotation_id IS NOT NULL;

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id);

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES shipments(id);

CREATE INDEX IF NOT EXISTS idx_trips_shipment_id ON trips(shipment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_shipment_id ON invoices(shipment_id);

-- A real status vocabulary for the 5-stage tracker + cancelled branch
DO $$
BEGIN
  ALTER TABLE shipments
    ADD CONSTRAINT shipments_status_check
    CHECK (status IN ('DRAFT','APPROVED','IN_TRANSIT','DELIVERED','INVOICED','PAID','CANCELLED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Waybills — didn't exist at all
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waybills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waybill_number text NOT NULL UNIQUE,
  shipment_id uuid NOT NULL REFERENCES shipments(id),
  trip_id uuid REFERENCES trips(id),
  cargo_description text,
  cargo_weight_kg numeric,
  package_count integer,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waybills_shipment_id ON waybills(shipment_id);
CREATE INDEX IF NOT EXISTS idx_waybills_trip_id ON waybills(trip_id);

ALTER TABLE waybills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS waybills_read ON waybills;
DROP POLICY IF EXISTS waybills_write ON waybills;
CREATE POLICY waybills_read ON waybills FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY waybills_write ON waybills FOR INSERT
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','OPERATOR','ACCOUNTANT'));

INSERT INTO document_sequences (doc_type, prefix, next_number)
  VALUES ('shipment', 'SH-', 1), ('waybill', 'WB-', 1)
  ON CONFLICT (doc_type) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Invoice lock: once an invoice leaves draft/pending it's a finalized
--    financial document — edits to its financial substance must go through
--    a Credit Note, not a direct UPDATE. Mirrors guard_posted_journal() from
--    006_finance_foundation.sql. Status/payment-recording fields stay
--    editable since that's legitimate lifecycle, not a financial edit.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_sent_invoice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS NULL OR OLD.status IN ('draft', 'pending') THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.shipment_id IS DISTINCT FROM OLD.shipment_id
     OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
  THEN
    RAISE EXCEPTION 'This invoice is locked and cannot be edited — it has been issued and is a finalized financial document. Use a Credit Note instead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sent_invoice ON invoices;
CREATE TRIGGER trg_guard_sent_invoice
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION guard_sent_invoice();

NOTIFY pgrst, 'reload schema';
