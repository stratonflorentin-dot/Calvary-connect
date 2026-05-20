"use server";

import { createClient } from "@supabase/supabase-js";
import { isPrimaryOwnerEmail } from "@/lib/supabase";

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

async function ensureManagerAccess(admin: ReturnType<typeof getAdminClient>, userId: string, email?: string | null) {
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile && isManagerRole(profile.role)) return true;
  if (email && isPrimaryOwnerEmail(email)) return true;
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

export type DriverLocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
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
  isOnline: boolean;
  lastUpdate: string;
  vehiclePlate: string;
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

  const row = {
    driver_id: user.id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    accuracy: payload.accuracy ?? null,
    speed: payload.speed ?? null,
    heading: payload.heading ?? null,
    is_active: payload.is_active ?? true,
    last_updated: new Date().toISOString(),
  };

  const { error } = await admin
    .from("driver_locations")
    .upsert(row, { onConflict: "driver_id" });

  if (error) throw new Error(error.message);
  return true;
}

/** Fleet map: load all driver locations (bypasses RLS for managers). */
export async function getDriverLocationsForMapAction(
  accessToken: string,
): Promise<{ locations: MapDriverLocation[]; error?: string }> {
  try {
    if (!accessToken) return { locations: [], error: "Not signed in" };

    const { admin, user } = await resolveAuthUser(accessToken);
    await ensureManagerAccess(admin, user.id, user.email);

    const { data: locationsData, error: locError } = await admin
      .from("driver_locations")
      .select("*")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("last_updated", { ascending: false });

    if (locError) return { locations: [], error: locError.message };

    const { data: drivers } = await admin
      .from("user_profiles")
      .select("id, name, email, role");

    const driverProfiles = (drivers || []).filter((d) => isDriverRole(d.role));

    const authByEmail = new Map<string, string>();
    const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const au of authList?.users || []) {
      if (au.email) authByEmail.set(au.email.toLowerCase().trim(), au.id);
    }

    const nameByDriverId = new Map<string, string>();
    for (const d of driverProfiles) {
      nameByDriverId.set(d.id, d.name || d.email || "Driver");
      const authId = d.email
        ? authByEmail.get(String(d.email).toLowerCase().trim())
        : undefined;
      if (authId) nameByDriverId.set(authId, d.name || d.email || "Driver");
    }

    const locations: MapDriverLocation[] = [];

    for (const loc of locationsData || []) {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const driverId = String(loc.driver_id);
      const driverName =
        nameByDriverId.get(driverId) ||
        `Driver ${driverId.slice(0, 8)}`;

      const staleMs = Date.now() - new Date(loc.last_updated || 0).getTime();
      const isOnline = !!loc.is_active && staleMs < 15 * 60 * 1000;

      locations.push({
        id: String(loc.id || driverId),
        driverId,
        driverName,
        latitude: lat,
        longitude: lng,
        heading: Number(loc.heading) || 0,
        speed: Number(loc.speed) || 0,
        isOnline,
        lastUpdate: loc.last_updated || "",
        vehiclePlate: "—",
      });
    }

    return { locations };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load locations";
    return { locations: [], error: msg };
  }
}
