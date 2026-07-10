"use client";

import { useEffect, useRef, useState } from "react";
import { PageShell, PageHeader, SectionCard, EmptyState } from "@/components/shell";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Fuel,
  Loader2,
  MapPin,
  Plus,
  Route as RouteIcon,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

interface Waypoint {
  id: string;
  address: string;
}

interface Leg {
  from: string;
  to: string;
  distance_km: number;
  duration_min: number;
}

interface OptimizedRoute {
  distance_km: number;
  duration_min: number;
  fuel_liters: number;
  ordered: { address: string; lat: number; lon: number }[];
  legs: Leg[];
  geometry: [number, number][];
  reordered: boolean;
}

let idCounter = 1;
const uid = () => `wp-${idCounter++}`;

const QUICK_ROUTES = [
  { label: "Dar es Salaam → Dodoma", stops: ["Dar es Salaam", "Morogoro", "Dodoma"] },
  { label: "Dar es Salaam → Mwanza", stops: ["Dar es Salaam", "Dodoma", "Singida", "Mwanza"] },
  { label: "Dar es Salaam → Tunduma (Zambia border)", stops: ["Dar es Salaam", "Iringa", "Mbeya", "Tunduma"] },
  { label: "Dar es Salaam → Lusaka", stops: ["Dar es Salaam", "Mbeya", "Kapiri Mposhi, Zambia", "Lusaka, Zambia"] },
  { label: "Dar es Salaam → Nairobi", stops: ["Dar es Salaam", "Arusha", "Namanga", "Nairobi, Kenya"] },
];

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&q=${encodeURIComponent(address)}`,
      { headers: { Accept: "application/json" } },
    );
    const data = await res.json();
    return data?.[0] ? { lat: Number(data[0].lat), lon: Number(data[0].lon) } : null;
  } catch {
    return null;
  }
}

async function optimize(addresses: string[]): Promise<OptimizedRoute> {
  const coords = await Promise.all(addresses.map(geocode));
  const resolved = addresses
    .map((address, i) => ({ address, point: coords[i] }))
    .filter((x): x is { address: string; point: { lat: number; lon: number } } => !!x.point);

  const failed = addresses.filter((_, i) => !coords[i]);
  if (failed.length > 0) throw new Error(`Couldn't find: ${failed.join(", ")}`);
  if (resolved.length < 2) throw new Error("At least two valid stops are required.");

  const coordStr = resolved.map((r) => `${r.point.lon},${r.point.lat}`).join(";");

  // OSRM trip service solves the stop order (first stop fixed as start,
  // last fixed as end). Falls back to plain routing for 2 stops.
  const url =
    resolved.length > 2
      ? `https://router.project-osrm.org/trip/v1/driving/${coordStr}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=false`
      : `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing engine error (${res.status})`);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error(data.message || "Routing failed");

  const route = resolved.length > 2 ? data.trips[0] : data.routes[0];

  let ordered = resolved.map((r) => ({ address: r.address, lat: r.point.lat, lon: r.point.lon }));
  let reordered = false;
  if (resolved.length > 2 && data.waypoints) {
    const order: number[] = data.waypoints.map((w: any) => w.waypoint_index);
    const sorted = resolved
      .map((r, inputIdx) => ({ r, pos: order[inputIdx] }))
      .sort((a, b) => a.pos - b.pos)
      .map(({ r }) => ({ address: r.address, lat: r.point.lat, lon: r.point.lon }));
    reordered = sorted.some((s, i) => s.address !== ordered[i].address);
    ordered = sorted;
  }

  const legs: Leg[] = route.legs.map((leg: any, i: number) => ({
    from: ordered[i]?.address ?? "?",
    to: ordered[i + 1]?.address ?? "?",
    distance_km: +(leg.distance / 1000).toFixed(1),
    duration_min: Math.round(leg.duration / 60),
  }));

  const distance_km = +(route.distance / 1000).toFixed(1);
  return {
    distance_km,
    duration_min: Math.round(route.duration / 60),
    fuel_liters: +(distance_km * 0.35).toFixed(0), // ~35L/100km loaded truck
    ordered,
    legs,
    geometry: route.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon] as [number, number]),
    reordered,
  };
}

