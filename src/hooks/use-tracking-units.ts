import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { hydrateTrips } from "@/lib/trips/hydrate";

export interface TrackingUnit {
  vehicleId: string;
  plate: string;
  type: string | null;
  vehicleStatus: string | null;
  photoUrl: string | null;
  mileage: number | null;
  nextMaintenanceDue: string | null;
  insuranceExpiry: string | null;
  currentFuelLevel: number | null;
  /** The vehicle's most recent non-terminal trip, if any — what makes a
   *  unit "Active" vs "Idle" in the status segment. */
  trip: {
    id: string;
    tripNumber: string | null;
    origin: string | null;
    destination: string | null;
    status: string;
    client: string | null;
    driverId: string | null;
    driverName: string | null;
    createdAt: string;
    estimatedDistanceKm: number | null;
    estimatedDurationHours: number | null;
  } | null;
}

const ACTIVE_TRIP_STATUSES = ["pending", "loading", "in_transit"];

/**
 * Every vehicle, each paired with its most recent active (not delivered/
 * cancelled) trip if it has one. This is the data source for the Tracking
 * Console's unit list (column 2) — reuses hydrateTrips() (src/lib/trips/
 * hydrate.ts), the same driver/vehicle-resolution helper /dispatch already
 * relies on, rather than a fresh brittle FK join.
 */
export function useTrackingUnits() {
  const [units, setUnits] = useState<TrackingUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: vehicles }, { data: tripsRaw }] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, plate_number, type, status, photo_url, mileage, next_maintenance_due, insurance_expiry, current_fuel_level")
          .order("plate_number"),
        supabase
          .from("trips")
          .select("*")
          .in("status", ACTIVE_TRIP_STATUSES)
          .order("created_at", { ascending: false }),
      ]);

      const hydrated = await hydrateTrips(tripsRaw ?? []);

      // A vehicle can only be "on" one active trip at a time in this
      // console's model — if more than one active row exists for the same
      // vehicle (a data-entry error upstream), the most recent wins.
      const latestTripByVehicle = new Map<string, (typeof hydrated)[number]>();
      for (const t of hydrated) {
        const vId = t.vehicle_id_resolved;
        if (!vId) continue;
        if (!latestTripByVehicle.has(vId)) latestTripByVehicle.set(vId, t);
      }

      const built: TrackingUnit[] = (vehicles ?? []).map((v) => {
        const t = latestTripByVehicle.get(v.id);
        return {
          vehicleId: v.id,
          plate: v.plate_number ?? "—",
          type: v.type ?? null,
          vehicleStatus: v.status ?? null,
          photoUrl: v.photo_url ?? null,
          mileage: v.mileage ?? null,
          nextMaintenanceDue: v.next_maintenance_due ?? null,
          insuranceExpiry: v.insurance_expiry ?? null,
          currentFuelLevel: v.current_fuel_level ?? null,
          trip: t
            ? {
                id: t.id,
                tripNumber: t.trip_number ?? null,
                origin: t.origin ?? null,
                destination: t.destination ?? null,
                status: String(t.status ?? "pending").toLowerCase(),
                client: t.client ?? null,
                driverId: t.driver_id_resolved,
                driverName: t.driver_name ?? null,
                createdAt: t.created_at,
                estimatedDistanceKm: t.estimated_distance ?? null,
                estimatedDurationHours: t.estimated_duration ?? null,
              }
            : null,
        };
      });

      setUnits(built);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("tracking-console-units")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { units, loading, reload: load };
}
