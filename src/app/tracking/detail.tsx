"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryCard, IndustryCardKicker, IndustryCardTitle } from "@/components/industry/card";
import { IndustryButton } from "@/components/industry/button";
import { cn } from "@/lib/utils";
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
        {(tab === "docs" || tab === "client" || tab === "billing" || tab === "handover") && (
          <IndustryCard>
            <IndustryCardTitle>{TABS.find((t) => t.key === tab)!.label}</IndustryCardTitle>
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
