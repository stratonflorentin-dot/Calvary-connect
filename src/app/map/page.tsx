"use client";

import { useCallback } from "react";
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
