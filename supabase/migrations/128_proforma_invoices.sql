-- Proforma Invoice system: a preliminary commercial document that precedes
-- a real invoice. Reuses the existing invoice/quotation architecture end to
-- end rather than inventing a parallel one:
--   - numbering via the existing document_sequences / next_doc_number()
--   - line items follow quotations' pattern (a dedicated lines table,
--     mirroring quotation_lines) rather than invoices' jsonb column, since
--     a proforma is edited before conversion and a real table is easier to
--     validate/update than a jsonb blob
--   - conversion writes into invoices exactly the way
--     src/app/finance/invoicing/customer-invoices/page.tsx already does
--     (a draft, type='receivable' row with line_items as jsonb) — nothing
--     about revenue recognition/AR/journal entries changes: that still only
--     happens later at Send (postJournalEntry({type:'invoice_sent'})) and
--     at payment, both untouched.
--
-- Idempotent: safe to run more than once.

INSERT INTO document_sequences (doc_type, prefix, next_number, padding)
VALUES ('proforma_invoice', 'PF-', 1, 4)
ON CONFLICT (doc_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS proforma_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  customer_name text,
  customer_reference text,
  quotation_id uuid REFERENCES quotations(id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  currency text NOT NULL DEFAULT 'TZS',
  vat_applicable boolean NOT NULL DEFAULT true,
  zero_rated_vat boolean NOT NULL DEFAULT false,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 18,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_terms text,
  salesperson_id uuid REFERENCES user_profiles(id),
  billing_address text,
  delivery_address text,
  notes text,
  terms_conditions text,
  -- Draft -> Sent -> Accepted|Expired|Cancelled|Converted. A proforma is a
  -- commercial document only: none of these transitions ever touch
  -- journal_entries/bank_transactions/payments (see section 35 of the
  -- brief this migration implements).
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','expired','cancelled','converted')),
  sent_at timestamptz,
  sent_by uuid REFERENCES user_profiles(id),
  converted_invoice_id uuid,
  converted_at timestamptz,
  converted_by uuid REFERENCES user_profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES user_profiles(id),
  cancel_reason text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proforma_invoices_customer ON proforma_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_status ON proforma_invoices(status);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_converted_invoice ON proforma_invoices(converted_invoice_id);

CREATE TABLE IF NOT EXISTS proforma_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_invoice_id uuid NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  line_number int NOT NULL DEFAULT 1,
  item_type text,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  duration_days numeric,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proforma_invoice_lines_parent ON proforma_invoice_lines(proforma_invoice_id);

DROP TRIGGER IF EXISTS trg_proforma_invoices_updated_at ON proforma_invoices;
CREATE TRIGGER trg_proforma_invoices_updated_at
  BEFORE UPDATE ON proforma_invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- converted_invoice_id -> invoices(id) is added as a separate ALTER (not
-- inline on CREATE TABLE) purely for migration-authoring convenience —
-- applied as 128b_proforma_converted_invoice_fk against the live project;
-- folded in here so a fresh environment gets the same end state in one file.
DO $$ BEGIN
  ALTER TABLE proforma_invoices
    ADD CONSTRAINT proforma_invoices_converted_invoice_id_fkey
    FOREIGN KEY (converted_invoice_id) REFERENCES invoices(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY proforma_invoices_read ON proforma_invoices
  FOR SELECT USING (current_user_role() = ANY (ARRAY['CEO','ADMIN','SALESMAN','ACCOUNTANT','OPERATOR']));
CREATE POLICY proforma_invoices_write ON proforma_invoices
  FOR ALL USING (current_user_role() = ANY (ARRAY['CEO','ADMIN','SALESMAN','ACCOUNTANT']))
  WITH CHECK (current_user_role() = ANY (ARRAY['CEO','ADMIN','SALESMAN','ACCOUNTANT']));

CREATE POLICY proforma_invoice_lines_read ON proforma_invoice_lines
  FOR SELECT USING (current_user_role() = ANY (ARRAY['CEO','ADMIN','SALESMAN','ACCOUNTANT','OPERATOR']));
CREATE POLICY proforma_invoice_lines_write ON proforma_invoice_lines
  FOR ALL USING (current_user_role() = ANY (ARRAY['CEO','ADMIN','SALESMAN','ACCOUNTANT']))
  WITH CHECK (current_user_role() = ANY (ARRAY['CEO','ADMIN','SALESMAN','ACCOUNTANT']));

-- ── invoices: traceability back to the source proforma ─────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS proforma_invoice_id uuid REFERENCES proforma_invoices(id);

-- The real double-conversion guard: even if two "Convert to Invoice" clicks
-- race past the application-level status check, at most one invoice row
-- can ever carry a given proforma_invoice_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_proforma_invoice_unique
  ON invoices(proforma_invoice_id) WHERE proforma_invoice_id IS NOT NULL;

-- ── CONVERT: create the real invoice through the same shape/fields the
--    New Invoice form already inserts, atomically, exactly once ──────────
CREATE OR REPLACE FUNCTION public.convert_proforma_invoice(p_proforma_id uuid)
RETURNS invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pf proforma_invoices%ROWTYPE;
  v_invoice_number text;
  v_wht_amount numeric := 0;
  v_total_payable numeric;
  v_line_items jsonb;
  v_invoice invoices%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot convert proforma invoices';
  END IF;

  SELECT * INTO v_pf FROM proforma_invoices WHERE id = p_proforma_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proforma invoice not found';
  END IF;

  IF v_pf.status = 'converted' THEN
    RAISE EXCEPTION 'This proforma has already been converted.';
  END IF;
  IF v_pf.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled proforma cannot be converted.';
  END IF;

  -- Same WHT rule as src/lib/tanzania-tax-rules.ts calculateInvoiceTotals()
  -- — 5% withholding on transport services above TZS 500,000, applied here
  -- only to size total_payable on the resulting invoice the same way a
  -- manually-created one would be; nothing is posted to the ledger yet.
  IF v_pf.total_amount > 500000 THEN
    v_wht_amount := v_pf.subtotal * 0.05;
  END IF;
  v_total_payable := v_pf.total_amount - v_wht_amount;

  SELECT next_doc_number('invoice') INTO v_invoice_number;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'description', l.description,
           'item_type_label', l.item_type,
           'quantity', l.quantity,
           'duration_days', l.duration_days,
           'unit_price', l.unit_price,
           'line_total', l.line_total
         ) ORDER BY l.line_number), '[]'::jsonb)
    INTO v_line_items
    FROM proforma_invoice_lines l
   WHERE l.proforma_invoice_id = p_proforma_id;

  INSERT INTO invoices (
    invoice_number, client_name, customer_name, customer_id,
    amount, subtotal, vat_applicable, vat_amount, wht_applicable, wht_amount,
    total_amount, total_payable, currency, due_date, issue_date,
    description, payment_terms, status, type, quotation_id,
    line_items, proforma_invoice_id, created_by
  ) VALUES (
    v_invoice_number, COALESCE(v_pf.customer_name, 'Customer'), v_pf.customer_name, v_pf.customer_id,
    v_pf.subtotal, v_pf.subtotal, v_pf.vat_applicable, v_pf.vat_amount, v_wht_amount > 0, v_wht_amount,
    v_pf.total_amount, v_total_payable, v_pf.currency, v_pf.valid_until, CURRENT_DATE,
    'Converted from proforma ' || v_pf.proforma_number, v_pf.payment_terms, 'draft', 'receivable', v_pf.quotation_id,
    v_line_items, p_proforma_id, auth.uid()
  )
  RETURNING * INTO v_invoice;

  UPDATE proforma_invoices
     SET status = 'converted',
         converted_invoice_id = v_invoice.id,
         converted_at = now(),
         converted_by = auth.uid()
   WHERE id = p_proforma_id;

  RETURN v_invoice;
