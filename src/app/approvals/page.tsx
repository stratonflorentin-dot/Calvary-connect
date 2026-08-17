"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSidebar } from "@/hooks/use-sidebar";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import {
  canRoleApprove,
  hoursSince,
  isOverdue,
  resolveApprovalLevel,
  slaHours,
} from "@/lib/workflow/approvals";
import type { EntityKind } from "@/lib/workflow/state-machines";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Fuel,
  Gavel,
  Loader2,
  LogOut,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Star,
  Wrench,
} from "lucide-react";

interface ApprovalItem {
  id: string;
  kind: EntityKind;
  amount: number;
  title: string;
  subtitle: string;
  createdAt: string;
  raw: any;
}

const KIND_META: Record<
  EntityKind,
  { label: string; icon: React.ElementType; accent: string }
> = {
  fuel_request: { label: "Fuel Request", icon: Fuel, accent: "text-warning bg-warning/10" },
  expense: { label: "Expense", icon: Receipt, accent: "text-primary bg-primary/10" },
  maintenance_request: { label: "Maintenance", icon: Wrench, accent: "text-info bg-info/10" },
  trip: { label: "Trip", icon: ClipboardCheck, accent: "text-success bg-success/10" },
  // Leave has its own review surface at /hr/leave (no monetary amount to
  // tier by, unlike the others this inbox aggregates) — this entry only
  // satisfies EntityKind's exhaustiveness, this page doesn't fetch leave.
  leave_request: { label: "Leave", icon: CalendarDays, accent: "text-muted-foreground bg-muted" },
  // Fuel anomaly investigations use plain role-gated transitions, not the
  // amount-tiered requiresApproval routing this inbox aggregates — they
  // have their own review surface at /fleet/fuel-anomalies. This entry
  // only satisfies EntityKind's exhaustiveness.
  fuel_anomaly: { label: "Fuel Anomaly", icon: AlertTriangle, accent: "text-destructive bg-destructive/10" },
  // Purchase orders use plain role-gated transitions (send/cancel), not the
  // amount-tiered requiresApproval routing this inbox aggregates — they
  // have their own surface at /purchase-orders. Pass-through entry only.
  purchase_order: { label: "Purchase Order", icon: ShoppingCart, accent: "text-info bg-info/10" },
  // The three HR case kinds below all use plain role-gated transitions, not
  // amount-tiered requiresApproval routing — they have their own surfaces at
  // /hr/disciplinary, /hr/separation and /hr/performance-reviews. Pass-
  // through entries only, to satisfy EntityKind's exhaustiveness.
  disciplinary_case: { label: "Disciplinary Case", icon: Gavel, accent: "text-destructive bg-destructive/10" },
  separation_case: { label: "Separation Case", icon: LogOut, accent: "text-muted-foreground bg-muted" },
  performance_review: { label: "Performance Review", icon: Star, accent: "text-warning bg-warning/10" },
};

