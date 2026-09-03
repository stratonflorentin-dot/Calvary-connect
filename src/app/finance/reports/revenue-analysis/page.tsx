"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, ArrowLeft, RefreshCw, Download, PieChart, BarChart3, Calendar, Filter, Users, FileText, Table as TableIcon, CheckCircle2, Clock, Wallet } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { getRate } from "@/lib/finance/fx";
import { Loader2 } from "lucide-react";

type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  currency: string;
  due_date: string;
  issue_date?: string;
  status: string;
  type: string;
};

type Income = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
};

const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ec4899", "#3b82f6"];

export default function RevenueAnalysisPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const loadRevenue = async () => {
    setLoading(true);
    try {
      let invoiceQuery = supabase.from("invoices").select("*").order("due_date", { ascending: false });
      let incomeQuery = supabase.from("income").select("*").order("date", { ascending: false });
      
      if (dateRange.start) {
        invoiceQuery = invoiceQuery.gte("due_date", dateRange.start);
        incomeQuery = incomeQuery.gte("date", dateRange.start);
      }
      if (dateRange.end) {
        invoiceQuery = invoiceQuery.lte("due_date", dateRange.end);
        incomeQuery = incomeQuery.lte("date", dateRange.end);
      }

      const [invoiceData, incomeData] = await Promise.all([
        invoiceQuery,
        incomeQuery,
      ]);

      setInvoices(invoiceData.data || []);
      setIncome(incomeData.data || []);
    } catch (err) {
      console.error("Error loading revenue:", err);
      toast({ title: "Error", description: "Failed to load revenue data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRevenue();
  }, [dateRange]);

  const filteredInvoices = selectedStatus === "all"
    ? invoices
    : invoices.filter((i) => i.status === selectedStatus);

  // A cancelled invoice is void — it generates zero real revenue, but it
  // should still be visible in the table, the status breakdown chart, and
  // selectable via the status filter (so "how much did we cancel" stays
  // answerable). A draft invoice hasn't been sent yet either — revenue is
  // now only recognized (a real journal entry posted) at Send, so an
  // unsent draft is exactly as un-earned as a cancelled one and gets the
  // same treatment: excluded from the revenue *sums*, not from the table.
  const revenueEligibleInvoices = useMemo(
    () => filteredInvoices.filter((i) => i.status !== "cancelled" && i.status !== "draft"),
    [filteredInvoices],
  );

  // Group revenue by currency
  const revenueByCurrency = useMemo(() => {
    const currencyMap = new Map<string, {
      totalRevenue: number;
      invoiceRevenue: number;
      otherIncome: number;
      paidRevenue: number;
      pendingRevenue: number;
      invoices: Invoice[];
      income: Income[];
    }>();

    AVAILABLE_CURRENCIES.forEach(curr => {
      currencyMap.set(curr.code, {
        totalRevenue: 0,
        invoiceRevenue: 0,
        otherIncome: 0,
        paidRevenue: 0,
        pendingRevenue: 0,
        invoices: [],
        income: [],
      });
    });

    revenueEligibleInvoices.forEach((invoice) => {
      const currency = invoice.currency || "TZS";
      const existing = currencyMap.get(currency) || {
        totalRevenue: 0,
        invoiceRevenue: 0,
        otherIncome: 0,
        paidRevenue: 0,
        pendingRevenue: 0,
        invoices: [],
        income: [],
      };
      existing.invoices.push(invoice);
      existing.invoiceRevenue += invoice.amount;
      existing.totalRevenue += invoice.amount;
      if (invoice.status === "paid") existing.paidRevenue += invoice.amount;
      if (invoice.status === "pending") existing.pendingRevenue += invoice.amount;
      currencyMap.set(currency, existing);
    });

    income.forEach((inc) => {
      const currency = inc.currency || "TZS";
      const existing = currencyMap.get(currency) || {
        totalRevenue: 0,
        invoiceRevenue: 0,
        otherIncome: 0,
        paidRevenue: 0,
        pendingRevenue: 0,
        invoices: [],
        income: [],
      };
      existing.income.push(inc);
      existing.otherIncome += inc.amount;
      existing.totalRevenue += inc.amount;
      currencyMap.set(currency, existing);
    });

    return currencyMap;
  }, [revenueEligibleInvoices, income]);

  // Consolidated (TZS) — every non-TZS amount converted at the rate
  // effective on that transaction's OWN date (fx.ts's getRate picks the
  // most recent CRDB-sourced rate on or before that date), not blended
  // or converted at today's rate. A row whose currency/date has no rate
  // on file is skipped, not fabricated. Per-currency figures stay below,
  // unconverted — this is an added headline, not a replacement.
  const [consolidated, setConsolidated] = useState({ total: 0, paid: 0, pending: 0, loading: true, skipped: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConsolidated((c) => ({ ...c, loading: true }));
      type Row = { amount: number; currency: string; date: string; status: string | null; kind: "invoice" | "income" };
      const rows: Row[] = [
        ...revenueEligibleInvoices.map((i) => ({ amount: i.amount, currency: i.currency || "TZS", date: i.issue_date || i.due_date, status: i.status, kind: "invoice" as const })),
        ...income.map((inc) => ({ amount: inc.amount, currency: inc.currency || "TZS", date: inc.date, status: null, kind: "income" as const })),
      ].filter((r) => r.date);

      const uniqueKeys = Array.from(new Set(rows.map((r) => `${r.currency}|${r.date}`)));
      const rateEntries = await Promise.all(
        uniqueKeys.map(async (key) => {
          const [cur, date] = key.split("|");
          if (cur === "TZS") return [key, 1] as const;
          const rate = await getRate(cur, "TZS", date);
          return [key, rate] as const;
        }),
      );
      const rateMap = new Map(rateEntries);

      let total = 0, paid = 0, pending = 0, skipped = 0;
      for (const r of rows) {
        const rate = rateMap.get(`${r.currency}|${r.date}`);
        if (rate == null) { skipped++; continue; }
        const tzsAmt = r.amount * rate;
        total += tzsAmt;
        if (r.kind === "invoice") {
          if (r.status === "paid") paid += tzsAmt;
          if (r.status === "pending" || r.status === "sent" || r.status === "partial") pending += tzsAmt;
        }
      }
      if (!cancelled) setConsolidated({ total, paid, pending, loading: false, skipped });
    })();
    return () => { cancelled = true; };
  }, [revenueEligibleInvoices, income]);

  // Keyed by name+currency (not just name) so a customer/status/month with
  // revenue in more than one currency gets separate, correctly-labeled
  // entries instead of being summed together under whichever currency
  // happened to be processed last.
  const customerData = useMemo(() => {
    const customerMap = new Map<string, { name: string; amount: number; currency: string }>();
    revenueEligibleInvoices.forEach((invoice) => {
      const customer = invoice.customer_name || "Unknown";
      const currency = invoice.currency || "TZS";
      const key = `${customer}::${currency}`;
      const existing = customerMap.get(key) || { name: customer, amount: 0, currency };
      customerMap.set(key, { name: customer, amount: existing.amount + invoice.amount, currency });
    });
    return Array.from(customerMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [revenueEligibleInvoices]);

  const statusData = useMemo(() => {
    const statusMap = new Map<string, { name: string; amount: number; currency: string }>();
    filteredInvoices.forEach((invoice) => {
      const status = invoice.status || "unknown";
      const currency = invoice.currency || "TZS";
      const key = `${status}::${currency}`;
      const existing = statusMap.get(key) || { name: status, amount: 0, currency };
      statusMap.set(key, { name: status, amount: existing.amount + invoice.amount, currency });
    });
    return Array.from(statusMap.values());
  }, [filteredInvoices]);

  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<string, { month: string; amount: number; currency: string }>();
    [...revenueEligibleInvoices, ...income].forEach((item) => {
      const date = (item as Invoice).due_date || (item as Income).date;
      if (!date) return;
      const month = new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const currency = item.currency || "TZS";
      const key = `${month}::${currency}`;
      const existing = monthlyMap.get(key) || { month, amount: 0, currency };
      monthlyMap.set(key, { month, amount: existing.amount + item.amount, currency });
    });
    return Array.from(monthlyMap.values());
  }, [revenueEligibleInvoices, income]);

  const statuses = useMemo(() => {
    const stats = new Set(filteredInvoices.map((i) => i.status).filter(Boolean));
    return Array.from(stats);
  }, [filteredInvoices]);

  // The actual rendered stat cards use revenueData (grouped per currency,
  // above) — these flat cross-currency sums were dead code (never rendered
  // anywhere) and, being unfiltered by currency, wrong the moment they were.
  // "% of total" only means something within a single currency.
  const invoiceRevenueByCurrency = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    revenueEligibleInvoices.forEach((i) => {
      const cur = i.currency || "TZS";
      byCurrency[cur] = (byCurrency[cur] ?? 0) + i.amount;
    });
    return byCurrency;
  }, [revenueEligibleInvoices]);
  const pctOfCurrencyTotal = (amount: number, currency: string) => {
    const total = invoiceRevenueByCurrency[currency || "TZS"] || 0;
    return total > 0 ? (amount / total) * 100 : 0;
  };

  const exportData = () => {
    const data = {
      invoices: filteredInvoices.map((i) => ({
        InvoiceNumber: i.invoice_number,
        Customer: i.customer_name,
        Amount: i.amount,
        Currency: i.currency,
        DueDate: i.due_date,
        Status: i.status,
        Type: i.type,
      })),
      income: income.map((i) => ({
        Description: i.description,
        Amount: i.amount,
        Currency: i.currency,
        Date: i.date,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-analysis-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    toast({ variant: "success", title: "Success", description: "Revenue data exported" });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Revenue Analysis Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Revenue (Consolidated TZS): ${formatCurrency(consolidated.total, "TZS")}`, 14, 38);
    doc.text(`Paid Revenue (Consolidated TZS): ${formatCurrency(consolidated.paid, "TZS")}`, 14, 46);
    doc.text(`Pending Revenue (Consolidated TZS): ${formatCurrency(consolidated.pending, "TZS")}`, 14, 54);

    // Customer breakdown table
    const customerTableData = customerData.map((item) => [
      item.name,
      formatCurrency(item.amount, item.currency),
      `${pctOfCurrencyTotal(item.amount, item.currency).toFixed(1)}%`,
      filteredInvoices.filter((i) => i.customer_name === item.name && (i.currency || "TZS") === item.currency).length,
    ]);

    autoTable(doc, {
      startY: 60,
      head: [["Customer", "Revenue", "% of Total", "Invoices"]],
      body: customerTableData,
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129] },
    });

    // Detailed invoices table
    const invoiceTableData = filteredInvoices.map((i) => [
      i.invoice_number,
      i.customer_name,
      formatDate(i.due_date),
      i.status,
      i.type,
      formatAmount(i.amount, i.currency),
    ]);

    // jspdf-autotable v5's functional autoTable() returns void — the result
    // lives on doc.lastAutoTable instead. Reading .finalY off the return
    // value throws "Cannot read properties of undefined", which silently
    // aborted this export before doc.save() ever ran.
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Invoice #", "Customer", "Due Date", "Status", "Type", "Amount"]],
      body: invoiceTableData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`revenue-analysis-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ variant: "success", title: "Success", description: "PDF exported successfully" });
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Customer breakdown sheet
    const customerSheet = XLSX.utils.json_to_sheet(
      customerData.map((item) => ({
        Customer: item.name,
        Revenue: item.amount,
        Currency: item.currency,
        Percentage: pctOfCurrencyTotal(item.amount, item.currency).toFixed(1) + "%",
        InvoiceCount: filteredInvoices.filter((i) => i.customer_name === item.name && (i.currency || "TZS") === item.currency).length,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, customerSheet, "Customer Breakdown");

    // Detailed invoices sheet
    const invoiceSheet = XLSX.utils.json_to_sheet(
      filteredInvoices.map((i) => ({
        InvoiceNumber: i.invoice_number,
        Customer: i.customer_name,
        DueDate: i.due_date,
        Status: i.status,
        Type: i.type,
        Amount: i.amount,
        Currency: i.currency,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, invoiceSheet, "Invoices");

    // Income sheet
    const incomeSheet = XLSX.utils.json_to_sheet(
      income.map((i) => ({
        Description: i.description,
        Amount: i.amount,
        Currency: i.currency,
        Date: i.date,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, incomeSheet, "Income");

    XLSX.writeFile(workbook, `revenue-analysis-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ variant: "success", title: "Success", description: "Excel exported successfully" });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button onClick={loadRevenue} disabled={loading}>
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
          </Button>
          <Button onClick={exportPDF} variant="outline">
            <FileText className="size-4 mr-2" /> Export PDF
          </Button>
          <Button onClick={exportExcel} variant="outline">
            <TableIcon className="size-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={exportData} variant="outline">
            <Download className="size-4 mr-2" /> Export JSON
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Revenue Analysis</h1>
        <p className="text-muted-foreground">Comprehensive breakdown of revenue by customer, status, and time period</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex-1 min-w-[160px]">
          <Label>Status Filter</Label>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>From Date</Label>
          <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
        </div>
        <div>
          <Label>To Date</Label>
          <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
        </div>
      </div>

      {/* Consolidated (TZS) — each transaction converted at its own date's CRDB rate */}
      <Card className="mb-6 border-primary/30">
        <CardHeader className="bg-primary/5">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Consolidated (TZS)</span>
            <span className="text-xs font-normal text-muted-foreground">Each amount converted at its own date's CRDB rate — not today's rate</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {consolidated.loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="size-4 animate-spin" /> Converting…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(consolidated.total, "TZS")}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Paid</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(consolidated.paid, "TZS")}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Pending</p>
                  <p className="text-2xl font-bold text-warning">{formatCurrency(consolidated.pending, "TZS")}</p>
                </div>
              </div>
              {consolidated.skipped > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {consolidated.skipped} entr{consolidated.skipped === 1 ? "y" : "ies"} excluded — no CRDB rate on file for that currency as of that date. Sync rates in Finance &gt; Accounting &gt; FX Rates.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards by Currency */}
      <section className="space-y-6 mb-6">
        {AVAILABLE_CURRENCIES.map((currency) => {
          const revenueData = revenueByCurrency.get(currency.code);
          if (!revenueData || revenueData.totalRevenue === 0) return null;

          return (
            <Card key={currency.code}>
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <span className="text-2xl">{currency.flag}</span>
                    <span>{currency.name}</span>
                    <CurrencyBadge currency={currency.code} />
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="size-4 text-success" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</p>
                    </div>
                    <p className="text-2xl font-bold text-success">{formatCurrency(revenueData.totalRevenue, currency.code)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="size-4 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Invoice Revenue</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(revenueData.invoiceRevenue, currency.code)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="size-4 text-info" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Other Income</p>
                    </div>
                    <p className="text-2xl font-bold text-info">{formatCurrency(revenueData.otherIncome, currency.code)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="size-4 text-warning" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Avg Invoice</p>
                    </div>
                    <p className="text-2xl font-bold text-warning">
                      {revenueData.invoices.length > 0 ? formatCurrency(revenueData.invoiceRevenue / revenueData.invoices.length, currency.code) : formatCurrency(0, currency.code)}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="size-4 text-success" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Paid Revenue</p>
                    </div>
                    <p className="text-2xl font-bold text-success">{formatCurrency(revenueData.paidRevenue, currency.code)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="size-4 text-warning" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Pending Revenue</p>
                    </div>
                    <p className="text-2xl font-bold text-warning">{formatCurrency(revenueData.pendingRevenue, currency.code)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="size-4 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Total Invoices</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">{revenueData.invoices.length}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="size-4 text-info" />
                      <p className="text-xs font-medium text-muted-foreground uppercase">Income Records</p>
                    </div>
                    <p className="text-2xl font-bold text-info">{revenueData.income.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue by Status</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={60} dataKey="amount" label={(entry) => entry.name}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any, props: any) => [formatCurrency(value, props?.payload?.currency || "TZS"), name]} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: any, name: any, props: any) => [formatCurrency(value, props?.payload?.currency || "TZS"), name]} />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 10 Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={customerData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: any, name: any, props: any) => [formatCurrency(value, props?.payload?.currency || "TZS"), name]} />
                <Bar dataKey="amount" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* Customer Breakdown Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Customer Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total Revenue</TableHead>
                  <TableHead>% of Total</TableHead>
                  <TableHead>Invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No customer data available
                    </TableCell>
                  </TableRow>
                ) : (
                  customerData.map((item) => {
                    const count = filteredInvoices.filter((i) => i.customer_name === item.name && (i.currency || "TZS") === item.currency).length;
                    const percentage = pctOfCurrencyTotal(item.amount, item.currency);
                    return (
                      <TableRow key={`${item.name}::${item.currency}`}>
                        <TableCell className="font-medium">{item.name} <span className="text-[10px] text-muted-foreground">{item.currency}</span></TableCell>
                        <TableCell className="text-success font-medium">{formatCurrency(item.amount, item.currency)}</TableCell>
                        <TableCell>{percentage.toFixed(1)}%</TableCell>
                        <TableCell>{count}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>{formatDate(invoice.due_date)}</TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === "paid" ? "default" : invoice.status === "pending" ? "secondary" : "outline"}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{invoice.type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-success">{formatAmount(invoice.amount, invoice.currency)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
