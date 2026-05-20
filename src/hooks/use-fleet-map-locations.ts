"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { getDriverLocationsForMapAction } from "@/app/tracking/actions";
import type { FleetMapDriver } from "@/components/fleet-map/types";

export function useFleetMapLocations() {
  const { user, isLoading: authLoading } = useSupabase();
  const { role, actualRole, isAdmin } = useRole();
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

      const managerRole = actualRole || role || user.role || "";

      const { locations: rows, error, driversWithoutGps: noGps } =
        await getDriverLocationsForMapAction(
          token,
          user.email,
          managerRole,
          isAdmin,
        );

      if (error) {
        setLoadError(error);
        setLocations([]);
        setDriversWithoutGps(noGps || []);
        return;
      }

      setLoadError(null);
      setDriversWithoutGps(noGps || []);
      setLocations(
        rows.map((loc) => ({
          id: loc.id,
          driverName: loc.driverName,
          latitude: loc.latitude,
          longitude: loc.longitude,
          speed: loc.speed,
          status: loc.isOnline ? "active" : "inactive",
          isOnline: loc.isOnline,
          vehiclePlate: loc.vehiclePlate,
          lastUpdate: loc.lastUpdate,
          heading: loc.heading,
        })),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, actualRole, role, isAdmin]);

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

    const poll = setInterval(loadLocations, 10000);

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