const fmtDur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function RouteMap({ route }: { route: OptimizedRoute }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

      const line = L.polyline(route.geometry, { color: "#4f46e5", weight: 4, opacity: 0.85 }).addTo(map);
      route.ordered.forEach((stop, i) => {
        const isFirst = i === 0;
        const isLast = i === route.ordered.length - 1;
        const color = isFirst ? "#16a34a" : isLast ? "#dc2626" : "#4f46e5";
        L.marker([stop.lat, stop.lon], {
          icon: L.divIcon({
            className: "",
            html: `<div style="min-width:22px;height:22px;padding:0 4px;border-radius:11px;background:${color};color:white;font:900 11px/22px Inter,sans-serif;text-align:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        })
          .addTo(map)
          .bindTooltip(stop.address);
      });
      map.fitBounds(line.getBounds(), { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 100);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [route]);

  return <div ref={containerRef} className="h-[380px] w-full rounded-xl overflow-hidden border border-border z-0 relative" />;
}

export default function RouteOptimizerPage() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: uid(), address: "" },
    { id: uid(), address: "" },
  ]);
  const [result, setResult] = useState<OptimizedRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const patchWp = (id: string, address: string) =>
    setWaypoints((prev) => prev.map((wp) => (wp.id === id ? { ...wp, address } : wp)));

  const run = async () => {
    const filled = waypoints.map((w) => w.address.trim()).filter(Boolean);
    if (filled.length < 2) {
      setError("Enter at least an origin and a destination.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      setResult(await optimize(filled));
    } catch (e: any) {
      setError(e.message || "Optimization failed. Check the stop names and try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyRoute = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.ordered.map((s) => s.address).join(" → "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Operations"
        title="Route optimizer"
        subtitle="Order multi-stop routes for the shortest driving distance — powered by OSRM"
        icon={RouteIcon}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        <div className="space-y-4">
          <SectionCard title="Stops" subtitle="First stop is the origin, last is the final destination">
            <div className="space-y-2">
              {waypoints.map((wp, i) => (
                <div key={wp.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0",
                      i === 0
                        ? "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]"
                        : i === waypoints.length - 1
                          ? "bg-red-100 text-red-700"
                          : "bg-primary/10 text-primary",
                    )}
                  >
                    {i + 1}
                  </span>
                  <Input
                    value={wp.address}
                    onChange={(e) => patchWp(wp.id, e.target.value)}
                    placeholder={i === 0 ? "Origin — e.g. Dar es Salaam" : i === waypoints.length - 1 ? "Destination — e.g. Mbeya" : `Stop ${i}`}
                    className="h-9"
                  />
                  {waypoints.length > 2 && (
                    <button
                      onClick={() => setWaypoints((prev) => prev.filter((x) => x.id !== wp.id))}
                      className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive flex items-center justify-center shrink-0 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 flex-1"
                onClick={() => setWaypoints((prev) => [...prev.slice(0, -1), { id: uid(), address: "" }, prev[prev.length - 1]])}
              >
                <Plus className="w-3.5 h-3.5" /> Add stop
              </Button>
              <Button
                size="sm"
                onClick={run}
                disabled={loading}
                className="h-9 gap-1.5 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {loading ? "Optimizing…" : "Optimize route"}
              </Button>
            </div>
            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quick routes" subtitle="Common Calvary corridors">
            <div className="space-y-1.5">
              {QUICK_ROUTES.map((q) => (
                <button
                  key={q.label}
                  onClick={() => {
                    setWaypoints(q.stops.map((address) => ({ id: uid(), address })));
                    setResult(null);
                    setError("");
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                >
                  <span className="text-xs font-bold text-foreground group-hover:text-primary">{q.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          {!result && !loading && (
            <SectionCard title="Route preview">
              <EmptyState
                icon={MapPin}
                title="No route yet"
                description="Add your stops on the left and hit Optimize — the best driving order, distance, time and fuel estimate will appear here."
              />
            </SectionCard>
          )}

          {loading && (
            <SectionCard title="Route preview">
              <div className="h-[380px] flex items-center justify-center text-muted-foreground gap-2 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" /> Geocoding stops and solving the route…
              </div>
            </SectionCard>
          )}

          {result && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="cv-kpi">
                  <span className="cv-kpi-label">Total distance</span>
                  <p className="cv-kpi-value mt-1">{result.distance_km.toLocaleString()} km</p>
                </div>
                <div className="cv-kpi">
                  <span className="cv-kpi-label flex items-center gap-1"><Clock className="w-3 h-3" /> Driving time</span>
                  <p className="cv-kpi-value mt-1">{fmtDur(result.duration_min)}</p>
                </div>
                <div className="cv-kpi">
                  <span className="cv-kpi-label flex items-center gap-1"><Fuel className="w-3 h-3" /> Est. fuel</span>
                  <p className="cv-kpi-value mt-1">{result.fuel_liters.toLocaleString()} L</p>
                </div>
              </div>

              {result.reordered && (
                <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success-soft))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--success))]">
                  <Sparkles className="w-4 h-4" /> Stops were reordered for a shorter route.
                </div>
              )}

              <SectionCard
                title="Optimized route"
                actions={
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={copyRoute}>
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                }
              >
                <RouteMap route={result} />
                <div className="mt-4 space-y-1">
                  {result.legs.map((leg, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0 text-sm">
                        <span className="font-bold text-foreground truncate">{leg.from}</span>
                        <ArrowDown className="w-3.5 h-3.5 rotate-[-90deg] text-muted-foreground shrink-0" />
                        <span className="font-bold text-foreground truncate">{leg.to}</span>
                      </div>
                      <div className="shrink-0 text-xs font-black text-muted-foreground">
                        {leg.distance_km.toLocaleString()} km · {fmtDur(leg.duration_min)}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
