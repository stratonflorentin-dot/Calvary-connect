"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryCard, IndustryCardKicker, IndustryCardTitle } from "@/components/industry/card";
import { IndustryButton } from "@/components/industry/button";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { cn, formatAmount } from "@/lib/utils";
import { complianceStatus, daysRemaining, STATUS_META, DOC_TYPE_LABELS } from "@/lib/compliance/status";
import type { TrackingUnit } from "@/hooks/use-tracking-units";

export type DetailTab = "shipping" | "vehicle" | "docs" | "client" | "billing" | "handover";

const TABS: { key: DetailTab; label: string }[] = [
  { key: "shipping", label: "Shipping info" },
  { key: "vehicle", label: "Vehicle info" },
  { key: "docs", label: "Documents" },
  { key: "client", label: "Client" },
  { key: "billing", label: "Billing" },
  { key: "handover", label: "Sales handover" },
];

const ACTIVE_TRIP_STATUSES = new Set(["pending", "loading", "in_transit"]);

export function TrackingDetail({ unit, tab, onTabChange, tick }: { unit: TrackingUnit; tab: DetailTab; onTabChange: (t: DetailTab) => void; tick: number }) {
  const isActive = !!unit.trip && ACTIVE_TRIP_STATUSES.has(unit.trip.status);

  return (
    <div className="flex-1 min-w-[430px] flex flex-col h-full overflow-hidden">
      <div className="sticky top-0 z-10 bg-[var(--ci-bg)] border-b border-[var(--ci-divider)] p-[13.6px] flex flex-col gap-[10px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ci-mono text-[26px] leading-none tracking-[-0.02em]">{unit.trip?.tripNumber ?? unit.plate}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <IndustryTag variant={isActive ? "accent" : "neutral"} pulse={isActive}>
                {unit.trip ? unit.trip.status.replace("_", " ") : "idle"}
              </IndustryTag>
              <span className="text-[12px] text-[var(--ci-text-secondary)] ci-mono">{unit.plate}</span>
              <span className="text-[12px] text-[var(--ci-text-secondary)]">· {unit.trip?.driverName ?? "Unassigned"}</span>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <IndustryButton variant="secondary">Call</IndustryButton>
            <IndustryButton variant="secondary" onClick={() => onTabChange("handover")}>Chat</IndustryButton>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={cn(
                "text-[13px] px-3 py-[6px] whitespace-nowrap border-b-2 transition-colors duration-150",
                tab === t.key
                  ? "border-[var(--ci-accent)] text-[var(--ci-text)] font-semibold"
                  : "border-transparent text-[var(--ci-text-tertiary)] hover:text-[var(--ci-text)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-[13.6px] flex flex-col gap-4">
        {tab === "shipping" && <ShippingTab unit={unit} tick={tick} />}
        {tab === "vehicle" && <VehicleTab unit={unit} />}
        {tab === "docs" && <DocumentsTab unit={unit} />}
        {tab === "client" && <ClientTab unit={unit} />}
        {tab === "billing" && <BillingTab unit={unit} />}
        {tab === "handover" && (
          <IndustryCard>
            <IndustryCardTitle>Sales handover</IndustryCardTitle>
            <p className="text-[13px] text-[var(--ci-text-secondary)]">Built in the next pass of this console.</p>
          </IndustryCard>
        )}
      </div>
    </div>
  );
}

function elapsedLabel(startIso: string): string {
  const ms = Date.now() - new Date(startIso).getTime();
  if (ms < 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function ShippingTab({ unit, tick }: { unit: TrackingUnit; tick: number }) {
  const trip = unit.trip;

  if (!trip) {
    return (
      <IndustryCard>
        <IndustryCardTitle>No active trip</IndustryCardTitle>
        <p className="text-[13px] text-[var(--ci-text-secondary)]">
          {unit.plate} has no pending, loading, or in-transit trip right now.
        </p>
      </IndustryCard>
    );
  }

  const eta = trip.estimatedDurationHours
    ? new Date(new Date(trip.createdAt).getTime() + trip.estimatedDurationHours * 3_600_000)
    : null;

  return (
    <>
      {/* tick is unused directly — its only job is forcing this component to
          re-render once a second so elapsedLabel() re-evaluates Date.now(). */}
      <div className="ci-metric-strip grid-cols-4" data-tick={tick}>
        <div>
          <p className="ci-lbl">Elapsed</p>
          <p className="ci-mono text-[24px] leading-[.92] tracking-[-0.02em]">{elapsedLabel(trip.createdAt)}</p>
        </div>
        <div>
          <p className="ci-lbl">Distance</p>
          <p className="ci-mono text-[24px] leading-[.92] tracking-[-0.02em]">
            {trip.estimatedDistanceKm != null ? trip.estimatedDistanceKm : "—"}
            {trip.estimatedDistanceKm != null && <span className="text-[13px] ml-1">km</span>}
          </p>
        </div>
        <div>
          <p className="ci-lbl">ETA</p>
          <p className="ci-mono text-[24px] leading-[.92] tracking-[-0.02em]">
            {eta ? eta.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
          </p>
        </div>
        <div>
          <p className="ci-lbl">Fuel</p>
          <p className="ci-mono text-[24px] leading-[.92] tracking-[-0.02em]">
            {unit.currentFuelLevel != null ? `${unit.currentFuelLevel}%` : "—"}
          </p>
        </div>
      </div>

      <IndustryCard>
        <IndustryCardKicker>Route</IndustryCardKicker>
        <div className="ci-hatch ci-blueprint h-[170px] flex items-center justify-center text-[11px] text-[var(--ci-text-tertiary)]">
          <i className="ci-corner tl" /><i className="ci-corner tr" /><i className="ci-corner bl" /><i className="ci-corner br" />
          route map — no waypoint data to plot yet
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <p className="ci-lbl">Origin</p>
            <p className="text-[13px]">{trip.origin || "—"}</p>
          </div>
          <div>
            <p className="ci-lbl">Destination</p>
            <p className="text-[13px]">{trip.destination || "—"}</p>
          </div>
        </div>
        {/* The design spec shows 4 leg columns (waypoint-by-waypoint) — this
            schema only records a single origin/destination pair per trip,
            no intermediate stops, so that breakdown isn't fabricated here. */}
      </IndustryCard>

      <IndustryCard>
        <IndustryCardKicker>Cargo</IndustryCardKicker>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="ci-hatch ci-blueprint aspect-square flex items-center justify-center text-[9px] text-center text-[var(--ci-text-tertiary)] p-1">
              <i className="ci-corner tl" /><i className="ci-corner tr" /><i className="ci-corner bl" /><i className="ci-corner br" />
              {["loading bay", "weighbridge", "tarpaulin", "odometer", "seal"][i]}
            </div>
          ))}
        </div>
      </IndustryCard>

      {/* Route requests (fuel/parts/maintenance tied to this specific trip)
          need a trip_id column on those request tables to join honestly —
          none exists yet, so this is a real gap, not rendered as fake rows. */}
    </>
  );
}

function VehicleTab({ unit }: { unit: TrackingUnit }) {
  const [maintenance, setMaintenance] = useState<{ id: string; title: string; status: string; created_at: string }[]>([]);
  const [crew, setCrew] = useState<{ name: string; role: string }[]>([]);

  useEffect(() => {
    supabase
      .from("maintenance_requests")
      .select("id, title, status, created_at")
      .eq("vehicle_id", unit.vehicleId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setMaintenance(data ?? []));

    if (unit.trip?.driverId) {
      supabase
        .from("user_profiles")
        .select("name, role")
        .eq("id", unit.trip.driverId)
        .maybeSingle()
        .then(({ data }) => setCrew(data ? [{ name: data.name, role: data.role }] : []));
    } else {
      setCrew([]);
    }
  }, [unit.vehicleId, unit.trip?.driverId]);

  return (
    <>
      <IndustryCard>
        <IndustryCardKicker>Spec sheet</IndustryCardKicker>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
          <SpecRow label="plate_number" value={unit.plate} mono />
          <SpecRow label="type" value={unit.type ?? "—"} />
          <SpecRow label="status" value={unit.vehicleStatus ?? "—"} />
          <SpecRow label="mileage" value={unit.mileage != null ? `${unit.mileage.toLocaleString()} km` : "—"} mono />
          <SpecRow label="next_maintenance_due" value={unit.nextMaintenanceDue ? new Date(unit.nextMaintenanceDue).toLocaleDateString() : "—"} mono />
          <SpecRow label="insurance_expiry" value={unit.insuranceExpiry ? new Date(unit.insuranceExpiry).toLocaleDateString() : "—"} mono />
          <SpecRow label="current_fuel_level" value={unit.currentFuelLevel != null ? `${unit.currentFuelLevel}%` : "—"} mono />
        </div>
      </IndustryCard>

      <IndustryCard>
        <IndustryCardKicker>Maintenance history</IndustryCardKicker>
        {maintenance.length === 0 ? (
          <p className="text-[12px] text-[var(--ci-text-tertiary)] mt-1">No maintenance requests logged for this vehicle.</p>
        ) : (
          <div className="flex flex-col mt-1">
            {maintenance.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-[6px] border-b border-[var(--ci-cell-divider)] last:border-b-0 text-[12px]">
                <span>{m.title}</span>
                <span className="ci-mono text-[var(--ci-text-tertiary)]">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </IndustryCard>

      <IndustryCard>
        <IndustryCardKicker>Assigned crew</IndustryCardKicker>
        {crew.length === 0 ? (
          <p className="text-[12px] text-[var(--ci-text-tertiary)] mt-1">No driver currently assigned.</p>
        ) : (
          crew.map((c, i) => (
            <p key={i} className="text-[13px] mt-1">{c.name} <span className="text-[var(--ci-text-tertiary)]">· {c.role}</span></p>
          ))
        )}
      </IndustryCard>
    </>
  );
}

function SpecRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="ci-lbl">{label}</span>
      <span className={cn("text-[13px]", mono && "ci-mono")}>{value}</span>
    </div>
  );
}

// The five document categories the design names, mapped onto this schema's
// real DOCUMENT_TYPES (src/lib/compliance/status.ts, the same engine
// /fleet/compliance already uses — reused, not reinvented). "Transit bond"
// has no dedicated category in this schema yet, so it's mapped to "other"
// and will only match a document someone filed that way.
const TRACKING_DOC_CATEGORIES: { key: string; label: string }[] = [
  { key: "insurance", label: "Insurance" },
  { key: "road_license", label: "Road licence" },
  { key: "inspection", label: "TBS inspection" },
  { key: "permit", label: "SUMATRA permit" },
  { key: "other", label: "Transit bond" },
];

interface VehicleDoc {
  doc_type: string;
  document_number: string | null;
  expiry_date: string | null;
}

function DocumentsTab({ unit }: { unit: TrackingUnit }) {
  const [docs, setDocs] = useState<VehicleDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("vehicle_documents")
      .select("doc_type, document_number, expiry_date")
      .eq("vehicle_id", unit.vehicleId)
      .order("expiry_date", { ascending: true })
      .then(({ data }) => {
        setDocs(data ?? []);
        setLoading(false);
      });
  }, [unit.vehicleId]);

  return (
    <IndustryCard>
      <IndustryCardTitle>Documents</IndustryCardTitle>
      {loading ? (
        <p className="text-[12px] text-[var(--ci-text-tertiary)] mt-1">Loading…</p>
      ) : (
        <IndustryTable className="mt-2">
          <thead>
            <tr>
              <IndustryTh>Document</IndustryTh>
              <IndustryTh>Reference</IndustryTh>
              <IndustryTh>Expiry</IndustryTh>
              <IndustryTh>Status</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {TRACKING_DOC_CATEGORIES.map((cat) => {
              // Most-soon-to-expire row for this category, if there's more
              // than one on file — that's the one that actually matters.
              const match = docs
                .filter((d) => d.doc_type === cat.key)
                .sort((a, b) => (a.expiry_date ?? "9999").localeCompare(b.expiry_date ?? "9999"))[0];
              const status = complianceStatus(match?.expiry_date);
              const remaining = daysRemaining(match?.expiry_date);
              return (
                <IndustryTr key={cat.key}>
                  <IndustryTd>{cat.label}</IndustryTd>
                  <IndustryTd mono>{match?.document_number || "—"}</IndustryTd>
                  <IndustryTd mono>{match?.expiry_date ? new Date(match.expiry_date).toLocaleDateString() : "—"}</IndustryTd>
                  <IndustryTd>
                    <IndustryTag variant={status === "expired" || status === "due_today" ? "danger" : status === "ok" ? "accent" : status === "unknown" ? "neutral" : "warning"}>
                      {STATUS_META[status].label}
                      {remaining !== null && status !== "expired" && status !== "unknown" ? ` · ${remaining}d` : ""}
                    </IndustryTag>
                  </IndustryTd>
                </IndustryTr>
              );
            })}
            {/* Any document type the vehicle actually has on file outside
                the five named above (e.g. a real "registration") — shown
                rather than silently dropped. */}
            {docs
              .filter((d) => !TRACKING_DOC_CATEGORIES.some((c) => c.key === d.doc_type))
              .map((d, i) => {
                const status = complianceStatus(d.expiry_date);
                const remaining = daysRemaining(d.expiry_date);
                return (
                  <IndustryTr key={`extra-${i}`}>
                    <IndustryTd>{DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</IndustryTd>
                    <IndustryTd mono>{d.document_number || "—"}</IndustryTd>
                    <IndustryTd mono>{d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : "—"}</IndustryTd>
                    <IndustryTd>
                      <IndustryTag variant={status === "expired" || status === "due_today" ? "danger" : status === "ok" ? "accent" : "warning"}>
                        {STATUS_META[status].label}
                        {remaining !== null ? ` · ${remaining}d` : ""}
                      </IndustryTag>
                    </IndustryTd>
                  </IndustryTr>
                );
              })}
          </tbody>
        </IndustryTable>
      )}
    </IndustryCard>
  );
}

interface ClientInfo {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
}

function ClientTab({ unit }: { unit: TrackingUnit }) {
  const [customer, setCustomer] = useState<ClientInfo | null>(null);
  const [balance, setBalance] = useState<{ currency: string; balance: number }[]>([]);
  const [contract, setContract] = useState<{ contract_number: string; contract_type: string | null; rate_per_km?: number | null; currency: string | null; status: string } | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unit.trip) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: trip } = await supabase.from("trips").select("quotation_id, notes").eq("id", unit.trip!.id).maybeSingle();
      if (cancelled) return;
      setNotes(trip?.notes ?? null);

      if (!trip?.quotation_id) {
        setLoading(false);
        return;
      }
      const { data: quotation } = await supabase.from("quotations").select("customer_id").eq("id", trip.quotation_id).maybeSingle();
      if (cancelled || !quotation?.customer_id) {
        setLoading(false);
        return;
      }
      const [{ data: cust }, { data: bal }, { data: contracts }] = await Promise.all([
        supabase.from("customers").select("id, company_name, contact_person, phone, email").eq("id", quotation.customer_id).maybeSingle(),
        supabase.from("v_customer_balances").select("currency, balance").eq("customer_key", quotation.customer_id),
        supabase.from("contracts").select("contract_number, contract_type, currency, status").eq("customer_id", quotation.customer_id).order("start_date", { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      setCustomer(cust ?? null);
      setBalance((bal ?? []).filter((b) => Math.round(Number(b.balance)) !== 0));
      setContract(contracts?.[0] ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [unit.trip]);

  if (!unit.trip) {
    return (
      <IndustryCard>
        <IndustryCardTitle>Client</IndustryCardTitle>
        <p className="text-[13px] text-[var(--ci-text-secondary)]">No active trip to show a consignor for.</p>
      </IndustryCard>
    );
  }

  return (
    <>
      <IndustryCard>
        <IndustryCardKicker>Consignor</IndustryCardKicker>
        {loading ? (
          <p className="text-[12px] text-[var(--ci-text-tertiary)] mt-1">Loading…</p>
        ) : customer ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
            <SpecRow label="company" value={customer.company_name ?? "—"} />
            <SpecRow label="contact" value={customer.contact_person ?? "—"} />
            <SpecRow label="phone" value={customer.phone ?? "—"} mono />
            <SpecRow label="email" value={customer.email ?? "—"} />
            <SpecRow label="contract" value={contract ? `${contract.contract_number} (${contract.status})` : "No contract on file"} />
            <SpecRow label="rate basis" value={contract?.contract_type ?? "—"} />
            <div className="col-span-2">
              <span className="ci-lbl">open balance</span>
              {balance.length === 0 ? (
                <p className="text-[13px]">Settled</p>
              ) : (
                balance.map((b) => (
                  <p key={b.currency} className="text-[13px] ci-mono">{formatAmount(b.balance, b.currency)}</p>
                ))
              )}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">
            {unit.trip.client ? `"${unit.trip.client}" (free-text client, not linked to a customer record)` : "No customer linked to this trip's quotation."}
          </p>
        )}
      </IndustryCard>

      <IndustryCard>
        <IndustryCardKicker>Delivery instructions</IndustryCardKicker>
        <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">{notes || "None recorded."}</p>
      </IndustryCard>
    </>
  );
}

const POSTS_TO: Record<string, string> = {
  revenue: "4000 Revenue",
  vat: "2200 VAT",
  fuel: "5100 Fuel",
  tolls: "5400 Tolls",
  border: "5400 Tolls",
  customs: "5400 Tolls",
};

function BillingTab({ unit }: { unit: TrackingUnit }) {
  const [invoice, setInvoice] = useState<{ invoice_number: string; total_amount: number; currency: string; status: string } | null>(null);
  const [tripCosts, setTripCosts] = useState<{ cost_fuel: number; cost_tolls: number; cost_border: number; cost_customs: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unit.trip) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from("invoices").select("invoice_number, total_amount, currency, status").eq("trip_id", unit.trip.id).order("issue_date", { ascending: false }).limit(1),
      supabase.from("trips").select("cost_fuel, cost_tolls, cost_border, cost_customs").eq("id", unit.trip.id).maybeSingle(),
    ]).then(([inv, costs]) => {
      setInvoice(inv.data?.[0] ?? null);
      setTripCosts(costs.data ?? null);
      setLoading(false);
    });
  }, [unit.trip]);

  if (!unit.trip) {
    return (
      <IndustryCard>
        <IndustryCardTitle>Billing</IndustryCardTitle>
        <p className="text-[13px] text-[var(--ci-text-secondary)]">No active trip to bill.</p>
      </IndustryCard>
    );
  }

  const currency = invoice?.currency ?? "TZS";
  const revenue = invoice?.total_amount ?? 0;
  const costToDate = tripCosts ? tripCosts.cost_fuel + tripCosts.cost_tolls + tripCosts.cost_border + tripCosts.cost_customs : 0;
  const margin = revenue - costToDate;

  const lines = tripCosts
    ? [
        { label: "Fuel", amount: tripCosts.cost_fuel, postsTo: POSTS_TO.fuel },
        { label: "Tolls", amount: tripCosts.cost_tolls, postsTo: POSTS_TO.tolls },
        { label: "Border fees", amount: tripCosts.cost_border, postsTo: POSTS_TO.border },
        { label: "Customs", amount: tripCosts.cost_customs, postsTo: POSTS_TO.customs },
      ].filter((l) => l.amount > 0)
    : [];

  return (
    <>
      <div className="ci-metric-strip grid-cols-4">
        <div>
          <p className="ci-lbl">Revenue</p>
          <p className="ci-mono text-[20px] leading-[.92]">{loading ? "—" : formatAmount(revenue, currency)}</p>
        </div>
        <div>
          <p className="ci-lbl">Cost to date</p>
          <p className="ci-mono text-[20px] leading-[.92]">{loading ? "—" : formatAmount(costToDate, currency)}</p>
        </div>
        <div>
          <p className="ci-lbl">Margin</p>
          <p className="ci-mono text-[20px] leading-[.92]">{loading ? "—" : formatAmount(margin, currency)}</p>
        </div>
        <div>
          <p className="ci-lbl">Invoice</p>
          <p className="text-[20px] leading-[.92]">{invoice ? invoice.status : "Not yet raised"}</p>
        </div>
      </div>

      <IndustryCard>
        <IndustryCardKicker>Lines</IndustryCardKicker>
        {loading ? (
          <p className="text-[12px] text-[var(--ci-text-tertiary)] mt-1">Loading…</p>
        ) : (
          <IndustryTable className="mt-2">
            <thead>
              <tr>
                <IndustryTh>Line</IndustryTh>
                <IndustryTh align="right">Amount</IndustryTh>
                <IndustryTh>Posts to</IndustryTh>
              </tr>
            </thead>
            <tbody>
              {invoice && (
                <IndustryTr>
                  <IndustryTd>{invoice.invoice_number}</IndustryTd>
                  <IndustryTd align="right" mono>{formatAmount(invoice.total_amount, invoice.currency)}</IndustryTd>
                  <IndustryTd>{POSTS_TO.revenue}</IndustryTd>
                </IndustryTr>
              )}
              {lines.map((l) => (
                <IndustryTr key={l.label}>
                  <IndustryTd>{l.label}</IndustryTd>
                  <IndustryTd align="right" mono>{formatAmount(l.amount, currency)}</IndustryTd>
                  <IndustryTd>{l.postsTo}</IndustryTd>
                </IndustryTr>
              ))}
              {!invoice && lines.length === 0 && (
                <tr>
                  <IndustryTd className="text-[var(--ci-text-tertiary)]">No revenue or cost lines recorded yet.</IndustryTd>
                  <IndustryTd align="right">—</IndustryTd>
                  <IndustryTd>—</IndustryTd>
                </tr>
              )}
            </tbody>
          </IndustryTable>
        )}
        <p className="text-[11px] text-[var(--ci-text-tertiary)] mt-2">
          These lines reflect what&apos;s actually posted or recorded — nothing here creates or edits a journal entry.
        </p>
      </IndustryCard>
    </>
  );
}
