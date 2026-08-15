// Types for the finance ERP upgrade (migrations 059-063): trip advances /
// driver float, TRA VFD invoicing, subcontractor WHT, POD shortage/damage
// claims, and the three reporting views. Field names match the underlying
// Supabase columns/view output exactly (snake_case) so these can be used
// directly against `.select()` results without a mapping layer, consistent
// with how the rest of this codebase consumes Supabase rows.

// ─── Trip Advances / Driver Float (migration 059) ─────────────────────────

export type TripAdvanceStatus = "ISSUED" | "RECONCILED";
export type TripAdvancePaymentMethod = "cash" | "bank" | "mobile";

export interface TripAdvance {
  id: string;
  advance_number: string | null;
  trip_id: string | null;
  driver_id: string | null;
  amount: number;
  currency: string;
  payment_method: TripAdvancePaymentMethod;
  bank_account_id: string | null;
  issue_date: string; // YYYY-MM-DD
  status: TripAdvanceStatus;
  journal_entry_id: string | null;
  reconciliation_journal_entry_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape for creating a new advance — the trigger fills advance_number/journal_entry_id/status. */
export type TripAdvanceInsert = Pick<TripAdvance, "trip_id" | "driver_id" | "amount"> &
  Partial<Pick<TripAdvance, "currency" | "payment_method" | "bank_account_id" | "issue_date" | "notes">>;

export interface TripAdvanceSettlement {
  id: string;
  trip_advance_id: string;
  expense_account_code: string;
  category: string | null;
  amount: number;
  receipt_reference: string | null;
  description: string | null;
  created_at: string;
}

/** One verified receipt line passed to reconcile_trip_advance()'s p_settlement_lines jsonb array. */
export interface TripAdvanceSettlementLineInput {
  account_code?: string; // defaults to '5103' server-side if omitted
  amount: number;
  category?: string;
  receipt_reference?: string;
  description?: string;
}

/** Params for `supabase.rpc("reconcile_trip_advance", ...)`. Returns the reconciliation journal_entry_id (uuid). */
export interface ReconcileTripAdvanceParams {
  p_trip_advance_id: string;
  p_settlement_lines: TripAdvanceSettlementLineInput[];
  p_settlement_bank_account_id?: string;
  p_settlement_date?: string; // YYYY-MM-DD, defaults to CURRENT_DATE
  p_notes?: string;
}

// ─── TRA VFD Invoicing (migration 059) ─────────────────────────────────────

export type InvoiceVatType = "STANDARD_18" | "ZERO_RATED" | "EXEMPT";

/** Columns added to `invoices` — spread onto whatever Invoice row type/`any` is already in use. */
export interface InvoiceTraVfdFields {
  vat_type: InvoiceVatType;
  tra_rct_num: string | null;
  tra_z_num: string | null;
  tra_verification_url: string | null;
  tra_qr_code: string | null;
  is_vfd_verified: boolean;
}

// ─── Subcontractor Vendor Bills & 2% TRA WHT (migration 059) ──────────────

export type VendorBillStatus = "draft" | "posted" | "paid";

export interface VendorBill {
  id: string;
  bill_number: string | null;
  subcontractor_name: string;
  subcontractor_id: string | null; // no vendor master table yet — freeform, see migration 059 audit note
  trip_id: string | null;
  bill_date: string; // YYYY-MM-DD
  due_date: string | null;
  gross_amount: number;
  wht_rate: number; // percent, default 2.00
  wht_amount: number; // server-computed
  net_payable: number; // server-computed
  currency: string;
  status: VendorBillStatus;
  journal_entry_id: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape for creating a bill — wht_amount/net_payable are computed server-side by a trigger. */
export type VendorBillInsert = Pick<VendorBill, "subcontractor_name" | "gross_amount"> &
  Partial<Pick<VendorBill, "subcontractor_id" | "trip_id" | "bill_date" | "due_date" | "wht_rate" | "currency" | "description">>;

// ─── Vehicle Depreciation (migration 059) ──────────────────────────────────

export interface VehicleDepreciationEntry {
  id: string;
  vehicle_id: string;
  period_year: number;
  period_month: number; // 1-12
  amount: number;
  accumulated_after: number;
  account_code: "1301" | "1302";
  journal_entry_id: string | null;
  created_at: string;
}

// ─── POD Shortage/Damage Claims (migration 061) ────────────────────────────

export type PodClaimStatus = "none" | "pending" | "credited";

/** Columns added to `proof_of_delivery` — spread onto the existing POD row type/`any`. */
export interface ProofOfDeliveryClaimFields {
  shortage_qty: number | null;
  shortage_value: number;
  damage_value: number;
  claim_status: PodClaimStatus;
  claim_notes: string | null;
  credit_note_id: string | null;
}

/** Params for `supabase.rpc("raise_pod_claim", ...)`. Returns the new (draft) credit_notes.id. */
export interface RaisePodClaimParams {
  p_pod_id: string;
  p_notes?: string;
}

// ─── Fuel Cost Entry (migration 061 — fixes the vehicle_costs insert gap) ──

/** Columns added to `vehicle_costs` so the existing fuel-costs page's liters/odometer fields actually persist. */
export interface VehicleCostFuelFields {
  liters: number | null;
  odometer_reading: number | null;
}

// ─── Reporting Views (migration 061) ───────────────────────────────────────

/** Row shape of `view_trip_profitability`. */
export interface TripProfitabilityRow {
  trip_id: string;
  trip_number: string | null;
  origin: string;
  destination: string;
  trip_type: string | null;
  status: string;
  distance_km: number | null;
  currency: string;
  revenue_tzs: number;
  vehicle_cost_tzs: number;
  driver_settled_expense_tzs: number;
  subcontractor_cost_tzs: number;
  shortage_damage_claims_tzs: number;
  net_profit_tzs: number;
  /** null when distance_km is 0/unset — can't divide by zero. */
  profit_per_km_tzs: number | null;
}

/** Row shape of `view_driver_float_aging`. Only ISSUED (un-cleared) advances appear here. */
export interface DriverFloatAgingRow {
  trip_advance_id: string;
  advance_number: string | null;
  driver_id: string | null;
  driver_name: string | null;
  trip_id: string | null;
  trip_number: string | null;
  advance_amount: number;
  currency: string;
  issue_date: string;
  status: TripAdvanceStatus;
  settled_amount: number;
  unreconciled_balance: number;
  days_outstanding: number;
}

/** Row shape of `view_tra_vfd_audit_schedule`. VAT rows come from invoices, WHT rows from vendor_bills — filter/group by schedule_type. */
export interface TraVfdAuditScheduleRow {
  schedule_type: "VAT" | "WHT";
  source_id: string;
  document_number: string | null;
  document_date: string;
  party_name: string | null;
  /** InvoiceVatType for VAT rows, e.g. "WHT_2.00PCT" for WHT rows. */
  tax_treatment: string;
  currency: string;
  taxable_base: number;
  tax_amount: number;
  gross_amount: number;
  is_vfd_verified: boolean;
  tra_rct_num: string | null;
  tra_z_num: string | null;
  tra_verification_url: string | null;
}

// ─── fleet_fuel_summary (migration 061 — redefined against live data) ─────

export interface FleetFuelSummaryRow {
  plate_number: string;
  make: string;
  model: string;
  fuel_fill_count: number;
  total_litres: number | null;
  total_fuel_cost: number | null;
  total_distance_km: number | null;
  avg_efficiency_km_l: number | null;
  min_efficiency_km_l: number | null;
  max_efficiency_km_l: number | null;
  last_fill_date: string | null;
  vehicle_id: string;
}
