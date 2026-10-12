import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { wialonLogin, wialonFetchUnitsTelemetry } from "@/lib/telematics/wialon-client";
import { cartrackFetchVehiclesTelemetry } from "@/lib/telematics/cartrack-client";

const ALLOWED_ROLES = ["CEO", "ADMIN", "OPERATOR"];
const ACTIVE_TRIP_STATUSES = ["in_transit", "IN_TRANSIT", "in progress", "IN PROGRESS", "in_progress", "IN_PROGRESS"];

async function getActiveTripByVehicle(admin: ReturnType<typeof supabaseAdmin>) {
  const { data: trips, error } = await admin
    .from("trips")
    .select("id, truck_id, vehicle_id")
    .in("status", ACTIVE_TRIP_STATUSES);
  if (error) throw error;

  const tripIds = (trips ?? []).map((trip: any) => trip.id);
  const { data: assignments, error: assignmentError } = tripIds.length
    ? await admin.from("trip_assignments").select("trip_id, truck_id").in("trip_id", tripIds)
    : { data: [], error: null };
  // Older installs may not have the multi-vehicle assignments table yet;
  // primary truck assignments still provide a safe match in that case.
  if (assignmentError) console.warn("[telematics] Could not load trip assignments:", assignmentError.message);

  const candidateTrips = new Map<string, Set<string>>();
  const attach = (vehicleId: string | null | undefined, tripId: string) => {
    if (!vehicleId) return;
    const ids = candidateTrips.get(vehicleId) ?? new Set<string>();
    ids.add(tripId);
    candidateTrips.set(vehicleId, ids);
  };
  for (const trip of trips ?? []) {
    attach(trip.truck_id, trip.id);
    attach(trip.vehicle_id, trip.id);
  }
  for (const assignment of assignments ?? []) attach(assignment.truck_id, assignment.trip_id);

  // Ambiguous assignments stay unlinked rather than attributing distance to
  // the wrong trip.
  return new Map(
    [...candidateTrips.entries()]
      .filter(([, ids]) => ids.size === 1)
      .map(([vehicleId, ids]) => [vehicleId, [...ids][0]]),
  );
}

/**
 * Two callers are allowed to trigger a sync:
 *  1. A logged-in CEO/ADMIN/OPERATOR from the map page's manual refresh /
 *     60s-while-open interval (existing behaviour, unchanged).
 *  2. The scheduled GitHub Actions workflow (.github/workflows/gps-sync.yml)
 *     presenting the shared CRON_SECRET as a bearer token — Vercel's Hobby
 *     plan only allows once-daily Cron, too infrequent to keep the map
 *     live, so this route is polled externally instead. There's no user
 *     session in that case, so it can't go through the role check below.
 */
async function requireSyncAccess(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("UNAUTHORIZED: missing access token");

  if (process.env.CRON_SECRET && accessToken === process.env.CRON_SECRET) {
    return supabaseAdmin();
  }

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("UNAUTHORIZED: invalid session");

  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error("FORBIDDEN: not authorized to run a GPS sync");
  }
  return admin;
}

