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
  TrendingUp, Users, FileText, DollarSign, Target, 
  Activity, ArrowUpRight, Calendar, CheckCircle, Clock, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function SalesDashboard() {
  const { toast } = useToast();
  const { role, hasDepartmentAccess } = useRole();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    totalCustomers: 0,
    totalQuotations: 0,
    draftQuotations: 0,
    approvedQuotations: 0,
    sentQuotations: 0,
    convertedQuotations: 0,
    totalContracts: 0,
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    totalPipelineValue: 0,
    monthlyRevenue: 0,
    conversionRate: 0,
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [pendingQuotations, setPendingQuotations] = useState<any[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        leadsData,
        customersData,
        quotationsData,
        contractsData,
        bookingsData,
      ] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("customers").select("*"),
        supabase.from("quotations").select("*").eq("status", "draft").limit(5),
        supabase.from("transport_contracts").select("*"),
        supabase.from("bookings").select("*"),
      ]);

      const allQuotations = await supabase.from("quotations").select("*");

      setStats({
        totalLeads: leadsData.data?.length || 0,
        newLeads: leadsData.data?.filter((l: any) => l.status === "new").length || 0,
        qualifiedLeads: leadsData.data?.filter((l: any) => l.status === "qualified").length || 0,
        convertedLeads: leadsData.data?.filter((l: any) => l.status === "converted").length || 0,
        totalCustomers: customersData.data?.length || 0,
        totalQuotations: allQuotations.data?.length || 0,
        draftQuotations: allQuotations.data?.filter((q: any) => q.status === "draft").length || 0,
        approvedQuotations: allQuotations.data?.filter((q: any) => q.status === "approved").length || 0,
        sentQuotations: allQuotations.data?.filter((q: any) => q.status === "sent").length || 0,
        convertedQuotations: allQuotations.data?.filter((q: any) => q.status === "converted").length || 0,
        totalContracts: contractsData.data?.length || 0,
        totalBookings: bookingsData.data?.length || 0,
        pendingBookings: bookingsData.data?.filter((b: any) => b.status === "pending").length || 0,
        confirmedBookings: bookingsData.data?.filter((b: any) => b.status === "confirmed").length || 0,
        totalPipelineValue: allQuotations.data?.reduce((sum: number, q: any) => sum + (q.total_amount || 0), 0) || 0,
        monthlyRevenue: bookingsData.data?.reduce((sum: number, b: any) => sum + (b.amount || 0), 0) || 0,
        conversionRate: leadsData.data?.length > 0 
          ? Math.round((leadsData.data.filter((l: any) => l.status === "converted").length / leadsData.data.length) * 100) 
          : 0,
      });

      setRecentLeads(leadsData.data || []);
      setPendingQuotations(quotationsData.data || []);
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

  if (!hasDepartmentAccess("SALES") && role !== "CEO" && role !== "ADMIN") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role || "CEO"} />
        <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Access denied. Sales dashboard requires Sales department access.</p>
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
              <h1 className="text-3xl font-bold text-foreground mb-2">Sales Dashboard</h1>
              <p className="text-muted-foreground">Sales pipeline performance and opportunities</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/sales/leads">
                  <Users className="size-4 mr-2" /> Manage Leads
                </Link>
              </Button>
              <Button onClick={loadDashboardData} disabled={loading}>
                <Activity className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
              </Button>
            </div>
          </div>

          {/* Pipeline Overview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Target className="size-5 text-primary" /> Pipeline Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">New Leads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.newLeads}</div>
                  <div className="text-xs text-muted-foreground mt-1">Fresh opportunities</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Qualified</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.qualifiedLeads}</div>
                  <div className="text-xs text-primary mt-1">Ready to quote</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Quotations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalQuotations}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats.draftQuotations} draft • {stats.approvedQuotations} approved
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalBookings}</div>
                  <div className="text-xs text-success mt-1">{stats.confirmedBookings} confirmed</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Conversion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Lead to customer</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Revenue Metrics */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="size-5 text-primary" /> Revenue Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">TZS {(stats.totalPipelineValue / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-primary mt-1 flex items-center">
                    <TrendingUp className="size-3 mr-1" /> Total quotations
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Booked Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">TZS {(stats.monthlyRevenue / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-success mt-1 flex items-center">
                    <TrendingUp className="size-3 mr-1" /> Confirmed bookings
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalContracts}</div>
                  <div className="text-xs text-accent mt-1">Active agreements</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Pending Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Pending Quotations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-warning" /> Pending Quotations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingQuotations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No pending quotations</p>
                ) : (
                  <div className="space-y-3">
                    {pendingQuotations.map((quote) => (
                      <div key={quote.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{quote.quotation_number}</p>
                          <p className="text-xs text-muted-foreground">
                            TZS {(quote.total_amount || 0).toLocaleString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/sales?tab=quotations`}>
                            Review <ArrowUpRight className="size-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Leads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-primary" /> Recent Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentLeads.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent leads</p>
                ) : (
                  <div className="space-y-3">
                    {recentLeads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{lead.company_name}</p>
                          <p className="text-xs text-muted-foreground">{lead.contact_person}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            lead.status === "new" ? "bg-primary/10 text-primary border-primary/20" :
                            lead.status === "qualified" ? "bg-success/10 text-success border-success/20" :
                            "bg-muted/50 text-muted-foreground border-border"
                          }
                        >
                          {lead.status}
                        </Badge>
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
                <Link href="/sales/leads">
                  <Users className="size-6" />
                  <span>Add Lead</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/sales?tab=quotations">
                  <FileText className="size-6" />
                  <span>New Quotation</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/sales?tab=contracts">
                  <CheckCircle className="size-6" />
                  <span>New Contract</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-24 flex-col gap-2">
                <Link href="/bookings">
                  <Calendar className="size-6" />
                  <span>View Bookings</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
