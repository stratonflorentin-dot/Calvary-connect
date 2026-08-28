import type { TileLayerOptions } from "leaflet";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

/**
 * Basemap providers, dark-first to match this app's theme (the 3D view uses
 * the same dark palette — see fleet-map-3d-canvas.tsx) instead of a light
 * tan map sitting inside a dark dashboard. MapTiler's "Streets Dark" raster
 * tiles lead when a key is configured (full road/building/POI detail,
 * richer than the free CARTO tiles); CARTO Dark Matter, then plain OSM,
 * stay as no-key fallbacks purely for uptime if MapTiler is ever unavailable.
 */
export const FLEET_MAP_TILE_LAYERS: {
  id: string;
  url: string;
  options: TileLayerOptions;
}[] = [
  ...(MAPTILER_KEY
    ? [
        {
          id: "maptiler-streets-dark",
          url: `https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
          options: {
            attribution:
              '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          } satisfies TileLayerOptions,
        },
      ]
    : []),
  {
    id: "carto-dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    options: {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      subdomains: "abcd",
    },
  },
  {
    id: "osm",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
    },
  },
  {
    id: "osm-de",
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    options: {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    },
  },
  {
    id: "carto",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    options: {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      subdomains: "abcd",
    },
  },
];

/**
 * Satellite imagery basemap — MapTiler when a key is configured (higher
 * resolution, same account as the streets layers above), otherwise Esri
 * World Imagery, a free, keyless, widely-used satellite tile source with no
 * signup required. Kept as a single layer with its own fallback chain
 * (rather than folding into FLEET_MAP_TILE_LAYERS above), since satellite
 * and street are a user-facing toggle, not an availability fallback chain
 * for one "the" basemap.
 */
export const FLEET_MAP_SATELLITE_LAYERS: {
  id: string;
  url: string;
  options: TileLayerOptions;
}[] = [
  ...(MAPTILER_KEY
    ? [
        {
          id: "maptiler-satellite",
          url: `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
          options: {
            attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>',
            maxZoom: 20,
          } satisfies TileLayerOptions,
        },
      ]
    : []),
  {
    id: "esri-world-imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution:
        "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxZoom: 19,
    },
  },
];

/** Transparent place-name/border overlay drawn on top of the satellite
 *  imagery so it reads as a hybrid view instead of an unlabeled photo. */
export const FLEET_MAP_SATELLITE_LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
