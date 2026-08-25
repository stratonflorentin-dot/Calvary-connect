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

function formatShort(v: number, cur: string): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${cur} ${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${cur} ${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${cur} ${(v / 1_000).toFixed(1)}K`;
  return `${cur} ${v.toFixed(0)}`;
}

function formatByCurrency(byCurrency: Record<string, number>): string {
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) return formatShort(0, "TZS");
  return entries.map(([cur, amt]) => formatShort(amt, cur)).join(" · ");
}

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
    totalPipelineValueByCurrency: {} as Record<string, number>,
    monthlyRevenueByCurrency: {} as Record<string, number>,
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
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("customers").select("*"),
        supabase.from("quotations").select("*").eq("status", "draft").limit(5),
        supabase.from("contracts").select("*"),
        supabase.from("bookings").select("*"),
      ]);

      const allQuotations = await supabase.from("quotations").select("*");
      const leads = leadsData.data ?? [];
      const customers = customersData.data ?? [];
      const allQuotationRows = allQuotations.data ?? [];
      const contractRows = contractsData.data ?? [];
      const bookingRows = bookingsData.data ?? [];
      const pendingQuotationRows = quotationsData.data ?? [];

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const bookedThisMonth = bookingRows.filter((b: any) => {
        const createdAt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createdAt >= monthStart && ["confirmed", "in_progress", "completed"].includes(b.status);
      });

      setStats({
        totalLeads: leads.length,
        newLeads: leads.filter((l: any) => l.status === "new").length,
        qualifiedLeads: leads.filter((l: any) => l.status === "qualified").length,
        convertedLeads: leads.filter((l: any) => l.status === "converted").length,
        totalCustomers: customers.length,
        totalQuotations: allQuotationRows.length,
        draftQuotations: allQuotationRows.filter((q: any) => q.status === "draft").length,
        approvedQuotations: allQuotationRows.filter((q: any) => q.status === "accepted").length,
        sentQuotations: allQuotationRows.filter((q: any) => q.status === "sent" || q.status === "viewed").length,
        convertedQuotations: allQuotationRows.filter((q: any) => Boolean(q.shipment_id)).length,
        totalContracts: contractRows.length,
        totalBookings: bookingRows.length,
        pendingBookings: bookingRows.filter((b: any) => b.status === "pending").length,
        confirmedBookings: bookingRows.filter((b: any) => b.status === "confirmed").length,
        totalPipelineValueByCurrency: allQuotationRows
          .filter((q: any) => !["rejected", "expired"].includes(q.status))
          .reduce((acc: Record<string, number>, q: any) => {
            const cur = q.currency || "TZS";
            acc[cur] = (acc[cur] ?? 0) + (Number(q.total_amount ?? q.amount) || 0);
            return acc;
          }, {}),
        monthlyRevenueByCurrency: bookedThisMonth.reduce((acc: Record<string, number>, b: any) => {
          const cur = b.currency || "TZS";
          acc[cur] = (acc[cur] ?? 0) + (Number(b.amount) || 0);
          return acc;
        }, {}),
        conversionRate: leads.length > 0
          ? Math.round((leads.filter((l: any) => l.status === "converted").length / leads.length) * 100)
          : 0,
      });

      setRecentLeads(leads);
      setPendingQuotations(pendingQuotationRows);
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
        <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8 flex items-center justify-center">
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
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
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
                  <div className="text-2xl font-bold truncate">{formatByCurrency(stats.totalPipelineValueByCurrency)}</div>
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
                  <div className="text-2xl font-bold truncate">{formatByCurrency(stats.monthlyRevenueByCurrency)}</div>
                  <div className="text-xs text-success mt-1 flex items-center">
                    <TrendingUp className="size-3 mr-1" /> Confirmed this month
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalContracts}</div>
                  <div className="text-xs text-accent-foreground mt-1">Active agreements</div>
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
                            {quote.currency || "TZS"} {(quote.total_amount || 0).toLocaleString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/quotations/${quote.id}`}>
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
                <Link href="/quotations/new">
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
