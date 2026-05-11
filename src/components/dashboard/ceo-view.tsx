"use client";

import {
  DashboardLayout,
  StatCard,
  DataTable,
  ActivityFeed,
  AlertPanel,
} from "@/components/dashboard/shared/dashboard-layout";
import { useFleetVehicles } from "@/hooks/data/use-fleet-vehicles";
import { useTrips } from "@/hooks/data/use-trips";
import { useExpenses } from "@/hooks/data/use-expenses";
import { useInvoices } from "@/hooks/data/use-invoices";
import { useMonthlyReports } from "@/hooks/data/use-monthly-reports";
import { useMaintenanceRequests } from "@/hooks/data/use-maintenance-requests";
import { useUsers } from "@/hooks/data/use-users";
import { useRole } from "@/hooks/use-role";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Truck,
  Navigation,
  DollarSign,
  Users,
  Package,
  MapPin,
  Plus,
  Trash2,
  Edit,
  Eye,
  BarChart2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Settings,
  Bell,
  Sparkles,
  FileText,
  Upload,
  Download,
  RefreshCw,
  Shield,
  Briefcase,
  Building2,
  CalendarDays,
  Globe,
  Thermometer,
  Anchor,
  Route,
  LayoutDashboard,
  Wrench,
  Calculator,
  LogOut,
  Camera,
  User as UserIcon,
  ChevronRight,
  MoreVertical,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";

