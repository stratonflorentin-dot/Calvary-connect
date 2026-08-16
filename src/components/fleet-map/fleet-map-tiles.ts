import type { TileLayerOptions } from "leaflet";

/**
 * Reliable basemap providers, all free/no API key. Dark Matter leads to
 * match this app's dark theme (the 3D view uses the same CARTO dark style —
 * see fleet-map-3d-canvas.tsx) instead of a light tan map sitting inside a
 * dark dashboard; plain OSM/CARTO Voyager stay as fallbacks purely for
 * uptime if CARTO's dark tiles are ever unavailable.
 */
export const FLEET_MAP_TILE_LAYERS: {
  id: string;
  url: string;
  options: TileLayerOptions;
}[] = [
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
