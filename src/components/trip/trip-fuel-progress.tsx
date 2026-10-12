"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel, Gauge, MapPin, RefreshCw, Route, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

type FuelProgressRow = {
  tripId: string;
  tripNumber: string | null;
  origin: string | null;
  destination: string | null;
  plateNumber: string;
  plannedKm: number | null;
  distanceKm: number | null;
  distanceSource: "odometer" | "gps" | null;
  fuelUsedLitres: number | null;
  fuelRemainingLitres: number | null;
  fuelLevelPct: number | null;
  fuelBasis: "sensor" | "observed-efficiency" | "unavailable";
  lastTelemetryAt: string | null;
};

const fmt = (value: number | null, digits = 0) => value === null ? "Waiting for telemetry" : `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}`;

export function TripFuelProgress() {
  const [rows, setRows] = useState<FuelProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in to view live trip fuel readings.");
      const response = await fetch("/api/trips/fuel-progress", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not load trip fuel readings.");
      setRows(result.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Could not load trip fuel readings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  return (
    <Card className="mb-6 border-border/70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Fuel className="size-4 text-primary" /> Active trip fuel & distance</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Truck telemetry is matched to its assigned in-transit trip.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 size-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error ? <p className="text-sm text-destructive">{error}</p> : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {loading ? "Loading live trip readings…" : "No in-transit trips with an assigned truck. Start a trip and telemetry will appear after the next GPS sync."}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <div key={`${row.tripId}:${row.plateNumber}`} className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.tripNumber || "Active trip"}</p>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{row.origin || "—"} → {row.destination || "—"}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"><Truck className="size-3" />{row.plateNumber}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-background/70 p-2.5">
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Route className="size-3" /> Travelled</p>
                    <p className="mt-1 text-sm font-bold">{fmt(row.distanceKm)}{row.distanceKm === null ? "" : " km"}</p>
                    {row.distanceSource && <p className="text-[10px] text-muted-foreground">Measured by {row.distanceSource}</p>}
                    {row.plannedKm !== null && <p className="text-[10px] text-muted-foreground">of {fmt(row.plannedKm)} km planned</p>}
                  </div>
                  <div className="rounded-lg bg-background/70 p-2.5">
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Gauge className="size-3" /> Fuel</p>
                    {row.fuelBasis === "sensor" ? (
                      <>
                        <p className="mt-1 text-sm font-bold">{fmt(row.fuelUsedLitres, 1)} L used</p>
                        <p className="text-[10px] text-muted-foreground">{fmt(row.fuelRemainingLitres, 1)} L remaining · {fmt(row.fuelLevelPct, 0)}% tank</p>
                      </>
                    ) : row.fuelBasis === "observed-efficiency" ? (
                      <>
                        <p className="mt-1 text-sm font-bold">~{fmt(row.fuelUsedLitres, 1)} L used</p>
                        <p className="text-[10px] text-muted-foreground">Estimate from this truck’s logged fuel efficiency</p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No fuel-level sensor or measured efficiency for this truck yet.</p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">
                  {row.lastTelemetryAt ? `Telemetry ${new Date(row.lastTelemetryAt).toLocaleString()}` : "Waiting for GPS telemetry"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
