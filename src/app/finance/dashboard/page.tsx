"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  TrendingUp, TrendingDown, Wallet, FileText, Receipt, ClipboardList, 
  Landmark, RefreshCw, Download, Plus, DollarSign, CreditCard, 
  Building2, AlertTriangle, CheckCircle2, ArrowRight, Search, 
  Calendar, Truck, Fuel, Wrench, MapPin, ArrowUpRight, ArrowDownLeft, Activity
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { CurrencySelector } from "@/components/finance/currency-selector";

type FinanceRow = Record<string, unknown>;

export default function FinanceDashboardPage() {
  const { toast } = useToast();
  const { role, hasDepartmentAccess } = useRole();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<FinanceRow[]>([]);
  const [expenses, setExpenses] = useState<FinanceRow[]>([]);
  const [income, setIncome] = useState<FinanceRow[]>([]);
  const [taxes, setTaxes] = useState<FinanceRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<FinanceRow[]>([]);
  const [vehicles, setVehicles] = useState<FinanceRow[]>([]);
  const [trips, setTrips] = useState<FinanceRow[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState("TZS");
  const [search, setSearch] = useState("");

  // Form states
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: "", customer_name: "", amount: "", currency: "TZS", type: "AR", due_date: "", description: "" });
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", currency: "TZS", category: "", vendor: "", date: "" });
  const [revenueForm, setRevenueForm] = useState({ description: "", amount: "", currency: "TZS", date: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", currency: "TZS", payment_method: "", payment_date: "", notes: "" });
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadFinance = async () => {
    setLoading(true);
    try {
      const [invoicesData, expensesData, incomeData, taxesData, bankAccountsData, vehiclesData, tripsData] = await Promise.all([
        supabase.from("invoices").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("income").select("*"),
        supabase.from("taxes").select("*"),
        supabase.from("bank_accounts").select("*"),
        supabase.from("vehicles").select("*"),
        supabase.from("trips").select("*"),
      ]);

      setInvoices(invoicesData.data || []);
      setExpenses(expensesData.data || []);
      setIncome(incomeData.data || []);
      setTaxes(taxesData.data || []);
      setBankAccounts(bankAccountsData.data || []);
      setVehicles(vehiclesData.data || []);
      setTrips(tripsData.data || []);
    } catch (err) {
      console.error("Error loading finance data:", err);
      toast({ title: "Error", description: "Failed to load finance data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const toNumber = (value: unknown): number => Number(value ?? 0) || 0;
  const text = (value: unknown, fallback = "-"): string => (value === null || value === undefined || value === "") ? fallback : String(value);

  // Calculate metrics grouped by currency
  const metricsByCurrency = useMemo(() => {
    const currencies = AVAILABLE_CURRENCIES.map(c => c.code);
    const metrics: Record<string, any> = {};
    
    currencies.forEach(currency => {
      const currencyInvoices = invoices.filter(i => text(i.currency) === currency);
      const currencyExpenses = expenses.filter(e => text(e.currency) === currency);
      const currencyIncome = income.filter(i => text(i.currency) === currency);
      const currencyTaxes = taxes.filter(t => text(t.currency) === currency);
      const currencyBankAccounts = bankAccounts.filter(b => text(b.currency) === currency);
      
      metrics[currency] = {
        revenue: currencyIncome.reduce((sum, i) => sum + toNumber(i.amount), 0) + 
                  currencyInvoices.filter((i) => text(i.type) === "AR").reduce((sum, i) => sum + toNumber(i.amount), 0),
        expenses: currencyExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0),
        receivables: currencyInvoices.filter((i) => text(i.status) !== "paid" && text(i.type) === "AR").reduce((sum, i) => sum + toNumber(i.amount), 0),
        payables: currencyInvoices.filter((i) => text(i.status) !== "paid" && text(i.type) === "AP").reduce((sum, i) => sum + toNumber(i.amount), 0),
        taxDue: currencyTaxes.filter((t) => text(t.status) !== "paid").reduce((sum, t) => sum + toNumber(t.amount), 0),
        bankBalance: currencyBankAccounts.reduce((sum, b) => sum + toNumber(b.balance), 0),
        netProfit: (currencyIncome.reduce((sum, i) => sum + toNumber(i.amount), 0) + 
                   currencyInvoices.filter((i) => text(i.type) === "AR").reduce((sum, i) => sum + toNumber(i.amount), 0)) -
                   currencyExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0),
        pendingExpenses: currencyExpenses.filter((e) => text(e.status) === "pending").length,
      };
    });
    
    return metrics;
  }, [invoices, expenses, income, taxes, bankAccounts]);

  // Process data for charts
  const revenueChartData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    income.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + toNumber(item.amount);
    });
    invoices.filter((i) => text(i.type) === "AR").forEach((item) => {
      const month = new Date(text(item.due_date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + toNumber(item.amount);
    });
    return Object.entries(monthlyData).map(([month, amount]) => ({ month, amount }));
  }, [income, invoices]);

  const expenseChartData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    expenses.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + toNumber(item.amount);
    });
    return Object.entries(monthlyData).map(([month, amount]) => ({ month, amount }));
  }, [expenses]);

  const cashFlowData = useMemo(() => {
    const monthlyData: Record<string, { inflow: number; outflow: number }> = {};
    income.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) monthlyData[month] = { inflow: 0, outflow: 0 };
      monthlyData[month].inflow += toNumber(item.amount);
    });
    invoices.filter((i) => text(i.status) === "paid").forEach((item) => {
      const month = new Date(text(item.due_date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) monthlyData[month] = { inflow: 0, outflow: 0 };
      monthlyData[month].inflow += toNumber(item.amount);
    });
    expenses.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) monthlyData[month] = { inflow: 0, outflow: 0 };
      monthlyData[month].outflow += toNumber(item.amount);
    });
    return Object.entries(monthlyData).map(([month, data]) => ({ month, ...data }));
  }, [income, invoices, expenses]);

  const profitTrendData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    income.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + toNumber(item.amount);
    });
    invoices.filter((i) => text(i.type) === "AR").forEach((item) => {
      const month = new Date(text(item.due_date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + toNumber(item.amount);
    });
    expenses.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) - toNumber(item.amount);
    });
    return Object.entries(monthlyData).map(([month, profit]) => ({ month, profit }));
  }, [income, invoices, expenses]);

  // Recent activity
  const recentExpenses = expenses.slice(0, 5);
  const recentRevenue = income.slice(0, 5);
  const recentPayments = invoices.filter((i) => text(i.status) === "paid").slice(0, 5);
  const pendingApprovals = expenses.filter((e) => text(e.status) === "pending").slice(0, 5);

  const saveInvoice = async () => {
    if (!invoiceForm.invoice_number || !invoiceForm.customer_name || !invoiceForm.amount) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("invoices").insert({
        invoice_number: invoiceForm.invoice_number,
        customer_name: invoiceForm.customer_name,
        amount: parseFloat(invoiceForm.amount),
        currency: invoiceForm.currency,
        type: invoiceForm.type,
        due_date: invoiceForm.due_date,
        description: invoiceForm.description,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadFinance();
      setModal(null);
      setInvoiceForm({ invoice_number: "", customer_name: "", amount: "", currency: "TZS", type: "AR", due_date: "", description: "" });
      toast({ title: "Success", description: "Invoice created successfully" });
    } catch (err) {
      console.error("Error saving invoice:", err);
      toast({ title: "Error", description: "Failed to create invoice", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const saveExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("expenses").insert({
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        currency: expenseForm.currency,
        category: expenseForm.category,
        vendor: expenseForm.vendor,
        date: expenseForm.date,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadFinance();
      setModal(null);
      setExpenseForm({ description: "", amount: "", currency: "TZS", category: "", vendor: "", date: "" });
      toast({ title: "Success", description: "Expense saved successfully" });
    } catch (err) {
      console.error("Error saving expense:", err);
      toast({ title: "Error", description: "Failed to save expense", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const saveRevenue = async () => {
    if (!revenueForm.description || !revenueForm.amount) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("income").insert({
        description: revenueForm.description,
        amount: parseFloat(revenueForm.amount),
        currency: revenueForm.currency,
        date: revenueForm.date,
        status: "received",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadFinance();
      setModal(null);
      setRevenueForm({ description: "", amount: "", currency: "TZS", date: "" });
      toast({ title: "Success", description: "Revenue recorded successfully" });
    } catch (err) {
      console.error("Error saving revenue:", err);
      toast({ title: "Error", description: "Failed to record revenue", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      metricsByCurrency,
      recentActivity: {
        expenses: recentExpenses,
        revenue: recentRevenue,
        payments: recentPayments,
        pendingApprovals,
      },
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-dashboard-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Success", description: "Report exported successfully" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || "CEO"} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
                <p className="text-muted-foreground">Overview of financial operations and performance</p>
              </div>
              <div className="flex gap-2">
                <CurrencySelector 
                  selectedCurrency={selectedCurrency} 
                  onCurrencyChange={setSelectedCurrency}
                />
                <Button variant="outline" onClick={loadFinance} disabled={loading}>
                  <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
                </Button>
                <Button onClick={handleExportReport}>
                  <Download className="size-4 mr-2" /> Export
                </Button>
              </div>
            </div>
          </header>

          {/* Row 1: Key Metrics by Currency */}
          <section className="space-y-6 mb-6">
            {AVAILABLE_CURRENCIES.map((currency) => {
              const metrics = metricsByCurrency[currency.code];
              const hasData = metrics.revenue > 0 || metrics.expenses > 0 || metrics.bankBalance > 0;
              
              if (!hasData) return null;
              
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
                        <p className="text-xs font-medium text-muted-foreground uppercase">Revenue</p>
                        <p className="text-xl font-bold text-success">{formatCurrency(metrics.revenue, currency.code)}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Expenses</p>
                        <p className="text-xl font-bold text-destructive">{formatCurrency(metrics.expenses, currency.code)}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Net Profit</p>
                        <p className={cn("text-xl font-bold", metrics.netProfit >= 0 ? "text-success" : "text-destructive")}>
                          {formatCurrency(metrics.netProfit, currency.code)}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Bank Balance</p>
                        <p className="text-xl font-bold text-primary">{formatCurrency(metrics.bankBalance, currency.code)}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Receivables</p>
                        <p className="text-xl font-bold text-warning">{formatCurrency(metrics.receivables, currency.code)}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Payables</p>
                        <p className="text-xl font-bold text-info">{formatCurrency(metrics.payables, currency.code)}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Tax Due</p>
                        <p className="text-xl font-bold text-destructive">{formatCurrency(metrics.taxDue, currency.code)}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Pending Expenses</p>
                        <p className="text-xl font-bold text-primary">{metrics.pendingExpenses}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          {/* Row 2: Charts */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={128}>
                  <AreaChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Expense Trend</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={128}>
                  <AreaChart data={expenseChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="amount" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cash Flow</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={128}>
                  <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="inflow" fill="#10b981" />
                    <Bar dataKey="outflow" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Profit Trend</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={128}>
                  <LineChart data={profitTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          {/* Row 3: Quick Actions */}
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Dialog open={modal === "invoice"} onOpenChange={(open) => setModal(open ? "invoice" : null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FileText className="size-4 mr-2" /> Create Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Invoice</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Invoice Number</Label>
                      <Input value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Customer Name</Label>
                      <Input value={invoiceForm.customer_name} onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={invoiceForm.currency} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, currency: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_CURRENCIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                      <Button onClick={saveInvoice} disabled={submitting}>Create</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={modal === "expense"} onOpenChange={(open) => setModal(open ? "expense" : null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Receipt className="size-4 mr-2" /> Record Expense
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add New Expense</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={expenseForm.currency} onValueChange={(value) => setExpenseForm({ ...expenseForm, currency: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_CURRENCIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                      <Button onClick={saveExpense} disabled={submitting}>Save</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={modal === "revenue"} onOpenChange={(open) => setModal(open ? "revenue" : null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Wallet className="size-4 mr-2" /> Record Revenue
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Record Revenue</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" value={revenueForm.amount} onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={revenueForm.currency} onValueChange={(value) => setRevenueForm({ ...revenueForm, currency: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_CURRENCIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={revenueForm.description} onChange={(e) => setRevenueForm({ ...revenueForm, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={revenueForm.date} onChange={(e) => setRevenueForm({ ...revenueForm, date: e.target.value })} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                      <Button onClick={saveRevenue} disabled={submitting}>Save</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" asChild>
                <Link href="/finance/accounting/journal-entries">
                  <ClipboardList className="size-4 mr-2" /> Journal Entry
                </Link>
              </Button>

              <Button variant="outline" size="sm" asChild>
                <Link href="/finance/transactions/payments">
                  <DollarSign className="size-4 mr-2" /> Receive Payment
                </Link>
              </Button>

              <Button variant="outline" size="sm" asChild>
                <Link href="/finance/invoicing/vendor-bills">
                  <Building2 className="size-4 mr-2" /> Vendor Bill
                </Link>
              </Button>

              <Button variant="outline" size="sm" asChild>
                <Link href="/finance/banking/bank-reconciliation">
                  <Landmark className="size-4 mr-2" /> Import Statement
                </Link>
              </Button>
            </div>
          </section>

          {/* Row 4: Recent Activity */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="size-4" /> Latest Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent expenses</p>
                ) : (
                  <div className="space-y-2">
                    {recentExpenses.map((exp) => (
                      <div key={text(exp.id)} className="flex justify-between text-sm items-center">
                        <span className="truncate">{text(exp.description)}</span>
                        <div className="flex items-center gap-2">
                          <CurrencyBadge currency={text(exp.currency)} size="sm" />
                          <span className="font-medium">{formatCurrency(toNumber(exp.amount), text(exp.currency))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="size-4" /> Latest Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentRevenue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent revenue</p>
                ) : (
                  <div className="space-y-2">
                    {recentRevenue.map((rev) => (
                      <div key={text(rev.id)} className="flex justify-between text-sm items-center">
                        <span className="truncate">{text(rev.description)}</span>
                        <div className="flex items-center gap-2">
                          <CurrencyBadge currency={text(rev.currency)} size="sm" />
                          <span className="font-medium text-success">{formatCurrency(toNumber(rev.amount), text(rev.currency))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="size-4" /> Recent Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent payments</p>
                ) : (
                  <div className="space-y-2">
                    {recentPayments.map((inv) => (
                      <div key={text(inv.id)} className="flex justify-between text-sm items-center">
                        <span className="truncate">{text(inv.customer_name)}</span>
                        <div className="flex items-center gap-2">
                          <CurrencyBadge currency={text(inv.currency)} size="sm" />
                          <span className="font-medium text-success">{formatCurrency(toNumber(inv.amount), text(inv.currency))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="size-4" /> Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="size-4" /> All caught up
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingApprovals.map((exp) => (
                      <div key={text(exp.id)} className="flex justify-between text-sm">
                        <span className="truncate">{text(exp.description)}</span>
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