/**
 * Pulls live position + ignition telemetry for every vehicle mapped to a
 * gps_provider, writes the current snapshot to vehicle_locations and
 * appends a row to vehicle_telemetry_history (the time series the fuel
 * fraud engine's POSSIBLE_SIPHONING/EXCESSIVE_IDLING rules read).
 *
 * Cartrack support enabled Fleet API/Subscriber access on 2026-08-31
 * (confirmed live against the real account — see cartrack-client.ts);
 * cartrack-mapped vehicles now sync the same way wialon-mapped ones do.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireSyncAccess(request);

    const { data: vehicles, error: vehiclesError } = await admin
      .from("vehicles")
      .select("id, plate_number, gps_provider, gps_device_id")
      .not("gps_provider", "is", null)
      .not("gps_device_id", "is", null)
      .is("deleted_at", null);
    if (vehiclesError) throw vehiclesError;

    const wialonVehicles = (vehicles ?? []).filter((v) => v.gps_provider === "wialon");
    const cartrackVehicles = (vehicles ?? []).filter((v) => v.gps_provider === "cartrack");
    const unsupportedProviders = (vehicles ?? []).filter(
      (v) => v.gps_provider !== "wialon" && v.gps_provider !== "cartrack",
    );

    let synced = 0;
    const errors: string[] = [];
    const activeTripByVehicle = await getActiveTripByVehicle(admin);

    if (wialonVehicles.length > 0) {
      try {
        const sid = await wialonLogin();
        const deviceIds = wialonVehicles.map((v) => v.gps_device_id as string);
        const telemetry = await wialonFetchUnitsTelemetry(sid, deviceIds);
        const byDeviceId = new Map(telemetry.map((t) => [t.unitId, t]));

        for (const vehicle of wialonVehicles) {
          const reading = byDeviceId.get(vehicle.gps_device_id as string);
          if (!reading || reading.latitude == null || reading.longitude == null) continue;

          const engineStatus = reading.engineOn === null ? null : reading.engineOn ? "on" : "off";
          const recordedAt = reading.recordedAt ?? new Date();

          const { error: locErr } = await admin.from("vehicle_locations").upsert(
            {
              vehicle_id: vehicle.id,
              latitude: reading.latitude,
              longitude: reading.longitude,
              speed: reading.speedKmh,
              heading: reading.heading,
              engine_status: engineStatus,
              is_online: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "vehicle_id" },
          );
          if (locErr) { errors.push(`${vehicle.plate_number}: ${locErr.message}`); continue; }

          const { error: histErr } = await admin.from("vehicle_telemetry_history").upsert(
            {
              vehicle_id: vehicle.id,
              source: "wialon",
              recorded_at: recordedAt.toISOString(),
              latitude: reading.latitude,
              longitude: reading.longitude,
              speed_kmh: reading.speedKmh,
              engine_on: reading.engineOn,
              odometer_km: null,
              fuel_level_pct: null,
              trip_id: activeTripByVehicle.get(vehicle.id) ?? null,
              raw: reading.raw,
            },
            { onConflict: "vehicle_id,source,recorded_at", ignoreDuplicates: true },
          );
          if (histErr) { errors.push(`${vehicle.plate_number} history: ${histErr.message}`); continue; }

          await admin.from("vehicles").update({ gps_last_synced_at: new Date().toISOString() }).eq("id", vehicle.id);
          synced++;
        }
      } catch (err: any) {
        errors.push(`Wialon: ${err.message}`);
      }
    }

    if (cartrackVehicles.length > 0) {
      try {
        const deviceIds = cartrackVehicles.map((v) => v.gps_device_id as string);
        const byDeviceId = await cartrackFetchVehiclesTelemetry(deviceIds);

        for (const vehicle of cartrackVehicles) {
          const reading = byDeviceId.get(vehicle.gps_device_id as string);
          if (!reading || reading.latitude == null || reading.longitude == null) continue;

          const engineStatus = reading.engineOn === null ? null : reading.engineOn ? "on" : "off";
          const recordedAt = reading.recordedAt ?? new Date();

          const { error: locErr } = await admin.from("vehicle_locations").upsert(
            {
              vehicle_id: vehicle.id,
              latitude: reading.latitude,
              longitude: reading.longitude,
              speed: reading.speedKmh,
              heading: reading.heading,
              engine_status: engineStatus,
              is_online: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "vehicle_id" },
          );
          if (locErr) { errors.push(`${vehicle.plate_number}: ${locErr.message}`); continue; }

          const { error: histErr } = await admin.from("vehicle_telemetry_history").upsert(
            {
              vehicle_id: vehicle.id,
              source: "cartrack",
              recorded_at: recordedAt.toISOString(),
              latitude: reading.latitude,
              longitude: reading.longitude,
              speed_kmh: reading.speedKmh,
              engine_on: reading.engineOn,
              odometer_km: reading.odometerKm,
              fuel_level_pct: reading.fuelPercent,
              trip_id: activeTripByVehicle.get(vehicle.id) ?? null,
              raw: reading.raw,
            },
            { onConflict: "vehicle_id,source,recorded_at", ignoreDuplicates: true },
          );
          if (histErr) { errors.push(`${vehicle.plate_number} history: ${histErr.message}`); continue; }

          await admin.from("vehicles").update({ gps_last_synced_at: new Date().toISOString() }).eq("id", vehicle.id);
          synced++;
        }
      } catch (err: any) {
        errors.push(`Cartrack: ${err.message}`);
      }
    }

    return NextResponse.json({
      synced,
      totalMapped: vehicles?.length ?? 0,
      skippedUnsupportedProvider: unsupportedProviders.map((v) => ({ plate: v.plate_number, provider: v.gps_provider })),
      errors,
    });
  } catch (error: any) {
    console.error("POST /api/telematics/sync error:", error);
    const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
