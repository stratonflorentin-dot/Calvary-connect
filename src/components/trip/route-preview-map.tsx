"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, TriangleAlert } from "lucide-react";
import "leaflet/dist/leaflet.css";

/**
 * Mini map for the trip form: geocodes origin/destination (Nominatim),
 * draws the driving route (OSRM public server) and reports distance and
 * duration back to the form. Falls back to a straight line + haversine
 * estimate when routing is unavailable.
 */

export interface RouteEstimate {
  distanceKm: number;
  durationHrs: number;
  exact: boolean; // true when it came from road routing, false for haversine
}

interface Props {
  origin: string;
  destination: string;
  onRoute?: (estimate: RouteEstimate) => void;
  className?: string;
}

interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

const geocodeCache = new Map<string, GeoPoint | null>();

async function geocode(place: string): Promise<GeoPoint | null> {
  const q = place.trim().toLowerCase();
  if (!q) return null;
  if (geocodeCache.has(q)) return geocodeCache.get(q)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } },
    );
    const data = await res.json();
    const hit = data?.[0]
      ? { lat: Number(data[0].lat), lon: Number(data[0].lon), label: String(data[0].display_name).split(",").slice(0, 2).join(",") }
      : null;
    geocodeCache.set(q, hit);
    return hit;
  } catch {
    return null;
  }
}

function haversineKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function fetchRoute(a: GeoPoint, b: GeoPoint): Promise<{ km: number; hrs: number; coords: [number, number][] } | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`,
    );
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;
    return {
      km: route.distance / 1000,
      hrs: route.duration / 3600,
      coords: route.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon] as [number, number]),
    };
  } catch {
    return null;
  }
}

export function RoutePreviewMap({ origin, destination, onRoute, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "notfound">("idle");
  const [summary, setSummary] = useState<{ km: number; hrs: number; exact: boolean } | null>(null);
  const [labels, setLabels] = useState<{ from: string; to: string } | null>(null);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  useEffect(() => {
    const from = origin.trim();
    const to = destination.trim();
    if (from.length < 3 || to.length < 3) {
      setStatus("idle");
      setSummary(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    const timer = setTimeout(async () => {
      const [a, b] = await Promise.all([geocode(from), geocode(to)]);
      if (cancelled) return;
      if (!a || !b) {
        setStatus("notfound");
        setSummary(null);
        return;
      }

      const road = await fetchRoute(a, b);
      if (cancelled) return;

      const km = road ? road.km : haversineKm(a, b);
      const hrs = road ? road.hrs : km / 60; // ~60 km/h average fallback
      const estimate = { km, hrs, exact: !!road };
      setSummary(estimate);
      setLabels({ from: a.label, to: b.label });
      setStatus("ready");
      onRouteRef.current?.({ distanceKm: km, durationHrs: hrs, exact: !!road });

      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          scrollWheelZoom: false,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
        }).addTo(mapRef.current);
      }

      if (layerRef.current) layerRef.current.remove();
      const group = L.layerGroup();

      const pin = (color: string) =>
        L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

      L.marker([a.lat, a.lon], { icon: pin("#16a34a") }).addTo(group);
      L.marker([b.lat, b.lon], { icon: pin("#4f46e5") }).addTo(group);

      const line = road
        ? L.polyline(road.coords, { color: "#4f46e5", weight: 3, opacity: 0.85 })
        : L.polyline(
            [
              [a.lat, a.lon],
              [b.lat, b.lon],
            ],
            { color: "#4f46e5", weight: 2.5, dashArray: "6 6", opacity: 0.7 },
          );
      line.addTo(group);

      group.addTo(mapRef.current);
      layerRef.current = group;
      mapRef.current.fitBounds(line.getBounds(), { padding: [24, 24] });
      // Dialog animations can leave leaflet with a stale size
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [origin, destination]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (status === "idle") return null;

  return (
    <div className={className}>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="relative h-44">
          <div ref={containerRef} className="absolute inset-0 z-0" />
          {status === "loading" && (
            <div className="absolute inset-0 z-10 bg-muted/60 backdrop-blur-[1px] flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Locating route…
            </div>
          )}
          {status === "notfound" && (
            <div className="absolute inset-0 z-10 bg-muted/80 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <TriangleAlert className="w-4 h-4" /> Couldn&apos;t find one of the locations
            </div>
          )}
        </div>
        {status === "ready" && summary && (
          <div className="px-3 py-2 border-t border-border bg-card flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="truncate">{labels?.from} → {labels?.to}</span>
            </div>
            <div className="shrink-0 font-black text-foreground">
              {Math.round(summary.km).toLocaleString()} km
              <span className="text-muted-foreground font-bold"> · ~{Math.round(summary.hrs)} h{summary.exact ? "" : " (est.)"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
