"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useCurrency } from "@/hooks/use-currency";
import { StatCard, SectionCard, EmptyState, RefreshControl } from "@/components/shell";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { useRole } from "@/hooks/use-role";
import { hydrateTrips } from "@/lib/trips/hydrate";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Fuel,
  MapPin,
  Navigation,
  Package,
  Receipt,
  Route as RouteIcon,
  Search,
  Truck,
  Wallet,
} from "lucide-react";

/**
 * Driver dashboard.
 *
 * Mobile-first, focused on the single thing a driver needs right now:
 * their current trip. Everything else is one tap away.
 */

// Real trip lifecycle, in order — drives the step-progress dots below.
// "delayed"/"cancelled" aren't a step on this line (a trip either
// progresses through it or gets pulled off it), so they're rendered as a
// separate flag rather than a fifth dot.
const STEPS = [
  { key: "pending", label: "Pending" },
  { key: "loading", label: "Loading" },
  { key: "in_transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
] as const;

function stepIndex(status: string): number {
  const s = (status || "").toLowerCase();
  if (["delivered", "completed"].includes(s)) return 3;
  if (["in_transit", "in_progress"].includes(s)) return 2;
  if (s === "loading") return 1;
  return 0;
}

function StepProgress({ status }: { status: string }) {
  const idx = stepIndex(status);
  const cancelled = ["delayed", "cancelled"].includes((status || "").toLowerCase());
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
              cancelled ? "bg-muted text-muted-foreground" : i <= idx ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {!cancelled && i < idx ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-0.5 flex-1 mx-1", !cancelled && i < idx ? "bg-orange-500" : "bg-muted")} />
          )}
        </div>
      ))}
    </div>
  );
}

