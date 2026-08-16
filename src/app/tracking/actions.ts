"use server";

import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

const MANAGER_ROLES = ["CEO", "ADMIN", "HR", "OPERATOR"];

function isDriverRole(role: unknown) {
  return String(role || "").toUpperCase() === "DRIVER";
}

function isManagerRole(role: unknown) {
  return MANAGER_ROLES.includes(String(role || "").toUpperCase());
}

async function resolveAuthUser(accessToken: string) {
  const admin = getAdminClient();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("Invalid session");
  return { admin, user };
}

async function verifyManager(
  admin: ReturnType<typeof getAdminClient>,
  userId?: string,
  email?: string | null,
  clientRole?: string | null,
  isAdminBypass?: boolean,
) {
  if (isAdminBypass) return true;
  if (
    clientRole &&
    isManagerRole(clientRole) &&
    email &&
    (userId || email)
  ) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .ilike("email", email.toLowerCase().trim())
      .maybeSingle();
    if (profile && isManagerRole(profile.role)) return true;
  }

  if (userId) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role, email")
      .eq("id", userId)
      .maybeSingle();
    if (profile && isManagerRole(profile.role)) return true;
  }

  if (email) {
    const normalized = email.toLowerCase().trim();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role, email")
      .ilike("email", normalized)
      .maybeSingle();
    if (profile && isManagerRole(profile.role)) return true;
  }

  throw new Error("Not authorized to view driver locations");
}

async function findDriverProfile(
  admin: ReturnType<typeof getAdminClient>,
  authUserId: string,
  authEmail: string,
) {
  const normalizedEmail = authEmail.toLowerCase().trim();

  const { data: byId } = await admin
    .from("user_profiles")
    .select("id, role, email")
    .eq("id", authUserId)
    .maybeSingle();

  if (byId && isDriverRole(byId.role)) {
    if (byId.id !== authUserId) {
      await admin
        .from("user_profiles")
        .update({ id: authUserId, updated_at: new Date().toISOString() })
        .eq("email", byId.email);
    }
    return byId;
  }

  const { data: byEmail } = await admin
    .from("user_profiles")
    .select("id, role, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (!byEmail || !isDriverRole(byEmail.role)) return null;

  if (byEmail.id !== authUserId) {
    await admin
      .from("user_profiles")
      .update({ id: authUserId, updated_at: new Date().toISOString() })
      .ilike("email", normalizedEmail);
  }

  return { ...byEmail, id: authUserId };
}

import { isValidCoordinate } from "@/lib/geo-utils";

export type DriverLocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitude_accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  trip_id?: string | null;
  vehicle_type?: string | null;
  is_active?: boolean;
};

export type MapDriverLocation = {
  id: string;
  driverId: string;
  driverName: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  vehicleType: string;
  isOnline: boolean;
  status: "LIVE" | "DELAYED" | "STALE" | "OFFLINE";
  lastUpdate: string;
  vehiclePlate: string;
  hasGps: boolean;
};

/** Persist driver GPS using service role (avoids RLS / profile-id mismatches). */
export async function upsertDriverLocationAction(
  accessToken: string,
  payload: DriverLocationPayload,
) {
  if (!accessToken) throw new Error("Not authenticated");

  const { admin, user } = await resolveAuthUser(accessToken);
  const profile = await findDriverProfile(admin, user.id, user.email || "");

  if (!profile) {
    throw new Error("Only drivers can report location");
  }

  // 1. Coordinate range and Null Island validation
  if (!isValidCoordinate(payload.latitude, payload.longitude)) {
    throw new Error(`Invalid GPS coordinates rejected: ${payload.latitude}, ${payload.longitude}`);
  }

  // 2. Call secure stored procedure to update current location and insert history row
  const { error } = await admin.rpc("upsert_driver_location", {
    p_driver_id: user.id,
    p_latitude: payload.latitude,
    p_longitude: payload.longitude,
    p_accuracy: payload.accuracy ?? null,
    p_altitude: payload.altitude ?? null,
    p_altitude_accuracy: payload.altitude_accuracy ?? null,
    p_speed: payload.speed ?? null,
    p_heading: payload.heading ?? null,
    p_trip_id: payload.trip_id ?? null,
    p_vehicle_type: payload.vehicle_type || "truck",
  });

  if (error) throw new Error(error.message);
  return true;
}

