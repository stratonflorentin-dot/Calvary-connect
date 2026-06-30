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
  TrendingUp, TrendingDown, Users, Truck, DollarSign, 
  FileText, AlertCircle, CheckCircle, Clock, ArrowUpRight,
  Activity, BarChart3, PieChart, Calendar, Target
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function ManagementDashboard() {
  const { toast } = useToast();
  const { role, isAdmin } = useRole();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeLeads: 0,
    convertedLeads: 0,
    totalCustomers: 0,
    totalQuotations: 0,
    pendingQuotations: 0,
    approvedQuotations: 0,
    totalContracts: 0,
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    inProgressBookings: 0,
    totalTrips: 0,
    completedTrips: 0,
    inProgressTrips: 0,
    totalRevenue: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    pendingPODs: 0,
    verifiedPODs: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        leadsData,
        customersData,
        quotationsData,
        contractsData,
        bookingsData,
        tripsData,
        invoicesData,
        podsData,
      ] = await Promise.all([
        supabase.from("leads").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("quotations").select("*"),
        supabase.from("transport_contracts").select("*"),
        supabase.from("bookings").select("*"),
        supabase.from("trips").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("proof_of_delivery").select("*"),
      ]);

      setStats({
        totalLeads: leadsData.data?.length || 0,
        activeLeads: leadsData.data?.filter((l: any) => l.status === "new" || l.status === "contacted").length || 0,
        convertedLeads: leadsData.data?.filter((l: any) => l.status === "converted").length || 0,
        totalCustomers: customersData.data?.length || 0,
        totalQuotations: quotationsData.data?.length || 0,
        pendingQuotations: quotationsData.data?.filter((q: any) => q.status === "draft").length || 0,
        approvedQuotations: quotationsData.data?.filter((q: any) => q.status === "approved").length || 0,
        totalContracts: contractsData.data?.length || 0,
        totalBookings: bookingsData.data?.length || 0,
        pendingBookings: bookingsData.data?.filter((b: any) => b.status === "pending").length || 0,
        confirmedBookings: bookingsData.data?.filter((b: any) => b.status === "confirmed").length || 0,
        inProgressBookings: bookingsData.data?.filter((b: any) => b.status === "in_progress").length || 0,
        totalTrips: tripsData.data?.length || 0,
        completedTrips: tripsData.data?.filter((t: any) => t.status === "COMPLETED").length || 0,
        inProgressTrips: tripsData.data?.filter((t: any) => t.status === "IN_PROGRESS" || t.status === "in_transit").length || 0,
        totalRevenue: tripsData.data?.reduce((sum: number, t: any) => sum + (t.totalAmount || 0), 0) || 0,
        totalInvoices: invoicesData.data?.length || 0,
        pendingInvoices: invoicesData.data?.filter((i: any) => i.status === "pending" || i.status === "sent").length || 0,
        paidInvoices: invoicesData.data?.filter((i: any) => i.status === "paid").length || 0,
        pendingPODs: podsData.data?.filter((p: any) => p.status === "pending").length || 0,
        verifiedPODs: podsData.data?.filter((p: any) => p.status === "verified").length || 0,
      });

      // Load recent activity from audit trail
      const { data: auditData } = await supabase
        .from("audit_trail")
        .select("*, auth.users(email, name)")
        .order("timestamp", { ascending: false })
        .limit(10);

      setRecentActivity(auditData || []);
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

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role || "CEO"} />
        <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Access denied. Management dashboard requires admin access.</p>
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
              <h1 className="text-3xl font-bold text-foreground mb-2">Management Dashboard</h1>
              <p className="text-muted-foreground">Enterprise-wide overview and key metrics</p>
            </div>
            <Button onClick={loadDashboardData} disabled={loading}>
              <Activity className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
          </div>

          {/* Sales Overview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" /> Sales Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLeads}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.activeLeads} active • {stats.convertedLeads} converted
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalCustomers}</div>
                  <div className="text-xs text-success mt-1 flex items-center">
                    <TrendingUp className="size-3 mr-1" /> Active accounts
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Quotations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalQuotations}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.pendingQuotations} pending • {stats.approvedQuotations} approved
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalContracts}</div>
                  <div className="text-xs text-primary mt-1">Active agreements</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Operations Overview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Truck className="size-5 text-primary" /> Operations Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalBookings}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.pendingBookings} pending • {stats.confirmedBookings} confirmed
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Trips</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalTrips}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.inProgressTrips} in progress • {stats.completedTrips} completed
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">PODs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingPODs + stats.verifiedPODs}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.pendingPODs} pending • {stats.verifiedPODs} verified
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalTrips > 0 ? Math.round((stats.completedTrips / stats.totalTrips) * 100) : 0}%
                  </div>
                  <div className="text-xs text-success mt-1 flex items-center">
                    <TrendingUp className="size-3 mr-1" /> Trip completion
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Finance Overview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="size-5 text-primary" /> Finance Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">TZS {(stats.totalRevenue / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-success mt-1 flex items-center">
                    <TrendingUp className="size-3 mr-1" /> From completed trips
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalInvoices}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.pendingInvoices} pending • {stats.paidInvoices} paid
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Collection Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalInvoices > 0 ? Math.round((stats.paidInvoices / stats.totalInvoices) * 100) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Invoice payment rate</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalLeads > 0 ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Lead to customer</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Target className="size-5 text-primary" /> Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/sales/leads">
                  <Users className="size-6" />
                  <span>Manage Leads</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/bookings">
                  <Calendar className="size-6" />
                  <span>View Bookings</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/trips">
                  <Truck className="size-6" />
                  <span>Manage Trips</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/finance">
                  <BarChart3 className="size-6" />
                  <span>Finance Reports</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="size-5 text-primary" /> Recent Activity
            </h2>
            <Card>
              <CardContent className="p-4">
                {recentActivity.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className={cn(
                          "size-8 rounded-full flex items-center justify-center",
                          activity.action === "create" && "bg-success/10 text-success",
                          activity.action === "update" && "bg-primary/10 text-primary",
                          activity.action === "delete" && "bg-destructive/10 text-destructive",
                          activity.action === "approve" && "bg-accent/10 text-accent"
                        )}>
                          {activity.action === "create" && <CheckCircle className="size-4" />}
                          {activity.action === "update" && <FileText className="size-4" />}
                          {activity.action === "delete" && <AlertCircle className="size-4" />}
                          {activity.action === "approve" && <CheckCircle className="size-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(activity as any).auth?.users?.email || "System"} • {format(new Date(activity.timestamp), "MMM dd, HH:mm")}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.module}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
