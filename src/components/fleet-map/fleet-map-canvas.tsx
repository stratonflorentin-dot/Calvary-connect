"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { FleetMapDriver } from "@/components/fleet-map/types";
import {
  borderMarkerHtml,
  cityMarkerHtml,
  driverMarkerHtml,
  popupHtml,
  DRIVER_MARKER_SIZE,
  DRIVER_MARKER_ANCHOR,
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
    const initRef = useRef(false);
    const [mapReady, setMapReady] = useState(false);
    const lastFitCountRef = useRef(0);

    const fitAllDrivers = () => {
      const map = mapInstanceRef.current;
      if (!map || !locations.length) return;
      import("leaflet").then((L) => {
        const bounds = L.latLngBounds(
          locations.map((l) => [l.latitude, l.longitude] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [100, 100], maxZoom: 14 });
      });
    };

    useImperativeHandle(ref, () => ({
      zoomIn: () => mapInstanceRef.current?.zoomIn(),
      zoomOut: () => mapInstanceRef.current?.zoomOut(),
      fitDrivers: fitAllDrivers,
      flyToDriver: (lat, lng, zoom = 15) => {
        mapInstanceRef.current?.flyTo([lat, lng], zoom, { duration: 0.8 });
      },
    }));

    useEffect(() => {
      if (!mapRef.current || initRef.current) return;

      const init = async () => {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        if (mapInstanceRef.current) return;

        const el = mapRef.current;
        if (el && (el as HTMLElement & { _leaflet_id?: number })._leaflet_id) {
          (el as HTMLElement & { _leaflet_id?: number })._leaflet_id = undefined;
        }

        const map = L.map(el!, {
          center: defaultCenter,
          zoom: 7,
          zoomControl: false,
          attributionControl: true,
        });

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
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
            .bindPopup(`<p style="font-family:system-ui;margin:0;font-size:13px;font-weight:600;">${p.name} Border</p>`)
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
            .bindPopup(`<p style="font-family:system-ui;margin:0;font-size:13px;font-weight:600;">${c.name}</p>`)
            .addTo(staticLayers);
        });

        mapInstanceRef.current = map;
        initRef.current = true;
        setMapReady(true);
      };

      init();

      return () => {
        mapInstanceRef.current?.remove();
        mapInstanceRef.current = null;
        markersRef.current.clear();
        initRef.current = false;
        setMapReady(false);
      };
    }, [defaultCenter]);

    useEffect(() => {
      if (!mapReady) return;

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
          const icon = L.divIcon({
            className: "fleet-driver-marker",
            html: driverMarkerHtml(loc.driverName, loc.isOnline, isSelected),
            iconSize: DRIVER_MARKER_SIZE,
            iconAnchor: DRIVER_MARKER_ANCHOR,
          });

          const existing = markersRef.current.get(loc.id);

          if (existing) {
            existing.setLatLng([loc.latitude, loc.longitude]);
            existing.setIcon(icon);
            existing.setZIndexOffset(isSelected ? 2000 : loc.isOnline ? 1000 : 100);
            return;
          }

          const marker = L.marker([loc.latitude, loc.longitude], {
            icon,
            zIndexOffset: isSelected ? 2000 : loc.isOnline ? 1000 : 100,
          }).addTo(map);

          marker.bindPopup(
            popupHtml({
              driverName: loc.driverName,
              isOnline: loc.isOnline,
              vehiclePlate: loc.vehiclePlate,
              speed: loc.speed,
              lastUpdate: loc.lastUpdate,
            }),
            { className: "fleet-popup", maxWidth: 280 },
          );

          marker.on("click", () => onSelectDriver(loc));
          markersRef.current.set(loc.id, marker);
        });

        if (locations.length > 0 && locations.length !== lastFitCountRef.current) {
          lastFitCountRef.current = locations.length;
          fitAllDrivers();
        }
      };

      sync();
    }, [locations, selectedId, onSelectDriver, mapReady]);

    useEffect(() => {
      if (!mapReady || !selectedId) return;
      const loc = locations.find((l) => l.id === selectedId);
      if (loc && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([loc.latitude, loc.longitude], 15, {
          duration: 0.6,
        });
      }
    }, [selectedId, locations, mapReady]);

    return (
      <>
        <div
          ref={mapRef}
          className="absolute inset-0 z-0 h-full w-full bg-[#e8eef4]"
        />
        <style jsx global>{`
          @keyframes fleet-pulse {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            70% {
              transform: scale(1.8);
              opacity: 0;
            }
            100% {
              transform: scale(1.8);
              opacity: 0;
            }
          }
          .fleet-driver-marker,
          .fleet-static-marker {
            background: transparent !important;
            border: none !important;
          }
          .fleet-popup .leaflet-popup-content-wrapper {
            border-radius: 14px;
            box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
          }
          .leaflet-container {
            font-family: inherit;
            background: #e8eef4;
          }
        `}</style>
      </>
    );
  },
);
