/**
 * Hydrate trip rows with driver and vehicle detail.
 *
 * The `trips` table has `driverId`/`driver_id` and `truckId`/`vehicle_id`
 * columns but Supabase's PostgREST schema cache may not have foreign-key
 * relationships declared, in which case nested joins like
 * `driver:user_profiles(name)` fail with "could not find a relationship".
 *
 * This helper does the join in JS instead — fetch trips first, then
 * fetch the referenced drivers and vehicles in two follow-up queries,
 * and merge. It never touches the FK cache so it works regardless of
 * how the database is configured.
 */

import { supabase } from "@/lib/supabase";

export interface HydratedTrip {
  [k: string]: any;
  driver_name?: string | null;
  driver_id_resolved?: string | null;
  vehicle_plate?: string | null;
  vehicle_id_resolved?: string | null;
}

function pick<T extends Record<string, any>>(row: T, ...keys: string[]): any {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

export async function hydrateTrips<T extends Record<string, any>>(rows: T[]): Promise<(T & HydratedTrip)[]> {
  if (rows.length === 0) return [];

  const driverIds = Array.from(new Set(rows.map((r) => pick(r, "driver_id", "driverId")).filter(Boolean)));
  const vehicleIds = Array.from(new Set(rows.map((r) => pick(r, "truck_id", "truckId", "vehicle_id", "vehicleId")).filter(Boolean)));

  const [drivers, vehicles] = await Promise.all([
    driverIds.length > 0
      ? supabase.from("user_profiles").select("id, uid, name").in("id", driverIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length > 0
      ? supabase.from("vehicles").select("id, plate_number, make, model").in("id", vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Fall back to `uid` if `id` failed (some schemas use uid as PK)
  let driverMap = new Map<string, any>();
  for (const d of drivers.data ?? []) driverMap.set(d.id ?? d.uid, d);
  if (driverMap.size === 0 && driverIds.length > 0) {
    const { data } = await supabase.from("user_profiles").select("id, uid, name").in("uid", driverIds);
    for (const d of data ?? []) driverMap.set(d.uid ?? d.id, d);
  }

  const vehicleMap = new Map<string, any>();
  for (const v of vehicles.data ?? []) vehicleMap.set(v.id, v);

  return rows.map((r) => {
    const dId = pick(r, "driver_id", "driverId");
    const vId = pick(r, "truck_id", "truckId", "vehicle_id", "vehicleId");
    const driver = dId ? driverMap.get(dId) : null;
    const vehicle = vId ? vehicleMap.get(vId) : null;
    return {
      ...r,
      driver_name: driver?.name ?? null,
      driver_id_resolved: dId ?? null,
      vehicle_plate: vehicle?.plate_number ?? null,
      vehicle_make: vehicle?.make ?? null,
      vehicle_model: vehicle?.model ?? null,
      vehicle_id_resolved: vId ?? null,
    };
  });
}
