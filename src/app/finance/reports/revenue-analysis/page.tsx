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
import { TrendingUp, ArrowLeft, RefreshCw, Download, PieChart, BarChart3, Calendar, Filter, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

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

  const customerData = useMemo(() => {
    const customerMap = new Map<string, number>();
    filteredInvoices.forEach((invoice) => {
      const customer = invoice.customer_name || "Unknown";
      customerMap.set(customer, (customerMap.get(customer) || 0) + invoice.amount);
    });
    return Array.from(customerMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredInvoices]);

  const statusData = useMemo(() => {
    const statusMap = new Map<string, number>();
    filteredInvoices.forEach((invoice) => {
      const status = invoice.status || "unknown";
      statusMap.set(status, (statusMap.get(status) || 0) + invoice.amount);
    });
    return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<string, number>();
    [...filteredInvoices, ...income].forEach((item) => {
      const date = item.due_date || item.date;
      if (!date) return;
      const month = new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + item.amount);
    });
    return Array.from(monthlyMap.entries()).map(([month, amount]) => ({ month, amount }));
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
          <Button onClick={exportData}>
            <Download className="size-4 mr-2" /> Export
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

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-success" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatAmount(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Avg Invoice</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatAmount(avgInvoice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Top Customer</p>
            </div>
            <p className="text-xl font-bold text-warning">{topCustomer?.name || "-"}</p>
            <p className="text-xs text-muted-foreground">{topCustomer ? formatAmount(topCustomer.value) : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="size-4 text-info" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Paid vs Pending</p>
            </div>
            <p className="text-sm">
              <span className="text-success">{formatAmount(paidRevenue)}</span> / <span className="text-warning">{formatAmount(pendingRevenue)}</span>
            </p>
          </CardContent>
        </Card>
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
                <Bar dataKey="value" fill="#10b981" />
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
                    const percentage = invoiceRevenue > 0 ? (item.value / invoiceRevenue) * 100 : 0;
                    return (
                      <TableRow key={item.name}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-success font-medium">{formatAmount(item.value)}</TableCell>
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
