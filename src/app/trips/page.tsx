"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "@/hooks/use-toast";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { hoursSince, isOverdue, slaHours } from "@/lib/workflow/approvals";
import { hydrateTrips } from "@/lib/trips/hydrate";
import { TripFormDialog } from "@/components/trip/trip-form-dialog";
import {
  CheckCircle2,
  ClipboardList,
  Flame,
  MapPin,
  Navigation,
  Package,
  Plus,
  Search,
  Truck,
  User,
} from "lucide-react";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard, IndustryCardKicker } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";

const OPERATOR_PAGES = [
  { label: "Dispatch", href: "/dispatch" },
  { label: "Trips register", href: "/trips" },
  { label: "Inventory & parts", href: "/inventory" },
  { label: "Live fleet map", href: "/map" },
];

const fieldClass = "w-full text-[13px] bg-transparent border border-[var(--ci-divider)] px-[9px] py-[6px] outline-none focus-visible:border-[var(--ci-accent)]";

const STATUS_VARIANT: Record<string, "accent" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  loading: "neutral",
  in_transit: "warning",
  delivered: "accent",
  cancelled: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  loading: "Loading",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
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
    const { data, error } = await supabase.from("trips").select("*").order("created_at", { ascending: false }).limit(500);
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
    const revenueByCurrency: Record<string, number> = {};
    trips.filter((t) => t.status === "delivered").forEach((t) => {
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

  return (
    <IndustryRoleShell roleLabel="Operator" pages={OPERATOR_PAGES}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">{stats.active} active · {stats.overdue} overdue · {stats.delivered} delivered</p>
        <div className="flex gap-2">
          <IndustryButton variant="secondary" asChild className="gap-1.5">
            <Link href="/dispatch"><Navigation className="size-4" /> Dispatch board</Link>
          </IndustryButton>
          <IndustryButton variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
            <Plus className="size-4" /> New trip
          </IndustryButton>
        </div>
      </div>

      <TripFormDialog open={formOpen} onOpenChange={setFormOpen} trip={editing} onSaved={load} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <IndustryCard className="gap-1"><IndustryCardKicker><ClipboardList className="size-3 inline mr-1" />Total trips</IndustryCardKicker><p className="ci-mono text-[20px] font-bold leading-none">{stats.total}</p></IndustryCard>
        <IndustryCard className="gap-1"><IndustryCardKicker><Truck className="size-3 inline mr-1" />Active</IndustryCardKicker><p className="ci-mono text-[20px] font-bold leading-none">{stats.active}</p></IndustryCard>
        <IndustryCard className="gap-1"><IndustryCardKicker><Flame className="size-3 inline mr-1" />Overdue</IndustryCardKicker><p className={"ci-mono text-[20px] font-bold leading-none " + (stats.overdue > 0 ? "text-[#8c1d18]" : "")}>{stats.overdue}</p></IndustryCard>
        <IndustryCard className="gap-1"><IndustryCardKicker><CheckCircle2 className="size-3 inline mr-1" />Delivered</IndustryCardKicker><p className="ci-mono text-[20px] font-bold leading-none">{stats.delivered}</p></IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><Package className="size-3 inline mr-1" />Revenue (delivered)</IndustryCardKicker>
          <p className="ci-mono text-[14px] font-bold leading-tight">{Object.keys(stats.revenueByCurrency).length ? Object.entries(stats.revenueByCurrency).map(([cur, amt]) => format(amt, cur)).join(" · ") : format(0)}</p>
        </IndustryCard>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={
                "px-3 py-[6px] text-[12px] border transition-colors duration-150 " +
                (filter === c.key ? "bg-[var(--ci-text)] text-[var(--ci-bg)] border-[var(--ci-text)]" : "border-[var(--ci-divider)] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-row-hover)]")
              }
            >
              {c.label} <span className="ci-mono opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-[9px] top-1/2 -translate-y-1/2 size-3.5 text-[var(--ci-text-tertiary)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trip #, driver, city…" className={fieldClass + " pl-8"} />
        </div>
      </div>

      <IndustryCard>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Trip #</IndustryTh>
              <IndustryTh>Route</IndustryTh>
              <IndustryTh>Client</IndustryTh>
              <IndustryTh>Driver / Vehicle</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh>Age</IndustryTh>
              <IndustryTh align="right">Amount</IndustryTh>
              <IndustryTh align="right">Actions</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><IndustryTd colSpan={8} className="text-center text-[var(--ci-text-tertiary)]">Loading…</IndustryTd></tr>
            ) : filtered.length === 0 ? (
              <tr><IndustryTd colSpan={8} className="text-center text-[var(--ci-text-tertiary)]">{trips.length === 0 ? "No trips yet. Create your first trip to start dispatching." : "No trips match this view."}</IndustryTd></tr>
            ) : (
              filtered.map((t) => {
                const overdue = t.status !== "delivered" && t.status !== "cancelled" && t.created_at && isOverdue("trip", t.created_at);
                const age = t.created_at ? hoursSince(t.created_at) : 0;
                return (
                  <IndustryTr key={t.id}>
                    <IndustryTd mono>
                      <button type="button" onClick={() => { setEditing(t); setFormOpen(true); }} className="hover:text-[var(--ci-accent)] hover:underline">
                        {t.trip_number ?? `TRP-${t.id.slice(0, 6)}`}
                      </button>
                    </IndustryTd>
                    <IndustryTd>
                      <span className="flex items-center gap-1 text-[12px]">
                        <MapPin className="size-3 text-[var(--ci-text-tertiary)] shrink-0" />
                        <span className="truncate">{t.origin || "—"}</span>
                        <span className="text-[var(--ci-text-tertiary)]">→</span>
                        <span className="truncate">{t.destination || "—"}</span>
                      </span>
                    </IndustryTd>
                    <IndustryTd className="text-[12px] truncate max-w-[140px]">{t.client || "—"}</IndustryTd>
                    <IndustryTd className="text-[11px]">
                      {t.driver_name && <div className="flex items-center gap-1"><User className="size-3 text-[var(--ci-text-tertiary)]" />{t.driver_name}</div>}
                      {t.vehicle_plate && <div className="flex items-center gap-1 ci-mono text-[var(--ci-text-tertiary)]"><Truck className="size-3" />{t.vehicle_plate}</div>}
                      {!t.driver_name && !t.vehicle_plate && <span className="text-[var(--ci-text-tertiary)] italic">Unassigned</span>}
                    </IndustryTd>
                    <IndustryTd>
                      <div className="flex flex-col gap-1">
                        <IndustryTag variant={STATUS_VARIANT[t.status] ?? "neutral"} pulse={t.status === "in_transit"}>{STATUS_LABEL[t.status] ?? t.status}</IndustryTag>
                        {overdue && <IndustryTag variant="danger"><Flame className="size-2.5" />{(age - slaHours.trip).toFixed(0)}h late</IndustryTag>}
                      </div>
                    </IndustryTd>
                    <IndustryTd mono className="text-[11px]">{age > 24 ? `${(age / 24).toFixed(1)}d` : `${age.toFixed(0)}h`}</IndustryTd>
                    <IndustryTd align="right" mono className="font-bold">
                      {t.total_amount || t.sales_amount || t.totalAmount || t.salesAmount ? format(Number(t.total_amount ?? t.totalAmount ?? t.sales_amount ?? t.salesAmount), t.currency || "TZS") : "—"}
                    </IndustryTd>
                    <IndustryTd align="right">
                      <TransitionButtons kind="trip" entity={t} actorId={user?.id ?? "system"} actorRole={role ?? undefined} onDone={load} size="sm" />
                    </IndustryTd>
                  </IndustryTr>
                );
              })
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>
    </IndustryRoleShell>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={null}>
      <TripsContent />
    </Suspense>
  );
}
