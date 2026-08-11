/**
 * Single source of truth for bucketing a vehicle's raw `status` column into
 * one of the 3 operational states the UI actually renders.
 *
 * vehicles_status_check (supabase/migrations/026_recovery_consolidated_fixes.sql)
 * allows 7 values: available, in_use, maintenance, out_of_service, active,
 * sold, decommissioned. Before this file existed, at least 3 different
 * dashboards each reimplemented this bucketing independently — none of them
 * accounted for all 7, so the same fleet showed a different "Available"
 * count depending on which page you were looking at (e.g. 22 on one
 * dashboard, 36 on another, for the identical 36-vehicle fleet), because
 * only some of them treated 'active' as available.
 */
export type VehicleStatusBucket = "available" | "in_use" | "maintenance";

export function vehicleStatusBucket(status?: string | null): VehicleStatusBucket {
  const s = (status ?? "").toLowerCase();
  if (s === "in_use") return "in_use";
  if (s === "maintenance" || s === "out_of_service" || s === "sold" || s === "decommissioned") return "maintenance";
  return "available"; // available, active, or any future/unrecognized value
}

export function isVehicleAvailable(status?: string | null): boolean {
  return vehicleStatusBucket(status) === "available";
}

export function isVehicleInUse(status?: string | null): boolean {
  return vehicleStatusBucket(status) === "in_use";
}

export function isVehicleInMaintenance(status?: string | null): boolean {
  return vehicleStatusBucket(status) === "maintenance";
}
