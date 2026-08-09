"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell, PageHeader, EmptyState } from "@/components/shell";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { useCurrency } from "@/hooks/use-currency";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import {
  canRoleApprove,
  hoursSince,
  isOverdue,
  resolveApprovalLevel,
  slaHours,
} from "@/lib/workflow/approvals";
import {
  Fuel,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Truck,
  User,
} from "lucide-react";

const VIEW_ROLES = ["CEO", "ADMIN", "OPERATOR", "MECHANIC", "ACCOUNTANT"];

interface FuelRequestRow {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  amount: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  driver: { name: string } | null;
  vehicle: { plate_number: string; make?: string; model?: string } | null;
}

type Filter = "pending" | "approved" | "rejected" | "all";

export default function FuelApprovalsPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const { format } = useCurrency();
  const [rows, setRows] = useState<FuelRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fuel_requests")
      .select("id, driver_id, vehicle_id, amount, status, created_at, driver:user_profiles(name), vehicle:vehicles(plate_number, make, model)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Couldn't load fuel requests", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as FuelRequestRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending");
    const overdue = pending.filter((r) => isOverdue("fuel_request", r.created_at));
    const approvedToday = rows.filter(
      (r) => r.status === "approved" && new Date(r.created_at).toDateString() === new Date().toDateString(),
    );
    return {
      pendingCount: pending.length,
      pendingTotal: pending.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      overdueCount: overdue.length,
      approvedToday: approvedToday.length,
    };
  }, [rows]);

  const canView = !roleLoading && VIEW_ROLES.includes(String(role || "").toUpperCase());

  if (roleLoading) return null;
  if (!canView) {
    return (
      <PageShell>
        <EmptyState icon={Fuel} title="Access denied" description="You don't have permission to view fuel approvals." />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Fleet"
        title="Fuel Approvals"
        subtitle="Driver fuel requests awaiting sign-off, routed by amount tier and SLA"
        icon={Fuel}
      />

      {/* Command banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[hsl(var(--sidebar-background))] to-[hsl(var(--sidebar-accent))] p-6 mb-6">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Pending</p>
            <p className="text-2xl font-black text-white mt-1">{stats.pendingCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Pending value</p>
            <p className="text-2xl font-black text-white mt-1">{format(stats.pendingTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 flex items-center gap-1">
              <Flame className="size-3" /> Overdue (&gt;{slaHours.fuel_request}h)
            </p>
            <p className={cn("text-2xl font-black mt-1", stats.overdueCount > 0 ? "text-destructive" : "text-white")}>
              {stats.overdueCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Approved today</p>
            <p className="text-2xl font-black text-white mt-1">{stats.approvedToday}</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all border",
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted border-border",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground"
          title="Refresh"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing here"
          description={filter === "pending" ? "No fuel requests awaiting a decision." : `No ${filter} fuel requests.`}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const overdue = r.status === "pending" && isOverdue("fuel_request", r.created_at);
            const level = resolveApprovalLevel("fuel_request", Number(r.amount) || 0);
            const age = hoursSince(r.created_at);
            const nearSla = !overdue && r.status === "pending" && age > slaHours.fuel_request * 0.6;

            return (
              <div
                key={r.id}
                className="bg-card/90 backdrop-blur-sm rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row items-stretch">
                  <div className="flex items-center gap-4 p-5 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-warning/10 text-warning">
                      <Fuel className="size-6" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        {level && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {level.label} tier
                          </span>
                        )}
                        {overdue && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                            <Flame className="size-3" /> Overdue by {(age - slaHours.fuel_request).toFixed(1)}h
                          </span>
                        )}
                        {nearSla && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                            <AlertTriangle className="size-3" /> Nearing SLA
                          </span>
                        )}
                        {r.status !== "pending" && (
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                              r.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {r.status}
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-black text-foreground">{format(Number(r.amount) || 0)}</p>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-3.5" /> {r.driver?.name || "Unknown driver"}
                        </span>
                        {r.vehicle?.plate_number && (
                          <span className="flex items-center gap-1">
                            <Truck className="size-3.5" /> {r.vehicle.plate_number}
                            {r.vehicle.make ? ` · ${r.vehicle.make} ${r.vehicle.model ?? ""}`.trim() : ""}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-5 lg:border-l border-border bg-muted/30">
                    {r.status === "pending" ? (
                      canRoleApprove("fuel_request", Number(r.amount) || 0, role as any) ? (
                        <TransitionButtons
                          kind="fuel_request"
                          entity={r}
                          actorId={user?.id ?? "system"}
                          actorRole={role ?? undefined}
                          onDone={load}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground italic px-2">
                          Needs {level?.label ?? "higher"} approval
                        </span>
                      )
                    ) : (
                      <Link href="/fleet/fuel-anomalies" className="text-xs text-primary hover:underline">
                        Check for anomalies →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
