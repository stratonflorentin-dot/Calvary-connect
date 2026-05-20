"use client";

import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { getDriverLocationsForMapAction } from "@/app/tracking/actions";
import type { FleetMapDriver } from "@/components/fleet-map/types";

const FleetMapView = dynamic(
  () => import("@/components/fleet-map/fleet-map-view"),
  { ssr: false },
);

export default function LiveMapPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const [locations, setLocations] = useState<FleetMapDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLocations = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setLocations([]);
        return;
      }

      const { locations: rows, error } = await getDriverLocationsForMapAction(token);

      if (error) {
        setLocations([]);
        return;
      }

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
    } catch {
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLocations();

    const subscription = supabase
      .channel("driver_locations_map")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        () => loadLocations(),
      )
      .subscribe();

    const poll = setInterval(loadLocations, 20000);

    return () => {
      subscription.unsubscribe();
      clearInterval(poll);
    };
  }, [loadLocations]);

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!isAdmin && !["CEO", "ADMIN", "OPERATOR", "HR"].includes(role || ""))
    return <div className="p-8">Access Denied</div>;

  const defaultCenter: [number, number] = [-3.3869, 36.683];

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 relative h-full min-h-0">
        <FleetMapView
          locations={locations}
          defaultCenter={defaultCenter}
          isLoading={isLoading}
          showEmptyOverlay={!isLoading && locations.length === 0}
          onRefresh={loadLocations}
        />
      </main>
    </div>
  );
}
