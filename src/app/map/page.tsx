"use client";

import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useFleetMapLocations } from "@/hooks/use-fleet-map-locations";
import dynamic from "next/dynamic";

const FleetMapView = dynamic(
  () => import("@/components/fleet-map/fleet-map-view"),
  { ssr: false },
);

const MANAGER_ROLES = ["CEO", "ADMIN", "OPERATOR", "HR"];

export default function LiveMapPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const { locations, driversWithoutGps, loadError, isLoading, refresh } =
    useFleetMapLocations();

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  const canView =
    isAdmin || MANAGER_ROLES.includes(String(role || "").toUpperCase());

  if (!canView) {
    return (
      <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-900">
        <Sidebar role={role!} />
        <main className="flex-1 relative h-[100dvh] min-h-0 w-full md:ml-60 flex items-center justify-center p-8">
          <div className="text-center bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-sm max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
            <p className="text-slate-400 text-sm">You do not have permission to view the live fleet map.</p>
          </div>
        </main>
      </div>
    );
  }

  const defaultCenter: [number, number] = [-3.3869, 36.683];

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-900">
      <Sidebar role={role!} />
      <main className="flex-1 relative h-[100dvh] min-h-0 w-full md:ml-60">
        <FleetMapView
          locations={locations}
          defaultCenter={defaultCenter}
          isLoading={isLoading}
          loadError={loadError}
          driversWithoutGps={driversWithoutGps}
          showEmptyOverlay={!isLoading && locations.length === 0}
          onRefresh={refresh}
        />
      </main>
    </div>
  );
}
