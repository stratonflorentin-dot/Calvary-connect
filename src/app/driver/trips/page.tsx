"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDriverData } from "@/hooks/use-driver-data";
import { useRole } from "@/hooks/use-role";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IndustryDriverShell } from "@/components/driver/industry-driver-shell";
import { IndustryCard } from "@/components/industry/card";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import { cn } from "@/lib/utils";

type TripTab = "all" | "pending" | "transit" | "delivered";

const FILTERS: { key: TripTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "transit", label: "In transit" },
  { key: "delivered", label: "Done" },
];

function displayStatus(status: string): string {
  const s = (status || "").toLowerCase();
  if (["delivered", "completed"].includes(s)) return "Delivered";
  if (["in_transit", "loading", "in_progress"].includes(s)) return "In Transit";
  if (["delayed", "cancelled"].includes(s)) return "Delayed";
  return "Pending";
}

function tagVariant(label: string): "accent" | "neutral" | "danger" {
  if (label === "Delivered") return "accent";
  if (label === "In Transit") return "accent";
  if (label === "Delayed") return "danger";
  return "neutral";
}

function filterTrips(trips: Record<string, unknown>[], tab: TripTab) {
  return trips.filter((t) => {
    const s = String(t.status || "").toLowerCase();
    if (tab === "pending") return ["pending", "created", "loaded"].includes(s);
    if (tab === "transit") return ["in_transit", "loading", "in_progress"].includes(s);
    if (tab === "delivered") return ["delivered", "completed"].includes(s);
    return true;
  });
}

/**
 * Restyled onto IndustryDriverShell — see Home for the shell's spec
 * rationale. The design forbids nested in-page tabs, so the status filter
 * that was a Radix Tabs component before is now a plain segmented button
 * row (no tab-panel semantics, just a filter), same underlying
 * filterTrips() logic as before.
 */
export default function DriverTripsPage() {
  const { role } = useRole();
  const router = useRouter();
  const { trips, loading } = useDriverData();
  const [tab, setTab] = useState<TripTab>("all");

  useEffect(() => {
    if (role && role !== "DRIVER") router.replace("/trips");
  }, [role, router]);

  const filtered = useMemo(() => filterTrips(trips, tab), [trips, tab]);

  return (
    <IndustryDriverShell title="My trips">
      <p className="text-[12px] text-[var(--ci-text-secondary)] -mt-1">
        Only trips assigned to you. You cannot create or assign trips.
      </p>

      <div className="flex border border-[var(--ci-divider)] w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTab(f.key)}
            className={cn(
              "text-[12px] px-3 min-h-[40px] border-l border-[var(--ci-divider)] first:border-l-0 transition-colors duration-150",
              tab === f.key ? "bg-[var(--ci-accent)] text-[var(--ci-bg)]" : "hover:bg-[var(--ci-nav-hover)]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-8">Loading trips…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-8">No trips in this category.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((trip: any) => {
            const label = displayStatus(String(trip.status));
            return (
              <IndustryCard key={String(trip.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="ci-mono text-[14px] font-bold">{String(trip.trip_number || trip.tripNumber || "Trip")}</p>
                    <p className="text-[12px] text-[var(--ci-text-secondary)] mt-0.5">
                      {String(trip.origin)} → {String(trip.destination)}
                    </p>
                  </div>
                  <IndustryTag variant={tagVariant(label)} pulse={label === "In Transit"}>
                    {label}
                  </IndustryTag>
                </div>
                {trip.cargo && (
                  <div className="mt-2 border-t border-[var(--ci-cell-divider)] pt-2">
                    <p className="ci-lbl">Cargo</p>
                    <p className="text-[13px]">{String(trip.cargo || trip.cargo_type || "—")}</p>
                  </div>
                )}
                <IndustryButton variant="secondary" size="driver" className="w-full mt-3" asChild>
                  <Link href="/proof">Upload proof of delivery</Link>
                </IndustryButton>
              </IndustryCard>
            );
          })}
        </div>
      )}
    </IndustryDriverShell>
  );
}
