"use client";

import dynamic from "next/dynamic";
import { PageShell } from "@/components/shell";
import { useRole } from "@/hooks/use-role";
import { useFleetMapLocations } from "@/hooks/use-fleet-map-locations";
import { Loader2, Shield } from "lucide-react";
import { EmptyState } from "@/components/shell";

const FleetMapView = dynamic(
  () => import("@/components/fleet-map/fleet-map-view"),
  { ssr: false },
);

const MANAGER_ROLES = ["CEO", "ADMIN", "OPERATOR", "HR"];
const defaultCenter: [number, number] = [-3.3869, 36.683]; // Central Tanzania

export default function LiveMapPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const { locations, driversWithoutGps, loadError, isLoading, refresh } = useFleetMapLocations();

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
          onRefresh={refresh}
        />
      </div>
    </PageShell>
  );
}
