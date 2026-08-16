"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FleetMapDriver } from "@/components/fleet-map/types";
import { calculateGeodesicDistance } from "@/lib/geo-utils";

// ─── Static reference locations ──────────────────────────────────────────────
const BORDER_POINTS = [
  { name: "Namanga",  coords: [-2.5276,  36.7873] as [number, number] },
  { name: "Tunduma",  coords: [-9.3042,  32.7765] as [number, number] },
  { name: "Sirari",   coords: [-1.4769,  34.0539] as [number, number] },
];

const MAJOR_CITIES = [
  { name: "Dar es Salaam", coords: [-6.7924, 39.2083] as [number, number] },
  { name: "Arusha",        coords: [-3.3667, 36.683]  as [number, number] },
  { name: "Mwanza",        coords: [-2.5164, 32.8983] as [number, number] },
  { name: "Dodoma",        coords: [-6.163,  35.7516] as [number, number] },
];

// MapTiler's "Dataviz Dark" vector style — richer basemap detail (buildings,
// terrain-aware roads, POI labelling) than the free CARTO tiles, used when a
// key is configured. CARTO Dark Matter (free, no key, same dark palette)
// stays as the fallback so the map keeps working even if the MapTiler key is
// ever missing, rate-limited, or the request fails.
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
const CARTO_DARK_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const MAP_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
  : CARTO_DARK_STYLE_URL;

// Fallback style if primary fails. When MapTiler is primary, CARTO is a much
// better fallback than MapLibre's blank demo tiles; when CARTO is already
// primary (no MapTiler key), demo tiles remain the last resort.
const FALLBACK_STYLE_URL = MAPTILER_KEY
  ? CARTO_DARK_STYLE_URL
  : "https://demotiles.maplibre.org/style.json";

/** The vector source id carrying OpenMapTiles-schema `building` features
 *  differs between providers — MapLibre needs the right one to resolve the
 *  3D building extrusion layer added below. */
function buildingSourceIdFor(styleUrl: string): string {
  return styleUrl.includes("api.maptiler.com") ? "maptiler_planet" : "carto";
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type FleetMapCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitDrivers: () => void;
  flyToDriver: (lat: number, lng: number, zoom?: number) => void;
};

type Props = {
  locations: FleetMapDriver[];
  defaultCenter: [number, number]; // [lat, lng]
  selectedId: string | null;
  onSelectDriver: (driver: FleetMapDriver) => void;
  cameraMode?: "overview" | "follow" | "follow-3d" | "north-up" | "heading-up";
  /** Called when both the primary and fallback styles fail — the parent
   *  should switch to the 2D Leaflet engine instead of showing a blank map. */
  onFatalError?: (message: string) => void;
};

/** Turn a MapLibre failure into a message that tells the user (and us) which
 *  layer of the stack broke — offline, CSP/blocked provider, or bad style. */
function describeMapFailure(e: { error?: Error; status?: number; url?: string }): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You appear to be offline.";
  }
  const msg = e.error?.message ?? "";
  if (/CSP|Content Security Policy|blocked/i.test(msg)) {
    return "The map provider is blocked by the browser security policy.";
  }
  if (e.status && e.status >= 400) {
    return `The map style provider returned HTTP ${e.status}.`;
  }
  if (/Failed to fetch|NetworkError|load failed/i.test(msg)) {
    return "The map style could not be downloaded (provider unreachable or blocked).";
  }
  return msg || "The map style failed to load.";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** GPS accuracy circle as a GeoJSON polygon (lat/lng → GeoJSON [lng,lat]) */
function makeAccuracyCircle(lat: number, lng: number, radiusM: number) {
  const n = 64;
  const coords: [number, number][] = [];
  const dx = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const dy = radiusM / 110574;
  for (let i = 0; i < n; i++) {
    const θ = (i / n) * 2 * Math.PI;
    coords.push([lng + dx * Math.cos(θ), lat + dy * Math.sin(θ)]);
  }
  coords.push(coords[0]);
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coords] },
    properties: {},
  };
}

