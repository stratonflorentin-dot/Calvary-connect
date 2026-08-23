"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/hooks/use-currency";
import { PageShell, PageHeader, StatCard, SectionCard, EmptyState, PageSkeleton, RefreshControl } from "@/components/shell";
import { hydrateTrips } from "@/lib/trips/hydrate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format as formatDate } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  History,
  MapPin,
  Route as RouteIcon,
  Search,
  Truck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "ytd" | "all";

export default function TripHistoryPage() {
  const { format } = useCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Range>("30d");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trips")
      .select("*")
      .in("status", ["delivered", "completed", "DELIVERED", "COMPLETED"])
      .order("created_at", { ascending: false })
      .limit(500);
    const hydrated = await hydrateTrips(data ?? []);
    setRows(
      hydrated.map((t) => ({
        ...t,
        completed_at: t.endTime ?? t.updated_at ?? t.created_at,
        revenue: Number(t.total_amount ?? t.totalAmount ?? t.sales_amount ?? t.salesAmount ?? 0),
        cost: Number(t.cost_fuel ?? 0) + Number(t.cost_tolls ?? 0) + Number(t.cost_border ?? 0) + Number(t.cost_customs ?? 0),
        currency: t.currency || "TZS",
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      range === "7d" ? now - 7 * 24 * 3600 * 1000 :
      range === "30d" ? now - 30 * 24 * 3600 * 1000 :
      range === "90d" ? now - 90 * 24 * 3600 * 1000 :
      range === "ytd" ? new Date(new Date().getFullYear(), 0, 1).getTime() :
      0;
    return rows.filter((r) => {
      if (cutoff && new Date(r.completed_at).getTime() < cutoff) return false;
      if (q) {
        const hay = [r.trip_number, r.origin, r.destination, r.driver_name, r.client, r.vehicle_plate].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, range]);

  const stats = useMemo(() => {
    const revenueByCurrency: Record<string, number> = {};
    const costByCurrency: Record<string, number> = {};
    const marginByCurrency: Record<string, number> = {};
    for (const r of filtered) {
      const cur = r.currency || "TZS";
      revenueByCurrency[cur] = (revenueByCurrency[cur] ?? 0) + r.revenue;
      costByCurrency[cur] = (costByCurrency[cur] ?? 0) + r.cost;
      marginByCurrency[cur] = (marginByCurrency[cur] ?? 0) + (r.revenue - r.cost);
    }
    return { trips: filtered.length, revenueByCurrency, costByCurrency, marginByCurrency };
  }, [filtered]);

  const formatByCurrency = (byCurrency: Record<string, number>) => {
    const entries = Object.entries(byCurrency);
    if (entries.length === 0) return format(0);
    return entries.map(([cur, amt]) => format(amt, cur)).join(" · ");
  };

  const grouped = useMemo(() => {
    const byDay = new Map<string, any[]>();
    for (const r of filtered) {
      const k = formatDate(new Date(r.completed_at), "yyyy-MM-dd");
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(r);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const exportCsv = () => {
    const list = [
      ["Trip #", "Completed", "Origin", "Destination", "Driver", "Vehicle", "Client", "Revenue", "Cost", "Margin"],
      ...filtered.map((r) => [
        r.trip_number ?? r.id,
        r.completed_at?.slice(0, 10) ?? "",
        r.origin,
        r.destination,
        r.driver_name ?? "",
        r.vehicle_plate ?? "",
        r.client ?? "",
        r.revenue,
        r.cost,
        r.revenue - r.cost,
      ].join(",")),
    ].map((r) => (Array.isArray(r) ? r.join(",") : r));
    const csv = list.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trip-history-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Operations"
        title="Trip History"
        subtitle={`${filtered.length} completed trips in the selected range`}
        icon={History}
        iconAccent="bg-primary text-primary-foreground"
        crumbs={[{ label: "Operations" }, { label: "Trip History" }]}
        actions={
          <>
            <RefreshControl onRefresh={load} storageKey="trip-history" />
            <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-2">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </>
        }
      />

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(["7d", "30d", "90d", "ytd", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-full border transition-colors",
                  range === r
                    ? "border-primary bg-[hsl(var(--primary-soft))] text-primary shadow-sm"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {r === "ytd" ? "Year to date" : r === "all" ? "All time" : `Last ${r}`}
              </button>
            ))}
            <div className="ml-auto relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trip, driver, city…" className="pl-9 h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Completed trips" value={stats.trips} icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
            <StatCard label="Revenue" value={formatByCurrency(stats.revenueByCurrency)} icon={RouteIcon} accent="bg-primary/10 text-primary" />
            <StatCard label="Direct cost" value={formatByCurrency(stats.costByCurrency)} icon={Truck} accent="bg-amber-100 text-amber-700" />
            <StatCard label="Margin" value={formatByCurrency(stats.marginByCurrency)} icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
          </div>

          {grouped.length === 0 ? (
            <SectionCard title="History" subtitle="Completed trips grouped by day">
              <EmptyState icon={History} title="No completed trips in this range" description="Try widening the date range or clearing the search." />
            </SectionCard>
          ) : (
            <div className="space-y-4">
              {grouped.map(([day, list]) => {
                const dayRevenueByCurrency: Record<string, number> = {};
                for (const r of list) {
                  const cur = r.currency || "TZS";
                  dayRevenueByCurrency[cur] = (dayRevenueByCurrency[cur] ?? 0) + r.revenue;
                }
                return (
                  <SectionCard
                    key={day}
                    title={formatDate(new Date(day), "EEEE, d MMMM yyyy")}
                    subtitle={`${list.length} trip${list.length === 1 ? "" : "s"} · ${formatByCurrency(dayRevenueByCurrency)} revenue`}
                    padded={false}
                  >
                    <ul className="divide-y divide-border">
                      {list.map((r: any) => (
                        <li key={r.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/40 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--success-soft))] text-[hsl(var(--success))] flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <p className="font-bold text-sm text-foreground">{r.trip_number ?? `TRP-${r.id.slice(0, 6)}`}</p>
                              <span className="text-[10px] text-muted-foreground">{r.client}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <MapPin className="w-3 h-3 text-emerald-500" />
                              {r.origin} → {r.destination}
                              {r.driver_name && (<><span>·</span><User className="w-3 h-3" /> {r.driver_name}</>)}
                              {r.vehicle_plate && (<><span>·</span><Truck className="w-3 h-3" /> {r.vehicle_plate}</>)}
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <p className="text-sm font-black text-foreground">{format(r.revenue, r.currency)}</p>
                            <p className="text-[10px] text-muted-foreground">margin {format(r.revenue - r.cost, r.currency)}</p>
                          </div>
                          <Link href={`/trips?tripId=${r.id}`} className="text-muted-foreground hover:text-primary">
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
