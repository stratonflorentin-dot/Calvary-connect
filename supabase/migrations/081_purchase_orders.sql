-- Purchase Orders + an append-only stock-movement ledger for spare_parts.
--
-- Confirmed genuinely absent before this: no purchase_orders table exists
-- anywhere, and spare_parts.quantity was a single mutable integer with no
-- movement history at all (both gaps from the LogiPRO comparison). PO
-- receiving is the natural, concrete trigger for the movement ledger, so
-- it's built here rather than as a separate change.
--
-- State machine (draft -> sent_to_supplier -> partially_received ->
-- fully_received; cancelled from any pre-received state) is registered in
-- src/lib/workflow/state-machines.ts as "purchase_order". The
-- partially/fully_received transitions are NOT reachable through the
-- generic engine — they're driven exclusively by receive_purchase_order_
-- items() below, which needs to atomically update item quantities, insert
-- stock movements, AND decide the resulting status in one transaction
-- (same "RPC does the atomic multi-table thing" pattern already used by
-- post_journal_entry/post_bank_transaction/post_subcontractor_bill).

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent_to_supplier', 'partially_received', 'fully_received', 'cancelled')),
  vat_type text NOT NULL DEFAULT 'STANDARD_18' CHECK (vat_type IN ('STANDARD_18', 'ZERO_RATED')),
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  expected_delivery_date date,
  notes text,
  cancel_reason text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  spare_part_id uuid REFERENCES spare_parts(id),
  item_description text NOT NULL,
  quantity_ordered numeric NOT NULL CHECK (quantity_ordered > 0),
  quantity_received numeric NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
  line_total numeric NOT NULL DEFAULT 0,
  notes text,
  CHECK (quantity_received <= quantity_ordered)
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

