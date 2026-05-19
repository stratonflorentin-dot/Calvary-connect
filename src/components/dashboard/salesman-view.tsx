"use client";

import { DashboardLayout, StatCard, DataTable, ActivityFeed, AlertPanel } from "@/components/dashboard/shared/dashboard-layout";
import { useTrips } from "@/hooks/data/use-trips";
import { useExpenses } from "@/hooks/data/use-expenses";
import { useInvoices } from "@/hooks/data/use-invoices";
import { useRole } from "@/hooks/use-role";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase, DollarSign, Users, Calendar, TrendingUp, BarChart2,
  CheckCircle2, Clock, AlertTriangle, Eye, FileText, MapPin,
  Navigation, Package, ArrowRight, RefreshCw, Settings, Bell,
  Sparkles, Shield, Plus, Trash2, Edit, Locate, Truck,
  Calculator
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function SalesmanDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();

  // Data hooks
  const { trips, loading: tripsLoading } = useTrips();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { invoices, loading: invoicesLoading } = useInvoices();

  const loading = tripsLoading || expensesLoading || invoicesLoading;

  // Calculate metrics
  const completedTrips = trips.filter(t => t.status === "completed");
  const pendingTrips = trips.filter(t => t.status === "pending" || t.status === "created");
  const activeTrips = trips.filter(t => ["in_transit", "loading"].includes(t.status));
  const totalRevenue = completedTrips.reduce((sum, t) => sum + (Number(t.revenue || t.price) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const unpaidInvoices = invoices.filter(i => {
    const s = (i.status || "").toLowerCase();
    return s && !["paid", "settled", "closed"].includes(s);
  });

  // Client revenue breakdown
  const clientRevenue = completedTrips.reduce((acc: Record<string, number>, trip) => {
    const client = trip.client || "Unknown";
    acc[client] = (acc[client] || 0) + (Number(trip.revenue || trip.price) || 0);
    return acc;
  }, {});

  // Trip type breakdown
  const tripTypes = completedTrips.reduce((acc: Record<string, number>, trip) => {
    const type = trip.cargo_type || "General";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // Alerts
  const alerts = [
    {
      id: "1",
      title: "Pending Invoices",
      description: `${unpaidInvoices.length} invoices are pending collection.`,
      severity: "warning" as const,
      time: "1 day ago"
    },
    {
      id: "2",
      title: "Monthly Target",
      description: `You've achieved ${completedTrips.length} trips this month.`,
      severity: "info" as const,
      time: "3 hours ago"
    }
  ];

  // Recent activities
  const activities = [
    {
      id: "1",
      title: "Trip Completed",
      description: "Nairobi → Mombasa | Revenue: KES 45,000",
      time: "2 hours ago",
      icon: CheckCircle2,
      color: "bg-green-500"
    },
    {
      id: "2",
      title: "New Client Added",
      description: "ABC Corporation - Nairobi Branch",
      time: "4 hours ago",
      icon: Users,
      color: "bg-blue-500"
    },
    {
      id: "3",
      title: "Invoice Paid",
      description: "INV-001 received payment of KES 30,000",
      time: "6 hours ago",
      icon: DollarSign,
      color: "bg-emerald-500"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Sales Dashboard"
      description="Sales tracking and client management"
      role={role || "SALESMAN"}
    >
      {/* Alert Panel */}
      <AlertPanel alerts={alerts} />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={format(totalRevenue)}
          icon={DollarSign}
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
          title="Active Trips"
          value={activeTrips.length}
          icon={Navigation}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
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
          title="Unpaid Invoices"
          value={unpaidInvoices.length}
          icon={FileText}
          color="text-orange-600"
          bgColor="bg-orange-50"
        />
        <StatCard
          title="Net Earnings"
          value={format(totalRevenue - totalExpenses)}
          icon={TrendingUp}
          color={totalRevenue - totalExpenses >= 0 ? "text-green-600" : "text-red-600"}
          bgColor={totalRevenue - totalExpenses >= 0 ? "bg-green-50" : "bg-red-50"}
        />
        <StatCard
          title="Clients"
          value={Object.keys(clientRevenue).length}
          icon={Users}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
      </div>

      {/* Revenue & Sales Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="size-5" />
              Revenue & Trip Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-bold text-green-600">{format(totalRevenue)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-bold text-red-600">{format(totalExpenses)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Completed Trips</p>
                <p className="text-lg font-bold text-blue-600">{completedTrips.length}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Avg Revenue/Trip</p>
                <p className="text-lg font-bold text-purple-600">
                  {completedTrips.length > 0
                    ? format(totalRevenue / completedTrips.length)
                    : format(0)}
                </p>
              </div>
            </div>
            {/* Trip Type Distribution */}
            <h4 className="text-sm font-medium mb-3">Trip Type Distribution</h4>
            <div className="space-y-2">
              {Object.entries(tripTypes).map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-muted-foreground truncate">{type}</div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${completedTrips.length > 0 ? (count / completedTrips.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm font-medium">{count} trips</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Top Clients */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="size-5" />
                Top Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.entries(clientRevenue)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([client, revenue], i) => (
                  <div key={i} className="flex items-center justify-between p-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium">{client}</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">{format(revenue)}</span>
                  </div>
                ))}
              {Object.keys(clientRevenue).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No client data available</p>
              )}
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

      {/* Trip & Invoice Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Navigation className="size-5" />
              Trip History
            </CardTitle>
            <Badge variant="secondary">{completedTrips.length} completed</Badge>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="completed">
              <TabsList>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="active">Active ({activeTrips.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingTrips.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="completed">
                <DataTable
                  columns={[
                    { key: "tripNumber", label: "Trip #" },
                    { key: "origin", label: "Origin" },
                    { key: "destination", label: "Destination" },
                    { key: "client", label: "Client" },
                    { key: "revenue", label: "Revenue", render: (row) => format(Number(row.revenue || row.price || 0)) },
                  ]}
                  data={completedTrips.slice(0, 10)}
                />
              </TabsContent>
              <TabsContent value="active">
                <DataTable
                  columns={[
                    { key: "tripNumber", label: "Trip #" },
                    { key: "origin", label: "Origin" },
                    { key: "destination", label: "Destination" },
                    { key: "status", label: "Status", render: (row) => (
                      <Badge variant="default">
                        {row.status?.replace("_", " ")}
                      </Badge>
                    )},
                  ]}
                  data={activeTrips.slice(0, 10)}
                />
              </TabsContent>
              <TabsContent value="pending">
                <DataTable
                  columns={[
                    { key: "tripNumber", label: "Trip #" },
                    { key: "origin", label: "Origin" },
                    { key: "destination", label: "Destination" },
                    { key: "status", label: "Status", render: (row) => (
                      <Badge variant="outline">
                        {row.status?.replace("_", " ")}
                      </Badge>
                    )},
                  ]}
                  data={pendingTrips.slice(0, 10)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Invoices
            </CardTitle>
            <Badge variant="destructive">{unpaidInvoices.length} unpaid</Badge>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "invoice_number", label: "Invoice #" },
                { key: "client", label: "Client" },
                { key: "amount", label: "Amount" },
                { key: "status", label: "Status", render: (row) => (
                  <Badge variant={row.status === "paid" ? "default" : "destructive"}>
                    {row.status}
                  </Badge>
                )},
              ]}
              data={invoices.slice(0, 10)}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
