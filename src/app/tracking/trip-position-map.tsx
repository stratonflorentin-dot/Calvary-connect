"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { FleetMapDriver } from "@/components/fleet-map/types";

/**
 * Live position of one vehicle — not a route/waypoint map (this schema has
 * no geocoded waypoints to plot a path against, see ShippingTab's own
 * comment on that). Raw Leaflet imperative API on a ref'd div, same
 * SSR-safe pattern as src/components/trip/route-preview-map.tsx (a dynamic
 * `import("leaflet")` inside an effect needs no next/dynamic wrapper),
 * rather than react-leaflet's MapContainer — this only ever shows one
 * marker, so the fuller multi-vehicle FleetMapContext machinery in
 * src/components/fleet-map/ isn't a fit here.
 */
export function TripPositionMap({ position }: { position: FleetMapDriver | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!position || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
        }).setView([position.latitude, position.longitude], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
        }).addTo(mapRef.current);
      }

      const color = position.isOnline ? "#5980a6" : "#8c8c8c";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(${position.heading || 0}deg)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      if (!markerRef.current) {
        markerRef.current = L.marker([position.latitude, position.longitude], { icon }).addTo(mapRef.current);
      } else {
        markerRef.current.setLatLng([position.latitude, position.longitude]);
        markerRef.current.setIcon(icon);
      }
      mapRef.current.panTo([position.latitude, position.longitude]);
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
    };
  }, [position]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    },
    []
  );

  if (!position) {
    return (
      <div className="ci-hatch ci-blueprint h-[170px] flex items-center justify-center text-[11px] text-[var(--ci-text-tertiary)]">
        <i className="ci-corner tl" /><i className="ci-corner tr" /><i className="ci-corner bl" /><i className="ci-corner br" />
        no live GPS position for this vehicle yet
      </div>
    );
  }

  return (
    <div className="ci-blueprint relative h-[170px] overflow-hidden">
      <i className="ci-corner tl" /><i className="ci-corner tr" /><i className="ci-corner bl" /><i className="ci-corner br" />
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute bottom-0 left-0 right-0 bg-[color-mix(in_srgb,var(--ci-bg)_85%,transparent)] px-2 py-1 flex items-center justify-between text-[11px] ci-mono">
        <span>{Math.round(position.speed)} km/h</span>
        <span className="text-[var(--ci-text-tertiary)]">{new Date(position.lastUpdate).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}
