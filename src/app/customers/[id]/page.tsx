"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Building2, TrendingUp, TrendingDown, DollarSign, FileText,
  CalendarDays, AlertTriangle, Sparkles, Clock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Customer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  credit_limit: number;
  current_balance?: number;
  risk_level?: "low" | "medium" | "high" | null;
  created_at: string;
}

const RISK_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-success/10 text-success border-success/20",
};

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function CustomerDetailPage() {
  const { role } = useRole();
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();
      if (customerError) throw customerError;
      setCustomer(customerData);

      const [bookingsRes, quotationsRes, invoicesRes, activitiesRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        supabase.from("route_quotations").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        // customer_id is the reliable join; older rows may only have the
        // text name populated, so those are picked up as a fallback.
        supabase
          .from("invoices")
          .select("*")
          .or(`customer_id.eq.${customerId},customer_name.eq.${customerData.company_name}`)
          .order("created_at", { ascending: false }),
        supabase.from("customer_activities").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
      ]);

      setBookings(bookingsRes.data || []);
      setQuotations(quotationsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setActivities(activitiesRes.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load customer", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const stats = useMemo(() => {
    const totalBookingRevenue = bookings.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const convertedQuotations = quotations.filter((q) => q.status === "converted").length;
    const conversionRate = quotations.length > 0 ? Math.round((convertedQuotations / quotations.length) * 100) : null;

    const paidInvoices = invoices.filter((i) => i.status === "paid");
    const outstandingInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
    const totalPaid = paidInvoices.reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);
    const totalOutstanding = outstandingInvoices.reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);

    // Last activity: prefer the customer_activities timeline (once it's
    // populated going forward); fall back to the most recent booking,
    // quotation, or invoice for customers with history predating that table.
    const allDates = [
      ...activities.map((a) => a.created_at),
      ...bookings.map((b) => b.created_at),
      ...quotations.map((q) => q.created_at),
      ...invoices.map((i) => i.created_at),
    ].filter(Boolean);
    const lastActivityDate = allDates.length > 0
      ? new Date(Math.max(...allDates.map((d) => new Date(d).getTime())))
      : null;
    const daysSinceLastActivity = lastActivityDate
      ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Monthly revenue trend (last 6 months) from bookings + paid invoices.
    const monthly = new Map<string, number>();
    for (const b of bookings) monthly.set(monthKey(b.created_at), (monthly.get(monthKey(b.created_at)) || 0) + (Number(b.amount) || 0));
    for (const i of paidInvoices) monthly.set(monthKey(i.created_at), (monthly.get(monthKey(i.created_at)) || 0) + Number(i.total_amount ?? i.amount ?? 0));
    const months = [...monthly.keys()].sort().slice(-6);
    const trendValues = months.map((m) => monthly.get(m) || 0);
    const revenueTrend = trendValues.length >= 2
      ? trendValues[trendValues.length - 1] >= trendValues[0] ? "up" : "down"
      : null;

    return {
      totalBookingRevenue,
      conversionRate,
      convertedQuotations,
      totalPaid,
      totalOutstanding,
      daysSinceLastActivity,
      revenueTrend,
      monthlyTrend: months.map((m) => ({ month: m, revenue: monthly.get(m) || 0 })),
    };
  }, [bookings, quotations, invoices, activities]);

  const runAiSummary = async () => {
    if (!customer) return;
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch("/api/ai/customer-relationship-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            company_name: customer.company_name,
            status: customer.status,
            risk_level: customer.risk_level,
            bookingsCount: bookings.length,
            totalBookingRevenue: stats.totalBookingRevenue,
            quotationsCount: quotations.length,
            conversionRate: stats.conversionRate,
            totalPaid: stats.totalPaid,
            totalOutstanding: stats.totalOutstanding,
            daysSinceLastActivity: stats.daysSinceLastActivity,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate summary");
      setAiSummary(json.summary);
    } catch (err: any) {
      setAiSummary(`Could not generate a summary: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => router.push("/customers")}>
            <ArrowLeft className="size-4 mr-2" /> Back to Customers
          </Button>

          {loading || !customer ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="size-6" /> {customer.company_name}
                  </h1>
                  <p className="text-muted-foreground">
                    {customer.customer_code} · {customer.contact_person} · {customer.email} · {customer.phone}
                  </p>
                </div>
                {customer.risk_level && (
                  <Badge className={`${RISK_STYLES[customer.risk_level]} capitalize`}>{customer.risk_level} risk</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="size-4" /> Booking Revenue</p>
                    <p className="text-2xl font-bold">Tsh {stats.totalBookingRevenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{bookings.length} booking(s)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground flex items-center gap-1"><FileText className="size-4" /> Quote Conversion</p>
                    <p className="text-2xl font-bold">{stats.conversionRate !== null ? `${stats.conversionRate}%` : "No quotes yet"}</p>
                    <p className="text-xs text-muted-foreground">{stats.convertedQuotations}/{quotations.length} converted</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="size-4" /> Outstanding</p>
                    <p className="text-2xl font-bold text-destructive">Tsh {stats.totalOutstanding.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Paid: Tsh {stats.totalPaid.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="size-4" /> Last Activity</p>
                    <p className="text-2xl font-bold">
                      {stats.daysSinceLastActivity !== null ? `${stats.daysSinceLastActivity}d ago` : "No activity recorded"}
                    </p>
                    {stats.revenueTrend && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {stats.revenueTrend === "up" ? <TrendingUp className="size-3 text-success" /> : <TrendingDown className="size-3 text-destructive" />}
                        Revenue trending {stats.revenueTrend}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> AI Relationship Summary</CardTitle>
                  <Button size="sm" onClick={runAiSummary} disabled={aiLoading}>
                    {aiLoading ? "Generating…" : "Generate"}
                  </Button>
                </CardHeader>
                {aiSummary && (
                  <CardContent>
                    <p className="text-sm whitespace-pre-line">{aiSummary}</p>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-4" /> Activity Timeline</CardTitle></CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No activity recorded yet in this timeline. New bookings, quotations, contracts, and payments for this
                      customer will appear here going forward — history predating this feature isn't reconstructable.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {activities.map((a) => (
                        <li key={a.id} className="flex justify-between border-b border-border pb-2 last:border-0">
                          <div>
                            <span className="font-medium capitalize">{a.activity_type}</span>
                            <span className="text-muted-foreground"> — {a.description}</span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
