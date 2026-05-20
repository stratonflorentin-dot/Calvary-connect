"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useDriverData } from "@/hooks/use-driver-data";
import { useSupabase } from "@/components/supabase-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  Fuel,
  Wrench,
  Route,
  Receipt,
  User,
  Camera,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  "On Trip": "bg-blue-100 text-blue-800",
  Maintenance: "bg-amber-100 text-amber-800",
  Offline: "bg-slate-100 text-slate-600",
};

function StatTile({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors active:scale-[0.98]"
    >
      <span className="flex items-center gap-3 font-medium text-sm">
        <Icon className="size-5 text-primary" />
        {label}
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}

export default function DriverDashboard() {
  const { user } = useSupabase();
  const { stats, assignedVehicle, trips, loading, refresh } = useDriverData();

  const plate =
    (assignedVehicle?.plate_number as string) ||
    (assignedVehicle?.plateNumber as string) ||
    "—";
  const vehicleType =
    (assignedVehicle?.type as string)?.replace(/_/g, " ") || "Truck";
  const fuelLevel =
    assignedVehicle?.current_fuel_level != null
      ? `${assignedVehicle.current_fuel_level}%`
      : assignedVehicle?.currentFuelLevel != null
        ? `${assignedVehicle.currentFuelLevel}%`
        : "—";
  const lastService =
    (assignedVehicle?.last_maintenance_date as string)?.slice(0, 10) ||
    (assignedVehicle?.lastMaintenanceDate as string)?.slice(0, 10) ||
    "—";

  const activeTrip = trips.find((t) =>
    ["in_transit", "loading", "in_progress"].includes(
      String(t.status || "").toLowerCase(),
    ),
  );
  const assignedRoute = activeTrip
    ? `${activeTrip.origin || "—"} → ${activeTrip.destination || "—"}`
    : trips[0]
      ? `${trips[0].origin || "—"} → ${trips[0].destination || "—"}`
      : "No route assigned";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-headline tracking-tight">
          Hello, {user?.name?.split(" ")[0] || "Driver"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Your trips, vehicle, fuel, and expenses in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Trips Assigned" value={stats.tripsAssigned} icon={Route} />
        <StatTile
          label="Pending Deliveries"
          value={stats.pendingDeliveries}
          icon={Clock}
        />
        <StatTile
          label="Completed"
          value={stats.completedDeliveries}
          icon={CheckCircle2}
        />
        <StatTile
          label="Truck Status"
          value={stats.truckStatus}
          icon={Truck}
          className="col-span-2"
        />
        <StatTile
          label="Fuel Pending"
          value={stats.fuelRequestsPending}
          icon={Fuel}
        />
        <StatTile
          label="Maintenance"
          value={stats.maintenanceRequests}
          icon={Wrench}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            My Assigned Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignedVehicle ? (
            <>
              <div className="aspect-video rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center">
                <Truck className="size-16 text-white/80" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Registration</p>
                  <p className="font-semibold">{plate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Type</p>
                  <p className="font-semibold capitalize">{vehicleType}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Assigned route</p>
                  <p className="font-medium">{assignedRoute}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fuel level</p>
                  <p className="font-semibold">{fuelLevel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Last service</p>
                  <p className="font-semibold">{lastService}</p>
                </div>
              </div>
              <Badge className={statusColors[stats.truckStatus] || statusColors.Active}>
                {stats.truckStatus}
              </Badge>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No vehicle assigned yet. Check back when a trip is assigned to you.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Quick actions
        </p>
        <QuickLink href="/driver/trips" label="My Trips" icon={Route} />
        <QuickLink href="/proof" label="Proof of Delivery" icon={Camera} />
        <QuickLink href="/driver/fuel" label="Fuel requests" icon={Fuel} />
        <QuickLink href="/driver/expenses" label="Submit expense" icon={Receipt} />
        <QuickLink href="/report" label="Report maintenance" icon={Wrench} />
        <QuickLink href="/driver/profile" label="Driver profile" icon={User} />
      </div>

      <Button variant="outline" size="sm" onClick={() => refresh()} className="w-full">
        Refresh dashboard
      </Button>
    </div>
  );
}

export { DriverDashboard as DriverView };
