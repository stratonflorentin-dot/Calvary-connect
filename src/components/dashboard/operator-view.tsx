"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { RoleDashboard } from "./shared/role-dashboard";
import { EmptyState } from "@/components/shell";
import { isOverdue } from "@/lib/workflow/approvals";
import { hydrateTrips } from "@/lib/trips/hydrate";
import {
  ClipboardList,
  Flame,
  Fuel,
  MapPin,
  Navigation,
  Package,
  Route as RouteIcon,
  Truck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function OperatorView() {
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);

  const load = async () => {
    const [t, v, f] = await Promise.all([
      supabase.from("trips").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("vehicles").select("*"),
      supabase.from("fuel_requests").select("*").eq("status", "pending"),
    ]);
    const hydrated = await hydrateTrips(t.data ?? []);
    setTrips(hydrated);
    setVehicles(v.data ?? []);
    setFuel(f.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const pending = trips.filter((t) => String(t.status).toLowerCase() === "pending").length;
    const loading = trips.filter((t) => String(t.status).toLowerCase() === "loading").length;
    const inTransit = trips.filter((t) => String(t.status).toLowerCase() === "in_transit").length;
    const overdue = trips.filter((t) => !["delivered", "cancelled"].includes(String(t.status).toLowerCase()) && t.created_at && isOverdue("trip", t.created_at)).length;
    const available = vehicles.filter((v) => v.status === "available").length;
    return { pending, loading, inTransit, overdue, available, fuel: fuel.length };
  }, [trips, vehicles, fuel]);

  const unassigned = useMemo(() => trips.filter((t) => String(t.status).toLowerCase() === "pending" && !t.driverId).slice(0, 5), [trips]);
  const activeTrips = useMemo(() => trips.filter((t) => ["loading", "in_transit"].includes(String(t.status).toLowerCase())).slice(0, 6), [trips]);

  return (
    <RoleDashboard
      eyebrow="Operations Console"
      title="Welcome"
      subtitle={`${stats.inTransit} in transit · ${stats.pending} pending · ${stats.overdue} overdue · ${stats.available} vehicles available`}
      onRefresh={load}
      storageKey="operator-dash"
      kpis={[
        { label: "Pending", value: stats.pending, icon: ClipboardList, accent: "bg-amber-100 text-amber-700", href: "/dispatch" },
        { label: "Loading", value: stats.loading, icon: Package, accent: "bg-sky-100 text-sky-700", href: "/dispatch" },
        { label: "In transit", value: stats.inTransit, icon: Navigation, accent: "bg-primary/10 text-primary", href: "/tracking" },
        { label: "Overdue", value: stats.overdue, icon: Flame, accent: "bg-red-100 text-red-700", href: "/dispatch" },
        { label: "Available vehicles", value: stats.available, icon: Truck, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]", href: "/fleet" },
        { label: "Fuel approvals", value: stats.fuel, icon: Fuel, accent: "bg-orange-100 text-orange-700", href: "/fuel-approvals" },
      ]}
      sections={[
        {
          title: "Unassigned pending trips",
          subtitle: "Need a driver assigned",
          href: "/dispatch",
          padded: false,
          colSpan: 2,
          content: unassigned.length === 0 ? (
            <EmptyState icon={ClipboardList} title="All trips assigned" description="No pending trips need a driver." />
          ) : (
            <ul className="divide-y divide-border">
              {unassigned.map((t) => (
                <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{t.trip_number ?? `TRP-${t.id.slice(0, 6)}`}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-500" /> {t.origin} → {t.destination}</p>
                  </div>
                  <Link href="/dispatch" className="text-primary text-xs font-bold hover:underline">Assign →</Link>
                </li>
              ))}
            </ul>
          ),
        },
        {
          title: "Active trips",
          subtitle: "In progress",
          href: "/tracking",
          padded: false,
          content: activeTrips.length === 0 ? (
            <EmptyState icon={Navigation} title="No active trips" />
          ) : (
            <ul className="divide-y divide-border">
              {activeTrips.map((t) => (
                <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    String(t.status).toLowerCase() === "in_transit" ? "bg-primary/10 text-primary" : "bg-sky-100 text-sky-700",
                  )}>
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{t.trip_number ?? `TRP-${t.id.slice(0, 6)}`}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.origin} → {t.destination}</p>
                  </div>
                  <span className="cv-chip cv-chip-info">{String(t.status).replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
      quickActions={[
        { href: "/dispatch", label: "Dispatch board", icon: Navigation, tone: "bg-primary/10 text-primary" },
        { href: "/trips", label: "Trips", icon: RouteIcon, tone: "bg-sky-100 text-sky-700" },
        { href: "/bookings", label: "Bookings", icon: ClipboardList, tone: "bg-emerald-100 text-emerald-700" },
        { href: "/fuel-approvals", label: "Fuel", icon: Fuel, tone: "bg-orange-100 text-orange-700" },
        { href: "/tracking", label: "Live map", icon: MapPin, tone: "bg-violet-100 text-violet-700" },
        { href: "/maintenance", label: "Maintenance", icon: Wrench, tone: "bg-amber-100 text-amber-700" },
      ]}
    />
  );
}
