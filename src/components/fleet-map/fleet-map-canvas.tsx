"use client";

import "leaflet/dist/leaflet.css";

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
import { FLEET_MAP_TILE_LAYERS } from "@/components/fleet-map/fleet-map-tiles";

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

function scheduleInvalidate(map: import("leaflet").Map) {
  const run = () => {
    map.invalidateSize({ animate: false });
  };
  run();
  requestAnimationFrame(run);
  setTimeout(run, 100);
  setTimeout(run, 400);
  setTimeout(run, 800);
}

export const FleetMapCanvas = forwardRef<FleetMapCanvasHandle, Props>(
  function FleetMapCanvas(
    { locations, defaultCenter, selectedId, onSelectDriver },
    ref,
  ) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
    const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
    const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
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
        map.fitBounds(bounds, { padding: [120, 120], maxZoom: 14 });
        scheduleInvalidate(map);
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
      const el = mapRef.current;
      if (!el || initRef.current) return;

      let map: import("leaflet").Map | null = null;
      let resizeObserver: ResizeObserver | null = null;
      let onWindowResize: (() => void) | null = null;

      const init = async () => {
        const L = await import("leaflet");

        if (initRef.current || mapInstanceRef.current) return;

        const container = mapRef.current;
        if (!container) return;

        if ((container as HTMLElement & { _leaflet_id?: number })._leaflet_id) {
          try { delete (container as HTMLElement & { _leaflet_id?: number })._leaflet_id; } catch(e) {}
        }

        map = L.map(container, {
          center: defaultCenter,
          zoom: locations.length > 0 ? 10 : 7,
          zoomControl: false,
          attributionControl: true,
          preferCanvas: false,
        });

        let fallbackIndex = 0;
        let switchedProvider = false;

        const addTileLayer = (index: number) => {
          if (!map || index >= FLEET_MAP_TILE_LAYERS.length) return;
          const cfg = FLEET_MAP_TILE_LAYERS[index];
          if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);

          const layer = L.tileLayer(cfg.url, cfg.options);
          layer.on("tileerror", () => {
            if (switchedProvider) return;
            fallbackIndex += 1;
            if (fallbackIndex < FLEET_MAP_TILE_LAYERS.length) {
              switchedProvider = true;
              addTileLayer(fallbackIndex);
            }
          });
          layer.addTo(map);
          tileLayerRef.current = layer;
        };

        addTileLayer(0);

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
            .bindPopup(
              `<p style="font-family:system-ui;margin:0;font-size:13px;font-weight:600;">${p.name} Border</p>`,
            )
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
            .bindPopup(
              `<p style="font-family:system-ui;margin:0;font-size:13px;font-weight:600;">${c.name}</p>`,
            )
            .addTo(staticLayers);
        });

        mapInstanceRef.current = map;
        initRef.current = true;

        map.whenReady(() => {
          scheduleInvalidate(map!);
          setMapReady(true);
        });

        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) scheduleInvalidate(mapInstanceRef.current);
        });
        resizeObserver.observe(container);

        onWindowResize = () => {
          if (mapInstanceRef.current) scheduleInvalidate(mapInstanceRef.current);
        };
        window.addEventListener("resize", onWindowResize);
      };

      const startWhenSized = () => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50) {
          init();
        } else {
          requestAnimationFrame(startWhenSized);
        }
      };

      startWhenSized();

      return () => {
        if (onWindowResize) window.removeEventListener("resize", onWindowResize);
        resizeObserver?.disconnect();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.remove();
        }
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
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

          const stateKey = `${loc.isOnline}-${isSelected}`;

          const existing = markersRef.current.get(loc.id);

          if (existing) {
            existing.setLatLng([loc.latitude, loc.longitude]);
            existing.setZIndexOffset(
              isSelected ? 2000 : loc.isOnline ? 1000 : 100,
            );

            if ((existing as any)._customStateKey !== stateKey) {
              existing.setIcon(icon);
              (existing as any)._customStateKey = stateKey;
            }

            const popup = existing.getPopup();
            if (popup) {
              const newHtml = popupHtml({
                driverName: loc.driverName,
                isOnline: loc.isOnline,
                vehiclePlate: loc.vehiclePlate,
                speed: loc.speed,
                lastUpdate: loc.lastUpdate,
              });
              if ((existing as any)._lastPopupHtml !== newHtml) {
                popup.setContent(newHtml);
                (existing as any)._lastPopupHtml = newHtml;
              }
            }
            return;
          }

          const marker = L.marker([loc.latitude, loc.longitude], {
            icon,
            zIndexOffset: isSelected ? 2000 : loc.isOnline ? 1000 : 100,
          }).addTo(map);

          (marker as any)._customStateKey = stateKey;

          const initialPopupHtml = popupHtml({
            driverName: loc.driverName,
            isOnline: loc.isOnline,
            vehiclePlate: loc.vehiclePlate,
            speed: loc.speed,
            lastUpdate: loc.lastUpdate,
          });
          
          (marker as any)._lastPopupHtml = initialPopupHtml;

          marker.bindPopup(
            initialPopupHtml,
            { className: "fleet-popup", maxWidth: 280, autoPan: false },
          );

          marker.on("click", () => onSelectDriver(loc));
          markersRef.current.set(loc.id, marker);
        });

        if (
          locations.length > 0 &&
          lastFitCountRef.current === 0
        ) {
          lastFitCountRef.current = locations.length;
          fitAllDrivers();
        }

        scheduleInvalidate(map);
      };

      sync();
    }, [locations, selectedId, onSelectDriver, mapReady]);

    // Removed automatic flyTo on locations change to prevent map jumping during realtime updates

    return (
      <div className="absolute inset-0 z-[1] h-full w-full min-h-[400px]">
        {!mapReady && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-slate-200/60 pointer-events-none">
            <p className="text-sm font-medium text-slate-600">Starting map…</p>
          </div>
        )}
        <div ref={mapRef} className="h-full w-full min-h-[400px]" />
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
          .fleet-map-root .leaflet-container {
            font-family: inherit;
            background: #cbd5e1 !important;
            height: 100% !important;
            width: 100% !important;
            z-index: 1;
          }
          .fleet-map-root .leaflet-tile-pane {
            z-index: 2;
          }
          .fleet-map-root .leaflet-overlay-pane,
          .fleet-map-root .leaflet-marker-pane {
            z-index: 4;
          }
          .fleet-map-root .leaflet-popup-pane {
            z-index: 5;
          }
          .fleet-popup .leaflet-popup-content-wrapper {
            border-radius: 14px;
            box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
          }
        `}</style>
      </div>
    );
  },
);
