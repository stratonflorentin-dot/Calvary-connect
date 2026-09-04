"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard, IndustryCardKicker } from "@/components/industry/card";
import { IndustryTag } from "@/components/industry/tag";
import { cn } from "@/lib/utils";

const MECHANIC_PAGES = [
  { label: "Service queue", href: "/mechanic/service-queue" },
  { label: "Spare parts", href: "/spare-parts" },
  { label: "Service history", href: "/mechanic/service-history" },
  { label: "Schedule", href: "/mechanic/schedule" },
];

interface ScheduleVehicle {
  id: string;
  plate_number: string;
  mileage: number | null;
  service_interval_km: number | null;
  last_service_date: string | null;
  next_maintenance_due: string | null;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

/** % of the last_service_date -> next_maintenance_due interval already
 *  elapsed — the only honestly-computable progress figure here, since
 *  there's no stored mileage-at-last-service to derive a mileage-based
 *  percentage from (only the interval size, service_interval_km, exists). */
function dateProgressPercent(v: ScheduleVehicle): number | null {
  if (!v.last_service_date || !v.next_maintenance_due) return null;
  const start = new Date(v.last_service_date).getTime();
  const end = new Date(v.next_maintenance_due).getTime();
  if (end <= start) return null;
  return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
}

export default function MechanicSchedulePage() {
  const [vehicles, setVehicles] = useState<ScheduleVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("vehicles")
      .select("id, plate_number, mileage, service_interval_km, last_service_date, next_maintenance_due")
      .order("next_maintenance_due", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setVehicles(data ?? []);
        setLoading(false);
      });
  }, []);

  const withDue = vehicles.filter((v) => v.next_maintenance_due);
  const withoutDue = vehicles.filter((v) => !v.next_maintenance_due);

  return (
    <IndustryRoleShell roleLabel="Mechanic" pages={MECHANIC_PAGES}>
      <p className="text-[12px] text-[var(--ci-text-secondary)] mb-4">
        Due by date or by mileage interval, whichever comes first. Date progress is measured against the last service date; mileage shows the interval only — no mileage-at-last-service is recorded to compute a percentage from.
      </p>

      {loading ? (
        <p className="text-[13px] text-[var(--ci-text-tertiary)] text-center py-8">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {withDue.map((v) => {
            const days = daysUntil(v.next_maintenance_due);
            const pct = dateProgressPercent(v);
            const overdue = days !== null && days < 0;
            const soon = days !== null && days >= 0 && days <= 14;
            return (
              <IndustryCard key={v.id}>
                <div className="flex items-center justify-between">
                  <p className="ci-mono text-[14px] font-bold">{v.plate_number}</p>
                  <IndustryTag variant={overdue ? "danger" : soon ? "warning" : "neutral"}>
                    {overdue ? `${Math.abs(days!)}d overdue` : days !== null ? `due in ${days}d` : "—"}
                  </IndustryTag>
                </div>
                <p className="text-[11px] text-[var(--ci-text-tertiary)] ci-mono mt-1">
                  Due {v.next_maintenance_due ? new Date(v.next_maintenance_due).toLocaleDateString() : "—"}
                </p>
                {pct !== null && (
                  <div className="h-1 bg-[var(--ci-divider)] mt-2">
                    <div
                      className={cn("h-full transition-[width] duration-[350ms]", overdue ? "bg-[#8c1d18]" : "bg-[var(--ci-accent)]")}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--ci-text-tertiary)]">
                  <span className="ci-mono">{v.mileage != null ? `${v.mileage.toLocaleString()} km` : "mileage —"}</span>
                  <span>{v.service_interval_km ? `interval ${v.service_interval_km.toLocaleString()} km` : "no interval set"}</span>
                </div>
              </IndustryCard>
            );
          })}
        </div>
      )}

      {withoutDue.length > 0 && (
        <div className="mt-6">
          <IndustryCardKicker>No service date on file ({withoutDue.length})</IndustryCardKicker>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {withoutDue.map((v) => (
              <IndustryCard key={v.id}>
                <p className="ci-mono text-[14px] font-bold">{v.plate_number}</p>
                <p className="text-[11px] text-[var(--ci-text-tertiary)] mt-1">No next_maintenance_due recorded.</p>
              </IndustryCard>
            ))}
          </div>
        </div>
      )}
    </IndustryRoleShell>
  );
}
