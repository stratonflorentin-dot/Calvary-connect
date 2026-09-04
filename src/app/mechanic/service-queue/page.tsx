"use client";

import { useState } from "react";
import { useMaintenance } from "@/hooks/data/use-maintenance";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { useCurrency } from "@/hooks/use-currency";
import { applyTransition } from "@/lib/workflow/engine";
import { toast } from "@/hooks/use-toast";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard, IndustryCardKicker, IndustryCardTitle } from "@/components/industry/card";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { cn } from "@/lib/utils";

const MECHANIC_PAGES = [
  { label: "Service queue", href: "/mechanic/service-queue" },
  { label: "Spare parts", href: "/spare-parts" },
  { label: "Service history", href: "/mechanic/service-history" },
  { label: "Schedule", href: "/mechanic/schedule" },
];

const QUEUE_STATUSES = ["requested", "scheduled", "in_progress"] as const;

function statusVariant(status: string): "accent" | "neutral" | "warning" {
  if (status === "in_progress") return "accent";
  if (status === "requested") return "warning";
  return "neutral";
}

/**
 * Mechanic / Service queue — design_handoff_calvary_connect Role Screens
 * spec: "queue on the left, open job card on the right (work performed,
 * parts issued from inventory, condition segment, next-service mileage,
 * 'Complete & release vehicle')". Structurally different from the existing
 * /maintenance page (a flat filterable table for all roles) — this is a
 * queue+detail interaction, closer to the Tracking Console's list+detail
 * pattern than a restyle of that table, so it's a new page reading the same
 * maintenance_records data via the same useMaintenance() hook — /maintenance
 * itself is left untouched for now. Lives under /mechanic (not nested under
 * /maintenance) specifically to avoid src/app/maintenance/layout.tsx, which
 * wraps every route under it in the app-wide Sidebar — doubling up with
 * this page's own IndustryRoleShell.
 */
