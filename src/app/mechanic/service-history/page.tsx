"use client";

import { useState } from "react";
import { useMaintenance } from "@/hooks/data/use-maintenance";
import { useCurrency } from "@/hooks/use-currency";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";

const MECHANIC_PAGES = [
  { label: "Service queue", href: "/mechanic/service-queue" },
  { label: "Spare parts", href: "/spare-parts" },
  { label: "Service history", href: "/mechanic/service-history" },
  { label: "Schedule", href: "/mechanic/schedule" },
];

/**
 * Mechanic / Service history — the log of completed (or cancelled) jobs,
 * as distinct from the Service queue's open, actionable ones. Same
 * maintenance_records data via useMaintenance(), nothing to act on here so
 * it's a plain searchable table, not a queue+detail pane.
 */
export default function ServiceHistoryPage() {
  const { format } = useCurrency();
  const [search, setSearch] = useState("");
  const { records, loading } = useMaintenance({ sort: "scheduled_date" });

  const history = records
    .filter((r) => r.status === "completed" || r.status === "cancelled")
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.record_number?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        r.technician?.toLowerCase().includes(q) ||
        (r as any).vehicles?.plate_number?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.completed_date ?? b.updated_at ?? "").localeCompare(a.completed_date ?? a.updated_at ?? ""));

  return (
    <IndustryRoleShell roleLabel="Mechanic" pages={MECHANIC_PAGES}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">{history.length} completed or cancelled job(s)</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search record #, title, technician, plate…"
          className="w-72 text-[13px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[6px] outline-none focus-visible:border-[var(--ci-accent)]"
        />
      </div>

      <IndustryCard>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Record</IndustryTh>
              <IndustryTh>Vehicle</IndustryTh>
              <IndustryTh>Title</IndustryTh>
              <IndustryTh>Technician</IndustryTh>
              <IndustryTh align="right">Cost</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh align="right">Completed</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><IndustryTd colSpan={7} className="text-center text-[var(--ci-text-tertiary)]">Loading…</IndustryTd></tr>
            ) : history.length === 0 ? (
              <tr><IndustryTd colSpan={7} className="text-center text-[var(--ci-text-tertiary)]">No service history yet.</IndustryTd></tr>
            ) : (
              history.map((r) => (
                <IndustryTr key={r.id}>
                  <IndustryTd mono>{r.record_number}</IndustryTd>
                  <IndustryTd mono>{(r as any).vehicles?.plate_number ?? "—"}</IndustryTd>
                  <IndustryTd>{r.title}</IndustryTd>
                  <IndustryTd>{r.technician || "—"}</IndustryTd>
                  <IndustryTd align="right" mono>{r.actual_cost != null ? format(r.actual_cost) : "—"}</IndustryTd>
                  <IndustryTd>
                    <IndustryTag variant={r.status === "completed" ? "accent" : "neutral"}>{r.status}</IndustryTag>
                  </IndustryTd>
                  <IndustryTd align="right" mono>
                    {r.completed_date ? new Date(r.completed_date).toLocaleDateString() : "—"}
                  </IndustryTd>
                </IndustryTr>
              ))
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>
    </IndustryRoleShell>
  );
}
