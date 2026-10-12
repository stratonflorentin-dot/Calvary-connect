import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { calculateGeodesicDistance } from "@/lib/geo-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ACTIVE_STATUSES = ["in_transit", "IN_TRANSIT", "in progress", "IN PROGRESS", "in_progress", "IN_PROGRESS"];
const ALLOWED_ROLES = new Set(["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT", "HR", "SALESMAN"]);
const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.has(String(profile.role).toUpperCase())) {
    return NextResponse.json({ success: false, error: "Not authorized to view fleet fuel progress" }, { status: 403 });
  }

  try {
    const { data: trips, error: tripsError } = await admin
      .from("trips")
      .select("id, trip_number, origin, destination, truck_id, vehicle_id, estimated_distance, distance_km, status")
      .in("status", ACTIVE_STATUSES)
      .limit(100);
    if (tripsError) throw tripsError;
    const tripRows = trips ?? [];
    if (tripRows.length === 0) return NextResponse.json({ success: true, data: [] });

    const tripIds = tripRows.map((trip) => trip.id);
    const { data: extraAssignments, error: assignmentsError } = await admin
      .from("trip_assignments")
      .select("trip_id, truck_id")
      .in("trip_id", tripIds);
    if (assignmentsError) console.warn("[trip-fuel-progress] Trip assignments unavailable:", assignmentsError.message);

    const vehiclesByTrip = new Map<string, Set<string>>();
    for (const trip of tripRows) {
      const assigned = new Set<string>();
      if (trip.truck_id) assigned.add(trip.truck_id);
      if (trip.vehicle_id) assigned.add(trip.vehicle_id);
      if (assigned.size) vehiclesByTrip.set(trip.id, assigned);
    }
    for (const assignment of extraAssignments ?? []) {
      if (!assignment.truck_id) continue;
      const assigned = vehiclesByTrip.get(assignment.trip_id) ?? new Set<string>();
      assigned.add(assignment.truck_id);
      vehiclesByTrip.set(assignment.trip_id, assigned);
    }

    const vehicleIds = [...new Set([...vehiclesByTrip.values()].flatMap((set) => [...set]))];
    const { data: vehicles, error: vehiclesError } = vehicleIds.length
      ? await admin.from("vehicles").select("id, plate_number, fuel_capacity").in("id", vehicleIds)
      : { data: [], error: null };
    if (vehiclesError) throw vehiclesError;
    const vehicleById = new Map((vehicles ?? []).map((vehicle) => [vehicle.id, vehicle]));

    const data = await Promise.all(tripRows.flatMap((trip) =>
      [...(vehiclesByTrip.get(trip.id) ?? [])].map(async (vehicleId) => {
        const vehicle = vehicleById.get(vehicleId);
        const { data: samples, error: samplesError } = await admin
          .from("vehicle_telemetry_history")
          .select("recorded_at, latitude, longitude, odometer_km, fuel_level_pct")
          .eq("trip_id", trip.id)
          .eq("vehicle_id", vehicleId)
          .order("recorded_at", { ascending: true })
          .limit(5000);
        if (samplesError) throw samplesError;

        const points = samples ?? [];
        const first = points[0];
        const last = points.at(-1);
        let distanceKm: number | null = null;
        let distanceSource: "odometer" | "gps" | null = null;
        const firstOdometer = numberOrNull(first?.odometer_km);
        const lastOdometer = numberOrNull(last?.odometer_km);
        if (firstOdometer !== null && lastOdometer !== null && lastOdometer >= firstOdometer) {
          distanceKm = lastOdometer - firstOdometer;
          distanceSource = "odometer";
        } else {
          let gpsDistanceMeters = 0;
          for (let index = 1; index < points.length; index++) {
            const previous = points[index - 1];
            const current = points[index];
            const lat1 = numberOrNull(previous.latitude);
            const lon1 = numberOrNull(previous.longitude);
            const lat2 = numberOrNull(current.latitude);
            const lon2 = numberOrNull(current.longitude);
            const time1 = new Date(previous.recorded_at).getTime();
            const time2 = new Date(current.recorded_at).getTime();
            if (lat1 === null || lon1 === null || lat2 === null || lon2 === null || time2 <= time1) continue;
            const segment = calculateGeodesicDistance(lat1, lon1, lat2, lon2);
            const elapsedHours = (time2 - time1) / 3_600_000;
            // Discard implausible jumps instead of inflating the trip mileage.
            if (segment <= elapsedHours * 130_000 + 1_000) gpsDistanceMeters += segment;
          }
          if (gpsDistanceMeters > 0) {
            distanceKm = gpsDistanceMeters / 1000;
            distanceSource = "gps";
          }
        }

        let fuelUsedLitres: number | null = null;
        let fuelBasis: "sensor" | "observed-efficiency" | "unavailable" = "unavailable";
        let fuelRemainingLitres: number | null = null;
        const tankCapacity = numberOrNull(vehicle?.fuel_capacity);
        const startPct = numberOrNull(first?.fuel_level_pct);
        const currentPct = numberOrNull(last?.fuel_level_pct);
        if (tankCapacity && tankCapacity > 0 && startPct !== null && currentPct !== null && first && last) {
          fuelRemainingLitres = tankCapacity * currentPct / 100;
          const { data: fills, error: fillsError } = await admin
            .from("fuel_logs")
            .select("litres, created_at")
            .eq("trip_id", trip.id)
            .eq("vehicle_id", vehicleId)
            .gte("created_at", first.recorded_at)
            .lte("created_at", last.recorded_at);
          if (fillsError) throw fillsError;
          const dispensedLitres = (fills ?? []).reduce((sum, fill) => sum + (numberOrNull(fill.litres) ?? 0), 0);
          const sensorBurn = tankCapacity * startPct / 100 + dispensedLitres - fuelRemainingLitres;
          if (sensorBurn >= 0 && sensorBurn <= tankCapacity + dispensedLitres) {
            fuelUsedLitres = sensorBurn;
            fuelBasis = "sensor";
          }
        }

        if (fuelUsedLitres === null && distanceKm !== null && distanceKm > 0) {
          const { data: history, error: historyError } = await admin
            .from("fuel_logs")
            .select("efficiency_km_l")
            .eq("vehicle_id", vehicleId)
            .gt("efficiency_km_l", 0)
            .order("fuel_date", { ascending: false })
            .limit(12);
          if (historyError) throw historyError;
          const efficiencies = (history ?? []).map((row) => numberOrNull(row.efficiency_km_l)).filter((value): value is number => value !== null && value > 0);
          if (efficiencies.length > 0) {
            const observedKmPerLitre = efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length;
            fuelUsedLitres = distanceKm / observedKmPerLitre;
            fuelBasis = "observed-efficiency";
          }
        }

        const plannedKm = numberOrNull(trip.estimated_distance) ?? numberOrNull(trip.distance_km);
        return {
          tripId: trip.id,
          tripNumber: trip.trip_number,
          origin: trip.origin,
          destination: trip.destination,
          status: trip.status,
          vehicleId,
          plateNumber: vehicle?.plate_number ?? "Vehicle",
          plannedKm,
          distanceKm,
          distanceSource,
          fuelUsedLitres,
          fuelRemainingLitres,
          fuelLevelPct: currentPct,
          fuelBasis,
          lastTelemetryAt: last?.recorded_at ?? null,
        };
      }),
    ));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("GET /api/trips/fuel-progress error:", error);
    return NextResponse.json({ success: false, error: error?.message ?? "Could not load trip fuel progress" }, { status: 500 });
  }
}
