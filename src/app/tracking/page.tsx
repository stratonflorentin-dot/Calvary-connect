"use client";

import { useEffect, useState } from "react";
import { IndustryShell } from "@/components/industry/shell";
import { useTrackingUnits } from "@/hooks/use-tracking-units";
import { TrackingRail } from "./rail";
import { TrackingUnitList } from "./unit-list";
import { TrackingDetail, type DetailTab } from "./detail";

/**
 * Operator's live tracking console — design_handoff_calvary_connect's
 * "Calvary Connect - Tracking Console.dc.html", rebuilt against real
 * Supabase data (vehicles + trips, via useTrackingUnits) instead of the
 * mock. Three independently-scrolling columns, no page scroll.
 */
export default function TrackingConsolePage() {
  const { units, loading } = useTrackingUnits();

  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("shipping");
  const [mode, setMode] = useState<"all" | "active" | "idle">("all");
  const [partners, setPartners] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);

  // 1Hz counter driving the elapsed-trip clock in the shipping-info tab —
  // per the design handoff's state spec, cleared on unmount.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-select the first unit once real data lands, if nothing's selected.
  useEffect(() => {
    if (!sel && units.length > 0) setSel(units[0].vehicleId);
  }, [sel, units]);

  const selectedUnit = units.find((u) => u.vehicleId === sel) ?? null;

  return (
    <IndustryShell className="flex h-screen w-screen overflow-hidden">
      <TrackingRail />
      <TrackingUnitList
        units={units}
        loading={loading}
        sel={sel}
        onSelect={(id) => {
          setSel(id);
          setTab("shipping");
        }}
        mode={mode}
        onModeChange={setMode}
        partners={partners}
        onPartnersChange={setPartners}
        query={query}
        onQueryChange={setQuery}
      />
      {selectedUnit ? (
        <TrackingDetail unit={selectedUnit} tab={tab} onTabChange={setTab} tick={tick} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--ci-text-tertiary)]">
          {loading ? "Loading fleet…" : "Select a unit to see its detail."}
        </div>
      )}
    </IndustryShell>
  );
}
