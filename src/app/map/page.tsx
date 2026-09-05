"use client";

import { useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { PageShell } from "@/components/shell";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { useFleetMapLocations } from "@/hooks/use-fleet-map-locations";
import { Loader2, Shield } from "lucide-react";
import { EmptyState } from "@/components/shell";

const FleetMapView = dynamic(
  () => import("@/components/fleet-map/fleet-map-view"),
  { ssr: false },
);

const MANAGER_ROLES = ["CEO", "ADMIN", "OPERATOR", "HR"];
const defaultCenter: [number, number] = [-3.3869, 36.683]; // Central Tanzania

const SYNC_ROLES = ["CEO", "ADMIN", "OPERATOR"];

export default function LiveMapPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const { locations, driversWithoutGps, loadError, isLoading, refresh } = useFleetMapLocations();

  const canSyncGps = isAdmin || SYNC_ROLES.includes(String(role || "").toUpperCase());

  // Pulls fresh Cartrack/Wialon positions for tracker-mapped vehicles before
  // reloading — same "Refresh" action the map already had, now also
  // catching up truck-tracker markers, not just driver-phone GPS.
  const refreshWithGpsSync = useCallback(async () => {
    if (canSyncGps) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch("/api/telematics/sync", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      } catch {
        // Non-fatal — refresh still shows whatever's already in the DB.
      }
    }
    await refresh();
  }, [canSyncGps, refresh]);

  // Without this, the map's positions never change after the page loads —
  // the existing 10s poll only re-reads whatever's already in the DB, and
  // vehicle_locations only gets new data when something actually syncs it
  // from Wialon/Cartrack. Pull fresh telemetry on an interval while the map
  // is open so trucks actually appear to move and speed reflects reality,
  // not just whenever someone happens to click Refresh.
  useEffect(() => {
    if (!canSyncGps) return;
    const interval = setInterval(refreshWithGpsSync, 60000);
    return () => clearInterval(interval);
  }, [canSyncGps, refreshWithGpsSync]);

  if (roleLoading) {
    return (
      <PageShell width="full">
        <div className="flex items-center justify-center h-[70vh] text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageShell>
    );
  }

  const canView = isAdmin || MANAGER_ROLES.includes(String(role || "").toUpperCase());

  if (!canView) {
    return (
      <PageShell>
        <EmptyState
          icon={Shield}
          title="Access denied"
          description="You don't have permission to view the live fleet map."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="full" className="p-0">
      {/* Opens the connection (DNS + TLS) to the tile CDNs as soon as this
          page mounts, instead of waiting for MapLibre/Leaflet's JS to issue
          the first fetch — shaves a full round trip off first tile paint,
          which matters most on the very first visit to a new origin. */}
      <link rel="preconnect" href="https://api.maptiler.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://api.maptiler.com" />
      <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://basemaps.cartocdn.com" />
      <div className="relative w-full h-[calc(100vh-0px)] md:h-[calc(100vh-0px)]">
        <FleetMapView
          locations={locations}
          defaultCenter={defaultCenter}
          isLoading={isLoading}
          loadError={loadError}
          driversWithoutGps={driversWithoutGps}
          showEmptyOverlay={!isLoading && locations.length === 0}
          onRefresh={refreshWithGpsSync}
        />
      </div>
    </PageShell>
  );
}
