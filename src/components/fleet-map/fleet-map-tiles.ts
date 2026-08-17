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
