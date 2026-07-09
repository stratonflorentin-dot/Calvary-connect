"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useCurrency } from "@/hooks/use-currency";
import { StatCard, SectionCard, EmptyState, RefreshControl } from "@/components/shell";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { useRole } from "@/hooks/use-role";
import {
  Camera,
  CheckCircle2,
  Clock,
  Fuel,
  MapPin,
  Navigation,
  Package,
  Receipt,
  Route as RouteIcon,
  Truck,
  Wallet,
} from "lucide-react";

/**
 * Driver dashboard.
 *
 * Mobile-first, focused on the single thing a driver needs right now:
 * their current trip. Everything else is one tap away.
 */
export function DriverView() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [fuelRequests, setFuelRequests] = useState<any[]>([]);
  const [allowances, setAllowances] = useState<any[]>([]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [t, f, a] = await Promise.all([
      supabase
        .from("trips")
        .select("*, vehicle:vehicles(plate_number, make, model)")
        .eq("driverId", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("fuel_requests").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("allowances").select("*").eq("employee_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);
    setTrips(t.data ?? []);
    setFuelRequests(f.data ?? []);
    setAllowances(a.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const currentTrip = useMemo(
    () => trips.find((t) => ["pending", "loading", "in_transit"].includes(String(t.status).toLowerCase())),
    [trips],
  );
  const upcomingTrips = useMemo(
    () => trips.filter((t) => String(t.status).toLowerCase() === "pending" && t.id !== currentTrip?.id).slice(0, 3),
    [trips, currentTrip],
  );
  const completedThisMonth = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return trips.filter((t) => String(t.status).toLowerCase() === "delivered" && new Date(t.updated_at ?? t.created_at).getTime() >= monthStart).length;
  }, [trips]);

  const pendingFuel = fuelRequests.filter((r) => r.status === "pending").length;
  const approvedAllowance = allowances
    .filter((a) => a.status === "approved" || a.status === "paid")
    .reduce((s, a) => s + Number(a.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="cv-panel bg-gradient-to-br from-primary/95 via-primary to-[hsl(235_84%_65%)] text-primary-foreground border-primary">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Driver Console</p>
            <h1 className="text-2xl font-black tracking-tight">Good day, {user?.name?.split(" ")[0] ?? "Driver"}</h1>
            <p className="text-sm opacity-90 mt-1">
              {currentTrip ? `On trip ${currentTrip.trip_number ?? currentTrip.id.slice(0, 6)}` : "No active trip — you're free"}
            </p>
          </div>
          <RefreshControl onRefresh={load} storageKey="driver-dash" compact />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Completed this month" value={completedThisMonth} icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
        <StatCard label="Pending fuel" value={pendingFuel} icon={Fuel} accent="bg-amber-100 text-amber-700" href="/fuel" />
        <StatCard label="Approved allowances" value={format(approvedAllowance)} icon={Wallet} accent="bg-primary/10 text-primary" href="/allowances" />
        <StatCard label="Upcoming trips" value={upcomingTrips.length} icon={RouteIcon} accent="bg-sky-100 text-sky-700" href="/trips" />
      </div>

      <SectionCard title="Current trip" subtitle={currentTrip ? "Live workflow — advance the status as you go" : "Nothing to do right now"}>
        {!currentTrip ? (
          <EmptyState icon={Navigation} title="No active trip" description="Once you're assigned a trip, it'll appear here with quick controls." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Trip</p>
                    <p className="text-xl font-black font-mono text-foreground">{currentTrip.trip_number ?? `TRP-${currentTrip.id.slice(0, 6)}`}</p>
                  </div>
                  <span className="cv-chip cv-chip-info">{String(currentTrip.status).replace("_", " ")}</span>
                </div>

                <div className="flex items-start gap-3 mb-4">
                  <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="w-px h-8 bg-border" />
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">From</p>
                      <p className="text-sm font-bold text-foreground truncate">{currentTrip.origin}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">To</p>
                      <p className="text-sm font-bold text-foreground truncate">{currentTrip.destination}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {currentTrip.vehicle && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="w-3.5 h-3.5" /> {currentTrip.vehicle.plate_number}
                    </div>
                  )}
                  {currentTrip.cargo && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="w-3.5 h-3.5" /> {currentTrip.cargo}
                    </div>
                  )}
                  {currentTrip.client && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <MapPin className="w-3.5 h-3.5" /> {currentTrip.client}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Advance workflow</p>
              <TransitionButtons
                kind="trip"
                entity={currentTrip}
                actorId={user?.id ?? "system"}
                actorRole={role ?? undefined}
                layout="stack"
                onDone={load}
              />
              <Link href="/proof" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:bg-muted/50 transition-colors">
                <Camera className="w-4 h-4" /> Upload POD
              </Link>
              <Link href="/fuel" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:bg-muted/50 transition-colors">
                <Fuel className="w-4 h-4" /> Request fuel
              </Link>
              <Link href="/driver/expenses" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:bg-muted/50 transition-colors">
                <Receipt className="w-4 h-4" /> Log expense
              </Link>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Upcoming assignments" subtitle="Trips assigned to you but not yet started" href="/trips" padded={false}>
        {upcomingTrips.length === 0 ? (
          <EmptyState icon={Clock} title="No pending trips" description="You'll be notified when a new trip is assigned." />
        ) : (
          <ul className="divide-y divide-border">
            {upcomingTrips.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Navigation className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{t.trip_number ?? `TRP-${t.id.slice(0, 6)}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.origin} → {t.destination}</p>
                </div>
                <span className="cv-chip cv-chip-neutral">{String(t.status).replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