/** Vehicle SVG icons */
function vehicleSvg(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("trailer") || t.includes("lowbed")) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M21 8h-2v3h-7V8H4c-1.1 0-2 .9-2 2v6h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5c0-1.66-1.34-3-3-3zm-14 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </svg>`;
  }
  if (t.includes("prime") || t.includes("mover") || t.includes("truck")) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>`;
}

/** Human-readable GPS age */
function gpsAge(lastUpdate: string): string {
  if (!lastUpdate) return "—";
  const s = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/** Minimal attribute-context escape for values interpolated into innerHTML. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Build the DOM element for a driver marker */
function makeMarkerEl(driver: FleetMapDriver, isSelected: boolean): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;cursor:pointer;";

  const col: Record<string, string> = {
    LIVE: "#10b981",
    DELAYED: "#0ea5e9",
    STALE: "#f59e0b",
    OFFLINE: "#64748b",
  };
  const color = col[driver.status] ?? "#64748b";
  const ring = isSelected
    ? "box-shadow:0 0 0 4px rgba(41,82,163,0.55),0 0 22px rgba(41,82,163,0.3);"
    : "box-shadow:0 4px 14px rgba(15,23,42,0.3);";

  const hdg = driver.heading ?? 0;
  const spd = Math.round(driver.speed ?? 0);
  const moving = spd > 2;

  // A real vehicle photo (same field the Fleet page shows) replaces the
  // generic SVG glyph when one exists — rotating a photo to show heading
  // would look broken, so only the SVG fallback gets the heading rotation.
  const photoUrl = driver.vehiclePhotoUrl ? escapeAttr(driver.vehiclePhotoUrl) : null;
  // Both the <img> and its SVG fallback are rendered up front (fallback
  // hidden) — flipping which one is visible on error is a plain style
  // toggle with no embedded markup, unlike an inline handler that tries to
  // splice HTML into an HTML attribute (that broke HTML parsing on the
  // first double-quote inside the SVG and leaked raw CSS text onto the map).
  const iconContent = photoUrl
    ? `<img src="${photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
      <div style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;">
        ${vehicleSvg(driver.vehicleType || "truck")}
      </div>`
    : `<div style="transform:rotate(${hdg}deg);transition:transform 0.4s ease;
        display:flex;align-items:center;justify-content:center;">
        ${vehicleSvg(driver.vehicleType || "truck")}
      </div>`;

  wrap.innerHTML = `
    <div style="position:relative;width:50px;height:50px;">
      <div style="position:relative;width:100%;height:100%;border-radius:50%;
        background:${color};border:3px solid #fff;${ring}overflow:hidden;
        display:flex;align-items:center;justify-content:center;
        color:#fff;transition:box-shadow 0.3s ease;">
        ${iconContent}
      </div>
      ${moving
        ? `<span style="position:absolute;bottom:-3px;right:-3px;width:18px;height:18px;
            background:#fff;border-radius:50%;display:flex;align-items:center;
            justify-content:center;font-size:7px;font-weight:800;color:${color};
            font-family:system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.2);">${spd}</span>`
        : ""
      }
      ${driver.status === "LIVE"
        ? `<span style="position:absolute;top:-2px;right:-2px;width:13px;height:13px;
            background:#6ee7b7;border:2px solid #fff;border-radius:50%;
            animation:fleetPulse3d 1.5s infinite;"></span>`
        : ""
      }
    </div>
    <div style="margin-top:5px;padding:2px 8px;background:#0f172a;color:#fff;
      font-size:10px;font-weight:700;border-radius:6px;white-space:nowrap;
      max-width:110px;overflow:hidden;text-overflow:ellipsis;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:system-ui,sans-serif;">
      ${driver.driverName.split(" ")[0]}
    </div>`;

  if (typeof document !== "undefined" && !document.getElementById("fleet3d-pulse-anim")) {
    const s = document.createElement("style");
    s.id = "fleet3d-pulse-anim";
    s.textContent = `@keyframes fleetPulse3d {
      0%   { transform:scale(0.95); box-shadow:0 0 0 0 rgba(110,231,183,0.7); }
      70%  { transform:scale(1);    box-shadow:0 0 0 7px rgba(110,231,183,0); }
      100% { transform:scale(0.95); box-shadow:0 0 0 0 rgba(110,231,183,0); }
    }`;
    document.head.appendChild(s);
  }

  return wrap;
}

/** Build popup HTML */
function popupHtml(d: FleetMapDriver): string {
  const bgFg: Record<string, string> = {
    LIVE: "#d1fae5|#065f46",
    DELAYED: "#e0f2fe|#0369a1",
    STALE: "#fef3c7|#92400e",
    OFFLINE: "#f1f5f9|#475569",
  };
  const [bg, fg] = (bgFg[d.status] ?? "#f1f5f9|#475569").split("|");
  return `
    <div style="font-family:system-ui,sans-serif;padding:8px;min-width:195px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
        <p style="font-weight:700;font-size:13px;color:#0f172a;margin:0;">${d.driverName}</p>
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;
          background:${bg};color:${fg};">${d.status}</span>
      </div>
      <div style="font-size:11px;color:#475569;line-height:1.65;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
          <div><b>Speed:</b> ${Math.round(d.speed ?? 0)} km/h</div>
          <div><b>GPS:</b> ${d.accuracy ? `±${Math.round(d.accuracy)}m` : "—"}</div>
          <div><b>Updated:</b> ${gpsAge(d.lastUpdate)}</div>
          <div><b>Type:</b> ${d.vehicleType ?? "truck"}</div>
        </div>
        ${d.latitude
          ? `<div style="margin-top:5px;font-size:10px;color:#94a3b8;">
              ${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}
            </div>`
          : ""}
      </div>
    </div>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FleetMap3DCanvas = forwardRef<FleetMapCanvasHandle, Props>(
  function FleetMap3DCanvas(
    { locations, defaultCenter, selectedId, onSelectDriver, cameraMode = "follow-3d", onFatalError },
    ref,
  ) {
    const containerRef  = useRef<HTMLDivElement>(null);
    const mapRef        = useRef<maplibregl.Map | null>(null);
    const markersRef    = useRef<Map<string, maplibregl.Marker>>(new Map());
    const staticRef     = useRef<maplibregl.Marker[]>([]);
    const prevPos       = useRef<Map<string, [number, number]>>(new Map());
    const mapReady      = useRef(false);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [styleLoaded, setStyleLoaded] = useState(false);
    // Set once the user drags/scrolls the map by hand — while true, the
    // follow-camera effect below backs off instead of yanking the view back
    // to the selected driver on every GPS poll, which otherwise made it
    // impossible to pan away and look at the rest of the fleet. Cleared on
    // a fresh selection or an explicit "Center on driver" / fitAll action.
    const userPannedRef = useRef(false);

    // ── Camera helpers ─────────────────────────────────────────────────────
    const fitAll = () => {
      const map = mapRef.current;
      if (!map || locations.length === 0) return;
      userPannedRef.current = false;
      const b = new maplibregl.LngLatBounds();
      locations.forEach((l) => b.extend([l.longitude, l.latitude]));
      map.fitBounds(b, { padding: 100, maxZoom: 13, duration: 1000 });
    };

    useImperativeHandle(ref, () => ({
      zoomIn:  () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
      fitDrivers: fitAll,
      flyToDriver: (lat, lng, zoom = 14.5) => {
        userPannedRef.current = false;
        mapRef.current?.flyTo({
          center: [lng, lat], // MapLibre: [lng, lat]
          zoom,
          pitch: 52,
          essential: true,
          duration: 1400,
        });
      },
    }));

    // ── Smooth marker animation ────────────────────────────────────────────
    const animateMarker = (
      marker: maplibregl.Marker,
      from: [number, number], // [lat, lng]
      to: [number, number],
      ms = 900,
    ) => {
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - t0) / ms, 1);
        const ease = 1 - Math.pow(1 - p, 3); // cubic ease-out
        marker.setLngLat([
          from[1] + (to[1] - from[1]) * ease,
          from[0] + (to[0] - from[0]) * ease,
        ]);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    // ── Map init ──────────────────────────────────────────────────────────
    useEffect(() => {
      const el = containerRef.current;
      if (!el || mapRef.current) return;

      let mapInstance: maplibregl.Map | null = null;
      let usingFallback = false;

      const initMap = (styleUrl: string, isFallback: boolean = false) => {
        console.log(`[MapLibre] Initializing map with ${isFallback ? 'fallback' : 'primary'} style:`, styleUrl);

        const map = new maplibregl.Map({
          container: el,
          style: styleUrl,
          center: [defaultCenter[1], defaultCenter[0]], // [lng, lat]
          zoom: locations.length > 0 ? 10 : 6.5,
          pitch: isFallback ? 0 : 48, // Disable 3D for fallback
          bearing: 0,
        });

        mapRef.current = map;
        mapInstance = map;
        usingFallback = isFallback;

        map.addControl(
          new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
          "top-left",
        );

        // Only real, hands-on input counts — MapLibre's own programmatic
        // easeTo()/flyTo() calls (the follow-camera below) also fire these
        // events, but without `originalEvent` since nothing was physically
        // dragged/scrolled/pinched.
        const onUserInteraction = (e: { originalEvent?: unknown }) => {
          if (e.originalEvent) userPannedRef.current = true;
        };
        map.on("dragstart", onUserInteraction);
        map.on("zoomstart", onUserInteraction);
        map.on("rotatestart", onUserInteraction);
        map.on("pitchstart", onUserInteraction);
        map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

        map.on("error", (e: any) => {
          console.error("[MapLibre Error]", {
            errorMessage: e.error?.message,
            sourceId: e.source?.id,
            status: e.status,
            url: e.url,
          });

          // Individual tile errors are transient — only style-level failures
          // (no source id) warrant fallback or escalation.
          if (e.source?.id) return;

          const reason = describeMapFailure(e);

          if (!usingFallback) {
            console.warn("[MapLibre] Primary style failed, trying fallback style…");
            if (mapInstance) {
              mapInstance.remove();
              mapRef.current = null;
            }
            initMap(FALLBACK_STYLE_URL, true);
          } else {
            setLoadErr(reason);
            // Both styles failed — hand control back to the parent for 2D fallback
            onFatalError?.(reason);
          }
        });

        map.on("load", () => {
          mapReady.current = true;
          setStyleLoaded(true);

          // 3D building extrusions (only for primary style)
          if (!isFallback) {
            const layers = map.getStyle()?.layers ?? [];
            let labelId = "";
            for (const layer of layers) {
              if (layer.type === "symbol" && (layer.layout as any)?.["text-field"]) {
                labelId = layer.id;
                break;
              }
            }
            try {
              map.addLayer(
                {
                  id: "3d-buildings",
                  source: buildingSourceIdFor(styleUrl),
                  "source-layer": "building",
                  type: "fill-extrusion",
                  minzoom: 14,
                  paint: {
                    "fill-extrusion-color": [
                      "interpolate", ["linear"],
                      ["coalesce", ["get", "height"], 0],
                      0,   "#dde6f0",
                      15,  "#c8d8e8",
                      40,  "#aabfd4",
                      80,  "#8aa5bc",
                      200, "#6b8ea8",
                    ],
                    "fill-extrusion-height": [
                      "interpolate", ["linear"], ["zoom"],
                      14, 0,
                      14.1, ["coalesce", ["get", "render_height"], ["get", "height"], 10],
                    ],
                    "fill-extrusion-base": [
                      "interpolate", ["linear"], ["zoom"],
                      14, 0,
                      14.1, ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
                    ],
                    "fill-extrusion-opacity": 0.72,
                  },
                },
                labelId || undefined,
              );
            } catch (e) {
              console.warn("[3D buildings]", e);
            }
          }

          // GPS accuracy circle layers
          map.addSource("accuracy-src", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "accuracy-fill",
            type: "fill",
            source: "accuracy-src",
            paint: { "fill-color": "#0284c7", "fill-opacity": 0.12 },
          });
          map.addLayer({
            id: "accuracy-line",
            type: "line",
            source: "accuracy-src",
            paint: {
              "line-color": "#0284c7",
              "line-width": 1.5,
              "line-dasharray": [2, 2],
            },
          });

          // Static markers — border points
          BORDER_POINTS.forEach((p) => {
            const el = document.createElement("div");
            el.innerHTML = `<div style="width:26px;height:26px;border-radius:50%;background:#0ea5e9;
              border:2px solid #fff;display:flex;align-items:center;justify-content:center;
              color:#fff;font-size:10px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.2);
              font-family:system-ui,sans-serif;">${p.name[0]}</div>`;
            const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
              `<p style="font-family:system-ui;margin:0;font-size:12px;font-weight:700;
                color:#0f172a;">${p.name} Border</p>`,
            );
            staticRef.current.push(
              new maplibregl.Marker({ element: el })
                .setLngLat([p.coords[1], p.coords[0]])
                .setPopup(popup)
                .addTo(map),
            );
          });

          // Static markers — cities
          MAJOR_CITIES.forEach((c) => {
            const el = document.createElement("div");
            el.innerHTML = `<div style="width:22px;height:22px;border-radius:50%;background:#6366f1;
              border:2px solid #fff;display:flex;align-items:center;justify-content:center;
              color:#fff;font-size:9px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,0.15);
              font-family:system-ui,sans-serif;">${c.name[0]}</div>`;
            const popup = new maplibregl.Popup({ offset: 10 }).setHTML(
              `<p style="font-family:system-ui;margin:0;font-size:12px;font-weight:700;
                color:#0f172a;">${c.name}</p>`,
            );
            staticRef.current.push(
              new maplibregl.Marker({ element: el })
                .setLngLat([c.coords[1], c.coords[0]])
                .setPopup(popup)
                .addTo(map),
            );
          });
        });
      };

      // Initialize map with primary style. A synchronous throw here usually
      // means WebGL is unavailable or the blob: worker was blocked by CSP.
      try {
        initMap(MAP_STYLE_URL, false);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "3D map engine failed to start.";
        setLoadErr(reason);
        onFatalError?.(reason);
      }

      // Keep the canvas sized to its container (sidebar/tab/layout changes)
      const resizeObserver = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      resizeObserver.observe(el);

      return () => {
        resizeObserver.disconnect();
        staticRef.current.forEach((m) => m.remove());
        staticRef.current = [];
        markersRef.current.forEach((m) => m.remove());
        markersRef.current.clear();
        mapRef.current?.remove();
        mapRef.current = null;
        mapReady.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Driver markers sync ────────────────────────────────────────────────
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      // ⚠️ Key fix: use driver.id — FleetMapDriver does NOT have driverId
      const activeIds = new Set(locations.map((l) => l.id));

      markersRef.current.forEach((marker, id) => {
        if (!activeIds.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
          prevPos.current.delete(id);
        }
      });

      locations.forEach((driver) => {
        const isSel = driver.id === selectedId;
        const key   = driver.id;
        const cur: [number, number] = [driver.latitude, driver.longitude];
        const prev  = prevPos.current.get(key);
        const exist = markersRef.current.get(key);

        if (exist) {
          // Update in place — MapLibre's Marker keeps positioning the
          // exact DOM element it was constructed with (it applies its
          // translate transform to that node directly, not to whatever
          // currently occupies its slot in the DOM). Swapping in a new
          // element via replaceWith() left the new node with no transform
          // at all, so it fell into normal document flow and every
          // marker collapsed into a vertical stack in list order after
          // its first update. Only the element's contents change here —
          // the node MapLibre tracks stays the same.
          const el = exist.getElement();
          el.innerHTML = makeMarkerEl(driver, isSel).innerHTML;
          el.onclick = () => onSelectDriver(driver);
          exist.getPopup()?.setHTML(popupHtml(driver));

          if (prev) {
            const dist = calculateGeodesicDistance(prev[0], prev[1], cur[0], cur[1]);
            if (dist > 0.5 && dist < 800) {
              animateMarker(exist, prev, cur, 900);
            } else {
              // Teleport for large jumps or zero movement
              exist.setLngLat([driver.longitude, driver.latitude]);
            }
          } else {
            exist.setLngLat([driver.longitude, driver.latitude]);
          }
        } else {
          const el = makeMarkerEl(driver, isSel);
          el.addEventListener("click", () => onSelectDriver(driver));

          const popup = new maplibregl.Popup({ offset: 26 }).setHTML(popupHtml(driver));

          const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([driver.longitude, driver.latitude])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.set(key, marker);
        }

        prevPos.current.set(key, cur);
      });
    }, [locations, selectedId, onSelectDriver]);

    // ── Accuracy circle + smart camera ────────────────────────────────────
    const prevSelectedIdRef = useRef<string | null>(null);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady.current) return;

      // A fresh selection always earns one recenter, even if the user had
      // panned away looking at a different truck.
      if (prevSelectedIdRef.current !== selectedId) {
        userPannedRef.current = false;
        prevSelectedIdRef.current = selectedId;
      }

      const sel    = locations.find((l) => l.id === selectedId);
      const source = map.getSource("accuracy-src") as maplibregl.GeoJSONSource | undefined;

      if (sel && source) {
        if (sel.accuracy && sel.accuracy > 0 && sel.accuracy <= 5000) {
          source.setData(makeAccuracyCircle(sel.latitude, sel.longitude, sel.accuracy) as any);
        } else {
          source.setData({ type: "FeatureCollection", features: [] });
        }

        // Once the user has manually panned/zoomed/rotated away, further GPS
        // updates shouldn't yank the camera back — that made it impossible
        // to look at the rest of the fleet. "Center on driver" or picking a
        // new truck clears the flag and resumes following.
        if (userPannedRef.current) return;

        const hdg = sel.heading ?? 0;

        switch (cameraMode) {
          case "follow-3d":
            map.easeTo({ center: [sel.longitude, sel.latitude], zoom: 14.5, pitch: 55, bearing: hdg, duration: 900 });
            break;
          case "follow":
            map.easeTo({ center: [sel.longitude, sel.latitude], zoom: 14.5, pitch: 0, bearing: 0, duration: 900 });
            break;
          case "heading-up":
            map.easeTo({ center: [sel.longitude, sel.latitude], bearing: hdg, duration: 900 });
            break;
          case "north-up":
            map.easeTo({ center: [sel.longitude, sel.latitude], bearing: 0, duration: 900 });
            break;
          // "overview" — dispatcher controls the camera freely
        }
      } else if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    }, [selectedId, locations, cameraMode]);

    return (
      <div className="w-full h-full relative">
        <div ref={containerRef} className="w-full h-full" style={{ background: "hsl(var(--background))" }} />
        {!styleLoaded && !loadErr && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 pointer-events-none">
            <p className="text-sm font-medium text-muted-foreground">Loading map…</p>
          </div>
        )}
        {loadErr && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none z-10">
            <p className="text-sm font-medium text-foreground bg-card/90 rounded-xl px-4 py-3 shadow-md">
              ⚠️ {loadErr}
            </p>
          </div>
        )}
      </div>
    );
  },
);
