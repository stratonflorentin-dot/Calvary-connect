"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import type { FleetMapDriver } from "@/components/fleet-map/types";

export function useFleetMapLocations() {
  const { user, isLoading: authLoading } = useSupabase();
  const [locations, setLocations] = useState<FleetMapDriver[]>([]);
  const [driversWithoutGps, setDriversWithoutGps] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadLocations = useCallback(async () => {
    if (!user?.email) return;

    try {
      setIsLoading(true);

      let token: string | null = null;
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData.session?.access_token ?? null;

      if (!token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token ?? null;
      }

      if (!token) {
        setLoadError("Your sign-in session expired. Sign in again to load fleet locations.");
        setLocations([]);
        setDriversWithoutGps([]);
        return;
      }

      const response = await fetch("/api/map/locations", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Fleet locations request failed (${response.status}).`);
      const rows = payload.locations as Array<{
        id: string; driverName: string; latitude: number; longitude: number; speed: number; status: FleetMapDriver["status"];
        isOnline: boolean; vehiclePlate: string; lastUpdate: string; heading: number; accuracy: number | null;
        altitude: number | null; altitudeAccuracy: number | null; vehicleType: string; vehiclePhotoUrl: string | null; engineOn: boolean | null;
      }>;

      setLoadError(null);
      setDriversWithoutGps(payload.driversWithoutGps || []);
      setLocations(
        rows.map((loc) => ({
          id: loc.id,
          driverName: loc.driverName,
          latitude: loc.latitude,
          longitude: loc.longitude,
          speed: loc.speed,
          status: loc.status,
          isOnline: loc.isOnline,
          vehiclePlate: loc.vehiclePlate,
          lastUpdate: loc.lastUpdate,
          heading: loc.heading,
          accuracy: loc.accuracy,
          altitude: loc.altitude,
          altitudeAccuracy: loc.altitudeAccuracy,
          vehicleType: loc.vehicleType,
          vehiclePhotoUrl: loc.vehiclePhotoUrl,
          engineOn: loc.engineOn,
        })),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user?.email) return;

    loadLocations();

    const subscription = supabase
      .channel(`fleet_map_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        () => loadLocations(),
      )
      .subscribe();

    // The postgres_changes subscription above already delivers live updates;
    // this is just a fallback in case a realtime event is missed/dropped.
    const poll = setInterval(loadLocations, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(poll);
    };
  }, [authLoading, user?.email, user?.id, loadLocations]);

  return {
    locations,
    driversWithoutGps,
    loadError,
    isLoading,
    refresh: loadLocations,
  };
}
