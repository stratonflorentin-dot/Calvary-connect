"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { IndustryTag } from "@/components/industry/tag";
import type { TrackingUnit } from "@/hooks/use-tracking-units";
import type { FleetMapDriver } from "@/components/fleet-map/types";

type Mode = "all" | "active" | "idle";

const ACTIVE_TRIP_STATUSES = new Set(["pending", "loading", "in_transit"]);

export function useTrackingFilters(units: TrackingUnit[], mode: Mode, partners: string[], query: string) {
  // Partner list is derived from real trip.client values that actually
  // appear in the data — never hardcoded, so it's empty until there's real
  // data to filter by rather than showing five clients that don't exist yet.
  const partnerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of units) if (u.trip?.client) set.add(u.trip.client);
    return Array.from(set).sort();
  }, [units]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter((u) => {
      const isActive = !!u.trip && ACTIVE_TRIP_STATUSES.has(u.trip.status);
      if (mode === "active" && !isActive) return false;
      if (mode === "idle" && isActive) return false;
      if (partners.length > 0 && (!u.trip?.client || !partners.includes(u.trip.client))) return false;
      if (q) {
        const haystack = [u.plate, u.trip?.tripNumber, u.trip?.driverName, u.trip?.origin, u.trip?.destination, u.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [units, mode, partners, query]);

  return { filtered, partnerOptions };
}

export function TrackingUnitList({
  units,
  loading,
  sel,
  onSelect,
  mode,
  onModeChange,
  partners,
  onPartnersChange,
  query,
  onQueryChange,
  positions,
}: {
  units: TrackingUnit[];
  loading: boolean;
  sel: string | null;
  onSelect: (vehicleId: string) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  partners: string[];
  onPartnersChange: (p: string[]) => void;
  query: string;
  onQueryChange: (q: string) => void;
  positions: FleetMapDriver[];
}) {
  const { filtered, partnerOptions } = useTrackingFilters(units, mode, partners, query);

  const togglePartner = (p: string) => {
    onPartnersChange(partners.includes(p) ? partners.filter((x) => x !== p) : [...partners, p]);
  };

  return (
    <div className="flex flex-col h-full min-w-[264px] max-w-[340px] w-full shrink-0 border-r border-[var(--ci-divider)]">
      <div className="p-[13.6px] border-b border-[var(--ci-divider)] flex flex-col gap-[10px]">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[15px]" style={{ fontFamily: "var(--font-barlow-condensed)", fontWeight: 600 }}>
            Units
          </h4>
          <span className="ci-mono text-[11px] text-[var(--ci-text-tertiary)]">{filtered.length} shown</span>
        </div>

        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search plate, trip, driver, route…"
          className="w-full text-[13px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[6px] outline-none focus-visible:border-[var(--ci-accent)]"
        />

        {partnerOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {partnerOptions.map((p) => (
              <button
                key={p}
                onClick={() => togglePartner(p)}
                className={cn(
                  "text-[11px] px-2 py-[3px] border transition-colors duration-150",
                  partners.includes(p)
                    ? "border-[var(--ci-accent)] bg-[var(--ci-accent-100)] text-[var(--ci-accent-800)]"
                    : "border-[var(--ci-divider)] text-[var(--ci-text-secondary)] hover:border-[var(--ci-accent)]"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="inline-flex border border-[var(--ci-divider)] w-fit">
          {(["all", "active", "idle"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={cn(
                "text-[12px] px-3 py-[5px] capitalize border-l border-[var(--ci-divider)] first:border-l-0 transition-colors duration-150",
                mode === m ? "bg-[var(--ci-accent)] text-[var(--ci-bg)]" : "hover:bg-[var(--ci-nav-hover)]"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-[10px] grid grid-cols-2 gap-[8px] content-start">
        {loading ? (
          <p className="col-span-2 text-[12px] text-[var(--ci-text-tertiary)] p-3">Loading units…</p>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-[12px] text-[var(--ci-text-tertiary)]">No units match</p>
            <button
              onClick={() => {
                onModeChange("all");
                onPartnersChange([]);
                onQueryChange("");
              }}
              className="text-[11px] text-[var(--ci-accent)] hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filtered.map((u) => {
            const pos =
              positions.find((l) => l.vehiclePlate === u.plate) ??
              (u.trip?.driverName ? positions.find((l) => l.driverName === u.trip!.driverName) : undefined) ??
              null;
            return <UnitCard key={u.vehicleId} unit={u} selected={u.vehicleId === sel} onClick={() => onSelect(u.vehicleId)} gpsOnline={pos?.isOnline ?? null} />;
          })
        )}
      </div>
    </div>
  );
}

function UnitCard({
  unit,
  selected,
  onClick,
  gpsOnline,
}: {
  unit: TrackingUnit;
  selected: boolean;
  onClick: () => void;
  /** null = no GPS data source found for this unit at all (not just offline). */
  gpsOnline: boolean | null;
}) {
  const isActive = !!unit.trip && ACTIVE_TRIP_STATUSES.has(unit.trip.status);
  return (
    <button
      onClick={onClick}
      className={cn(
        "ci-blueprint text-left flex flex-col gap-1.5 p-[9px] transition-[transform,border-color,background] duration-150 ease-[cubic-bezier(.16,1,.3,1)]",
        selected ? "border-[var(--ci-accent)] bg-[var(--ci-selected)]" : "hover:-translate-y-px hover:border-[var(--ci-accent)]"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="ci-mono text-[13px] font-bold flex items-center gap-1.5">
          {unit.plate}
          <span
            title={gpsOnline === null ? "No GPS source" : gpsOnline ? "GPS live" : "GPS offline"}
            className={cn("inline-block size-1.5 rounded-full", gpsOnline === null ? "bg-[var(--ci-text-tertiary)]" : gpsOnline ? "ci-pulse bg-[var(--ci-accent)]" : "bg-[#8c1d18]")}
          />
        </span>
        <IndustryTag variant={isActive ? "accent" : "neutral"} pulse={isActive}>
          {isActive ? unit.trip!.status.replace("_", " ") : "idle"}
        </IndustryTag>
      </div>

      {unit.trip ? (
        <>
          <p className="text-[11px] text-[var(--ci-text-tertiary)] ci-mono">
            {new Date(unit.trip.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[12px] leading-snug truncate">{unit.trip.origin || "—"}</p>
          <p className="text-[11px] text-[var(--ci-text-tertiary)] ci-mono">
            {unit.trip.estimatedDistanceKm != null ? `${unit.trip.estimatedDistanceKm} km` : "—"}
          </p>
          <p className="text-[12px] leading-snug truncate">→ {unit.trip.destination || "—"}</p>
        </>
      ) : (
        <p className="text-[12px] text-[var(--ci-text-tertiary)]">No active trip</p>
      )}

      <div className="ci-hatch h-14 mt-1 flex items-center justify-center overflow-hidden">
        {unit.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={unit.photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-[var(--ci-text-tertiary)]">vehicle photo</span>
        )}
      </div>

      {unit.trip && (
        <div className="h-1 bg-[var(--ci-divider)] mt-1">
          <div
            className="h-full bg-[var(--ci-accent)] transition-[width] duration-[350ms]"
            style={{ width: `${tripProgressPercent(unit.trip)}%` }}
          />
        </div>
      )}
    </button>
  );
}

/** No geocoded waypoints exist to compute real progress along the route, so
 *  this is an honest time-based proxy — elapsed time over estimated
 *  duration — not a GPS-derived distance-traveled figure. Clamped to 92%
 *  short of "delivered" (that status flips the bar full via the caller). */
function tripProgressPercent(trip: NonNullable<TrackingUnit["trip"]>): number {
  if (!trip.estimatedDurationHours || trip.estimatedDurationHours <= 0) return trip.status === "in_transit" ? 40 : 10;
  const elapsedHours = (Date.now() - new Date(trip.createdAt).getTime()) / 3_600_000;
  return Math.max(4, Math.min(92, Math.round((elapsedHours / trip.estimatedDurationHours) * 100)));
}
