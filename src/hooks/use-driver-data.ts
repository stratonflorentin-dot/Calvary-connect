"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";

export type DriverTruckStatus = "Active" | "On Trip" | "Maintenance" | "Offline";

export interface DriverDashboardStats {
  tripsAssigned: number;
  pendingDeliveries: number;
  completedDeliveries: number;
  truckStatus: DriverTruckStatus;
  fuelRequestsPending: number;
  maintenanceRequests: number;
}

function mapTripStatus(status: string): "pending" | "in_transit" | "delivered" | "delayed" {
  const s = (status || "").toLowerCase();
  if (["delivered", "completed"].includes(s)) return "delivered";
  if (["in_transit", "loading", "in_progress", "in progress"].includes(s)) return "in_transit";
  if (["delayed", "cancelled"].includes(s)) return "delayed";
  return "pending";
}

function mapVehicleStatus(
  status: string | undefined,
  hasActiveTrip: boolean,
): DriverTruckStatus {
  if (hasActiveTrip) return "On Trip";
  const s = (status || "").toLowerCase();
  if (s === "maintenance" || s === "in_maintenance") return "Maintenance";
  if (s === "out_of_service" || s === "offline" || s === "inactive") return "Offline";
  if (s === "in_use" || s === "active" || s === "available") return "Active";
  return "Active";
}

export function useDriverData() {
  const { user } = useSupabase();
  const [stats, setStats] = useState<DriverDashboardStats>({
    tripsAssigned: 0,
    pendingDeliveries: 0,
    completedDeliveries: 0,
    truckStatus: "Offline",
    fuelRequestsPending: 0,
    maintenanceRequests: 0,
  });
  const [trips, setTrips] = useState<Record<string, unknown>[]>([]);
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [fuelRequests, setFuelRequests] = useState<Record<string, unknown>[]>([]);
  const [assignedVehicle, setAssignedVehicle] = useState<Record<string, unknown> | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: profileRow } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(profileRow || null);

      const { data: tripsData } = await supabase
        .from("trips")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });

      const myTrips = tripsData || [];
      setTrips(myTrips);

      const pending = myTrips.filter((t) =>
        ["pending", "created", "loaded"].includes(String(t.status || "").toLowerCase()),
      );
      const completed = myTrips.filter((t) =>
        ["delivered", "completed"].includes(String(t.status || "").toLowerCase()),
      );
      const inTransit = myTrips.filter((t) =>
        ["in_transit", "loading", "in_progress"].includes(String(t.status || "").toLowerCase()),
      );

      let vehicle: Record<string, unknown> | null = null;
      const activeTrip = inTransit[0] || pending[0];
      const vehicleId =
        activeTrip?.vehicle_id || activeTrip?.truck_id || activeTrip?.truckId;

      if (vehicleId) {
        const { data: v } = await supabase
          .from("vehicles")
          .select("*")
          .eq("id", vehicleId)
          .maybeSingle();
        vehicle = v;
      }

      if (!vehicle && myTrips.length > 0) {
        const lastVid = myTrips[0].vehicle_id || myTrips[0].truck_id;
        if (lastVid) {
          const { data: v } = await supabase
            .from("vehicles")
            .select("*")
            .eq("id", lastVid)
            .maybeSingle();
          vehicle = v;
        }
      }

      setAssignedVehicle(vehicle);

      const { data: expenseRows } = await supabase
        .from("expenses")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });
      setExpenses(expenseRows || []);

      let fuelPending = 0;
      let fuelList: Record<string, unknown>[] = [];
      const { data: fuelData, error: fuelErr } = await supabase
        .from("fuel_requests")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });

      if (!fuelErr && fuelData) {
        fuelList = fuelData;
        fuelPending = fuelData.filter(
          (f) => String(f.status || "").toLowerCase() === "pending",
        ).length;
      }
      setFuelRequests(fuelList);

      let maintCount = 0;
      const { data: maintData, error: maintErr } = await supabase
        .from("maintenance_requests")
        .select("id, status")
        .eq("driver_id", user.id);

      if (!maintErr && maintData) {
        maintCount = maintData.filter((m) =>
          !["completed", "cancelled"].includes(String(m.status || "").toLowerCase()),
        ).length;
      }

      setStats({
        tripsAssigned: myTrips.length,
        pendingDeliveries: pending.length + inTransit.length,
        completedDeliveries: completed.length,
        truckStatus: mapVehicleStatus(
          vehicle?.status as string | undefined,
          inTransit.length > 0,
        ),
        fuelRequestsPending: fuelPending,
        maintenanceRequests: maintCount,
      });
    } catch (e) {
      console.error("[useDriverData]", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    stats,
    trips,
    expenses,
    fuelRequests,
    assignedVehicle,
    profile,
    loading,
    refresh,
    mapTripStatus,
  };
}
