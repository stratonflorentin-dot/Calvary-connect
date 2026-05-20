"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { FleetMapDriver } from "@/components/fleet-map/types";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Navigation, Loader2 } from "lucide-react";
import { getDriverLocationsForMapAction } from "@/app/tracking/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const FleetMapCanvas = dynamic(
  () => import("@/components/fleet-map/fleet-map-canvas").then((m) => m.FleetMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ),
  }
);
export function DriverLocationMap() {
  const { user } = useSupabase();
  const { role, isAdmin, actualRole } = useRole();
  const [locations, setLocations] = useState<
    Awaited<ReturnType<typeof getDriverLocationsForMapAction>>["locations"]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canView =
    isAdmin || ["CEO", "ADMIN", "HR", "OPERATOR"].includes(role || "");

  const fetchDriverLocations = useCallback(async () => {
    if (!user?.email) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData.session?.access_token ?? null;
      if (!token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token ?? null;
      }
      const { locations: rows, error } = await getDriverLocationsForMapAction(
        token,
        user.email,
        actualRole || role || undefined,
        isAdmin,
      );
      if (error) setLoadError(error);
      else setLoadError(null);
      setLocations(rows);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, actualRole, role, isAdmin]);

  useEffect(() => {
    if (!canView) return;
    fetchDriverLocations();
    const sub = supabase
      .channel("driver_locations_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        () => fetchDriverLocations(),
      )
      .subscribe();
    const poll = setInterval(fetchDriverLocations, 20000);
    return () => {
      sub.unsubscribe();
      clearInterval(poll);
    };
  }, [canView, fetchDriverLocations, user?.email]);

  if (!canView) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const activeDrivers = locations.filter((l) => l.isOnline).length;
  const center =
    locations.length > 0
      ? { lat: locations[0].latitude, lng: locations[0].longitude }
      : { lat: -3.3869, lng: 36.683 };

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Live Driver Locations
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Updates while drivers are signed in to the app
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {activeDrivers} online / {locations.length} tracked
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href="/map">Full map</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadError && (
          <p className="text-sm text-amber-700 mb-3">{loadError}</p>
        )}
        {locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground h-[280px] flex flex-col items-center justify-center">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No driver GPS data yet</p>
            <p className="text-sm mt-1 max-w-md">
              Driver must open the app on their phone and allow location when the
              browser prompts (one time).
            </p>
          </div>
        ) : (
          <div className="relative h-[400px] rounded-lg overflow-hidden border">
            <FleetMapCanvas
              locations={locations as unknown as FleetMapDriver[]}
              defaultCenter={[center.lat, center.lng]}
              selectedId={null}
              onSelectDriver={() => {}}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
