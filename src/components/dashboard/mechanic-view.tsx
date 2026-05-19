"use client";

import {
  DashboardLayout,
  StatCard,
  DataTable,
  ActivityFeed,
  AlertPanel,
} from "@/components/dashboard/shared/dashboard-layout";
import { useMaintenanceRequests } from "@/hooks/data/use-maintenance-requests";
import { useFleetVehicles } from "@/hooks/data/use-fleet-vehicles";
import { useTrips } from "@/hooks/data/use-trips";
import { useRole } from "@/hooks/use-role";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wrench,
  Package,
  History,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  Clock,
  TrendingUp,
  BarChart2,
  Truck,
  Users,
  Settings,
  Bell,
  Sparkles,
  Eye,
  FileText,
  RefreshCw,
  AlertTriangle,
  Calendar,
  DollarSign,
  Navigation,
  MapPin,
  Plus,
  Trash2,
  Edit,
  Shield,
  Briefcase,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";

export default function MechanicDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();

  // Data hooks
  const { requests: maintenanceRequests, loading: maintenanceLoading } =
    useMaintenanceRequests();
  const { vehicles, loading: vehiclesLoading } = useFleetVehicles({
    status: "maintenance",
  });
  const { trips, loading: tripsLoading } = useTrips();

  const loading = maintenanceLoading || vehiclesLoading || tripsLoading;

  // Calculate metrics
  const pendingCount = maintenanceRequests.filter(
    (r) => r.status === "pending" || r.status === "reported",
  ).length;
  const inProgressCount = maintenanceRequests.filter(
    (r) => r.status === "in_progress" || r.status === "diagnosed",
  ).length;
  const completedCount = maintenanceRequests.filter(
    (r) => r.status === "completed",
  ).length;
  const cancelledCount = maintenanceRequests.filter(
    (r) => r.status === "cancelled",
  ).length;

  // Maintenance cost estimate
  const totalEstimatedCost = maintenanceRequests.reduce(
    (sum, r) => sum + (Number(r.estimatedCost) || 0),
    0,
  );
  const totalActualCost = maintenanceRequests.reduce(
    (sum, r) => sum + (Number(r.actualCost) || 0),
    0,
  );

  // Recent completed maintenance
  const recentCompleted = maintenanceRequests
    .filter((r) => r.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.updated_at || 0).getTime() -
        new Date(a.completedAt || a.updated_at || 0).getTime(),
    )
    .slice(0, 5);

  // Alerts
  const alerts = [
    {
      id: "1",
      title: "Critical Maintenance Required",
      description: `${maintenanceRequests.filter((r) => r.priority === "critical").length} critical maintenance requests need immediate attention.`,
      severity: "critical" as const,
      time: "30 minutes ago",
    },
    {
      id: "2",
      title: "Parts Running Low",
      description: "3 spare parts are below minimum stock level.",
      severity: "warning" as const,
      time: "2 hours ago",
    },
  ];

  // Recent activities
  const activities = [
    {
      id: "1",
      title: "Maintenance Completed",
      description: "Engine repair for TRK-005 - $2,500",
      time: "2 hours ago",
      icon: CheckCircle2,
      color: "bg-green-500",
    },
    {
      id: "2",
      title: "New Maintenance Request",
      description: "Brake inspection for TRK-012",
      time: "4 hours ago",
      icon: PlusCircle,
      color: "bg-blue-500",
    },
    {
      id: "3",
      title: "Parts Order Placed",
      description: "Ordered 4 brake pads and 2 oil filters",
      time: "6 hours ago",
      icon: Package,
      color: "bg-amber-500",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading maintenance data...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Mechanic Dashboard"
      description="Fleet maintenance and repair management"
      role={role || "MECHANIC"}
    >
      {/* Alert Panel */}
      <AlertPanel alerts={alerts} />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard
          title="Pending Requests"
          value={pendingCount}
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          title="In Progress"
          value={inProgressCount}
          icon={Loader2}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Completed"
          value={completedCount}
          icon={CheckCircle2}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Cancelled"
          value={cancelledCount}
          icon={AlertCircle}
          color="text-red-600"
          bgColor="bg-red-50"
        />
        <StatCard
          title="Vehicles in Maintenance"
          value={vehicles.length}
          icon={Truck}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Estimated Cost"
          value={format(totalEstimatedCost)}
          icon={DollarSign}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="Actual Cost"
          value={format(totalActualCost)}
          icon={Calculator}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
        />
        <StatCard
          title="Active Trips"
          value={
            trips.filter((t) =>
              ["in_transit", "loading", "pending"].includes(t.status),
            ).length
          }
          icon={Navigation}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
      </div>

      {/* Maintenance & Fleet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Active Maintenance Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-5" />
              Active Maintenance Queue
            </CardTitle>
            <Badge variant="destructive">{pendingCount} pending</Badge>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending ({pendingCount})
                </TabsTrigger>
                <TabsTrigger value="in_progress">
                  In Progress ({inProgressCount})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed ({completedCount})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pending">
                <DataTable
                  columns={[
                    { key: "issueDescription", label: "Issue" },
                    { key: "fleetVehicleId", label: "Vehicle" },
                    {
                      key: "priority",
                      label: "Priority",
                      render: (row) => (
                        <Badge
                          variant={
                            row.priority === "critical"
                              ? "destructive"
                              : row.priority === "high"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {row.priority}
                        </Badge>
                      ),
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => (
                        <Badge
                          variant={
                            row.status === "pending"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {row.status?.replace("_", " ")}
                        </Badge>
                      ),
                    },
                  ]}
                  data={maintenanceRequests.filter(
                    (r) => r.status === "pending" || r.status === "reported",
                  )}
                />
              </TabsContent>
              <TabsContent value="in_progress">
                <DataTable
                  columns={[
                    { key: "issueDescription", label: "Issue" },
                    { key: "fleetVehicleId", label: "Vehicle" },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => (
                        <Badge variant="secondary">
                          {row.status?.replace("_", " ")}
                        </Badge>
                      ),
                    },
                  ]}
                  data={maintenanceRequests.filter(
                    (r) =>
                      r.status === "in_progress" || r.status === "diagnosed",
                  )}
                />
              </TabsContent>
              <TabsContent value="completed">
                <DataTable
                  columns={[
                    { key: "issueDescription", label: "Issue" },
                    { key: "fleetVehicleId", label: "Vehicle" },
                    {
                      key: "completedAt",
                      label: "Completed",
                      render: (row) =>
                        new Date(
                          row.completedAt || row.updated_at,
                        ).toLocaleDateString(),
                    },
                    {
                      key: "truckConditionAfterService",
                      label: "Condition",
                      render: (row) => (
                        <Badge
                          variant={
                            row.truckConditionAfterService === "good"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {row.truckConditionAfterService}
                        </Badge>
                      ),
                    },
                  ]}
                  data={recentCompleted}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Fleet Status & Cost Analysis */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="size-5" />
                Fleet Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {vehicles.filter((v) => v.status === "available").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Available</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {vehicles.filter((v) => v.status === "in_use").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">In Use</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {vehicles.filter((v) => v.status === "maintenance").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Maintenance
                  </p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "plate_number", label: "Plate" },
                  { key: "make", label: "Make" },
                  { key: "model", label: "Model" },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <Badge
                        variant={
                          row.status === "available"
                            ? "secondary"
                            : row.status === "in_use"
                              ? "default"
                              : "destructive"
                        }
                      >
                        {row.status}
                      </Badge>
                    ),
                  },
                ]}
                data={vehicles.slice(0, 8)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="size-5" />
                Cost Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">
                    Estimated Cost
                  </p>
                  <p className="text-lg font-bold text-orange-600">
                    {format(totalEstimatedCost)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Actual Cost</p>
                  <p className="text-lg font-bold text-green-600">
                    {format(totalActualCost)}
                  </p>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Cost Variance
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-4 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${totalEstimatedCost > 0 ? (totalActualCost / totalEstimatedCost) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold w-16 text-right">
                    {totalEstimatedCost > 0
                      ? ((totalActualCost / totalEstimatedCost) * 100).toFixed(
                          0,
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
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
        </div>
      </div>

      {/* Request Parts Button */}
      <div className="flex justify-end mb-6">
        <Button
          onClick={() => {
            /* Request parts logic */
          }}
        >
          <PlusCircle className="size-4 mr-2" /> Request Parts
        </Button>
      </div>
    </DashboardLayout>
  );
}

export { MechanicDashboard as MechanicView };
