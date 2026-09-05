"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getListStagger, listItem, statusChange } from "@/lib/animations";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "@/hooks/use-toast";
import { PageShell, PageHeader, StatCard, SectionCard, EmptyState, PageSkeleton, RefreshControl } from "@/components/shell";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { hoursSince, isOverdue, slaHours } from "@/lib/workflow/approvals";
import { hydrateTrips } from "@/lib/trips/hydrate";
import { TripFormDialog } from "@/components/trip/trip-form-dialog";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Flame,
  MapPin,
  Navigation,
  Package,
  Plus,
  Route as RouteIcon,
  Search,
  Truck,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  pending:    { label: "Pending",    chip: "bg-warning/10 text-warning",   dot: "bg-warning" },
  loading:    { label: "Loading",    chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  in_transit: { label: "In Transit", chip: "bg-[hsl(var(--info-soft))] text-[hsl(var(--info))]", dot: "bg-[hsl(var(--info))] animate-pulse" },
  delivered:  { label: "Delivered",  chip: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]", dot: "bg-[hsl(var(--success))]" },
  cancelled:  { label: "Cancelled",  chip: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

type FilterKey = "all" | "active" | "pending" | "delivered" | "overdue";

function TripsContent() {
  const { role } = useRole();
  const { user } = useSupabase();
  const { format } = useCurrency();
  const searchParams = useSearchParams();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Route Optimizer hands off a computed route via query params (only a
  // single origin/destination pair — trips has no stops/waypoints column,
  // so any intermediate stops are folded into a "Via: ..." note instead of
  // being dropped). No `id` on this object, so TripFormDialog stays in
  // create mode.
  useEffect(() => {
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    if (!origin || !destination) return;
    const distance = searchParams.get("distance");
    const duration = searchParams.get("duration");
    const via = searchParams.get("via");
    setEditing({
      trip_number: `TRP-${Date.now().toString().slice(-6)}`,
      origin,
      destination,
      estimated_distance: distance ? Number(distance) : "",
      estimated_duration: duration ? Number(duration) : "",
      notes: via ? `Via: ${via}` : "",
    });
    setFormOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // "View Details" / "Edit Trip" elsewhere (e.g. the Dispatch Board) hand
  // off a specific trip this same way — open it in the edit dialog, which
  // doubles as this app's trip detail view since there's no separate
  // /trips/[id] page.
  useEffect(() => {
    const tripId = searchParams.get("tripId");
    if (!tripId || trips.length === 0) return;
    const trip = trips.find((t) => t.id === tripId);
    if (trip) {
      setEditing(trip);
      setFormOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, trips]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Load error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const hydrated = await hydrateTrips(data ?? []);
    setTrips(hydrated.map((t) => ({ ...t, status: String(t.status ?? "pending").toLowerCase() })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = trips.filter((t) => ["pending", "loading", "in_transit"].includes(t.status)).length;
    const overdue = trips.filter((t) => t.status !== "delivered" && t.status !== "cancelled" && t.created_at && isOverdue("trip", t.created_at)).length;
    const delivered = trips.filter((t) => t.status === "delivered").length;
    // Grouped by currency, not blended into one number — a USD trip and a
    // TZS trip summed together (or worse, the USD figure formatted with a
    // hardcoded TZS label) is meaningless, not just mislabeled.
    const revenueByCurrency: Record<string, number> = {};
    trips
      .filter((t) => t.status === "delivered")
      .forEach((t) => {
        const cur = t.currency || "TZS";
        const amt = Number(t.total_amount ?? t.totalAmount ?? t.sales_amount ?? t.salesAmount ?? 0);
        revenueByCurrency[cur] = (revenueByCurrency[cur] || 0) + amt;
      });
    return { total: trips.length, active, overdue, delivered, revenueByCurrency };
  }, [trips]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((t) => {
      if (q) {
        const hay = [t.trip_number, t.origin, t.destination, t.driver_name, t.vehicle_plate, t.client].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "active") return ["pending", "loading", "in_transit"].includes(t.status);
      if (filter === "pending") return t.status === "pending";
      if (filter === "delivered") return t.status === "delivered";
      if (filter === "overdue") return t.status !== "delivered" && t.status !== "cancelled" && t.created_at && isOverdue("trip", t.created_at);
      return true;
    });
  }, [trips, search, filter]);

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "active", label: "Active", count: stats.active },
    { key: "pending", label: "Pending", count: trips.filter((t) => t.status === "pending").length },
    { key: "overdue", label: "Overdue", count: stats.overdue },
    { key: "delivered", label: "Delivered", count: stats.delivered },
  ];

  // Capped so a long trip list doesn't take ages to finish staggering in —
  // see getListStagger in src/lib/animations.ts.
  const rowStagger = useMemo(
    () => ({ hidden: {}, visible: { transition: { staggerChildren: getListStagger(filtered.length) } } }),
    [filtered.length],
  );

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Operations"
        title="Trips"
        subtitle={`${stats.active} active · ${stats.overdue} overdue · ${stats.delivered} delivered`}
        icon={RouteIcon}
        iconAccent="bg-primary text-primary-foreground"
        actions={
          <>
            <RefreshControl onRefresh={load} storageKey="trips" />
            <Link href="/dispatch">
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Navigation className="w-3.5 h-3.5" /> Dispatch Board
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="h-9 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-3.5 h-3.5" /> New Trip
            </Button>
          </>
        }
      />

      <TripFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        trip={editing}
        onSaved={load}
      />

      {loading ? (
        <PageSkeleton kpiCount={5} />
      ) : (
        <>
          {/* KPIs */}
          <motion.div
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6"
          >
            <motion.div variants={listItem}><StatCard label="Total trips" value={stats.total} icon={ClipboardList} accent="bg-primary/10 text-primary" /></motion.div>
            <motion.div variants={listItem}><StatCard label="Active" value={stats.active} icon={Truck} accent="bg-info/10 text-info" /></motion.div>
            <motion.div variants={listItem}><StatCard label="Overdue" value={stats.overdue} icon={Flame} accent="bg-destructive/10 text-destructive" /></motion.div>
            <motion.div variants={listItem}><StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" /></motion.div>
            <motion.div variants={listItem}><StatCard label="Revenue (delivered)" value={Object.keys(stats.revenueByCurrency).length ? Object.entries(stats.revenueByCurrency).map(([cur, amt]) => format(amt, cur)).join(" · ") : format(0)} icon={Package} accent="bg-success/10 text-success" /></motion.div>
          </motion.div>

          {/* Filter chips */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                    filter === c.key
                      ? "border-primary bg-[hsl(var(--primary-soft))] text-primary shadow-sm"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {c.label}
                  <span className="text-[10px] font-black bg-background/60 rounded-full px-1.5">{c.count}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trip #, driver, city…" className="pl-9 h-9" />
            </div>
          </div>

          {/* Table */}
          <SectionCard title={`Trips (${filtered.length})`} subtitle="Click a row to edit or advance status" padded={false}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={RouteIcon}
                title={trips.length === 0 ? "No trips yet" : "No trips match this view"}
                description={trips.length === 0 ? "Create your first trip to start dispatching." : "Try clearing the search or switching filters."}
                action={
                  trips.length === 0 ? (
                    <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                      <Plus className="w-4 h-4" /> New Trip
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3">Trip #</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Driver / Vehicle</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Age</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <motion.tbody variants={rowStagger} initial="hidden" animate="visible">
                    {filtered.map((t) => {
                      const meta = STATUS_META[t.status] ?? STATUS_META.pending;
                      const overdue = t.status !== "delivered" && t.status !== "cancelled" && t.created_at && isOverdue("trip", t.created_at);
                      const age = t.created_at ? hoursSince(t.created_at) : 0;
                      return (
                        <motion.tr key={t.id} variants={listItem} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => { setEditing(t); setFormOpen(true); }}
                              className="font-mono text-xs font-black text-foreground hover:text-primary underline-offset-4 hover:underline"
                            >
                              {t.trip_number ?? `TRP-${t.id.slice(0, 6)}`}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-sm text-foreground">
                              <MapPin className="w-3 h-3 text-success shrink-0" />
                              <span className="truncate">{t.origin || "—"}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="truncate">{t.destination || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[160px]">{t.client || "—"}</td>
                          <td className="px-4 py-3 text-xs">
                            <div className="space-y-0.5">
                              {t.driver_name && (
                                <div className="flex items-center gap-1 text-foreground">
                                  <User className="w-3 h-3 text-muted-foreground" /> {t.driver_name}
                                </div>
                              )}
                              {t.vehicle_plate && (
                                <div className="flex items-center gap-1 text-muted-foreground font-mono">
                                  <Truck className="w-3 h-3" /> {t.vehicle_plate}
                                </div>
                              )}
                              {!t.driver_name && !t.vehicle_plate && <span className="text-muted-foreground italic">Unassigned</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <AnimatePresence mode="wait">
                                <motion.span
                                  key={t.status}
                                  variants={statusChange}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  className={cn("cv-chip", meta.chip)}
                                >
                                  <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                                  {meta.label}
                                </motion.span>
                              </AnimatePresence>
                              {overdue && (
                                <span className="cv-chip cv-chip-danger">
                                  <Flame className="w-2.5 h-2.5" /> {(age - slaHours.trip).toFixed(0)}h late
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {age > 24 ? `${(age / 24).toFixed(1)}d` : `${age.toFixed(0)}h`}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {t.total_amount || t.sales_amount || t.totalAmount || t.salesAmount ? format(Number(t.total_amount ?? t.totalAmount ?? t.sales_amount ?? t.salesAmount), t.currency || "TZS") : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <TransitionButtons
                              kind="trip"
                              entity={t}
                              actorId={user?.id ?? "system"}
                              actorRole={role ?? undefined}
                              onDone={load}
                              size="sm"
                            />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </motion.tbody>
                </table>
              </div>
            )}

            {/* Mobile card view */}
            <motion.div variants={rowStagger} initial="hidden" animate="visible" className="sm:hidden space-y-3">
              {filtered.map((t) => {
                const meta = STATUS_META[t.status] ?? STATUS_META.pending;
                const overdue = t.status !== "delivered" && t.status !== "cancelled" && t.created_at && isOverdue("trip", t.created_at);
                const age = t.created_at ? hoursSince(t.created_at) : 0;
                return (
                  <motion.div
                    key={t.id}
                    variants={listItem}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setEditing(t); setFormOpen(true); }}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <button
                          type="button"
                          className="font-mono text-xs font-black text-foreground hover:text-primary underline-offset-4 hover:underline"
                        >
                          {t.trip_number ?? `TRP-${t.id.slice(0, 6)}`}
                        </button>
                        <div className="flex items-center gap-1.5 text-sm text-foreground mt-1">
                          <MapPin className="w-3 h-3 text-success shrink-0" />
                          <span className="truncate">{t.origin || "—"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="truncate">{t.destination || "—"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={t.status}
                            variants={statusChange}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className={cn("cv-chip", meta.chip)}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                            {meta.label}
                          </motion.span>
                        </AnimatePresence>
                        {overdue && (
                          <span className="cv-chip cv-chip-danger">
                            <Flame className="w-2.5 h-2.5" /> {(age - slaHours.trip).toFixed(0)}h late
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Client</span>
                        <span className="font-medium">{t.client || "—"}</span>
                      </div>
                      {t.driver_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Driver</span>
                          <span className="font-medium">{t.driver_name}</span>
                        </div>
                      )}
                      {t.vehicle_plate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vehicle</span>
                          <span className="font-medium font-mono">{t.vehicle_plate}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Age</span>
                        <span className="font-medium">{age > 24 ? `${(age / 24).toFixed(1)}d` : `${age.toFixed(0)}h`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-bold">{t.total_amount || t.sales_amount || t.totalAmount || t.salesAmount ? format(Number(t.total_amount ?? t.totalAmount ?? t.sales_amount ?? t.salesAmount), t.currency || "TZS") : "—"}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border">
                      <TransitionButtons
                        kind="trip"
                        entity={t}
                        actorId={user?.id ?? "system"}
                        actorRole={role ?? undefined}
                        onDone={load}
                        size="sm"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </SectionCard>
        </>
      )}
    </PageShell>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<PageShell width="wide"><PageSkeleton kpiCount={5} /></PageShell>}>
      <TripsContent />
    </Suspense>
  );
}
