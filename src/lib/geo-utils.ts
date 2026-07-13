/**
 * Shared Coordinate Utilities for Calvary Connect
 * Standardizes coordinate formats across Leaflet, GeoJSON, and database queries.
 */

export interface LatLngLike {
  latitude: number;
  longitude: number;
}

export type LeafletLatLng = [number, number]; // [lat, lng]
export type GeoJSONCoordinate = [number, number]; // [lng, lat]

/**
 * Validates coordinate pair.
 * Rejects NaN, infinite, null, undefined, (0,0), and coordinates out of range.
 */
export function isValidCoordinate(latitude: number | null | undefined, longitude: number | null | undefined): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  
  // Reject exact 0,0 (Null Island / initialization default)
  if (latitude === 0 && longitude === 0) return false;
  
  // Lat must be in [-90, 90], Lng must be in [-180, 180]
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  
  return true;
}

/**
 * Converts any coordinate representation to Leaflet format: [lat, lng]
 */
export function toLeafletLatLng(lat: number, lng: number): LeafletLatLng {
  return [lat, lng];
}

/**
 * Converts any coordinate representation to GeoJSON format: [lng, lat]
 */
export function toGeoJSONCoordinate(lat: number, lng: number): GeoJSONCoordinate {
  return [lng, lat];
}

/**
 * Formats a coordinate into a PostGIS point format: 'POINT(longitude latitude)'
 */
export function toPostGISPoint(lat: number, lng: number): string {
  return `POINT(${lng} ${lat})`;
}

/**
 * Calculates the geodesic distance between two points using the Haversine formula (returns meters).
 */
export function calculateGeodesicDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

/**
 * Calculates bearing between two coordinate points in degrees (0-360, where 0/360 is North).
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Calculates speed in km/h based on distance and timestamp difference.
 */
export function calculateSpeedFromPoints(
  lat1: number,
  lng1: number,
  t1: number, // ms
  lat2: number,
  lng2: number,
  t2: number // ms
): number {
  const timeDiffHours = Math.abs(t2 - t1) / (1000 * 60 * 60);
  if (timeDiffHours <= 0) return 0;

  const distanceMeters = calculateGeodesicDistance(lat1, lng1, lat2, lng2);
  const distanceKm = distanceMeters / 1000;

  // Prevent unrealistic speeds (e.g. GPS jumps)
  const speed = distanceKm / timeDiffHours;
  return speed > 200 ? 0 : Math.round(speed * 10) / 10;
}
