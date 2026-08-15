-- Follow-up to migrations 059/060 (trip advances, TRA VFD invoicing,
-- subcontractor WHT, depreciation — already live). This migration covers
-- what wasn't done yet: POD shortage/damage claims, a real fuel-cost data
-- gap, and the three reporting views.
--
-- Audit findings that shaped this migration:
--
-- 1. `vehicle_costs` (not `fuel_logs`/`fuel_records`/`fuel_tracking`) is the
--    real, live fuel/maintenance cost ledger — confirmed by grep:
--    src/app/finance/fleet-finance/fuel-costs/page.tsx and
--    maintenance-costs/page.tsx both write to vehicle_costs with
--    cost_type = 'fuel' / 'maintenance'. fuel_logs, fuel_records,
--    fuel_tracking, trip_accounting and route_profitability are dead —
--    zero references anywhere in src/, same "abandoned duplicate seed"
--    pattern as the Chart of Accounts cleanup in migration 059. Not
--    dropped (per instruction not to drop existing tables), just labeled
--    with COMMENT ON TABLE so nobody builds on them by mistake.
--
-- 2. That live fuel-costs page has actually been BROKEN: its FuelCost type
--    and insert payload include `liters` and `odometer_reading`, but
--    vehicle_costs has neither column — every fuel entry that fills in
--    those optional fields fails the insert. This is also the direct
--    reason CPK/fuel-efficiency reporting has been impossible: the data
--    the UI already tries to collect has nowhere to land. Fixed by adding
--    both columns.
--
-- 3. The existing `fleet_fuel_summary` view (from an earlier migration,
--    itself unused by any frontend code) joins against the dead
--    `fuel_logs` table, so it has always returned zero rows of real data.
--    Redefined here to read from live vehicle_costs instead — same output
--    column names, so nothing that might reference it later breaks.
--
-- 4. `proof_of_delivery` has no shortage/damage/claim columns at all — the
--    "POD shortage/damage penalties as contra-AR deductions" requirement
--    has nowhere to be recorded. Rather than inventing a new, untested
--    posting path, this reuses the credit_notes table and post_credit_note()
--    from migration 051 (already live, already does exactly "Dr Sales
--    Returns / Dr VAT reversed / Cr AR"): raise_pod_claim() creates a DRAFT
--    credit note tagged reason = POD_SHORTAGE / POD_DAMAGE /
--    POD_SHORTAGE_AND_DAMAGE, and an accountant posts it through the
--    existing post_credit_note() RPC — same review gate every other credit
--    note already goes through, rather than letting ops staff unilaterally
--    deduct AR.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- =============================================================================
-- SECTION A — LIVE FUEL-COST DATA GAP
-- =============================================================================

ALTER TABLE vehicle_costs
  ADD COLUMN IF NOT EXISTS liters numeric,
  ADD COLUMN IF NOT EXISTS odometer_reading numeric;

COMMENT ON TABLE fuel_logs IS 'DEAD: no app code writes here. Live fuel-cost data is in vehicle_costs (cost_type = ''fuel''). See migration 061.';
COMMENT ON TABLE fuel_records IS 'DEAD: no app code writes here. Live fuel-cost data is in vehicle_costs (cost_type = ''fuel''). See migration 061.';
COMMENT ON TABLE fuel_tracking IS 'DEAD: no app code writes here. Live fuel-cost data is in vehicle_costs (cost_type = ''fuel''). See migration 061.';
COMMENT ON TABLE trip_accounting IS 'DEAD: no app code writes here. Live trip profitability data is assembled in view_trip_profitability from trip_revenue + vehicle_costs + trip_advance_settlements + vendor_bills. See migration 061.';
COMMENT ON TABLE route_profitability IS 'DEAD: no app code writes here. Live per-trip profitability is view_trip_profitability; aggregate by origin/destination client-side or with a further view on top of it. See migration 061.';

-- Redefine the existing (previously unused, previously broken) fuel summary
-- view against the real data source. Same output columns as before.
-- Distance per fill is derived from consecutive odometer readings per
-- vehicle (LAG), since vehicle_costs doesn't store a running distance.
-- CREATE OR REPLACE VIEW cannot rename/reorder/drop existing output
-- columns — only append new ones — so plate_number/make/model stay first,
-- in the same order as the original definition, with vehicle_id appended.
CREATE OR REPLACE VIEW fleet_fuel_summary AS
WITH fuel_fills AS (
  SELECT
    vc.vehicle_id,
    vc.date,
    vc.liters,
    vc.amount,
    vc.odometer_reading,
    vc.odometer_reading - LAG(vc.odometer_reading) OVER (
      PARTITION BY vc.vehicle_id ORDER BY vc.date, vc.odometer_reading
    ) AS distance_km
  FROM vehicle_costs vc
  WHERE vc.cost_type = 'fuel'
)
SELECT
  v.plate_number,
  v.make,
  v.model,
  COUNT(f.date) AS fuel_fill_count,
  SUM(f.liters) AS total_litres,
  SUM(f.amount) AS total_fuel_cost,
  SUM(f.distance_km) FILTER (WHERE f.distance_km > 0) AS total_distance_km,
  AVG(f.distance_km / NULLIF(f.liters, 0)) FILTER (WHERE f.distance_km > 0 AND f.liters > 0) AS avg_efficiency_km_l,
  MIN(f.distance_km / NULLIF(f.liters, 0)) FILTER (WHERE f.distance_km > 0 AND f.liters > 0) AS min_efficiency_km_l,
  MAX(f.distance_km / NULLIF(f.liters, 0)) FILTER (WHERE f.distance_km > 0 AND f.liters > 0) AS max_efficiency_km_l,
  MAX(f.date) AS last_fill_date,
  v.id AS vehicle_id
FROM vehicles v
LEFT JOIN fuel_fills f ON f.vehicle_id = v.id
GROUP BY v.id, v.plate_number, v.make, v.model;

-- =============================================================================
-- SECTION B — POD SHORTAGE/DAMAGE CLAIMS (CONTRA-AR)
-- =============================================================================

ALTER TABLE proof_of_delivery
  ADD COLUMN IF NOT EXISTS shortage_qty numeric CHECK (shortage_qty IS NULL OR shortage_qty >= 0),
  ADD COLUMN IF NOT EXISTS shortage_value numeric NOT NULL DEFAULT 0 CHECK (shortage_value >= 0),
  ADD COLUMN IF NOT EXISTS damage_value numeric NOT NULL DEFAULT 0 CHECK (damage_value >= 0),
  ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'none' CHECK (claim_status IN ('none', 'pending', 'credited')),
  ADD COLUMN IF NOT EXISTS claim_notes text,
  ADD COLUMN IF NOT EXISTS credit_note_id uuid REFERENCES credit_notes(id);

-- raise_pod_claim(): creates a DRAFT credit note against the trip's invoice
-- for the shortage/damage value recorded on the POD. Does not post it —
-- posting still goes through post_credit_note() (migration 051/052), which
-- already enforces the CEO/ADMIN/ACCOUNTANT gate. VAT on the claim mirrors
-- the original invoice's vat_type (18% reversed for STANDARD_18, 0% for
-- ZERO_RATED/EXEMPT).
CREATE OR REPLACE FUNCTION public.raise_pod_claim(p_pod_id uuid, p_notes text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pod proof_of_delivery;
  v_invoice invoices%ROWTYPE;
  v_net numeric;
  v_vat numeric;
  v_total numeric;
  v_reason text;
  v_cn_id uuid;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'SALESMAN', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/SALESMAN/ACCOUNTANT may raise a shortage/damage claim';
  END IF;

  SELECT * INTO v_pod FROM proof_of_delivery WHERE id = p_pod_id FOR UPDATE;
  IF v_pod.id IS NULL THEN
    RAISE EXCEPTION 'Proof of delivery record not found';
  END IF;
  IF v_pod.credit_note_id IS NOT NULL THEN
    RAISE EXCEPTION 'A claim has already been raised for this delivery';
  END IF;

  v_net := COALESCE(v_pod.shortage_value, 0) + COALESCE(v_pod.damage_value, 0);
  IF v_net <= 0 THEN
    RAISE EXCEPTION 'Nothing to claim — set shortage_value and/or damage_value first';
  END IF;

  SELECT * INTO v_invoice
    FROM invoices
   WHERE trip_id = v_pod.trip_id
     AND COALESCE(type, 'receivable') <> 'payable'
     AND deleted_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'No customer invoice found for this delivery''s trip — cannot raise a contra-AR claim';
  END IF;

  v_vat := CASE WHEN v_invoice.vat_type = 'STANDARD_18' THEN ROUND(v_net * 0.18, 2) ELSE 0 END;
  v_total := v_net + v_vat;

  v_reason := CASE
    WHEN v_pod.shortage_value > 0 AND v_pod.damage_value > 0 THEN 'POD_SHORTAGE_AND_DAMAGE'
    WHEN v_pod.shortage_value > 0 THEN 'POD_SHORTAGE'
    ELSE 'POD_DAMAGE'
  END;

  INSERT INTO credit_notes (
    customer_id, customer_name, original_invoice_id, amount, vat_amount, total_amount,
    currency, issue_date, reason, description, status, created_by
  ) VALUES (
    v_invoice.customer_id, COALESCE(v_invoice.customer_name, v_invoice.client_name, 'customer'), v_invoice.id,
    v_net, v_vat, v_total, COALESCE(v_invoice.currency, 'TZS'), CURRENT_DATE, v_reason,
    COALESCE(p_notes, v_pod.claim_notes, 'POD shortage/damage claim'), 'draft', auth.uid()
  )
  RETURNING id INTO v_cn_id;

  UPDATE proof_of_delivery
     SET credit_note_id = v_cn_id, claim_status = 'pending', claim_notes = COALESCE(p_notes, claim_notes), updated_at = now()
   WHERE id = p_pod_id;

  RETURN v_cn_id;
END;
$function$;

-- Closes the loop once an accountant actually posts (or voids) the claim,
-- without touching post_credit_note()/reverse logic itself.
CREATE OR REPLACE FUNCTION public.sync_pod_claim_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'issued' AND OLD.status IS DISTINCT FROM 'issued' THEN
    UPDATE proof_of_delivery SET claim_status = 'credited', updated_at = now() WHERE credit_note_id = NEW.id;
  ELSIF NEW.status = 'voided' AND OLD.status IS DISTINCT FROM 'voided' THEN
    UPDATE proof_of_delivery SET claim_status = 'none', credit_note_id = NULL, updated_at = now() WHERE credit_note_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_pod_claim_status ON credit_notes;
CREATE TRIGGER trg_sync_pod_claim_status
  AFTER UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION sync_pod_claim_status();

-- =============================================================================
-- SECTION C — REPORTING VIEWS
-- =============================================================================

-- Per-trip profitability. Two cost capture paths feed this on purpose:
--   - vehicle_costs: fuel/maintenance entered directly by dispatch/finance
--     (fuel-costs & maintenance-costs pages), tagged with trip_id when known.
--   - trip_advance_settlements: driver-float receipts (fuel/tolls/parking)
--     verified at reconciliation (migration 059).
-- These are DIFFERENT operational entry points and can double-count the
-- same real-world fuel purchase if a business process ever records it both
-- ways (e.g. dispatch logs a fuel receipt in vehicle_costs AND the driver
-- also settles it against their float). There is currently no de-duplication
-- across the two paths — pick one capture method per trip/cost-type
-- operationally, or a future de-dup key (e.g. receipt_reference) would be
-- needed here.
CREATE OR REPLACE VIEW view_trip_profitability AS
SELECT
  t.id AS trip_id,
  t.trip_number,
  t.origin,
  t.destination,
  t.trip_type,
  t.status,
  t.distance_km,
  COALESCE(t.currency, 'TZS') AS currency,
  COALESCE(rev.revenue_amount, 0) AS revenue_tzs,
  COALESCE(cost.vehicle_cost_amount, 0) AS vehicle_cost_tzs,
  COALESCE(drv.driver_settled_expense, 0) AS driver_settled_expense_tzs,
  COALESCE(sub.subcontractor_amount, 0) AS subcontractor_cost_tzs,
  COALESCE(claim.claim_amount, 0) AS shortage_damage_claims_tzs,
  (
    COALESCE(rev.revenue_amount, 0)
    - COALESCE(cost.vehicle_cost_amount, 0)
    - COALESCE(drv.driver_settled_expense, 0)
    - COALESCE(sub.subcontractor_amount, 0)
    - COALESCE(claim.claim_amount, 0)
  ) AS net_profit_tzs,
  CASE WHEN COALESCE(t.distance_km, 0) > 0 THEN
    ROUND((
      COALESCE(rev.revenue_amount, 0)
      - COALESCE(cost.vehicle_cost_amount, 0)
      - COALESCE(drv.driver_settled_expense, 0)
      - COALESCE(sub.subcontractor_amount, 0)
      - COALESCE(claim.claim_amount, 0)
    ) / t.distance_km, 2)
  ELSE NULL END AS profit_per_km_tzs
FROM trips t
LEFT JOIN (
  SELECT trip_id, SUM(amount) AS revenue_amount
  FROM trip_revenue
  GROUP BY trip_id
) rev ON rev.trip_id = t.id
LEFT JOIN (
  SELECT trip_id, SUM(amount) AS vehicle_cost_amount
  FROM vehicle_costs
  WHERE trip_id IS NOT NULL
  GROUP BY trip_id
) cost ON cost.trip_id = t.id
LEFT JOIN (
  SELECT ta.trip_id, SUM(tas.amount) AS driver_settled_expense
  FROM trip_advance_settlements tas
  JOIN trip_advances ta ON ta.id = tas.trip_advance_id
  GROUP BY ta.trip_id
) drv ON drv.trip_id = t.id
LEFT JOIN (
  SELECT trip_id, SUM(gross_amount) AS subcontractor_amount
  FROM vendor_bills
  WHERE status IN ('posted', 'paid')
  GROUP BY trip_id
) sub ON sub.trip_id = t.id
LEFT JOIN (
  SELECT i.trip_id, SUM(cn.total_amount) AS claim_amount
  FROM credit_notes cn
  JOIN invoices i ON i.id = cn.original_invoice_id
  WHERE cn.reason LIKE 'POD_%' AND cn.status = 'issued'
  GROUP BY i.trip_id
) claim ON claim.trip_id = t.id;

-- Un-cleared driver float: every ISSUED advance, how long it's been
-- outstanding, and (for forward-compatibility with any future partial-
-- settlement flow) how much of it has been settled so far. Today
-- reconcile_trip_advance() always fully settles in one call, so
-- settled_amount is always 0 for an ISSUED row — it only becomes non-zero
-- if a future partial-reconciliation feature is added.
CREATE OR REPLACE VIEW view_driver_float_aging AS
SELECT
  ta.id AS trip_advance_id,
  ta.advance_number,
  ta.driver_id,
  d.full_name AS driver_name,
  ta.trip_id,
  t.trip_number,
  ta.amount AS advance_amount,
  ta.currency,
  ta.issue_date,
  ta.status,
  COALESCE(s.settled_amount, 0) AS settled_amount,
  ta.amount - COALESCE(s.settled_amount, 0) AS unreconciled_balance,
  (CURRENT_DATE - ta.issue_date) AS days_outstanding
FROM trip_advances ta
LEFT JOIN drivers d ON d.id = ta.driver_id
LEFT JOIN trips t ON t.id = ta.trip_id
LEFT JOIN (
  SELECT trip_advance_id, SUM(amount) AS settled_amount
  FROM trip_advance_settlements
  GROUP BY trip_advance_id
) s ON s.trip_advance_id = ta.id
WHERE ta.status = 'ISSUED';

-- TRA filing schedule: standard/zero-rated/exempt VAT from customer
-- invoices, plus 2% WHT withheld from subcontractor bills. VAT and WHT are
-- separate statutory returns in Tanzania, so schedule_type distinguishes
-- the two — group/filter by it rather than treating this as one form.
CREATE OR REPLACE VIEW view_tra_vfd_audit_schedule AS
SELECT
  'VAT'::text AS schedule_type,
  i.id AS source_id,
  i.invoice_number AS document_number,
  i.issue_date AS document_date,
  COALESCE(i.customer_name, i.client_name) AS party_name,
  i.vat_type AS tax_treatment,
  i.currency,
  COALESCE(i.subtotal, i.amount, i.total_amount - COALESCE(i.vat_amount, 0), 0) AS taxable_base,
  CASE WHEN i.vat_type = 'STANDARD_18' THEN COALESCE(i.vat_amount, 0) ELSE 0 END AS tax_amount,
  i.total_amount AS gross_amount,
  i.is_vfd_verified,
  i.tra_rct_num,
  i.tra_z_num,
  i.tra_verification_url
FROM invoices i
WHERE i.deleted_at IS NULL
  AND COALESCE(i.status, '') NOT IN ('draft', 'cancelled', 'void')
  AND COALESCE(i.type, 'receivable') <> 'payable'

UNION ALL

SELECT
  'WHT'::text AS schedule_type,
  vb.id AS source_id,
  vb.bill_number AS document_number,
  vb.bill_date AS document_date,
  vb.subcontractor_name AS party_name,
  ('WHT_' || vb.wht_rate || 'PCT')::text AS tax_treatment,
  vb.currency,
  vb.gross_amount AS taxable_base,
  vb.wht_amount AS tax_amount,
  vb.gross_amount AS gross_amount,
  (vb.status IN ('posted', 'paid')) AS is_vfd_verified,
  NULL::text AS tra_rct_num,
  NULL::text AS tra_z_num,
  NULL::text AS tra_verification_url
FROM vendor_bills vb
WHERE vb.status IN ('posted', 'paid');

INSERT INTO public.schema_migrations (version) VALUES ('061_pod_claims_fuel_columns_and_profitability_views.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
