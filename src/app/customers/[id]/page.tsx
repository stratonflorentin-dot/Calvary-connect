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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityHeader, StatCard, DataTable, StatusBadge } from "@/components/shell";
import { formatCurrency } from "@/components/ui/currency-badge";
import {
  TrendingUp, TrendingDown, DollarSign, FileText,
  CalendarDays, Sparkles, Clock, Truck, FileSignature,
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
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState("overview");

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

      const [bookingsRes, quotationsRes, invoicesRes, activitiesRes, contractsRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        // quotations, not the disconnected legacy route_quotations table —
        // see src/app/quotations/page.tsx, the real quotation module.
        supabase.from("quotations").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        // customer_id is the reliable join; older rows may only have the
        // text name populated, so those are picked up as a fallback.
        supabase
          .from("invoices")
          .select("*")
          .or(`customer_id.eq.${customerId},customer_name.eq.${customerData.company_name}`)
          .order("created_at", { ascending: false }),
        supabase.from("customer_activities").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        // contracts, not the disconnected legacy transport_contracts table —
        // same real-vs-legacy split as quotations above.
        supabase.from("contracts").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
      ]);

      setBookings(bookingsRes.data || []);
      setQuotations(quotationsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setActivities(activitiesRes.data || []);
      setContracts(contractsRes.data || []);
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
    // A quotation "converts" when it produces a real shipment, not via a
    // status value — quotations.status tracks the customer-facing document
    // lifecycle (draft/sent/viewed/accepted/rejected/expired), while
    // shipment_id is set once /quotations' accept flow actually creates one.
    const convertedQuotations = quotations.filter((q) => Boolean(q.shipment_id)).length;
    const conversionRate = quotations.length > 0 ? Math.round((convertedQuotations / quotations.length) * 100) : null;

    const paidInvoices = invoices.filter((i) => i.status === "paid");
    const outstandingInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
    const totalPaid = paidInvoices.reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);
    // total_amount minus paid_amount, not the full total — a partially-paid
    // invoice was otherwise counted as fully owed here, same fix already
    // applied everywhere else this app computes outstanding balance (see
    // accountant-view.tsx's arByCcy/apByCcy).
    const totalOutstanding = outstandingInvoices.reduce(
      (s, i) => s + (Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0)),
      0,
    );

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
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {loading || !customer ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <EntityHeader
                crumbs={[
                  { label: "Customers", href: "/customers" },
                  { label: customer.company_name },
                ]}
                eyebrow="Customer"
                title={customer.company_name}
                subtitle={`${customer.customer_code} · ${customer.contact_person} · ${customer.email} · ${customer.phone}`}
                status={customer.status}
                badges={
                  customer.risk_level && (
                    <Badge className={`${RISK_STYLES[customer.risk_level]} capitalize`}>{customer.risk_level} risk</Badge>
                  )
                }
                primaryMetricLabel="Outstanding"
                primaryMetricValue={formatCurrency(stats.totalOutstanding, "TZS")}
                primaryMetricTone={stats.totalOutstanding > 0 ? "danger" : "default"}
              />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                  label="Booking Revenue"
                  value={formatCurrency(stats.totalBookingRevenue, "TZS")}
                  sub={`${bookings.length} booking(s)`}
                  icon={DollarSign}
                />
                <StatCard
                  label="Quote Conversion"
                  value={stats.conversionRate !== null ? `${stats.conversionRate}%` : "No quotes yet"}
                  sub={`${stats.convertedQuotations}/${quotations.length} converted`}
                  icon={FileText}
                />
                <StatCard
                  label="Paid"
                  value={formatCurrency(stats.totalPaid, "TZS")}
                  sub={invoices.length > 0 ? `${invoices.filter((i) => i.status === "paid").length}/${invoices.length} invoice(s)` : "No invoices yet"}
                  icon={DollarSign}
                  accent="bg-success/10 text-success"
                />
                <StatCard
                  label="Last Activity"
                  value={stats.daysSinceLastActivity !== null ? `${stats.daysSinceLastActivity}d ago` : "No activity recorded"}
                  sub={
                    stats.revenueTrend ? (
                      <span className="inline-flex items-center gap-1">
                        {stats.revenueTrend === "up" ? <TrendingUp className="size-3 text-success" /> : <TrendingDown className="size-3 text-destructive" />}
                        Revenue trending {stats.revenueTrend}
                      </span>
                    ) : undefined
                  }
                  icon={Clock}
                />
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

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="bookings">Bookings</TabsTrigger>
                  <TabsTrigger value="quotations">Quotations</TabsTrigger>
                  <TabsTrigger value="contracts">Contracts</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
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
                </TabsContent>

                <TabsContent value="bookings">
                  <DataTable
                    data={bookings}
                    getRowId={(b) => b.id}
                    emptyIcon={Truck}
                    emptyTitle="No bookings yet"
                    emptyDescription="Bookings created for this customer will appear here."
                    initialSort={{ key: "date", dir: "desc" }}
                    columns={[
                      {
                        key: "route", header: "Route",
                        accessor: (b) => <span className="font-medium">{b.pickup_location || b.origin || "—"} → {b.delivery_location || b.destination || "—"}</span>,
                      },
                      { key: "number", header: "Booking #", hideBelow: "md", accessor: (b) => <span className="font-mono text-xs text-muted-foreground">{b.booking_number}</span> },
                      { key: "date", header: "Date", hideBelow: "md", accessor: (b) => <span className="text-xs text-muted-foreground">{formatDate(b.created_at)}</span>, sortValue: (b) => b.created_at ?? "" },
                      { key: "amount", header: "Amount", align: "right", accessor: (b) => formatCurrency(Number(b.amount) || 0, "TZS"), sortValue: (b) => Number(b.amount) || 0 },
                      { key: "status", header: "Status", accessor: (b) => <StatusBadge status={b.status} />, sortValue: (b) => b.status ?? "" },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="quotations">
                  <DataTable
                    data={quotations}
                    getRowId={(q) => q.id}
                    onRowClick={(q) => router.push(`/quotations/${q.id}`)}
                    emptyIcon={FileText}
                    emptyTitle="No quotations yet"
                    emptyDescription="Quotations sent to this customer will appear here."
                    initialSort={{ key: "date", dir: "desc" }}
                    columns={[
                      { key: "route", header: "Route", accessor: (q) => <span className="font-medium">{q.origin} → {q.destination}</span> },
                      { key: "number", header: "Quotation #", hideBelow: "md", accessor: (q) => <span className="font-mono text-xs text-muted-foreground">{q.quotation_number}</span> },
                      { key: "date", header: "Date", hideBelow: "md", accessor: (q) => <span className="text-xs text-muted-foreground">{formatDate(q.created_at)}</span>, sortValue: (q) => q.created_at ?? "" },
                      { key: "amount", header: "Amount", align: "right", accessor: (q) => formatCurrency(Number(q.total_amount) || 0, q.currency || "TZS"), sortValue: (q) => Number(q.total_amount) || 0 },
                      { key: "status", header: "Status", accessor: (q) => <StatusBadge status={q.status} />, sortValue: (q) => q.status ?? "" },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="contracts">
                  <DataTable
                    data={contracts}
                    getRowId={(c) => c.id}
                    emptyIcon={FileSignature}
                    emptyTitle="No contracts yet"
                    emptyDescription="Contracts signed with this customer will appear here."
                    initialSort={{ key: "expires", dir: "desc" }}
                    columns={[
                      {
                        key: "type", header: "Type",
                        accessor: (c) => <span className="font-medium capitalize">{String(c.contract_type || "").replace("_", " ") || "Contract"}</span>,
                      },
                      { key: "number", header: "Contract #", hideBelow: "md", accessor: (c) => <span className="font-mono text-xs text-muted-foreground">{c.contract_number}</span> },
                      { key: "expires", header: "Expires", hideBelow: "md", accessor: (c) => <span className="text-xs text-muted-foreground">{c.end_date ? formatDate(c.end_date) : "—"}</span>, sortValue: (c) => c.end_date ?? "" },
                      { key: "status", header: "Status", accessor: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status ?? "" },
                    ]}
                  />
                </TabsContent>

                <TabsContent value="invoices">
                  <DataTable
                    data={invoices}
                    getRowId={(i) => i.id}
                    onRowClick={(i) => router.push(`/finance/invoicing/customer-invoices/${i.id}`)}
                    emptyIcon={FileText}
                    emptyTitle="No invoices yet"
                    emptyDescription="Invoices billed to this customer will appear here."
                    initialSort={{ key: "date", dir: "desc" }}
                    columns={[
                      { key: "number", header: "Invoice #", accessor: (i) => <span className="font-mono text-xs font-black text-foreground">{i.invoice_number}</span> },
                      { key: "date", header: "Date", hideBelow: "md", accessor: (i) => <span className="text-xs text-muted-foreground">{formatDate(i.created_at)}</span>, sortValue: (i) => i.created_at ?? "" },
                      { key: "total", header: "Total", align: "right", accessor: (i) => <span className="font-bold">{formatCurrency(Number(i.total_amount ?? i.amount ?? 0), i.currency || "TZS")}</span>, sortValue: (i) => Number(i.total_amount ?? i.amount ?? 0) },
                      { key: "paid", header: "Paid", align: "right", hideBelow: "lg", accessor: (i) => <span className="text-muted-foreground">{formatCurrency(Number(i.paid_amount) || 0, i.currency || "TZS")}</span> },
                      { key: "status", header: "Status", accessor: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status ?? "" },
                    ]}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