-- Append-only stock-movement ledger. spare_parts.quantity stays as the
-- fast-read cache it already was; this is now the audit trail behind it.
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_part_id uuid NOT NULL REFERENCES spare_parts(id),
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity numeric NOT NULL,
  unit_cost numeric,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (movement_type = 'adjustment' OR quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_part ON stock_movements(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- Links a payable back to the PO it was received against, for
-- Balance Due = Received - Paid (the three-way-match logic explicitly
-- worth copying). Nullable/additive — vendor_bills' existing trip-centric
-- use (subcontractor freight) is untouched.
ALTER TABLE vendor_bills ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES purchase_orders(id);

-- ────────────────────────────────────────────────────────────────────────────
-- Numbering + line-total + parent-rollup triggers
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO document_sequences (doc_type, prefix, next_number, padding)
VALUES ('purchase_order', 'PO-', 1, 5)
ON CONFLICT (doc_type) DO NOTHING;

CREATE OR REPLACE FUNCTION assign_po_number()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.po_number IS NULL THEN
    NEW.po_number := next_doc_number('purchase_order');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_po_number ON purchase_orders;
CREATE TRIGGER trg_assign_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION assign_po_number();

CREATE OR REPLACE FUNCTION set_purchase_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_purchase_orders_updated_at();

CREATE OR REPLACE FUNCTION compute_po_item_line_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.line_total := ROUND(NEW.quantity_ordered * NEW.unit_cost, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_po_item_line_total ON purchase_order_items;
CREATE TRIGGER trg_compute_po_item_line_total
  BEFORE INSERT OR UPDATE OF quantity_ordered, unit_cost ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION compute_po_item_line_total();

-- Rolls purchase_order_items totals up into the parent PO's subtotal/vat/
-- total on any item change, same "trigger keeps the parent authoritative"
-- pattern as vendor_bills' trg_compute_vendor_bill_amounts.
CREATE OR REPLACE FUNCTION recompute_po_totals()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po_id uuid := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  v_subtotal numeric;
  v_vat_type text;
  v_vat numeric;
BEGIN
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM purchase_order_items WHERE purchase_order_id = v_po_id;

  SELECT vat_type INTO v_vat_type FROM purchase_orders WHERE id = v_po_id;
  v_vat := CASE WHEN v_vat_type = 'ZERO_RATED' THEN 0 ELSE ROUND(v_subtotal * 0.18, 2) END;

  UPDATE purchase_orders
     SET subtotal = v_subtotal, vat_amount = v_vat, total_amount = v_subtotal + v_vat, updated_at = now()
   WHERE id = v_po_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_po_totals ON purchase_order_items;
CREATE TRIGGER trg_recompute_po_totals
  AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION recompute_po_totals();

-- Also recompute VAT when vat_type itself is changed after items exist.
CREATE OR REPLACE FUNCTION recompute_po_totals_on_vat_type_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.vat_type IS DISTINCT FROM OLD.vat_type THEN
    NEW.vat_amount := CASE WHEN NEW.vat_type = 'ZERO_RATED' THEN 0 ELSE ROUND(NEW.subtotal * 0.18, 2) END;
    NEW.total_amount := NEW.subtotal + NEW.vat_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_vat_type_change ON purchase_orders;
CREATE TRIGGER trg_po_vat_type_change
  BEFORE UPDATE OF vat_type ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION recompute_po_totals_on_vat_type_change();

-- Stock movement -> spare_parts.quantity. 'in' adds, 'out' subtracts,
-- 'adjustment' applies the (possibly negative) quantity directly.
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_delta numeric;
BEGIN
  v_delta := CASE
    WHEN NEW.movement_type = 'in' THEN NEW.quantity
    WHEN NEW.movement_type = 'out' THEN -NEW.quantity
    ELSE NEW.quantity
  END;
  UPDATE spare_parts
     SET quantity = GREATEST(COALESCE(quantity, 0) + v_delta, 0),
         updated_at = now()
   WHERE id = NEW.spare_part_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON stock_movements;
CREATE TRIGGER trg_apply_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION apply_stock_movement();

-- ────────────────────────────────────────────────────────────────────────────
-- receive_purchase_order_items: the one place partial/full receiving
-- happens. p_receipts is a jsonb array of {po_item_id, quantity_received}.
-- Atomically bumps each item's quantity_received, inserts a stock_movements
-- row for any item linked to a real spare_parts row (which itself updates
-- spare_parts.quantity via the trigger above), then sets the PO's status
-- to fully_received (every item fully received) or partially_received
-- (some but not all).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION receive_purchase_order_items(p_po_id uuid, p_receipts jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po purchase_orders%ROWTYPE;
  v_receipt jsonb;
  v_item purchase_order_items%ROWTYPE;
  v_qty numeric;
  v_all_received boolean;
  v_any_received boolean;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC') THEN
    RAISE EXCEPTION 'Your role cannot receive purchase order items';
  END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF v_po.id IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_po.status NOT IN ('sent_to_supplier', 'partially_received') THEN
    RAISE EXCEPTION 'Purchase order must be sent to supplier before receiving (current status: %)', v_po.status;
  END IF;

  FOR v_receipt IN SELECT * FROM jsonb_array_elements(p_receipts)
  LOOP
    v_qty := (v_receipt ->> 'quantity_received')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_item FROM purchase_order_items
     WHERE id = (v_receipt ->> 'po_item_id')::uuid AND purchase_order_id = p_po_id
     FOR UPDATE;
    IF v_item.id IS NULL THEN
      RAISE EXCEPTION 'Purchase order item % does not belong to this order', v_receipt ->> 'po_item_id';
    END IF;
    IF v_item.quantity_received + v_qty > v_item.quantity_ordered THEN
      RAISE EXCEPTION 'Receiving % of "%" would exceed the % ordered (% already received)',
        v_qty, v_item.item_description, v_item.quantity_ordered, v_item.quantity_received;
    END IF;

    UPDATE purchase_order_items
       SET quantity_received = quantity_received + v_qty
     WHERE id = v_item.id;

    IF v_item.spare_part_id IS NOT NULL THEN
      INSERT INTO stock_movements (spare_part_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
      VALUES (v_item.spare_part_id, 'in', v_qty, v_item.unit_cost, 'purchase_order', p_po_id,
              'Received against ' || v_po.po_number, auth.uid());
    END IF;
  END LOOP;

  SELECT bool_and(quantity_received >= quantity_ordered), bool_or(quantity_received > 0)
    INTO v_all_received, v_any_received
    FROM purchase_order_items WHERE purchase_order_id = p_po_id;

  UPDATE purchase_orders
     SET status = CASE WHEN v_all_received THEN 'fully_received'
                        WHEN v_any_received THEN 'partially_received'
                        ELSE status END,
         updated_at = now()
   WHERE id = p_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION receive_purchase_order_items(uuid, jsonb) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON purchase_orders FROM anon;
REVOKE ALL ON purchase_order_items FROM anon;
REVOKE ALL ON stock_movements FROM anon;

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- SELECT is broader than write: MECHANIC can receive items via
-- receive_purchase_order_items() (a SECURITY DEFINER RPC, so it doesn't need
-- its own UPDATE grant here), but still needs to see what's on order and
-- what's already arrived before receiving it.
CREATE POLICY purchase_orders_read ON purchase_orders FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'MECHANIC'));
CREATE POLICY purchase_orders_write ON purchase_orders FOR INSERT WITH CHECK (
  current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT'));
CREATE POLICY purchase_orders_update ON purchase_orders FOR UPDATE USING (
  current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT'));

CREATE POLICY purchase_order_items_read ON purchase_order_items FOR SELECT
  USING (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'MECHANIC'));
CREATE POLICY purchase_order_items_write ON purchase_order_items FOR INSERT WITH CHECK (
  current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT'));
CREATE POLICY purchase_order_items_update ON purchase_order_items FOR UPDATE USING (
  current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT'));
CREATE POLICY purchase_order_items_delete ON purchase_order_items FOR DELETE USING (
  current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'ACCOUNTANT'));

-- Stock movements: broad read (it's an audit trail everyone touching fleet
-- ops benefits from), write restricted to the same roles that can receive
-- goods / already have spare_parts write access.
CREATE POLICY stock_movements_read ON stock_movements FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY stock_movements_write ON stock_movements FOR INSERT
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'));

NOTIFY pgrst, 'reload schema';
