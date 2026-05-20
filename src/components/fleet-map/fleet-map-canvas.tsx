"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { FleetMapDriver } from "@/components/fleet-map/types";
import {
  borderMarkerHtml,
  cityMarkerHtml,
  driverMarkerHtml,
  popupHtml,
} from "@/components/fleet-map/map-markers";

const BORDER_POINTS = [
  { name: "Namanga", coords: [-2.5276, 36.7873] as [number, number] },
  { name: "Tunduma", coords: [-9.3042, 32.7765] as [number, number] },
  { name: "Sirari", coords: [-1.4769, 34.0539] as [number, number] },
];

const MAJOR_CITIES = [
  { name: "Dar es Salaam", coords: [-6.7924, 39.2083] as [number, number] },
  { name: "Arusha", coords: [-3.3667, 36.683] as [number, number] },
  { name: "Mwanza", coords: [-2.5164, 32.8983] as [number, number] },
  { name: "Dodoma", coords: [-6.163, 35.7516] as [number, number] },
];

export type FleetMapCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitDrivers: () => void;
  flyToDriver: (lat: number, lng: number, zoom?: number) => void;
};

type Props = {
  locations: FleetMapDriver[];
  defaultCenter: [number, number];
  selectedId: string | null;
  onSelectDriver: (driver: FleetMapDriver) => void;
};

export const FleetMapCanvas = forwardRef<FleetMapCanvasHandle, Props>(
  function FleetMapCanvas(
    { locations, defaultCenter, selectedId, onSelectDriver },
    ref,
  ) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
    const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
    const staticLayersRef = useRef<import("leaflet").LayerGroup | null>(null);
    const initRef = useRef(false);

    useImperativeHandle(ref, () => ({
      zoomIn: () => mapInstanceRef.current?.zoomIn(),
      zoomOut: () => mapInstanceRef.current?.zoomOut(),
      fitDrivers: () => {
        const map = mapInstanceRef.current;
        if (!map || !locations.length) return;
        import("leaflet").then((L) => {
          const bounds = L.latLngBounds(
            locations.map((l) => [l.latitude, l.longitude]),
          );
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 12 });
        });
      },
      flyToDriver: (lat, lng, zoom = 14) => {
        mapInstanceRef.current?.flyTo([lat, lng], zoom, { duration: 0.8 });
      },
    }));

    useEffect(() => {
      if (!mapRef.current || initRef.current) return;

      const init = async () => {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        if (mapInstanceRef.current) return;
        if (mapRef.current && (mapRef.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) {
          (mapRef.current as HTMLElement & { _leaflet_id?: number })._leaflet_id = undefined;
        }

        const map = L.map(mapRef.current!, {
          center: defaultCenter,
          zoom: 7,
          zoomControl: false,
          attributionControl: true,
        });

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19,
          },
        ).addTo(map);

        const staticLayers = L.layerGroup().addTo(map);

        BORDER_POINTS.forEach((p) => {
          L.marker(p.coords, {
            icon: L.divIcon({
              className: "fleet-static-marker",
              html: borderMarkerHtml(p.name[0]),
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
          })
            .bindPopup(`<p class="text-sm font-medium">${p.name} Border</p>`)
            .addTo(staticLayers);
        });

        MAJOR_CITIES.forEach((c) => {
          L.marker(c.coords, {
            icon: L.divIcon({
              className: "fleet-static-marker",
              html: cityMarkerHtml(c.name[0]),
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          })
            .bindPopup(`<p class="text-sm font-medium">${c.name}</p>`)
            .addTo(staticLayers);
        });

        staticLayersRef.current = staticLayers;
        mapInstanceRef.current = map;
        initRef.current = true;
      };

      init();

      return () => {
        mapInstanceRef.current?.remove();
        mapInstanceRef.current = null;
        markersRef.current.clear();
        staticLayersRef.current = null;
        initRef.current = false;
      };
    }, [defaultCenter]);

    useEffect(() => {
      const sync = async () => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const L = await import("leaflet");

        markersRef.current.forEach((marker, id) => {
          if (!locations.find((l) => l.id === id)) {
            map.removeLayer(marker);
            markersRef.current.delete(id);
          }
        });

        locations.forEach((loc) => {
          const isSelected = selectedId === loc.id;
          const existing = markersRef.current.get(loc.id);

          if (existing) {
            existing.setLatLng([loc.latitude, loc.longitude]);
            existing.setIcon(
              L.divIcon({
                className: "fleet-driver-marker",
                html: driverMarkerHtml(loc.isOnline, isSelected, loc.heading || 0),
                iconSize: [44, 44],
                iconAnchor: [22, 22],
              }),
            );
            existing.setZIndexOffset(isSelected ? 1000 : loc.isOnline ? 500 : 0);
            return;
          }

          const marker = L.marker([loc.latitude, loc.longitude], {
            icon: L.divIcon({
              className: "fleet-driver-marker",
              html: driverMarkerHtml(loc.isOnline, isSelected, loc.heading || 0),
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            }),
            zIndexOffset: isSelected ? 1000 : loc.isOnline ? 500 : 0,
          }).addTo(map);

          marker.bindPopup(
            popupHtml({
              driverName: loc.driverName,
              isOnline: loc.isOnline,
              vehiclePlate: loc.vehiclePlate,
              speed: loc.speed,
              lastUpdate: loc.lastUpdate,
            }),
            { className: "fleet-popup", maxWidth: 260 },
          );

          marker.on("click", () => onSelectDriver(loc));
          markersRef.current.set(loc.id, marker);
        });
      };

      sync();
    }, [locations, selectedId, onSelectDriver]);

    useEffect(() => {
      if (selectedId && mapInstanceRef.current) {
        const loc = locations.find((l) => l.id === selectedId);
        if (loc) {
          mapInstanceRef.current.flyTo([loc.latitude, loc.longitude], 13, {
            duration: 0.6,
          });
        }
      }
    }, [selectedId, locations]);

    return (
      <div
        ref={mapRef}
        className="absolute inset-0 z-0 h-full w-full bg-[#e8eef4]"
      />
    );
  },
);
