"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RoleDashboard } from "./shared/role-dashboard";
import { EmptyState } from "@/components/shell";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Package,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function MechanicView() {
  const [records, setRecords] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [partsRequests, setPartsRequests] = useState<any[]>([]);

  const load = async () => {
    const [m, v, p] = await Promise.all([
      supabase.from("maintenance_records").select("*, vehicles(plate_number, make, model)").order("created_at", { ascending: false }).limit(100),
      supabase.from("vehicles").select("*"),
      supabase.from("parts_requests").select("*").eq("status", "pending"),
    ]);
    setRecords(m.data ?? []);
    setVehicles(v.data ?? []);
    setPartsRequests(p.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const requested = records.filter((r) => r.status === "requested").length;
    const scheduled = records.filter((r) => r.status === "scheduled").length;
    const inProgress = records.filter((r) => r.status === "in_progress").length;
    const completed = records.filter((r) => r.status === "completed").length;
    return { requested, scheduled, inProgress, completed, parts: partsRequests.length };
  }, [records, partsRequests]);

  const workQueue = useMemo(() => records.filter((r) => ["requested", "scheduled", "in_progress"].includes(r.status)).slice(0, 8), [records]);
  const attention = useMemo(() => vehicles.filter((v) => {
    if (!v.next_maintenance_due) return false;
    const d = (new Date(v.next_maintenance_due).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return d <= 14;
  }).slice(0, 5), [vehicles]);

  return (
    <RoleDashboard
      eyebrow="Mechanic Console"
      title="Welcome"
      subtitle={`${stats.requested} requested · ${stats.inProgress} in progress · ${stats.parts} parts request${stats.parts === 1 ? "" : "s"} pending`}
      onRefresh={load}
      storageKey="mechanic-dash"
      kpis={[
        { label: "Requested", value: stats.requested, icon: ClipboardList, accent: "bg-amber-100 text-amber-700", href: "/maintenance" },
        { label: "Scheduled", value: stats.scheduled, icon: Wrench, accent: "bg-primary/10 text-primary", href: "/maintenance" },
        { label: "In progress", value: stats.inProgress, icon: Sparkles, accent: "bg-sky-100 text-sky-700", href: "/maintenance" },
        { label: "Completed", value: stats.completed, icon: CheckCircle2, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]", href: "/maintenance" },
      ]}
      sections={[
        {
          title: "Work queue",
          subtitle: "Everything open, oldest first",
          href: "/maintenance",
          padded: false,
          colSpan: 2,
          content: workQueue.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing in the queue" description="No open maintenance tickets." />
          ) : (
            <ul className="divide-y divide-border">
              {workQueue.map((r) => (
                <li key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    r.status === "requested" ? "bg-amber-100 text-amber-700" :
                    r.status === "scheduled" ? "bg-primary/10 text-primary" :
                    "bg-sky-100 text-sky-700",
                  )}>
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{r.title ?? "Maintenance"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.vehicles?.plate_number ? `${r.vehicles.plate_number} · ` : ""}
                      {r.type} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={cn(
                    "cv-chip",
                    r.status === "requested" ? "cv-chip-warning" :
                    r.status === "scheduled" ? "cv-chip-info" :
                    "cv-chip-neutral",
                  )}>
                    {r.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          title: "Vehicles needing attention",
          subtitle: "Service due in ≤ 14 days",
          href: "/fleet/compliance",
          padded: false,
          content: attention.length === 0 ? (
            <EmptyState icon={Truck} title="All caught up" description="No service events in the next 14 days." />
          ) : (
            <ul className="divide-y divide-border">
              {attention.map((v) => (
                <li key={v.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-black text-foreground">{v.plate_number}</p>
                    <p className="text-xs text-muted-foreground truncate">Service {v.next_maintenance_due ? new Date(v.next_maintenance_due).toLocaleDateString() : "due"}</p>
                  </div>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
      quickActions={[
        { href: "/maintenance", label: "Maintenance", icon: Wrench, tone: "bg-primary/10 text-primary" },
        { href: "/maintenance/new", label: "New ticket", icon: ClipboardList, tone: "bg-amber-100 text-amber-700" },
        { href: "/parts-requests", label: "Parts", icon: Package, tone: "bg-sky-100 text-sky-700" },
        { href: "/spare-parts", label: "Inventory", icon: Package, tone: "bg-emerald-100 text-emerald-700" },
        { href: "/fleet", label: "Fleet", icon: Truck, tone: "bg-violet-100 text-violet-700" },
        { href: "/approvals", label: "Approvals", icon: ClipboardList, tone: "bg-fuchsia-100 text-fuchsia-700" },
      ]}
    />
  );
}