function buildLocationRows(
  admin: ReturnType<typeof getAdminClient>,
  locationsData: Record<string, any>[],
  driverProfiles: { id: string; name?: string; email?: string; role?: string }[],
  authByEmail: Map<string, string>,
) {
  const nameByDriverId = new Map<string, string>();
  const profileIds = new Set<string>();

  for (const d of driverProfiles) {
    profileIds.add(d.id);
    nameByDriverId.set(d.id, d.name || d.email || "Driver");
    const authId = d.email
      ? authByEmail.get(String(d.email).toLowerCase().trim())
      : undefined;
    if (authId) {
      profileIds.add(authId);
      nameByDriverId.set(authId, d.name || d.email || "Driver");
    }
  }

  const locations: MapDriverLocation[] = [];
  const seenDriverIds = new Set<string>();

  for (const loc of locationsData) {
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    if (!isValidCoordinate(lat, lng)) continue;

    const driverId = String(loc.driver_id);
    const driverName =
      nameByDriverId.get(driverId) || `Driver ${driverId.slice(0, 8)}`;

    const lastUpdatedTime = new Date(String(loc.last_updated || 0)).getTime();
    const staleMs = Date.now() - lastUpdatedTime;
    
    // Freshness status rules
    let status: "LIVE" | "DELAYED" | "STALE" | "OFFLINE" = "OFFLINE";
    if (loc.is_active) {
      if (staleMs <= 30000) {
        status = "LIVE";
      } else if (staleMs <= 120000) {
        status = "DELAYED";
      } else if (staleMs <= 600000) {
        status = "STALE";
      }
    }
    
    const isOnline = status === "LIVE" || status === "DELAYED";

    if (seenDriverIds.has(driverId)) continue;
    seenDriverIds.add(driverId);

    locations.push({
      id: String(loc.id || driverId),
      driverId,
      driverName,
      latitude: lat,
      longitude: lng,
      heading: Number(loc.heading) || 0,
      speed: Number(loc.speed) || 0,
      accuracy: loc.accuracy !== null ? Number(loc.accuracy) : null,
      altitude: loc.altitude !== null ? Number(loc.altitude) : null,
      altitudeAccuracy: loc.altitude_accuracy !== null ? Number(loc.altitude_accuracy) : null,
      vehicleType: String(loc.vehicle_type || "truck"),
      isOnline,
      status,
      lastUpdate: String(loc.last_updated || ""),
      vehiclePlate: "—",
      hasGps: true,
    });
  }

  return { locations };
}


/**
 * Vehicle-tracker positions (Cartrack/Wialon, synced into vehicle_locations
 * by /api/telematics/sync) as map markers, in the same shape as driver-phone
 * markers so FleetMapView needs no changes to render them.
 *
 * Not de-duplicated against a driver's phone GPS for the same truck —
 * driver_locations has no vehicle_id to reliably cross-reference against
 * (it's keyed by driver_id only), so if both a driver's phone and the
 * truck's own tracker are reporting, both markers show. Tracker data is
 * synthetic driverId `vehicle:<uuid>`, which can't collide with a real
 * driver's user id.
 */
