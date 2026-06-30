"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, MapPin, Calendar, CheckCircle, Clock, AlertCircle, 
  Activity, Users, Fuel, Wrench, ArrowUpRight, Package
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function OperationsDashboard() {
  const { toast } = useToast();
  const { role, hasDepartmentAccess } = useRole();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    inProgressBookings: 0,
    totalTrips: 0,
    pendingTrips: 0,
    inProgressTrips: 0,
    completedTrips: 0,
    totalVehicles: 0,
    availableVehicles: 0,
    inUseVehicles: 0,
    maintenanceVehicles: 0,
    totalDrivers: 0,
    availableDrivers: 0,
    onTripDrivers: 0,
    pendingPODs: 0,
    verifiedPODs: 0,
    totalPODs: 0,
  });
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        bookingsData,
        tripsData,
        vehiclesData,
        usersData,
        podsData,
      ] = await Promise.all([
        supabase.from("bookings").select("*").eq("status", "pending").limit(5),
        supabase.from("trips").select("*").in("status", ["PENDING", "IN_PROGRESS", "in_transit"]).limit(5),
        supabase.from("vehicles").select("*"),
        supabase.from("users").select("*").eq("role", "DRIVER"),
        supabase.from("proof_of_delivery").select("*"),
      ]);

      const allBookings = await supabase.from("bookings").select("*");
      const allTrips = await supabase.from("trips").select("*");

      setStats({
        totalBookings: allBookings.data?.length || 0,
        pendingBookings: allBookings.data?.filter((b: any) => b.status === "pending").length || 0,
        confirmedBookings: allBookings.data?.filter((b: any) => b.status === "confirmed").length || 0,
        inProgressBookings: allBookings.data?.filter((b: any) => b.status === "in_progress").length || 0,
        totalTrips: allTrips.data?.length || 0,
        pendingTrips: allTrips.data?.filter((t: any) => t.status === "PENDING").length || 0,
        inProgressTrips: allTrips.data?.filter((t: any) => t.status === "IN_PROGRESS" || t.status === "in_transit").length || 0,
        completedTrips: allTrips.data?.filter((t: any) => t.status === "COMPLETED").length || 0,
        totalVehicles: vehiclesData.data?.length || 0,
        availableVehicles: vehiclesData.data?.filter((v: any) => v.status === "available").length || 0,
        inUseVehicles: vehiclesData.data?.filter((v: any) => v.status === "in_use").length || 0,
        maintenanceVehicles: vehiclesData.data?.filter((v: any) => v.status === "maintenance").length || 0,
        totalDrivers: usersData.data?.length || 0,
        availableDrivers: usersData.data?.filter((u: any) => u.status === "active").length || 0,
        onTripDrivers: allTrips.data?.filter((t: any) => t.status === "IN_PROGRESS" || t.status === "in_transit").length || 0,
        pendingPODs: podsData.data?.filter((p: any) => p.status === "pending").length || 0,
        verifiedPODs: podsData.data?.filter((p: any) => p.status === "verified").length || 0,
        totalPODs: podsData.data?.length || 0,
      });

      setActiveTrips(tripsData.data || []);
      setPendingBookings(bookingsData.data || []);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (!hasDepartmentAccess("OPERATIONS") && role !== "CEO" && role !== "ADMIN") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role || "CEO"} />
        <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Access denied. Operations dashboard requires Operations department access.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || "CEO"} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Operations Dashboard</h1>
              <p className="text-muted-foreground">Fleet operations and trip management overview</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/trips">
                  <Truck className="size-4 mr-2" /> Manage Trips
                </Link>
              </Button>
              <Button onClick={loadDashboardData} disabled={loading}>
                <Activity className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
              </Button>
            </div>
          </div>

          {/* Bookings Overview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="size-5 text-primary" /> Bookings Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalBookings}</div>
                  <div className="text-xs text-muted-foreground mt-1">All time</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{stats.pendingBookings}</div>
                  <div className="text-xs text-muted-foreground mt-1">Awaiting confirmation</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{stats.confirmedBookings}</div>
                  <div className="text-xs text-muted-foreground mt-1">Ready for dispatch</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{stats.inProgressBookings}</div>
                  <div className="text-xs text-muted-foreground mt-1">Active operations</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Fleet Overview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Truck className="size-5 text-primary" /> Fleet Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Vehicles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalVehicles}</div>
                  <div className="text-xs text-muted-foreground mt-1">Fleet size</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{stats.availableVehicles}</div>
                  <div className="text-xs text-muted-foreground mt-1">Ready for assignment</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">In Use</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{stats.inUseVehicles}</div>
                  <div className="text-xs text-muted-foreground mt-1">Currently on trips</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{stats.maintenanceVehicles}</div>
                  <div className="text-xs text-muted-foreground mt-1">Under repair</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Driver & POD Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Drivers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-primary" /> Driver Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{stats.totalDrivers}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-success/10">
                    <div className="text-2xl font-bold text-success">{stats.availableDrivers}</div>
                    <div className="text-xs text-muted-foreground">Available</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-primary/10">
                    <div className="text-2xl font-bold text-primary">{stats.onTripDrivers}</div>
                    <div className="text-xs text-muted-foreground">On Trip</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* POD Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-5 text-primary" /> POD Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{stats.totalPODs}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-warning/10">
                    <div className="text-2xl font-bold text-warning">{stats.pendingPODs}</div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-success/10">
                    <div className="text-2xl font-bold text-success">{stats.verifiedPODs}</div>
                    <div className="text-xs text-muted-foreground">Verified</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Trips & Pending Bookings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Active Trips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="size-5 text-primary" /> Active Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeTrips.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No active trips</p>
                ) : (
                  <div className="space-y-3">
                    {activeTrips.map((trip) => (
                      <div key={trip.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{trip.trip_number || trip.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">
                            {trip.origin} → {trip.destination}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            trip.status === "IN_PROGRESS" || trip.status === "in_transit" 
                              ? "bg-primary/10 text-primary border-primary/20" 
                              : "bg-warning/10 text-warning border-warning/20"
                          }
                        >
                          {trip.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Bookings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="size-5 text-warning" /> Pending Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingBookings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No pending bookings</p>
                ) : (
                  <div className="space-y-3">
                    {pendingBookings.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{booking.booking_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {booking.pickup_location} → {booking.delivery_location}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/trips">
                            Create Trip <ArrowUpRight className="size-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="size-5 text-primary" /> Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/trips">
                  <Truck className="size-6" />
                  <span>New Trip</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/bookings">
                  <Calendar className="size-6" />
                  <span>View Bookings</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/operations/pod">
                  <Package className="size-6" />
                  <span>Manage PODs</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/vehicles">
                  <Wrench className="size-6" />
                  <span>Fleet Status</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