function initials(name?: string | null): string {
  if (!name) return "D";
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function DriverView() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [fuelRequests, setFuelRequests] = useState<any[]>([]);
  const [allowances, setAllowances] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    // Drivers may be stored on the trip under `driverId` (camel) OR
    // `driver_id` (snake) depending on when the row was written. Try both.
    const [byCamel, byUnderscore, f, a] = await Promise.all([
      supabase.from("trips").select("*").eq("driverId", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("trips").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("fuel_requests").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10),
      // driver_allowances (not the legacy allowances table — nothing ever
      // successfully writes to that one, see src/app/allowances/actions.ts)
      // keys the driver by driver_id (uuid), not employee_id (a separate
      // department-prefixed text code).
      supabase.from("driver_allowances").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);
    const raw = [...(byCamel.data ?? []), ...(byUnderscore.data ?? [])];
    const seen = new Set<string>();
    const dedup = raw.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    const hydrated = await hydrateTrips(dedup);
    // Reshape vehicle info into the nested `vehicle` object the JSX expects.
    setTrips(hydrated.map((h: any) => ({
      ...h,
      vehicle: h.vehicle_plate ? { plate_number: h.vehicle_plate, make: h.vehicle_make, model: h.vehicle_model } : null,
    })));
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
  const otherTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips
      .filter((t) => t.id !== currentTrip?.id)
      .filter((t) => !q || [t.trip_number, t.origin, t.destination, t.client].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      .slice(0, 8);
  }, [trips, currentTrip, search]);
  const completedThisMonth = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return trips.filter((t) => String(t.status).toLowerCase() === "delivered" && new Date(t.updated_at ?? t.created_at).getTime() >= monthStart).length;
  }, [trips]);

  const pendingFuel = fuelRequests.filter((r) => r.status === "pending").length;
  const approvedAllowance = allowances
    .filter((a) => a.status === "approved" || a.status === "paid")
    .reduce((s, a) => s + Number(a.amount || 0), 0);

  const firstName = user?.name?.split(" ")[0] ?? "Driver";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 text-white p-5 border border-orange-500/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black tracking-tight truncate">Hi {firstName},</p>
              <p className="text-sm text-white/70 truncate">
                {currentTrip ? `On trip ${currentTrip.trip_number ?? currentTrip.id.slice(0, 6)}` : "No active trip — you're free"}
              </p>
            </div>
          </div>
          <RefreshControl onRefresh={load} storageKey="driver-dash" compact />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Completed this month" value={completedThisMonth} icon={CheckCircle2} accent="bg-orange-500/10 text-orange-500" />
        <StatCard label="Pending fuel" value={pendingFuel} icon={Fuel} accent="bg-warning/10 text-warning" href="/fuel" />
        <StatCard label="Approved allowances" value={format(approvedAllowance)} icon={Wallet} accent="bg-orange-500/10 text-orange-500" href="/allowances" />
        <StatCard label="Other trips" value={otherTrips.length} icon={RouteIcon} accent="bg-info/10 text-info" href="/trips" />
      </div>

      <SectionCard title="Current shipment" subtitle={currentTrip ? "Live workflow — advance the status as you go" : "Nothing to do right now"}>
        {!currentTrip ? (
          <EmptyState icon={Navigation} title="No active trip" description="Once you're assigned a trip, it'll appear here with quick controls." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Order ID</p>
                    <p className="text-xl font-black font-mono text-foreground">{currentTrip.trip_number ?? `TRP-${currentTrip.id.slice(0, 6)}`}</p>
                  </div>
                  <span className="cv-chip bg-orange-500/15 text-orange-600 dark:text-orange-400">{String(currentTrip.status).replace("_", " ")}</span>
                </div>

                <StepProgress status={String(currentTrip.status)} />
                <div className="flex justify-between mt-1 mb-4">
                  {STEPS.map((s) => <span key={s.key} className="text-[9px] text-muted-foreground w-5 text-center -mx-2 first:ml-0 last:mr-0">{s.label}</span>)}
                </div>

                <div className="flex items-start gap-3 mb-4">
                  <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="w-px h-8 bg-border" />
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
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
              <Link href="/proof" className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500 text-white px-3 py-2 text-sm font-bold hover:bg-orange-600 transition-colors">
                <Camera className="w-4 h-4" /> Upload POD
              </Link>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Quick actions" subtitle="Common driver tasks">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/fuel" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-orange-500/40 hover:bg-orange-500/5 transition-colors">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><Fuel className="w-4 h-4" /></div>
            <span className="text-xs font-bold text-foreground">Request fuel</span>
          </Link>
          <Link href="/driver/expenses" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-orange-500/40 hover:bg-orange-500/5 transition-colors">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><Receipt className="w-4 h-4" /></div>
            <span className="text-xs font-bold text-foreground">Log expense</span>
          </Link>
        </div>
        <Link href="/driver/maintenance" className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm font-bold text-destructive hover:bg-destructive/15 transition-colors">
          <AlertTriangle className="w-4 h-4" /> Report an issue
        </Link>
      </SectionCard>

      <SectionCard title="Recent shipping" subtitle="Every trip assigned to you" href="/trips" padded={false}>
        <div className="px-5 pt-4 pb-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shipping…"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-muted/30 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:border-orange-500/40"
            />
          </div>
        </div>
        {loading ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>
        ) : otherTrips.length === 0 ? (
          <EmptyState icon={Clock} title="No other shipments" description="You'll be notified when a new trip is assigned." />
        ) : (
          <ul className="divide-y divide-border mt-2">
            {otherTrips.map((t) => {
              const delivered = String(t.status).toLowerCase() === "delivered";
              return (
                <li key={t.id} className={cn("px-5 py-3.5", delivered && "bg-orange-500/[0.04]")}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm font-bold font-mono text-foreground truncate">{t.trip_number ?? `TRP-${t.id.slice(0, 6)}`}</p>
                    <span className={cn("cv-chip shrink-0", delivered ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" : "cv-chip-neutral")}>
                      {String(t.status).replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-2">{t.origin} → {t.destination}</p>
                  <StepProgress status={String(t.status)} />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
