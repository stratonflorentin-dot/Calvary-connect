"use server";

import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

export type DriverLocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  is_active?: boolean;
};

/** Persist driver GPS using service role (avoids RLS / profile-id mismatches). */
export async function upsertDriverLocationAction(
  accessToken: string,
  payload: DriverLocationPayload,
) {
  if (!accessToken) throw new Error("Not authenticated");

  const admin = getAdminClient();
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(accessToken);

  if (authError || !user) throw new Error("Invalid session");

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = String(profile?.role || "").toUpperCase();
  if (role !== "DRIVER") {
    throw new Error("Only drivers report location");
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
