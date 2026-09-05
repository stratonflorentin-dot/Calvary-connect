"use client";

import { useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { useFleetMapLocations } from "@/hooks/use-fleet-map-locations";
import { AlertTriangle, Gauge, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard, IndustryCardKicker } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import { IndustryShell } from "@/components/industry/shell";

const FleetMapView = dynamic(() => import("@/components/fleet-map/fleet-map-view"), { ssr: false });

const OPERATOR_PAGES = [
  { label: "Dispatch", href: "/dispatch" },
  { label: "Trips register", href: "/trips" },
  { label: "Inventory & parts", href: "/inventory" },
  { label: "Live fleet map", href: "/map" },
];

const MANAGER_ROLES = ["CEO", "ADMIN", "OPERATOR", "HR"];
const SYNC_ROLES = ["CEO", "ADMIN", "OPERATOR"];
const defaultCenter: [number, number] = [-3.3869, 36.683];

const STATUS_VARIANT: Record<string, "accent" | "warning" | "danger" | "neutral"> = {
  LIVE: "accent",
  DELAYED: "warning",
  STALE: "warning",
  OFFLINE: "danger",
};

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms >= 0 ? Math.floor(ms / 60000) : null;
}

export default function LiveMapPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const { locations, driversWithoutGps, loadError, isLoading, refresh } = useFleetMapLocations();

  const canSyncGps = isAdmin || SYNC_ROLES.includes(String(role || "").toUpperCase());

  const refreshWithGpsSync = useCallback(async () => {
    if (canSyncGps) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch("/api/telematics/sync", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
        }
      } catch {
        // Non-fatal — refresh still shows whatever's already in the DB.
      }
    }
    await refresh();
  }, [canSyncGps, refresh]);

  useEffect(() => {
    if (!canSyncGps) return;
    const interval = setInterval(refreshWithGpsSync, 60000);
    return () => clearInterval(interval);
  }, [canSyncGps, refreshWithGpsSync]);

  const attention = useMemo(() => locations.filter((l) => l.status !== "LIVE"), [locations]);
  const telemetry = useMemo(() => {
    const online = locations.filter((l) => l.isOnline).length;
    const offline = locations.length - online;
    const moving = locations.filter((l) => l.speed > 2);
    const avgSpeed = moving.length > 0 ? moving.reduce((s, l) => s + (l.speed || 0), 0) / moving.length : 0;
    const engineOn = locations.filter((l) => l.engineOn).length;
    return { online, offline, avgSpeed, engineOn };
  }, [locations]);

  if (roleLoading) return null;

  const canView = isAdmin || MANAGER_ROLES.includes(String(role || "").toUpperCase());
  if (!canView) {
    return (
      <IndustryShell className="min-h-screen flex items-center justify-center">
        <IndustryCard className="max-w-md text-center">
          <h1 className="text-[22px]" style={{ fontFamily: "var(--font-barlow-condensed)", fontWeight: 600, color: "#8c1d18" }}>Access denied</h1>
          <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">You don&apos;t have permission to view the live fleet map.</p>
        </IndustryCard>
      </IndustryShell>
    );
  }

  return (
    <IndustryRoleShell roleLabel="Operator" pages={OPERATOR_PAGES}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">{locations.length} unit(s) tracked{driversWithoutGps.length > 0 ? ` · ${driversWithoutGps.length} driver(s) with no GPS on file` : ""}</p>
        <IndustryButton variant="secondary" onClick={refreshWithGpsSync} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} /> Refresh
        </IndustryButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <IndustryCard className="gap-1">
          <IndustryCardKicker><Wifi className="size-3 inline mr-1" />Online</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{telemetry.online}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><WifiOff className="size-3 inline mr-1" />Offline</IndustryCardKicker>
          <p className={"ci-mono text-[20px] font-bold leading-none " + (telemetry.offline > 0 ? "text-[#8c1d18]" : "")}>{telemetry.offline}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><Gauge className="size-3 inline mr-1" />Avg. speed (moving)</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{telemetry.avgSpeed.toFixed(0)} km/h</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Engine on</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{telemetry.engineOn}</p>
        </IndustryCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-3 mb-3">
        <IndustryCard>
          <IndustryCardKicker><AlertTriangle className="size-3 inline mr-1" />Needs attention ({attention.length})</IndustryCardKicker>
          {attention.length === 0 ? (
            <p className="text-[12px] text-[var(--ci-text-tertiary)] py-2">All units reporting live.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--ci-cell-divider)] max-h-[420px] overflow-y-auto">
              {attention.map((l) => {
                const mins = minutesSince(l.lastUpdate);
                return (
                  <div key={l.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium truncate">{l.vehiclePlate || l.driverName}</p>
                      <p className="text-[10px] text-[var(--ci-text-tertiary)] truncate">
                        {l.status === "OFFLINE" ? "GPS offline" : l.speed <= 1 ? "Stopped" : "Delayed update"}
                        {mins != null ? ` · ${mins}m ago` : ""}
                      </p>
                    </div>
                    <IndustryTag variant={STATUS_VARIANT[l.status] ?? "neutral"}>{l.status}</IndustryTag>
                  </div>
                );
              })}
            </div>
          )}
          {driversWithoutGps.length > 0 && (
            <>
              <IndustryCardKicker className="mt-2">No GPS on file ({driversWithoutGps.length})</IndustryCardKicker>
              <div className="flex flex-col gap-1">
                {driversWithoutGps.map((name) => <p key={name} className="text-[12px] text-[var(--ci-text-tertiary)]">{name}</p>)}
              </div>
            </>
          )}
        </IndustryCard>

        <IndustryCard blueprint={false} className="p-0 overflow-hidden">
          <div className="relative w-full h-[480px]">
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
        </IndustryCard>
      </div>

      <IndustryCard>
        <IndustryCardKicker>Unit list</IndustryCardKicker>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Vehicle</IndustryTh>
              <IndustryTh>Driver</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh align="right">Speed</IndustryTh>
              <IndustryTh>Engine</IndustryTh>
              <IndustryTh align="right">Last update</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">{isLoading ? "Loading…" : "No units tracked."}</IndustryTd></tr>
            ) : (
              locations.map((l) => {
                const mins = minutesSince(l.lastUpdate);
                return (
                  <IndustryTr key={l.id}>
                    <IndustryTd mono>{l.vehiclePlate || "—"}</IndustryTd>
                    <IndustryTd>{l.driverName}</IndustryTd>
                    <IndustryTd><IndustryTag variant={STATUS_VARIANT[l.status] ?? "neutral"} pulse={l.status === "LIVE"}>{l.status}</IndustryTag></IndustryTd>
                    <IndustryTd align="right" mono>{l.speed?.toFixed(0) ?? "—"} km/h</IndustryTd>
                    <IndustryTd>{l.engineOn == null ? "—" : l.engineOn ? "On" : "Off"}</IndustryTd>
                    <IndustryTd align="right" mono className="text-[11px]">{mins != null ? `${mins}m ago` : "—"}</IndustryTd>
                  </IndustryTr>
                );
              })
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>
    </IndustryRoleShell>
  );
}