export default function CeoDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();

  // Data hooks
  const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
  const { trips, loading: tripsLoading } = useTrips();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { reports, loading: reportsLoading } = useMonthlyReports();
  const { requests: maintenanceRequests, loading: maintenanceLoading } =
    useMaintenanceRequests();
  const { users: drivers, loading: driversLoading } = useUsers({
    role: "DRIVER",
  });

  const loading =
    vehiclesLoading ||
    tripsLoading ||
    expensesLoading ||
    invoicesLoading ||
    reportsLoading ||
    maintenanceLoading ||
    driversLoading;

  // Calculate metrics
  const activeTrips = trips.filter((t) =>
    ["in_transit", "loading", "pending"].includes(t.status),
  );
  const completedTrips = trips.filter((t) => t.status === "completed");
  const totalRevenue = completedTrips.reduce(
    (sum, t) => sum + (Number(t.revenue || t.price) || 0),
    0,
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const unpaidInvoices = invoices.filter((i) => {
    const s = (i.status || "").toLowerCase();
    return s && !["paid", "settled", "closed"].includes(s);
  });

  // Fleet status counts
  const availableVehicles = vehicles.filter(
    (v) => v.status === "available",
  ).length;
  const inUseVehicles = vehicles.filter((v) => v.status === "in_use").length;
  const maintenanceVehicles = vehicles.filter(
    (v) => v.status === "maintenance",
  ).length;

  // Cross-border trips
  const crossBorderTrips = activeTrips.filter((trip) => {
    const dest = (trip.destination || "").toLowerCase();
    return (
      dest.includes("border") ||
      dest.includes("dr congo") ||
      dest.includes("kenya") ||
      dest.includes("zambia") ||
      dest.includes("burundi") ||
      dest.includes("rwanda") ||
      dest.includes("uganda")
    );
  }).length;

  // Cold chain trips
  const coldChainTrips = activeTrips.filter(
    (t) =>
      t.has_reefer ||
      t.cargo_type === "REEFER" ||
      t.cargo_type === "cold_chain",
  ).length;

  // Heavy cargo trips
  const heavyCargoTrips = activeTrips.filter((t) =>
    ["LOWBED", "heavy_equipment", "machinery"].includes(
      t.cargo_type?.toUpperCase() || "",
    ),
  ).length;

  // Alerts
  const alerts = [
    {
      id: "1",
      title: "Vehicle Maintenance Due",
      description:
        "3 vehicles are due for scheduled maintenance within the next 7 days.",
      severity: "warning" as const,
      time: "2 hours ago",
    },
    {
      id: "2",
      title: "High Fuel Consumption",
      description:
        "Vehicle TRK-007 has exceeded fuel consumption threshold by 15%.",
      severity: "critical" as const,
      time: "1 hour ago",
    },
    {
      id: "3",
      title: "New Trip Completed",
      description:
        "Trip from Nairobi to Mombasa has been completed successfully.",
      severity: "info" as const,
      time: "30 minutes ago",
    },
  ];

  // Recent activities
  const activities = [
    {
      id: "1",
      title: "Trip #T001 Completed",
      description: "Nairobi → Mombasa | Driver: John Doe",
      time: "2 hours ago",
      icon: CheckCircle2,
      color: "bg-green-500",
    },
    {
      id: "2",
      title: "New Vehicle Added",
      description: "Toyota Hilux - Plate: KDJ-123X",
      time: "3 hours ago",
      icon: Plus,
      color: "bg-blue-500",
    },
    {
      id: "3",
      title: "Expense Report Submitted",
      description: "Fuel expense of KES 15,000 by Driver Jane",
      time: "4 hours ago",
      icon: FileText,
      color: "bg-amber-500",
    },
    {
      id: "4",
      title: "Maintenance Request Created",
      description: "Engine check for Truck TRK-005",
      time: "5 hours ago",
      icon: Wrench,
      color: "bg-red-500",
    },
  ];

  // Monthly data for chart
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentReport = reports.find((r) =>
    (r.month || "").toString().startsWith(currentMonth),
  );
  const recentReports = reports.slice(0, 6);

  // Vehicle utilization
  const utilizationRate =
    vehicles.length > 0 ? (inUseVehicles / vehicles.length) * 100 : 0;

  // Cost per trip
  const costPerTrip =
    completedTrips.length > 0 ? totalExpenses / completedTrips.length : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="CEO Dashboard"
      description="Fleet overview and strategic insights"
      role={role || "CEO"}
    >
      {/* Alert Panel */}
      <AlertPanel alerts={alerts} />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard
          title="Total Fleet"
          value={vehicles.length}
          icon={Truck}
          color="text-blue-600"
          bgColor="bg-blue-50"
          link="/fleet"
        />
        <StatCard
          title="Active Trips"
          value={activeTrips.length}
          icon={Navigation}
          color="text-green-600"
          bgColor="bg-green-50"
          link="/trips"
        />
        <StatCard
          title="Monthly Revenue"
          value={format(totalRevenue)}
          icon={DollarSign}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          link="/finance"
        />
        <StatCard
          title="Cross-Border"
          value={crossBorderTrips}
          icon={Globe}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Cold Chain"
          value={coldChainTrips}
          icon={Thermometer}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
        />
        <StatCard
          title="Heavy Cargo"
          value={heavyCargoTrips}
          icon={Package}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          title="Total Drivers"
          value={drivers.length}
          icon={Users}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
        <StatCard
          title="Unpaid Invoices"
          value={unpaidInvoices.length}
          icon={FileText}
          color="text-orange-600"
          bgColor="bg-orange-50"
          link="/finance"
        />
      </div>

      {/* Revenue & Profit Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="size-5" />
              Revenue & Profit Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-bold text-green-600">
                  {format(totalRevenue)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-bold text-red-600">
                  {format(totalExpenses)}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Net Profit</p>
                <p
                  className={`text-lg font-bold ${netProfit >= 0 ? "text-blue-600" : "text-red-600"}`}
                >
                  {format(netProfit)}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Completed Trips</p>
                <p className="text-lg font-bold text-purple-600">
                  {completedTrips.length}
                </p>
              </div>
            </div>
            {/* Simple bar chart using divs */}
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-medium">Monthly Revenue Trend</h4>
              <div className="flex items-end gap-2 h-32">
                {recentReports.map((report, i) => {
                  const height = Math.max(
                    20,
                    (Number(report.total_revenue || 0) /
                      Math.max(
                        ...recentReports.map((r) =>
                          Number(r.total_revenue || 0),
                        ),
                        1,
                      )) *
                      100,
                  );
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary rounded-t-sm flex flex-col items-center justify-end h-full"
                      style={{ height: `${height}%` }}
                    >
                      <span className="text-[8px] text-muted-foreground mb-1">
                        {new Date(report.month).toLocaleDateString("en-US", {
                          month: "short",
                        })}
                      </span>
                      <span className="text-[8px] font-bold text-primary-foreground">
                        {format(Number(report.total_revenue || 0))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" />
              Key Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                Fleet Utilization
              </span>
              <Badge
                variant={
                  utilizationRate > 70
                    ? "default"
                    : utilizationRate > 40
                      ? "secondary"
                      : "destructive"
                }
              >
                {utilizationRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                Cost Per Trip
              </span>
              <span className="text-sm font-bold">{format(costPerTrip)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                Profit Margin
              </span>
              <span
                className={`text-sm font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {totalRevenue > 0
                  ? ((netProfit / totalRevenue) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                Avg Revenue/Trip
              </span>
              <span className="text-sm font-bold">
                {completedTrips.length > 0
                  ? format(totalRevenue / completedTrips.length)
                  : format(0)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                Active Drivers
              </span>
              <span className="text-sm font-bold">
                {drivers.filter((d) => d.status === "active").length}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                Vehicles Available
              </span>
              <span className="text-sm font-bold">{availableVehicles}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Status & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Vehicle Fleet */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="size-5" />
              Fleet Status
            </CardTitle>
            <Badge variant="secondary">{vehicles.length} vehicles</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {availableVehicles}
                </p>
                <p className="text-[10px] text-muted-foreground">Available</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {inUseVehicles}
                </p>
                <p className="text-[10px] text-muted-foreground">In Use</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {maintenanceVehicles}
                </p>
                <p className="text-[10px] text-muted-foreground">Maintenance</p>
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
              data={vehicles}
            />
          </CardContent>
        </Card>

        {/* Recent Activities & Active Trips */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" />
                Recent Activities
              </CardTitle>
              <Badge variant="secondary">{activities.length} new</Badge>
            </CardHeader>
            <CardContent>
              <ActivityFeed activities={activities} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Navigation className="size-5" />
                Active Trips
              </CardTitle>
              <Badge variant="secondary">{activeTrips.length} active</Badge>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "tripNumber", label: "Trip #" },
                  { key: "origin", label: "Origin" },
                  { key: "destination", label: "Destination" },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <Badge
                        variant={
                          row.status === "in_transit"
                            ? "default"
                            : row.status === "loading"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {row.status?.replace("_", " ")}
                      </Badge>
                    ),
                  },
                ]}
                data={activeTrips.slice(0, 5)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Financial Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-5" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="reports">Monthly Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    {format(totalRevenue)}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">
                    Total Expenses
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {format(totalExpenses)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Net Profit</p>
                  <p
                    className={`text-2xl font-bold ${netProfit >= 0 ? "text-blue-600" : "text-red-600"}`}
                  >
                    {format(netProfit)}
                  </p>
                </div>
              </div>
              {currentReport && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="text-sm font-bold mb-2">
                    Current Month Report ({currentMonth})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Revenue
                      </p>
                      <p className="text-sm font-semibold text-green-600">
                        {format(Number(currentReport.total_revenue || 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Expenses
                      </p>
                      <p className="text-sm font-semibold text-red-600">
                        {format(Number(currentReport.total_expenses || 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Allowances
                      </p>
                      <p className="text-sm font-semibold text-blue-600">
                        {format(Number(currentReport.total_allowances || 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Net Profit
                      </p>
                      <p
                        className={`text-sm font-semibold ${Number(currentReport.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {format(Number(currentReport.net_profit || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="expenses">
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
                data={expenses.slice(0, 10)}
              />
            </TabsContent>
            <TabsContent value="invoices">
              <DataTable
                columns={[
                  { key: "invoice_number", label: "Invoice #" },
                  { key: "client", label: "Client" },
                  { key: "amount", label: "Amount" },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <Badge
                        variant={
                          row.status === "paid" ? "default" : "destructive"
                        }
                      >
                        {row.status}
                      </Badge>
                    ),
                  },
                ]}
                data={invoices.slice(0, 10)}
              />
            </TabsContent>
            <TabsContent value="reports">
              <DataTable
                columns={[
                  {
                    key: "month",
                    label: "Month",
                    render: (row) =>
                      new Date(row.month).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      }),
                  },
                  {
                    key: "total_revenue",
                    label: "Revenue",
                    render: (row) => (
                      <span className="text-green-600">
                        {format(Number(row.total_revenue || 0))}
                      </span>
                    ),
                  },
                  {
                    key: "total_expenses",
                    label: "Expenses",
                    render: (row) => (
                      <span className="text-red-600">
                        {format(Number(row.total_expenses || 0))}
                      </span>
                    ),
                  },
                  {
                    key: "net_profit",
                    label: "Net Profit",
                    render: (row) => (
                      <span
                        className={`font-semibold ${Number(row.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {format(Number(row.net_profit || 0))}
                      </span>
                    ),
                  },
                ]}
                data={recentReports}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
