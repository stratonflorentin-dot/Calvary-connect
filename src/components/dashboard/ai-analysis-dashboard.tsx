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
import { useMonthlyReports } from "@/hooks/data/use-monthly-reports";
import { useUsers } from "@/hooks/data/use-users";
import { useRole } from "@/hooks/use-role";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Truck,
  Navigation,
  DollarSign,
  Users,
  Package,
  MapPin,
  BarChart2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Settings,
  Bell,
  Eye,
  FileText,
  Calendar,
  Calculator,
  Briefcase,
  Globe,
  Thermometer,
  Anchor,
  Route,
  LayoutDashboard,
  Wrench,
  Plus,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

export default function AIAnalysisDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();

  // Data hooks
  const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
  const { trips, loading: tripsLoading } = useTrips();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { reports, loading: reportsLoading } = useMonthlyReports();
  const { users: drivers, loading: driversLoading } = useUsers({
    role: "DRIVER",
  });

  const loading =
    vehiclesLoading ||
    tripsLoading ||
    expensesLoading ||
    reportsLoading ||
    driversLoading;

  // Calculate comprehensive metrics
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

  // Fleet metrics
  const availableVehicles = vehicles.filter(
    (v) => v.status === "available",
  ).length;
  const inUseVehicles = vehicles.filter((v) => v.status === "in_use").length;
  const maintenanceVehicles = vehicles.filter(
    (v) => v.status === "maintenance",
  ).length;
  const fleetUtilization =
    vehicles.length > 0 ? (inUseVehicles / vehicles.length) * 100 : 0;

  // Trip analysis
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

  const coldChainTrips = activeTrips.filter(
    (t) =>
      t.has_reefer ||
      t.cargo_type === "REEFER" ||
      t.cargo_type === "cold_chain",
  ).length;

  const heavyCargoTrips = activeTrips.filter((t) =>
    ["LOWBED", "heavy_equipment", "machinery"].includes(
      t.cargo_type?.toUpperCase() || "",
    ),
  ).length;

  // Cost analysis
  const costPerTrip =
    completedTrips.length > 0 ? totalExpenses / completedTrips.length : 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Monthly trend data
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentReport = reports.find((r) =>
    (r.month || "").toString().startsWith(currentMonth),
  );
  const recentReports = reports.slice(0, 6);

  // AI-generated insights
  const aiInsights = useMemo(() => {
    const insights: string[] = [];

    if (fleetUtilization < 50 && vehicles.length > 0) {
      insights.push(
        `Low fleet utilization detected (${fleetUtilization.toFixed(1)}%). Consider optimizing trip assignments to improve efficiency.`,
      );
    }

    if (netProfit < 0) {
      insights.push(
        `Operating at a loss of ${format(Math.abs(netProfit))}. Review expense categories for cost reduction opportunities.`,
      );
    }

    if (profitMargin > 20) {
      insights.push(
        `Strong profit margin of ${profitMargin.toFixed(1)}%. Consider expanding fleet capacity to meet demand.`,
      );
    }

    if (crossBorderTrips > 0) {
      insights.push(
        `${crossBorderTrips} active cross-border trips. Ensure compliance with regional customs and transit regulations.`,
      );
    }

    if (coldChainTrips > 0) {
      insights.push(
        `${coldChainTrips} cold chain trips in progress. Monitor temperature-sensitive cargo closely.`,
      );
    }

    if (maintenanceVehicles > vehicles.length * 0.3) {
      insights.push(
        `High maintenance ratio (${maintenanceVehicles} vehicles). Review fleet age and consider replacement strategy.`,
      );
    }

    if (completedTrips.length > 0) {
      const avgRevenue = totalRevenue / completedTrips.length;
      insights.push(
        `Average revenue per trip: ${format(avgRevenue)}. Compare against cost per trip (${format(costPerTrip)}) for profitability assessment.`,
      );
    }

    if (insights.length === 0) {
      insights.push(
        "Fleet operations are running within normal parameters. Continue monitoring key metrics.",
      );
    }

    return insights;
  }, [
    fleetUtilization,
    vehicles.length,
    netProfit,
    profitMargin,
    crossBorderTrips,
    coldChainTrips,
    maintenanceVehicles,
    completedTrips.length,
    totalRevenue,
    costPerTrip,
    format,
  ]);

  // Alerts
  const alerts = [
    {
      id: "1",
      title: "AI Analysis Complete",
      description: `${aiInsights.length} actionable insights generated from fleet data.`,
      severity: "info" as const,
      time: "Just now",
    },
    ...(netProfit < 0
      ? [
          {
            id: "2",
            title: "Operating Loss Detected",
            description: `Fleet is operating at a loss of ${format(Math.abs(netProfit))}. Immediate review recommended.`,
            severity: "critical" as const,
            time: "Based on current data",
          },
        ]
      : []),
    ...(fleetUtilization < 30
      ? [
          {
            id: "3",
            title: "Low Utilization Alert",
            description: `Fleet utilization is only ${fleetUtilization.toFixed(1)}%. Consider reducing active vehicles or increasing trip volume.`,
            severity: "warning" as const,
            time: "Based on current data",
          },
        ]
      : []),
  ];

  // Activity feed
  const activities = [
    {
      id: "1",
      title: "AI Analysis Generated",
      description: `Processed ${completedTrips.length} completed trips and ${vehicles.length} vehicles`,
      time: "Just now",
      icon: Sparkles,
      color: "bg-blue-500",
    },
    {
      id: "2",
      title: "Revenue Milestone",
      description: `Monthly revenue reached ${format(totalRevenue)}`,
      time: "Based on data",
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      id: "3",
      title: "Fleet Optimization",
      description: `${fleetUtilization.toFixed(1)}% fleet utilization detected`,
      time: "Based on data",
      icon: TrendingUp,
      color: "bg-amber-500",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading AI analysis data...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="AI Fleet Analysis"
      description="Intelligent insights powered by fleet data analysis"
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
        />
        <StatCard
          title="Active Trips"
          value={activeTrips.length}
          icon={Navigation}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Monthly Revenue"
          value={format(totalRevenue)}
          icon={DollarSign}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="Fleet Utilization"
          value={`${fleetUtilization.toFixed(1)}%`}
          icon={TrendingUp}
          color={
            fleetUtilization > 70
              ? "text-green-600"
              : fleetUtilization > 40
                ? "text-amber-600"
                : "text-red-600"
          }
          bgColor={
            fleetUtilization > 70
              ? "bg-green-50"
              : fleetUtilization > 40
                ? "bg-amber-50"
                : "bg-red-50"
          }
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
          title="Cost Per Trip"
          value={format(costPerTrip)}
          icon={Calculator}
          color="text-orange-600"
          bgColor="bg-orange-50"
        />
        <StatCard
          title="Net Profit"
          value={format(netProfit)}
          icon={DollarSign}
          color={netProfit >= 0 ? "text-green-600" : "text-red-600"}
          bgColor={netProfit >= 0 ? "bg-green-50" : "bg-red-50"}
        />
      </div>

      {/* AI Insights & Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* AI Insights */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI-Generated Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsights.map((insight, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center shrink-0",
                      insight.includes("loss") || insight.includes("Low")
                        ? "bg-red-100 text-red-600"
                        : insight.includes("strong") ||
                            insight.includes("profit")
                          ? "bg-green-100 text-green-600"
                          : "bg-blue-100 text-blue-600",
                    )}
                  >
                    <Sparkles className="size-4" />
                  </div>
                  <p className="text-sm">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="size-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentReports.map((report, i) => {
                const maxRevenue = Math.max(
                  ...recentReports.map((r) => Number(r.total_revenue || 0)),
                  1,
                );
                const height =
                  (Number(report.total_revenue || 0) / maxRevenue) * 100;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20">
                      {new Date(report.month).toLocaleDateString("en-US", {
                        month: "short",
                      })}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium w-20 text-right">
                      {format(Number(report.total_revenue || 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle & Trip Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
              data={vehicles.slice(0, 8)}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivityFeed activities={activities} />
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="size-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="expenses">Expenses</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground">
                        Total Revenue
                      </p>
                      <p className="text-lg font-bold text-green-600">
                        {format(totalRevenue)}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground">
                        Total Expenses
                      </p>
                      <p className="text-lg font-bold text-red-600">
                        {format(totalExpenses)}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground">
                        Net Profit
                      </p>
                      <p
                        className={`text-lg font-bold ${netProfit >= 0 ? "text-blue-600" : "text-red-600"}`}
                      >
                        {format(netProfit)}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground">
                        Completed Trips
                      </p>
                      <p className="text-lg font-bold text-purple-600">
                        {completedTrips.length}
                      </p>
                    </div>
                  </div>
                  {currentReport && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <h4 className="text-sm font-bold mb-2">
                        Current Month ({currentMonth})
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
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
                    ]}
                    data={expenses.slice(0, 10)}
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
        </div>
      </div>
    </DashboardLayout>
  );
}

export { AIAnalysisDashboard };
