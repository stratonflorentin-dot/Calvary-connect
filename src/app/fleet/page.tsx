"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { getListStagger, listItem, TRANSITION } from "@/lib/animations";
import { PageShell, PageHeader, StatCard, SectionCard, EmptyState, PageSkeleton, RefreshControl } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VehicleFormDialog } from "@/components/fleet/vehicle-form-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Search,
  Shield,
  Truck,
  Wrench,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { vehicleStatusBucket as statusBucket } from "@/lib/fleet/vehicle-status";

interface Vehicle {
  id: string;
  plate_number: string;
  make?: string | null;
  model?: string | null;
  type?: string | null;
  status?: string | null;
  mileage?: number | null;
  next_maintenance_due?: string | null;
  insuranceExpiry?: string | null;
  insurance_expiry?: string | null;
  registrationExpiry?: string | null;
  registration_expiry?: string | null;
  currentDriverId?: string | null;
  currentFuelLevel?: number | null;
  fuelCapacity?: number | null;
  photo_url?: string | null;
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  return Math.floor((t - Date.now()) / (1000 * 60 * 60 * 24));
}

const STATUS_META: Record<string, { label: string; chip: string }> = {
  available:      { label: "Available",      chip: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" },
  active:         { label: "Available",      chip: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" },
  in_use:         { label: "In Use",         chip: "bg-primary/10 text-primary" },
  maintenance:    { label: "In Maintenance", chip: "bg-warning/10 text-warning" },
  out_of_service: { label: "Out of Service", chip: "bg-destructive/10 text-destructive" },
  sold:           { label: "Sold",           chip: "bg-muted text-muted-foreground" },
  decommissioned: { label: "Decommissioned", chip: "bg-muted text-muted-foreground" },
};

// Shared with every other dashboard that shows a vehicle-availability count
// — see src/lib/fleet/vehicle-status.ts for why this exists as one function
// instead of N independent copies.

export default function FleetPage() {
  const { role, isLoading: roleLoading, isAdmin } = useRole();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "in_use" | "maintenance" | "attention">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("vehicles").select("*").order("plate_number");
    setVehicles((data ?? []) as Vehicle[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = vehicles.length;
    const inUse = vehicles.filter((v) => statusBucket(v.status) === "in_use").length;
    const maint = vehicles.filter((v) => statusBucket(v.status) === "maintenance").length;
    const available = vehicles.filter((v) => statusBucket(v.status) === "available").length;
    const attention = vehicles.filter((v) => {
      const doc = Math.min(
        daysUntil(v.insuranceExpiry ?? v.insurance_expiry) ?? 9999,
        daysUntil(v.registrationExpiry ?? v.registration_expiry) ?? 9999,
        daysUntil(v.next_maintenance_due) ?? 9999,
      );
      return doc <= 14;
    }).length;
    return { total, inUse, maint, available, attention, utilization: total > 0 ? (inUse / total) * 100 : 0 };
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (q) {
        const hay = [v.plate_number, v.make, v.model, v.type].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "attention") {
        const doc = Math.min(
          daysUntil(v.insuranceExpiry ?? v.insurance_expiry) ?? 9999,
          daysUntil(v.registrationExpiry ?? v.registration_expiry) ?? 9999,
          daysUntil(v.next_maintenance_due) ?? 9999,
        );
        return doc <= 14;
      }
      if (filter !== "all") return statusBucket(v.status) === filter;
      return true;
    });
  }, [vehicles, search, filter]);

  const expiringSoon = useMemo(() => {
    const rows = vehicles
      .flatMap((v) => {
        const items: { kind: string; date: string; days: number; vehicle: Vehicle }[] = [];
        const ins = v.insuranceExpiry ?? v.insurance_expiry;
        const reg = v.registrationExpiry ?? v.registration_expiry;
        const svc = v.next_maintenance_due;
        if (ins) items.push({ kind: "Insurance", date: ins, days: daysUntil(ins)!, vehicle: v });
        if (reg) items.push({ kind: "Registration", date: reg, days: daysUntil(reg)!, vehicle: v });
        if (svc) items.push({ kind: "Service", date: svc, days: daysUntil(svc)!, vehicle: v });
        return items;
      })
      .filter((r) => r.days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 10);
    return rows;
  }, [vehicles]);

  const chips: { key: typeof filter; label: string; count: number }[] = [
    { key: "all",         label: "All",           count: stats.total },
    { key: "available",   label: "Available",     count: stats.available },
    { key: "in_use",      label: "In use",        count: stats.inUse },
    { key: "maintenance", label: "In maintenance", count: stats.maint },
    { key: "attention",   label: "Needs attention", count: stats.attention },
  ];

  if (roleLoading) return <PageShell><PageSkeleton /></PageShell>;
  if (!isAdmin && !["CEO", "ADMIN", "OPERATOR", "MECHANIC"].includes(role || "")) {
    return (
      <PageShell>
        <EmptyState icon={Shield} title="Access denied" description="You don't have permission to view fleet management." />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Fleet"
        title="Fleet Management"
        subtitle={`${stats.total} vehicles · ${stats.utilization.toFixed(0)}% utilization · ${stats.attention} need attention`}
        icon={Truck}
        iconAccent="bg-primary text-primary-foreground"
        actions={
          <>
            <RefreshControl onRefresh={load} storageKey="fleet" />
            <Link href="/maintenance">
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Wrench className="w-3.5 h-3.5" /> Maintenance
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" /> Add vehicle
            </Button>
          </>
        }
      />

      <VehicleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        vehicle={editing}
        onSaved={load}
      />

      {loading ? (
        <PageSkeleton kpiCount={5} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="Vehicles" value={stats.total} icon={Truck} accent="bg-primary/10 text-primary" />
            <StatCard label="Utilization" value={`${stats.utilization.toFixed(0)}%`} sub={`${stats.inUse} in use`} icon={Gauge} accent="bg-info/10 text-info" />
            <StatCard label="Available" value={stats.available} icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
            <StatCard label="In maintenance" value={stats.maint} icon={Wrench} accent="bg-warning/10 text-warning" />
            <StatCard label="Needs attention" value={stats.attention} icon={AlertTriangle} accent="bg-destructive/10 text-destructive" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  {chips.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setFilter(c.key)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-full border transition-colors",
                        filter === c.key
                          ? "border-primary bg-[hsl(var(--primary-soft))] text-primary shadow-sm"
                          : "border-border bg-card text-foreground hover:bg-muted",
                      )}
                    >
                      {c.label} <span className="ml-1 text-[10px] font-black bg-background/60 rounded-full px-1.5">{c.count}</span>
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate, make…" className="pl-9 h-9" />
                </div>
              </div>

              <SectionCard title={`Vehicles (${filtered.length})`} padded={false}>
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={Truck}
                    title={vehicles.length === 0 ? "No vehicles yet" : "No vehicles in this view"}
                    description={vehicles.length === 0 ? "Add your first vehicle to start managing the fleet." : "Try clearing the search or picking a different filter."}
                    action={
                      vehicles.length === 0 ? (
                        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                          <Plus className="w-4 h-4" /> Add vehicle
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  <motion.ul
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(filtered.length) } } }}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-border"
                  >
                    {filtered.map((v) => {
                      const meta = STATUS_META[v.status ?? "available"] ?? STATUS_META.available;
                      const ins = v.insuranceExpiry ?? v.insurance_expiry;
                      const reg = v.registrationExpiry ?? v.registration_expiry;
                      const insDays = daysUntil(ins);
                      const regDays = daysUntil(reg);
                      const fuel = v.currentFuelLevel != null && v.fuelCapacity ? (Number(v.currentFuelLevel) / Number(v.fuelCapacity)) * 100 : null;
                      return (
                        <motion.li key={v.id} variants={listItem} className="px-5 py-3 hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-4">
                            {v.photo_url ? (
                              <img
                                src={v.photo_url}
                                alt={v.plate_number}
                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-border"
                              />
                            ) : (
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", meta.chip)}>
                                <Truck className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <p className="font-mono font-black text-sm text-foreground">{v.plate_number}</p>
                                <span className="text-xs text-muted-foreground">{v.make} {v.model}</span>
                                {v.type && <span className="cv-chip cv-chip-neutral">{v.type.replace(/_/g, " ").toLowerCase()}</span>}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                {v.mileage != null && <span>{Number(v.mileage).toLocaleString()} km</span>}
                                {insDays != null && (
                                  <span className={cn(insDays <= 14 && "text-destructive font-bold")}>
                                    Insurance {insDays >= 0 ? `expires in ${insDays}d` : `expired ${Math.abs(insDays)}d ago`}
                                  </span>
                                )}
                                {regDays != null && (
                                  <span className={cn(regDays <= 14 && "text-destructive font-bold")}>
                                    Reg {regDays >= 0 ? `expires in ${regDays}d` : `expired ${Math.abs(regDays)}d ago`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {fuel != null && (
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Fuel className="w-3 h-3" /> {fuel.toFixed(0)}%
                                  </div>
                                  <div className="w-16 h-1.5 rounded-full bg-muted mt-0.5 overflow-hidden">
                                    <motion.div
                                      className={cn("h-full w-full", fuel < 25 ? "bg-destructive" : fuel < 50 ? "bg-warning" : "bg-success")}
                                      style={{ transformOrigin: "left" }}
                                      initial={{ scaleX: 0 }}
                                      animate={{ scaleX: fuel / 100 }}
                                      transition={TRANSITION.modal}
                                    />
                                  </div>
                                </div>
                              )}
                              <span className={cn("cv-chip", meta.chip)}>{meta.label}</span>
                              <button
                                onClick={() => { setEditing(v); setFormOpen(true); }}
                                className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center transition-colors"
                                title="Edit vehicle"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                )}
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard title="Expiring documents & services" subtitle="Next 30 days" href="/fleet/compliance" padded={false}>
                {expiringSoon.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="All up to date" description="No documents or services expire within 30 days." />
                ) : (
                  <motion.ul
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(expiringSoon.length) } } }}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-border"
                  >
                    {expiringSoon.map((r, i) => (
                      <motion.li key={i} variants={listItem} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", r.days <= 7 ? "bg-destructive/10 text-destructive" : r.days <= 14 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground")}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{r.vehicle.plate_number} · {r.kind}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.days >= 0 ? `in ${r.days} day${r.days === 1 ? "" : "s"}` : `overdue by ${Math.abs(r.days)} days`}
                            {" · "}
                            {formatDistanceToNow(new Date(r.date), { addSuffix: true })}
                          </p>
                        </div>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