async function fetchVehicleTrackerLocations(
  admin: ReturnType<typeof getAdminClient>,
): Promise<MapDriverLocation[]> {
  const { data, error } = await admin
    .from("vehicle_locations")
    .select("vehicle_id, latitude, longitude, speed, heading, updated_at, vehicles(plate_number)")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error || !data) return [];

  const rows: MapDriverLocation[] = [];
  for (const loc of data as any[]) {
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    if (!isValidCoordinate(lat, lng)) continue;

    const staleMs = Date.now() - new Date(String(loc.updated_at || 0)).getTime();
    let status: "LIVE" | "DELAYED" | "STALE" | "OFFLINE" = "OFFLINE";
    if (staleMs <= 300000) status = "LIVE";
    else if (staleMs <= 1800000) status = "DELAYED";
    else if (staleMs <= 86400000) status = "STALE";

    const plate = loc.vehicles?.plate_number || "Unknown vehicle";
    rows.push({
      id: `vehicle-tracker-${loc.vehicle_id}`,
      driverId: `vehicle:${loc.vehicle_id}`,
      driverName: `${plate} (tracker)`,
      latitude: lat,
      longitude: lng,
      heading: Number(loc.heading) || 0,
      speed: Number(loc.speed) || 0,
      accuracy: null,
      altitude: null,
      altitudeAccuracy: null,
      vehicleType: "truck",
      isOnline: status === "LIVE" || status === "DELAYED",
      status,
      lastUpdate: String(loc.updated_at || ""),
      vehiclePlate: plate,
      hasGps: true,
    });
  }
  return rows;
}

async function fetchMapLocationsInternal(
  admin: ReturnType<typeof getAdminClient>,
): Promise<{ locations: MapDriverLocation[]; driversWithoutGps: string[]; error?: string }> {
  const { data: locationsData, error: locError } = await admin
    .from("driver_locations")
    .select("*")
    .order("last_updated", { ascending: false });

  if (locError) return { locations: [], driversWithoutGps: [], error: locError.message };

  const { data: drivers } = await admin
    .from("user_profiles")
    .select("id, name, email, role");

  const driverProfiles = (drivers || []).filter((d) => isDriverRole(d.role));

  const authByEmail = new Map<string, string>();
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const au of authList?.users || []) {
    if (au.email) authByEmail.set(au.email.toLowerCase().trim(), au.id);
  }

  const { locations: driverLocations } = buildLocationRows(
    admin,
    locationsData || [],
    driverProfiles,
    authByEmail,
  );

  const trackerLocations = await fetchVehicleTrackerLocations(admin);
  const locations = [...driverLocations, ...trackerLocations];

  const driversWithoutGps: string[] = [];
  for (const d of driverProfiles) {
    const authId = d.email
      ? authByEmail.get(String(d.email).toLowerCase().trim())
      : undefined;
    const hasGps = driverLocations.some(
      (l) => l.driverId === d.id || (authId && l.driverId === authId),
    );
    if (!hasGps) {
      driversWithoutGps.push(d.name || d.email || "Driver");
    }
  }

  return { locations, driversWithoutGps };
}

/** Fleet map: same driver GPS data for CEO, Admin, HR, Operator (service role). */
export async function getDriverLocationsForMapAction(
  accessToken?: string | null,
  managerEmail?: string | null,
  managerRole?: string | null,
  isAdminBypass?: boolean,
): Promise<{
  locations: MapDriverLocation[];
  driversWithoutGps?: string[];
  error?: string;
}> {
  try {
    const admin = getAdminClient();
    let verified = false;

    if (accessToken) {
      try {
        const { user } = await resolveAuthUser(accessToken);
        await verifyManager(
          admin,
          user.id,
          user.email || managerEmail,
          managerRole,
          isAdminBypass,
        );
        verified = true;
      } catch {
        if (managerEmail) {
          await verifyManager(
            admin,
            undefined,
            managerEmail,
            managerRole,
            isAdminBypass,
          );
          verified = true;
        }
      }
    }

    if (!verified && managerEmail) {
      await verifyManager(
        admin,
        undefined,
        managerEmail,
        managerRole,
        isAdminBypass,
      );
      verified = true;
    }

    if (!verified) {
      return { locations: [], error: "Not signed in" };
    }

    return fetchMapLocationsInternal(admin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load locations";
    return { locations: [], error: msg };
  }
}
