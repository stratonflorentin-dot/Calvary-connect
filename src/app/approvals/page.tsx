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
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Fuel,
  Loader2,
  Receipt,
  RefreshCw,
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
  fuel_request: { label: "Fuel Request", icon: Fuel, accent: "text-amber-600 bg-amber-50" },
  expense: { label: "Expense", icon: Receipt, accent: "text-indigo-600 bg-indigo-50" },
  maintenance_request: { label: "Maintenance", icon: Wrench, accent: "text-sky-600 bg-sky-50" },
  trip: { label: "Trip", icon: ClipboardCheck, accent: "text-emerald-600 bg-emerald-50" },
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
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar role={(role as any) ?? "ADMIN"} />
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          isCollapsed ? "md:ml-20" : "md:ml-64",
        )}
      >
        <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-30 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800 leading-tight">
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
                  { key: "mine", label: "For me", value: stats.mine, color: "text-indigo-600" },
                  { key: "overdue", label: "Overdue", value: stats.overdue, color: "text-red-600" },
                  { key: "all", label: "All open", value: stats.total, color: "text-slate-700" },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setFilter(s.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 border transition-colors",
                    filter === s.key
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                >
                  <span className="text-[10px] text-muted-foreground font-medium">{s.label}</span>
                  <span className={cn("text-sm font-black", s.color)}>{s.value}</span>
                </button>
              ))}
              <button
                onClick={load}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
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
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : visible.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
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
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
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
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              {level.label} tier
                            </span>
                          )}
                          {overdue && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                              <Flame className="w-3 h-3" /> Overdue by {(age - sla).toFixed(1)}h
                            </span>
                          )}
                          {!overdue && age > sla * 0.75 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                              <AlertTriangle className="w-3 h-3" /> Nearing SLA
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-800 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-5 lg:border-l border-slate-100 bg-slate-50/60">
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
