"use client";

import {
  DashboardLayout,
  StatCard,
  DataTable,
  ActivityFeed,
  AlertPanel,
} from "@/components/dashboard/shared/dashboard-layout";
import { useTrips } from "@/hooks/data/use-trips";
import { useExpenses } from "@/hooks/data/use-expenses";
import { useUsers } from "@/hooks/data/use-users";
import { useRole } from "@/hooks/use-role";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  Navigation,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Eye,
  FileText,
  Calendar,
  DollarSign,
  Users,
  BarChart2,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Package,
  RefreshCw,
  Settings,
  Bell,
  Sparkles,
  Shield,
  Briefcase,
  Phone,
  Mail,
  Locate,
  Route,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function DriverDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();
  const { location, error: locationError } = useGeolocation();

  // Data hooks
  const {
    trips,
    loading: tripsLoading,
    refresh: refreshTrips,
  } = useTrips({ driverId: "current" });
  const { expenses, loading: expensesLoading } = useExpenses();

  const loading = tripsLoading || expensesLoading;

  // Get current driver's trips
  const activeTrips = trips.filter((t) =>
    ["in_transit", "loading", "pending"].includes(t.status),
  );
  const completedTrips = trips.filter((t) => t.status === "completed");
  const pendingTrips = trips.filter(
    (t) => t.status === "pending" || t.status === "created",
  );

  // Calculate earnings
  const totalEarnings = completedTrips.reduce(
    (sum, t) => sum + (Number(t.revenue || t.price) || 0),
    0,
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netEarnings = totalEarnings - totalExpenses;

  // Recent trip
  const recentTrip = activeTrips[0] || completedTrips[0];

  // Alerts
  const alerts = [];
  if (locationError) {
    alerts.push({
      id: "1",
      title: "Location Access Denied",
      description: "Please enable location services to track your position.",
      severity: "warning" as const,
      time: "Just now",
    });
  }
  if (activeTrips.length > 0 && !location) {
    alerts.push({
      id: "2",
      title: "GPS Signal Lost",
      description: "Unable to determine your current location.",
      severity: "critical" as const,
      time: "Just now",
    });
  }

  // Recent activities
  const activities = [
    {
      id: "1",
      title: "Trip Started",
      description: recentTrip
        ? `${recentTrip.origin} → ${recentTrip.destination}`
        : "No active trip",
      time: "2 hours ago",
      icon: CheckCircle2,
      color: "bg-green-500",
    },
    {
      id: "2",
      title: "Delivery Completed",
      description: "Trip #T001 - Dar es Salaam",
      time: "4 hours ago",
      icon: Truck,
      color: "bg-blue-500",
    },
    {
      id: "3",
      title: "Expense Recorded",
      description: "Fuel expense KES 2,500",
      time: "6 hours ago",
      icon: DollarSign,
      color: "bg-amber-500",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading driver dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Driver Dashboard"
      description="Track trips and manage deliveries"
      role={role || "DRIVER"}
    >
      {/* Alert Panel */}
      {alerts.length > 0 && <AlertPanel alerts={alerts} />}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard
          title="Active Trips"
          value={activeTrips.length}
          icon={Navigation}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Completed Trips"
          value={completedTrips.length}
          icon={CheckCircle2}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Total Earnings"
          value={format(totalEarnings)}
          icon={DollarSign}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="Net Earnings"
          value={format(netEarnings)}
          icon={TrendingUp}
          color={netEarnings >= 0 ? "text-green-600" : "text-red-600"}
          bgColor={netEarnings >= 0 ? "bg-green-50" : "bg-red-50"}
        />
        <StatCard
          title="Pending Trips"
          value={pendingTrips.length}
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          title="Total Expenses"
          value={format(totalExpenses)}
          icon={Calculator}
          color="text-red-600"
          bgColor="bg-red-50"
        />
        <StatCard
          title="GPS Status"
          value={location ? "Active" : "Inactive"}
          icon={MapPin}
          color={location ? "text-green-600" : "text-red-600"}
          bgColor={location ? "bg-green-50" : "bg-red-50"}
        />
        <StatCard
          title="Current Location"
          value={
            location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : "N/A"
          }
          icon={Locate}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Current Trip Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="size-5" />
              Current Trip Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTrip ? (
              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Route</span>
                    <Badge variant="default">
                      {recentTrip.status?.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-primary" />
                    <span>{recentTrip.origin}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <MapPin className="size-4 text-primary" />
                    <span>{recentTrip.destination}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Cargo</p>
                    <p className="text-sm font-bold">
                      {recentTrip.cargo || "N/A"}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Client</p>
                    <p className="text-sm font-bold">
                      {recentTrip.client || "N/A"}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">
                      Distance
                    </p>
                    <p className="text-sm font-bold">
                      {recentTrip.distance || "N/A"} km
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                    <p className="text-sm font-bold">
                      {format(
                        Number(recentTrip.revenue || recentTrip.price || 0),
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Truck className="size-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No active trips</p>
                <p className="text-xs text-muted-foreground mt-2">
                  You have no trips assigned at this time.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trip History & Expenses */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" />
                Trip History
              </CardTitle>
              <Badge variant="secondary">
                {completedTrips.length} completed
              </Badge>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "tripNumber", label: "Trip #" },
                  { key: "origin", label: "Origin" },
                  { key: "destination", label: "Destination" },
                  {
                    key: "revenue",
                    label: "Revenue",
                    render: (row) =>
                      format(Number(row.revenue || row.price || 0)),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <Badge variant="default">
                        {row.status?.replace("_", " ")}
                      </Badge>
                    ),
                  },
                ]}
                data={completedTrips.slice(0, 5)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="size-5" />
                Recent Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "category", label: "Category" },
                  {
                    key: "amount",
                    label: "Amount",
                    render: (row) => (
                      <span className="text-rose-600 font-medium">
                        -{format(row.amount)}
                      </span>
                    ),
                  },
                  { key: "description", label: "Description" },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <Badge
                        variant={
                          row.status === "approved" ? "default" : "secondary"
                        }
                      >
                        {row.status}
                      </Badge>
                    ),
                  },
                ]}
                data={expenses.slice(0, 5)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Feed */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Recent Activities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities} />
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export { DriverDashboard as DriverView };
