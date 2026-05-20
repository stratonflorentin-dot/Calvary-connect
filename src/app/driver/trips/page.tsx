"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DriverShell } from "@/components/driver/driver-shell";
import { useDriverData } from "@/hooks/use-driver-data";
import { useRole } from "@/hooks/use-role";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Package, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

type TripTab = "all" | "pending" | "transit" | "delivered";

function displayStatus(status: string): string {
  const s = (status || "").toLowerCase();
  if (["delivered", "completed"].includes(s)) return "Delivered";
  if (["in_transit", "loading", "in_progress"].includes(s)) return "In Transit";
  if (["delayed", "cancelled"].includes(s)) return "Delayed";
  return "Pending";
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const label = displayStatus(status);
  if (label === "Delivered") return "default";
  if (label === "In Transit") return "secondary";
  if (label === "Delayed") return "destructive";
  return "outline";
}

function filterTrips(trips: Record<string, unknown>[], tab: TripTab) {
  return trips.filter((t) => {
    const s = String(t.status || "").toLowerCase();
    if (tab === "pending") return ["pending", "created", "loaded"].includes(s);
    if (tab === "transit") return ["in_transit", "loading", "in_progress"].includes(s);
    if (tab === "delivered") return ["delivered", "completed"].includes(s);
    return true;
  });
}

export default function DriverTripsPage() {
  const { role } = useRole();
  const router = useRouter();
  const { trips, loading } = useDriverData();
  const [tab, setTab] = useState<TripTab>("all");

  useEffect(() => {
    if (role && role !== "DRIVER") router.replace("/trips");
  }, [role, router]);

  const filtered = useMemo(() => filterTrips(trips, tab), [trips, tab]);

  return (
    <DriverShell
      title="My Trips"
      description="Only trips assigned to you. You cannot create or assign trips."
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as TripTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
          <TabsTrigger value="transit" className="text-xs">In transit</TabsTrigger>
          <TabsTrigger value="delivered" className="text-xs">Done</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading trips…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No trips in this category.</p>
          ) : (
            filtered.map((trip) => (
              <Card key={String(trip.id)} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {String(trip.trip_number || trip.tripNumber || "Trip")}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="size-3 shrink-0" />
                        <span>
                          {String(trip.origin)} → {String(trip.destination)}
                        </span>
                      </div>
                    </div>
                    <Badge variant={statusVariant(String(trip.status))}>
                      {displayStatus(String(trip.status))}
                    </Badge>
                  </div>
                  {trip.cargo && (
                    <div className="flex items-start gap-2 text-sm bg-muted/50 rounded-lg p-2">
                      <Package className="size-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cargo</p>
                        <p>{String(trip.cargo || trip.cargo_type || "—")}</p>
                      </div>
                    </div>
                  )}
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href="/proof">
                      <Camera className="size-4 mr-2" />
                      Upload proof of delivery
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </DriverShell>
  );
}
