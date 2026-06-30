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

type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  currency: string;
  due_date: string;
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

    filteredInvoices.forEach((invoice) => {
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
  }, [filteredInvoices, income]);

  const customerData = useMemo(() => {
    const customerMap = new Map<string, { amount: number; currency: string }>();
    filteredInvoices.forEach((invoice) => {
      const customer = invoice.customer_name || "Unknown";
      const existing = customerMap.get(customer) || { amount: 0, currency: invoice.currency };
      customerMap.set(customer, { 
        amount: existing.amount + invoice.amount, 
        currency: invoice.currency 
      });
    });
    return Array.from(customerMap.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [filteredInvoices]);

  const statusData = useMemo(() => {
    const statusMap = new Map<string, { amount: number; currency: string }>();
    filteredInvoices.forEach((invoice) => {
      const status = invoice.status || "unknown";
      const existing = statusMap.get(status) || { amount: 0, currency: invoice.currency };
      statusMap.set(status, { 
        amount: existing.amount + invoice.amount, 
        currency: invoice.currency 
      });
    });
    return Array.from(statusMap.entries()).map(([name, value]) => ({ name, ...value }));
  }, [filteredInvoices]);

  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<string, { amount: number; currency: string }>();
    [...filteredInvoices, ...income].forEach((item) => {
      const date = (item as Invoice).due_date || (item as Income).date;
      if (!date) return;
      const month = new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const existing = monthlyMap.get(month) || { amount: 0, currency: item.currency };
      monthlyMap.set(month, { 
        amount: existing.amount + item.amount, 
        currency: item.currency 
      });
    });
    return Array.from(monthlyMap.entries()).map(([month, value]) => ({ month, ...value }));
  }, [filteredInvoices, income]);

  const statuses = useMemo(() => {
    const stats = new Set(filteredInvoices.map((i) => i.status).filter(Boolean));
    return Array.from(stats);
  }, [filteredInvoices]);

  const totalRevenue = filteredInvoices.reduce((sum, i) => sum + i.amount, 0) + income.reduce((sum, i) => sum + i.amount, 0);
  const invoiceRevenue = filteredInvoices.reduce((sum, i) => sum + i.amount, 0);
  const otherIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const paidRevenue = filteredInvoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const pendingRevenue = filteredInvoices.filter((i) => i.status === "pending").reduce((sum, i) => sum + i.amount, 0);
  const topCustomer = customerData.length > 0 ? customerData[0] : null;
  const avgInvoice = filteredInvoices.length > 0 ? invoiceRevenue / filteredInvoices.length : 0;

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
    toast({ title: "Success", description: "Revenue data exported" });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Revenue Analysis Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Revenue: ${formatAmount(totalRevenue)}`, 14, 38);
    doc.text(`Paid Revenue: ${formatAmount(paidRevenue)}`, 14, 46);
    doc.text(`Pending Revenue: ${formatAmount(pendingRevenue)}`, 14, 54);

    // Customer breakdown table
    const customerTableData = customerData.map((item) => [
      item.name,
      formatCurrency(item.amount, item.currency),
      invoiceRevenue > 0 ? ((item.amount / invoiceRevenue) * 100).toFixed(1) + "%" : "0%",
      filteredInvoices.filter((i) => i.customer_name === item.name).length,
    ]);

    const firstTable = autoTable(doc, {
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
      formatAmount(i.amount),
    ]);

    autoTable(doc, {
      startY: (firstTable as any).finalY + 10,
      head: [["Invoice #", "Customer", "Due Date", "Status", "Type", "Amount"]],
      body: invoiceTableData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`revenue-analysis-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Customer breakdown sheet
    const customerSheet = XLSX.utils.json_to_sheet(
      customerData.map((item) => ({
        Customer: item.name,
        Revenue: item.amount,
        Currency: item.currency,
        Percentage: invoiceRevenue > 0 ? ((item.amount / invoiceRevenue) * 100).toFixed(1) + "%" : "0%",
        InvoiceCount: filteredInvoices.filter((i) => i.customer_name === item.name).length,
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
    toast({ title: "Success", description: "Excel exported successfully" });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
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

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
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
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={(entry) => entry.name}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
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
                <Tooltip />
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
                <Tooltip />
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
          <div className="rounded-md border">
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
                    const count = filteredInvoices.filter((i) => i.customer_name === item.name).length;
                    const percentage = invoiceRevenue > 0 ? (item.amount / invoiceRevenue) * 100 : 0;
                    return (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium">{item.name}</TableCell>
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
          <div className="rounded-md border">
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
                      <TableCell className="font-medium text-success">{formatAmount(invoice.amount)}</TableCell>
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
