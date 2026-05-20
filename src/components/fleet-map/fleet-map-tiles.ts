import type { TileLayerOptions } from "leaflet";

/** Reliable basemap providers (OSM first — works without API keys). */
export const FLEET_MAP_TILE_LAYERS: {
  id: string;
  url: string;
  options: TileLayerOptions;
}[] = [
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