export default function ApprovalsInboxPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const { isCollapsed } = useSidebar();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine" | "overdue">("mine");

  const load = async () => {
    setLoading(true);
    const [fuelRes, expenseRes, maintRes] = await Promise.all([
      supabase
        .from("fuel_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_records")
        .select("*")
        .eq("status", "requested")
        .order("created_at", { ascending: false }),
    ]);

    const merged: ApprovalItem[] = [];
    for (const r of fuelRes.data ?? []) {
      merged.push({
        id: r.id,
        kind: "fuel_request",
        amount: Number(r.amount) || 0,
        title: `TZS ${Number(r.amount).toLocaleString()} · Vehicle ${r.vehicle_id ?? "—"}`,
        subtitle: `Driver ${r.driver_id ?? "—"} • ${new Date(r.created_at).toLocaleDateString()}`,
        createdAt: r.created_at,
        raw: r,
      });
    }
    for (const r of expenseRes.data ?? []) {
      merged.push({
        id: r.id,
        kind: "expense",
        amount: Number(r.amount) || 0,
        title: `TZS ${Number(r.amount).toLocaleString()} · ${r.type ?? "expense"}`,
        subtitle: r.description ?? "",
        createdAt: r.created_at,
        raw: r,
      });
    }
    for (const r of maintRes.data ?? []) {
      merged.push({
        id: r.id,
        kind: "maintenance_request",
        amount: Number(r.estimated_cost) || 0,
        title: `${r.title ?? "Maintenance"} · ${r.priority ?? ""}`.trim(),
        subtitle: `Vehicle ${r.vehicle_id ?? "—"} • ${r.type ?? ""}`,
        createdAt: r.created_at,
        raw: r,
      });
    }
    setItems(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (filter === "overdue") return isOverdue(i.kind, i.createdAt);
      if (filter === "mine") {
        // For maintenance_request the machine doesn't use spend tiers, so
        // fall back to role-check via the state machine's transition roles.
        if (i.kind === "maintenance_request") {
          return ["ADMIN", "CEO", "MECHANIC"].includes(role ?? "");
        }
        return canRoleApprove(i.kind, i.amount, role ?? undefined);
      }
      return true;
    });
  }, [items, filter, role]);

  const stats = useMemo(
    () => ({
      total: items.length,
      mine: items.filter((i) => {
        if (i.kind === "maintenance_request") return ["ADMIN", "CEO", "MECHANIC"].includes(role ?? "");
        return canRoleApprove(i.kind, i.amount, role ?? undefined);
      }).length,
      overdue: items.filter((i) => isOverdue(i.kind, i.createdAt)).length,
    }),
    [items, role],
  );

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar role={(role as any) ?? "ADMIN"} />
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          isCollapsed ? "md:ml-20" : "md:ml-64",
        )}
      >
        <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-30 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
                <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-black text-foreground leading-tight">
                  Approvals Inbox
                </h1>
                <p className="text-xs text-muted-foreground">
                  Items awaiting decision, routed by amount tier and role.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(
                [
                  { key: "mine", label: "For me", value: stats.mine, color: "text-primary" },
                  { key: "overdue", label: "Overdue", value: stats.overdue, color: "text-destructive" },
                  { key: "all", label: "All open", value: stats.total, color: "text-foreground" },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setFilter(s.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 border transition-colors",
                    filter === s.key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span className="text-[10px] text-muted-foreground font-medium">{s.label}</span>
                  <span className={cn("text-sm font-black", s.color)}>{s.value}</span>
                </button>
              ))}
              <button
                onClick={load}
                className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
                title="Refresh"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : visible.length === 0 ? (
            <div className="py-20 text-center bg-card rounded-2xl border border-dashed border-border">
              <CheckCircle2 className="w-10 h-10 text-success/50 mx-auto mb-3" />
              <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">
                Inbox zero. Nothing awaiting your decision.
              </p>
            </div>
          ) : (
            visible.map((item) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              const overdue = isOverdue(item.kind, item.createdAt);
              const level = ["fuel_request", "expense"].includes(item.kind)
                ? resolveApprovalLevel(item.kind, item.amount)
                : null;
              const age = hoursSince(item.createdAt);
              const sla = slaHours[item.kind];

              return (
                <div
                  key={item.kind + ":" + item.id}
                  className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="flex flex-col lg:flex-row items-stretch">
                    <div className="flex items-center gap-4 p-5 flex-1">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          meta.accent,
                        )}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                            {meta.label}
                          </span>
                          {level && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {level.label} tier
                            </span>
                          )}
                          {overdue && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                              <Flame className="w-3 h-3" /> Overdue by {(age - sla).toFixed(1)}h
                            </span>
                          )}
                          {!overdue && age > sla * 0.75 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                              <AlertTriangle className="w-3 h-3" /> Nearing SLA
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-5 lg:border-l border-border bg-muted/40">
                      <TransitionButtons
                        kind={item.kind}
                        entity={{
                          ...item.raw,
                          status: item.kind === "maintenance_request" ? "requested" : "pending",
                        }}
                        actorId={user?.id ?? "system"}
                        actorRole={role ?? undefined}
                        onDone={load}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