END;
$$;

REVOKE EXECUTE ON FUNCTION convert_proforma_invoice(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION convert_proforma_invoice(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION convert_proforma_invoice(uuid) TO authenticated;

-- ── CANCEL: audit-tracked status change, no accounting side effect ────────
CREATE OR REPLACE FUNCTION public.cancel_proforma_invoice(p_proforma_id uuid, p_reason text DEFAULT NULL)
RETURNS proforma_invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pf proforma_invoices%ROWTYPE;
BEGIN
  IF current_user_role() NOT IN ('CEO','ADMIN','SALESMAN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Your role cannot cancel proforma invoices';
  END IF;

  SELECT * INTO v_pf FROM proforma_invoices WHERE id = p_proforma_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proforma invoice not found';
  END IF;
  IF v_pf.status = 'converted' THEN
    RAISE EXCEPTION 'This proforma has already been converted to an invoice and cannot be cancelled.';
  END IF;
  IF v_pf.status = 'cancelled' THEN
    RAISE EXCEPTION 'This proforma is already cancelled.';
  END IF;

  UPDATE proforma_invoices
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_reason = NULLIF(btrim(p_reason), '')
   WHERE id = p_proforma_id
   RETURNING * INTO v_pf;

  RETURN v_pf;
END;
$$;

REVOKE EXECUTE ON FUNCTION cancel_proforma_invoice(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cancel_proforma_invoice(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_proforma_invoice(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
