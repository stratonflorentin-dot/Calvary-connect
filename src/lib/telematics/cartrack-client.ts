// Server-only Cartrack Fleet API client. Never import this from client
// components — it reads CARTRACK_API_USERNAME/CARTRACK_API_PASSWORD, which
// must stay server-side.
//
// Confirmed live against Calvary's account (2026-08-31): HTTP Basic Auth
// (base64 "username:password") against GET /rest/vehicles/status on the
// "tz" regional host — https://developer.cartrack.com/docs/fleet-api-general.
// The account initially 401'd with "must be a Cartrack Subscriber" even with
// valid credentials; that was an account-level Fleet API entitlement Cartrack
// support had to switch on, not a request-format issue — same wall noted in
// api/telematics/sync/route.ts's original comment. Response fields below are
// copied from the real payload, not the (JS-rendered, unscrapable) docs site.

const CARTRACK_REGION = process.env.CARTRACK_API_REGION || "tz";
const CARTRACK_BASE_URL =
  process.env.CARTRACK_API_BASE_URL || `https://fleetapi-${CARTRACK_REGION}.cartrack.com`;
const CARTRACK_USERNAME = process.env.CARTRACK_API_USERNAME;
const CARTRACK_PASSWORD = process.env.CARTRACK_API_PASSWORD;

export interface CartrackVehicleTelemetry {
  /** Cartrack's own numeric vehicle id — stable, used as the device-id join
   *  key (vehicles.gps_device_id), same role as Wialon's unitId. */
  vehicleId: string;
  /** Plate-style registration, e.g. "T349EQB-CALVARY" — display only. */
  registration: string;
  recordedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  /** Compass heading 0-360 — Cartrack calls this "bearing". */
  heading: number | null;
  /** Cartrack returns this as a real boolean, unlike Wialon's io_239 flag. */
  engineOn: boolean | null;
  odometerKm: number | null;
  fuelPercent: number | null;
  raw: any;
}

function normalizeItem(item: any): CartrackVehicleTelemetry {
  const loc = item.location ?? {};
  return {
    vehicleId: String(item.vehicle_id),
    registration: item.registration ?? "",
    recordedAt: loc.updated ? new Date(loc.updated) : (item.event_ts ? new Date(item.event_ts) : null),
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
    speedKmh: item.speed ?? null,
    heading: item.bearing ?? null,
    engineOn: typeof item.ignition === "boolean" ? item.ignition : null,
    odometerKm: item.odometer != null ? Number(item.odometer) / 1000 : null,
    fuelPercent: item.fuel?.precentage_left ?? null,
    raw: item,
  };
}

/**
 * Fetches current status for every vehicle visible to this Cartrack account,
 * then returns a lookup keyed by the EXACT device-id strings passed in.
 * Confirmed live: the endpoint returns the whole fleet in one call (no
 * per-vehicle id filter parameter found in the response/docs), same
 * "fetch all, filter client-side" shape as the Wialon client.
 *
 * Each requested id is matched against EITHER Cartrack's numeric vehicle_id
 * OR its plate-style registration (e.g. "T349EQB-CALVARY"), case-
 * insensitively for the latter — the vehicle-form-dialog's field is free
 * text labeled "Cartrack vehicle registration/ID", and whoever fills it in
 * is far more likely to type the plate they can read off Cartrack's own
 * dashboard than look up the internal numeric id. Keying the result by the
 * caller's own input string (rather than by whichever field matched) means
 * the caller can look a vehicle up by its stored gps_device_id verbatim,
 * regardless of which representation that turned out to be.
 */
export async function cartrackFetchVehiclesTelemetry(
  deviceIds: string[],
): Promise<Map<string, CartrackVehicleTelemetry>> {
  const result = new Map<string, CartrackVehicleTelemetry>();
  if (deviceIds.length === 0) return result;
  if (!CARTRACK_USERNAME || !CARTRACK_PASSWORD) {
    throw new Error("CARTRACK_API_USERNAME/CARTRACK_API_PASSWORD is not configured");
  }

  const auth = Buffer.from(`${CARTRACK_USERNAME}:${CARTRACK_PASSWORD}`).toString("base64");

  const res = await fetch(`${CARTRACK_BASE_URL}/rest/vehicles/status`, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cartrack /rest/vehicles/status failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const items = (json?.data ?? []) as any[];

  const byVehicleId = new Map(items.map((item) => [String(item.vehicle_id), item]));
  const byRegistration = new Map(
    items.map((item) => [String(item.registration ?? "").trim().toUpperCase(), item]),
  );

  for (const deviceId of deviceIds) {
    const item = byVehicleId.get(deviceId) ?? byRegistration.get(deviceId.trim().toUpperCase());
    if (item) result.set(deviceId, normalizeItem(item));
  }

  return result;
}