export default function ServiceQueuePage() {
  const { role } = useRole();
  const { user: authUser } = useSupabase();
  const { format } = useCurrency();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [costInput, setCostInput] = useState("");
  const [completing, setCompleting] = useState(false);

  const { records, loading, refetch } = useMaintenance({ sort: "scheduled_date" });
  const queue = records.filter((r) => (QUEUE_STATUSES as readonly string[]).includes(r.status));
  const selected = queue.find((r) => r.id === selectedId) ?? queue[0] ?? null;

  const complete = async () => {
    if (!selected) return;
    const cost = parseFloat(costInput);
    if (!cost || cost <= 0) {
      toast({ title: "Enter the actual cost first", variant: "destructive" });
      return;
    }
    setCompleting(true);
    try {
      const result = await applyTransition({
        kind: "maintenance_request",
        entityId: selected.id,
        toState: "completed",
        actorId: authUser?.id ?? "system",
        actorRole: role ?? undefined,
        payload: { actual_cost: cost },
      });
      if (!result.ok) {
        toast({ title: "Couldn't complete", description: result.message, variant: "destructive" });
        return;
      }
      toast({ variant: "success", title: "Job completed", description: "Vehicle released, cost posted." });
      setCostInput("");
      setSelectedId(null);
      refetch();
    } finally {
      setCompleting(false);
    }
  };

  // Real next-service-due mileage — vehicles.mileage + service_interval_km,
  // both real columns — not a fabricated figure.
  const vehicle = (selected as any)?.vehicles;

  return (
    <IndustryRoleShell roleLabel="Mechanic" pages={MECHANIC_PAGES}>
      <div className="flex gap-4 h-full min-h-0">
        <div className="w-[300px] shrink-0 flex flex-col gap-2 overflow-y-auto">
          <p className="ci-lbl">{queue.length} open</p>
          {loading ? (
            <p className="text-[12px] text-[var(--ci-text-tertiary)] p-2">Loading…</p>
          ) : queue.length === 0 ? (
            <p className="text-[12px] text-[var(--ci-text-tertiary)] p-2">No open jobs.</p>
          ) : (
            queue.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedId(r.id); setCostInput(""); }}
                className={cn(
                  "ci-blueprint text-left p-[9px] transition-colors duration-150",
                  selected?.id === r.id ? "border-[var(--ci-accent)] bg-[var(--ci-selected)]" : "hover:border-[var(--ci-accent)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="ci-mono text-[12px] font-bold">{r.record_number}</span>
                  <IndustryTag variant={statusVariant(r.status)}>{r.status.replace("_", " ")}</IndustryTag>
                </div>
                <p className="text-[13px] mt-1 truncate">{r.title}</p>
                <p className="text-[11px] text-[var(--ci-text-tertiary)] ci-mono mt-0.5">
                  {r.vehicles?.plate_number ?? "—"}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <IndustryCard>
              <p className="text-[13px] text-[var(--ci-text-secondary)]">Select a job from the queue.</p>
            </IndustryCard>
          ) : (
            <div className="flex flex-col gap-4">
              <IndustryCard>
                <div className="flex items-start justify-between">
                  <div>
                    <IndustryCardKicker>{selected.record_number}</IndustryCardKicker>
                    <IndustryCardTitle>{selected.title}</IndustryCardTitle>
                  </div>
                  <IndustryTag variant={statusVariant(selected.status)}>{selected.status.replace("_", " ")}</IndustryTag>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                  <div>
                    <p className="ci-lbl">Vehicle</p>
                    <p className="ci-mono text-[13px]">{vehicle?.plate_number ?? "—"}</p>
                  </div>
                  <div>
                    <p className="ci-lbl">Type</p>
                    <p className="text-[13px] capitalize">{selected.type}</p>
                  </div>
                  <div>
                    <p className="ci-lbl">Priority</p>
                    <p className="text-[13px] capitalize">{selected.priority}</p>
                  </div>
                  <div>
                    <p className="ci-lbl">Technician</p>
                    <p className="text-[13px]">{selected.technician || "Unassigned"}</p>
                  </div>
                </div>
              </IndustryCard>

              <IndustryCard>
                <IndustryCardKicker>Work performed</IndustryCardKicker>
                <p className="text-[13px] mt-1 whitespace-pre-wrap">{selected.description || selected.notes || "No notes recorded yet."}</p>
              </IndustryCard>

              <IndustryCard>
                <IndustryCardKicker>Parts issued from inventory</IndustryCardKicker>
                <p className="text-[12px] text-[var(--ci-text-tertiary)] mt-1">
                  No link exists yet between maintenance_records and inventory issuance — this needs a schema addition, not fabricated here.
                </p>
              </IndustryCard>

              {vehicle && (
                <IndustryCard>
                  <IndustryCardKicker>Next service due</IndustryCardKicker>
                  <p className="ci-mono text-[16px] mt-1">
                    {vehicle.mileage != null && vehicle.service_interval_km
                      ? `${(vehicle.mileage + vehicle.service_interval_km).toLocaleString()} km`
                      : "Not enough vehicle data to compute"}
                  </p>
                </IndustryCard>
              )}

              <IndustryCard>
                <IndustryCardKicker>Actions</IndustryCardKicker>
                {selected.status !== "in_progress" ? (
                  <TransitionButtons
                    kind="maintenance_request"
                    entity={selected}
                    actorId={authUser?.id ?? "system"}
                    actorRole={role ?? undefined}
                    size="sm"
                    onDone={() => refetch()}
                  />
                ) : (
                  <div className="flex flex-col gap-2 mt-1">
                    <label className="ci-lbl">Actual cost (to complete & release vehicle)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        value={costInput}
                        onChange={(e) => setCostInput(e.target.value)}
                        placeholder="0"
                        className="flex-1 text-[14px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]"
                      />
                      <IndustryButton variant="primary" onClick={complete} disabled={completing}>
                        {completing ? "Completing…" : "Complete & release vehicle"}
                      </IndustryButton>
                    </div>
                    {selected.estimated_cost != null && (
                      <p className="text-[11px] text-[var(--ci-text-tertiary)]">Estimated: {format(selected.estimated_cost)}</p>
                    )}
                  </div>
                )}
              </IndustryCard>
            </div>
          )}
        </div>
      </div>
    </IndustryRoleShell>
  );
}
