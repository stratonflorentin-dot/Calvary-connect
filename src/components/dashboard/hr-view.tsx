"use client";

import {
  DashboardLayout,
  StatCard,
  DataTable,
  ActivityFeed,
  AlertPanel,
} from "@/components/dashboard/shared/dashboard-layout";
import { useUsers } from "@/hooks/data/use-users";
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
  Users,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Edit,
  Eye,
  FileText,
  Calendar,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Shield,
  AlertCircle,
  TrendingUp,
  BarChart2,
  Settings,
  Bell,
  Sparkles,
  ArrowRight,
  Navigation,
  Package,
  DollarSign,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { DriverLocationMap } from "@/components/driver-location-map";

export default function HRDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();

  // Data hooks
  const { users: employees, loading: employeesLoading } = useUsers();
  const { users: drivers, loading: driversLoading } = useUsers({
    role: "DRIVER",
  });
  const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
  const { trips, loading: tripsLoading } = useTrips();

  const loading =
    employeesLoading || driversLoading || vehiclesLoading || tripsLoading;

  // Calculate metrics
  const activeEmployees = employees.filter((e) => e.status === "active").length;
  const inactiveEmployees = employees.filter(
    (e) => e.status === "inactive",
  ).length;
  const totalDrivers = drivers.length;
  const activeTrips = trips.filter((t) =>
    ["in_transit", "loading", "pending"].includes(t.status),
  );

  // License expiry alerts
  const licenseExpiryAlerts = drivers.filter((d) => {
    if (!d.license_expiry) return false;
    const expiry = new Date(d.license_expiry);
    const daysUntilExpiry = Math.floor(
      (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  });

  // Alerts
  const alerts = [
    {
      id: "1",
      title: "Driver License Expiry",
      description: `${licenseExpiryAlerts.length} drivers have licenses expiring within 30 days.`,
      severity: "warning" as const,
      time: "1 day ago",
    },
    {
      id: "2",
      title: "New Employee Onboarding",
      description: "3 new employees are pending onboarding completion.",
      severity: "info" as const,
      time: "3 hours ago",
    },
  ];

  // Recent activities
  const activities = [
    {
      id: "1",
      title: "New Driver Added",
      description: "John Doe - License: ABC-12345",
      time: "2 hours ago",
      icon: CheckCircle2,
      color: "bg-green-500",
    },
    {
      id: "2",
      title: "Employee Status Updated",
      description: "Jane Smith - Status changed to Active",
      time: "4 hours ago",
      icon: Users,
      color: "bg-blue-500",
    },
    {
      id: "3",
      title: "License Renewal Reminder",
      description: "Driver Mike - License expires in 15 days",
      time: "6 hours ago",
      icon: AlertTriangle,
      color: "bg-amber-500",
    },
  ];

  // Employee distribution by role
  const roleDistribution = employees.reduce(
    (acc: Record<string, number>, emp) => {
      const r = emp.role || "Unknown";
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    },
    {},
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading HR data...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="HR Dashboard"
      description="Employee management and workforce analytics"
      role={role || "HR"}
      hideSidebar={true}
    >
      {/* Alert Panel */}
      <AlertPanel alerts={alerts} />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard
          title="Total Employees"
          value={employees.length}
          icon={Users}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Active Employees"
          value={activeEmployees}
          icon={CheckCircle2}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Total Drivers"
          value={totalDrivers}
          icon={Truck}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
        <StatCard
          title="Active Trips"
          value={activeTrips.length}
          icon={Navigation}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
        />
        <StatCard
          title="License Alerts"
          value={licenseExpiryAlerts.length}
          icon={AlertTriangle}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          title="Vehicles"
          value={vehicles.length}
          icon={Package}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Fleet Utilization"
          value={`${vehicles.length > 0 ? ((activeTrips.length / vehicles.length) * 100).toFixed(1) : 0}%`}
          icon={TrendingUp}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="Departments"
          value={Object.keys(roleDistribution).length}
          icon={Briefcase}
          color="text-orange-600"
          bgColor="bg-orange-50"
        />
      </div>

      {/* Employee & Fleet Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Employee Directory */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Employee Directory
            </CardTitle>
            <Badge variant="secondary">{employees.length} employees</Badge>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All ({employees.length})</TabsTrigger>
                <TabsTrigger value="active">
                  Active ({activeEmployees})
                </TabsTrigger>
                <TabsTrigger value="drivers">
                  Drivers ({totalDrivers})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <DataTable
                  columns={[
                    { key: "name", label: "Name" },
                    { key: "email", label: "Email" },
                    { key: "phone", label: "Phone" },
                    { key: "role", label: "Role" },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => (
                        <Badge
                          variant={
                            row.status === "active" ? "default" : "secondary"
                          }
                        >
                          {row.status}
                        </Badge>
                      ),
                    },
                  ]}
                  data={employees.slice(0, 15)}
                />
              </TabsContent>
              <TabsContent value="active">
                <DataTable
                  columns={[
                    { key: "name", label: "Name" },
                    { key: "email", label: "Email" },
                    { key: "phone", label: "Phone" },
                    { key: "role", label: "Role" },
                  ]}
                  data={employees
                    .filter((e) => e.status === "active")
                    .slice(0, 15)}
                />
              </TabsContent>
              <TabsContent value="drivers">
                <DataTable
                  columns={[
                    { key: "name", label: "Name" },
                    { key: "email", label: "Email" },
                    { key: "phone", label: "Phone" },
                    { key: "license_number", label: "License #" },
                    {
                      key: "license_expiry",
                      label: "License Expiry",
                      render: (row) => (
                        <span
                          className={`text-sm ${new Date(row.license_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "text-amber-600 font-medium" : ""}`}
                        >
                          {new Date(row.license_expiry).toLocaleDateString()}
                        </span>
                      ),
                    },
                  ]}
                  data={drivers.slice(0, 15)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Workforce Analytics & Role Distribution */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="size-5" />
                Role Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(roleDistribution).map(([role, count]) => (
                  <div key={role} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{role}</span>
                      <span className="font-medium">{count} employees</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{
                          width: `${(count / employees.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5" />
                License Expiry Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {licenseExpiryAlerts.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="size-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No license expiry alerts
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {licenseExpiryAlerts.map((driver, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-amber-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">
                          License: {driver.license_number}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        Expires:{" "}
                        {new Date(driver.license_expiry).toLocaleDateString()}
                      </Badge>
                    </div>
                  ))}
                </div>
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

      <div className="mb-6">
        <DriverLocationMap />
      </div>

      {/* Add Employee Button */}
      <div className="flex justify-end mb-6">
        <Button
          onClick={() => {
            /* Add employee logic */
          }}
        >
          <Plus className="size-4 mr-2" /> Add Employee
        </Button>
      </div>
    </DashboardLayout>
  );
}

export { HRDashboard as HRView };
