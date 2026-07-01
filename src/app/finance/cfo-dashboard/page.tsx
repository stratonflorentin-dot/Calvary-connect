"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { Sidebar } from "@/components/navigation/sidebar";
import { useSidebar } from "@/hooks/use-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingUp, TrendingDown, Wallet, FileText, Receipt, ClipboardList, 
  Landmark, RefreshCw, Download, Plus, DollarSign, CreditCard, 
  Building2, AlertTriangle, CheckCircle2, ArrowRight, Search, 
  Calendar, Bell, Settings, Printer, ArrowUpRight, ArrowDownLeft, Activity,
  PieChart, BarChart3, LineChart, Target, Shield, Zap,
  Truck, Send, Banknote, FileSpreadsheet, HandCoins, FileEdit, Scale, Clock
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { 
  AreaChart, Area, BarChart, Bar, LineChart as RechartsLineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell,
  Legend
} from "recharts";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { CurrencySelector } from "@/components/finance/currency-selector";

type FinanceRow = Record<string, unknown>;

export default function EnterpriseFinanceDashboard() {
  const { toast } = useToast();
  const { role } = useRole();
  const { isCollapsed } = useSidebar();
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
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<string>("");

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
      setLastUpdated(new Date().toLocaleString());
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
      
      const revenue = currencyIncome.reduce((sum, i) => sum + toNumber(i.amount), 0) + 
                     currencyInvoices.filter((i) => text(i.type) === "AR").reduce((sum, i) => sum + toNumber(i.amount), 0);
      const expensesTotal = currencyExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
      
      metrics[currency] = {
        revenue,
        expenses: expensesTotal,
        receivables: currencyInvoices.filter((i) => text(i.status) !== "paid" && text(i.type) === "AR").reduce((sum, i) => sum + toNumber(i.amount), 0),
        payables: currencyInvoices.filter((i) => text(i.status) !== "paid" && text(i.type) === "AP").reduce((sum, i) => sum + toNumber(i.amount), 0),
        taxDue: currencyTaxes.filter((t) => text(t.status) !== "paid").reduce((sum, t) => sum + toNumber(t.amount), 0),
        bankBalance: currencyBankAccounts.reduce((sum, b) => sum + toNumber(b.balance), 0),
        netProfit: revenue - expensesTotal,
        grossProfit: revenue * 0.65, // Assuming 65% gross margin
        cashAvailable: currencyBankAccounts.reduce((sum, b) => sum + toNumber(b.balance), 0),
        outstandingInvoices: currencyInvoices.filter((i) => text(i.status) !== "paid" && text(i.type) === "AR").length,
        overdueBills: currencyInvoices.filter((i) => text(i.status) === "overdue" && text(i.type) === "AP").length,
      };
    });
    
    return metrics;
  }, [invoices, expenses, income, taxes, bankAccounts]);

  // Calculate aging for receivables
  const receivablesAging = useMemo(() => {
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, days120: 0 };
    const arInvoices = invoices.filter((i) => text(i.type) === "AR" && text(i.status) !== "paid");
    
    arInvoices.forEach((invoice) => {
      const dueDate = new Date(text(invoice.due_date));
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue <= 0) aging.current += toNumber(invoice.amount);
      else if (daysOverdue <= 30) aging.days30 += toNumber(invoice.amount);
      else if (daysOverdue <= 60) aging.days60 += toNumber(invoice.amount);
      else if (daysOverdue <= 90) aging.days90 += toNumber(invoice.amount);
      else aging.days120 += toNumber(invoice.amount);
    });
    
    return aging;
  }, [invoices]);

  // Calculate aging for payables
  const payablesAging = useMemo(() => {
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, days120: 0 };
    const apInvoices = invoices.filter((i) => text(i.type) === "AP" && text(i.status) !== "paid");
    
    apInvoices.forEach((invoice) => {
      const dueDate = new Date(text(invoice.due_date));
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue <= 0) aging.current += toNumber(invoice.amount);
      else if (daysOverdue <= 30) aging.days30 += toNumber(invoice.amount);
      else if (daysOverdue <= 60) aging.days60 += toNumber(invoice.amount);
      else if (daysOverdue <= 90) aging.days90 += toNumber(invoice.amount);
      else aging.days120 += toNumber(invoice.amount);
    });
    
    return aging;
  }, [invoices]);

  // Alerts
  const alerts = useMemo(() => {
    const alertList: Array<{ type: string; message: string; severity: "high" | "medium" | "low" }> = [];
    
    const overdueInvoices = invoices.filter((i) => {
      const dueDate = new Date(text(i.due_date));
      return text(i.status) !== "paid" && dueDate < new Date();
    });
    
    if (overdueInvoices.length > 0) {
      alertList.push({
        type: "Overdue Invoices",
        message: `${overdueInvoices.length} customer invoices are overdue`,
        severity: "high",
      });
    }
    
    const lowCashCurrencies = AVAILABLE_CURRENCIES.filter(c => {
      const metrics = metricsByCurrency[c.code];
      return metrics && metrics.bankBalance < 1000000;
    });
    
    if (lowCashCurrencies.length > 0) {
      alertList.push({
        type: "Low Cash Warning",
        message: `Low cash balance in ${lowCashCurrencies.map(c => c.code).join(", ")}`,
        severity: "high",
      });
    }
    
    const pendingExpenses = expenses.filter((e) => text(e.status) === "pending");
    if (pendingExpenses.length > 10) {
      alertList.push({
        type: "Pending Approvals",
        message: `${pendingExpenses.length} expenses awaiting approval`,
        severity: "medium",
      });
    }

    const unreconciledAccounts = bankAccounts.filter(b => text(b.reconciled) !== "true");
    if (unreconciledAccounts.length > 0) {
      alertList.push({
        type: "Unreconciled Bank Accounts",
        message: `${unreconciledAccounts.length} accounts need reconciliation`,
        severity: "medium",
      });
    }
    
    return alertList;
  }, [invoices, expenses, metricsByCurrency, bankAccounts]);

  // Chart data
  const revenueByMonth = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    income.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + toNumber(item.amount);
    });
    return Object.entries(monthlyData).map(([month, amount]) => ({ month, amount }));
  }, [income]);

  const expensesByMonth = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    expenses.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + toNumber(item.amount);
    });
    return Object.entries(monthlyData).map(([month, amount]) => ({ month, amount }));
  }, [expenses]);

  const profitByMonth = useMemo(() => {
    const revenueData = revenueByMonth.reduce((acc, item) => ({ ...acc, [item.month]: item.amount }), {});
    const expensesData = expensesByMonth.reduce((acc, item) => ({ ...acc, [item.month]: item.amount }), {});
    const allMonths = [...new Set([...Object.keys(revenueData), ...Object.keys(expensesData)])];
    
    return allMonths.map(month => ({
      month,
      profit: (revenueData[month] || 0) - (expensesData[month] || 0)
    }));
  }, [revenueByMonth, expensesByMonth]);

  const cashFlowData = useMemo(() => {
    const monthlyData: Record<string, { inflow: number; outflow: number }> = {};
    income.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) monthlyData[month] = { inflow: 0, outflow: 0 };
      monthlyData[month].inflow += toNumber(item.amount);
    });
    invoices.filter((i) => text(i.status) === "paid").forEach((item) => {
      const month = new Date(text(i.due_date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

  const expensesByCategory = useMemo(() => {
    const categoryData: Record<string, number> = {};
    expenses.forEach((item) => {
      const category = text(item.category, "Other");
      categoryData[category] = (categoryData[category] || 0) + toNumber(item.amount);
    });
    return Object.entries(categoryData).map(([category, amount]) => ({ category, amount }));
  }, [expenses]);

  // Recent transactions
  const recentTransactions = useMemo(() => {
    const allTransactions = [
      ...income.map((item) => ({ ...item, type: "income" })),
      ...expenses.map((item) => ({ ...item, type: "expense" })),
      ...invoices.map((item) => ({ ...item, type: "invoice" })),
    ].sort((a, b) => new Date(text(b.date || b.created_at)).getTime() - new Date(text(a.date || a.created_at)).getTime());

    return allTransactions.filter(item => {
      if (transactionFilter === "all") return true;
      return item.type === transactionFilter;
    }).filter(item => {
      const searchTerm = search.toLowerCase();
      return text(item.description).toLowerCase().includes(searchTerm) ||
             text(item.customer_name).toLowerCase().includes(searchTerm);
    }).slice(0, 50);
  }, [income, expenses, invoices, transactionFilter, search]);

  // Fleet profitability (simplified with existing data)
  const fleetProfitability = useMemo(() => {
    // Group trips by vehicle and calculate profitability
    const vehicleProfit: Record<string, { revenue: number; expenses: number; profit: number }> = {};
    
    trips.forEach(trip => {
      const vehicleId = text(trip.vehicle_id);
      if (!vehicleProfit[vehicleId]) {
        vehicleProfit[vehicleId] = { revenue: 0, expenses: 0, profit: 0 };
      }
      vehicleProfit[vehicleId].revenue += toNumber(trip.amount);
    });

    expenses.forEach(expense => {
      const vehicleId = text(expense.vehicle_id);
      if (vehicleId && vehicleProfit[vehicleId]) {
        vehicleProfit[vehicleId].expenses += toNumber(expense.amount);
      }
    });

    // Calculate profit
    Object.keys(vehicleProfit).forEach(id => {
      vehicleProfit[id].profit = vehicleProfit[id].revenue - vehicleProfit[id].expenses;
    });

    return Object.entries(vehicleProfit).map(([vehicleId, data]) => {
      const vehicle = vehicles.find(v => text(v.id) === vehicleId);
      return {
        vehicleId,
        vehicleName: vehicle ? text(vehicle.plate_number || vehicle.name) : "Unknown Vehicle",
        ...data
      };
    }).slice(0, 10);
  }, [trips, expenses, vehicles]);

  const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const AGING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#dc2626'];

  const handleExportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      metricsByCurrency,
      alerts,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enterprise-finance-dashboard-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Dashboard exported successfully" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || "CEO"} />
      <main className={cn(
        "flex-1 min-h-screen",
        isCollapsed ? "md:ml-20" : "md:ml-64"
      )}>
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 md:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Shield className="size-6 text-primary" />
                    Enterprise Finance Dashboard
                  </h1>
                  <p className="text-sm text-muted-foreground">Calvary Connect - ERP Financial Overview</p>
                </div>
                <Badge variant="outline" className="hidden md:inline-flex">
                  {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <CurrencySelector 
                  selectedCurrency={selectedCurrency} 
                  onCurrencyChange={setSelectedCurrency}
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={loadFinance} disabled={loading}>
                    <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleExportReport}>
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
          </div>
        </header>

        <div className="container mx-auto px-4 md:px-8 py-6 space-y-6">
          {/* Executive KPIs */}
          <section>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
              {/* Revenue */}
              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="size-4 text-emerald-500" />
                    Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(metricsByCurrency[selectedCurrency]?.revenue || 0, selectedCurrency)}</p>
                </CardContent>
              </Card>

              {/* Expenses */}
              <Card className="border-l-4 border-l-rose-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="size-4 text-rose-500" />
                    Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(metricsByCurrency[selectedCurrency]?.expenses || 0, selectedCurrency)}</p>
                </CardContent>
              </Card>

              {/* Net Profit */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Activity className="size-4 text-blue-500" />
                    Net Profit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={cn("text-xl font-bold", (metricsByCurrency[selectedCurrency]?.netProfit || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {formatCurrency(metricsByCurrency[selectedCurrency]?.netProfit || 0, selectedCurrency)}
                  </p>
                </CardContent>
              </Card>

              {/* Cash Balance */}
              <Card className="border-l-4 border-l-cyan-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Wallet className="size-4 text-cyan-500" />
                    Cash
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(metricsByCurrency[selectedCurrency]?.bankBalance || 0, selectedCurrency)}</p>
                </CardContent>
              </Card>

              {/* Receivables */}
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="size-4 text-amber-500" />
                    Receivables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(metricsByCurrency[selectedCurrency]?.receivables || 0, selectedCurrency)}</p>
                </CardContent>
              </Card>

              {/* Payables */}
              <Card className="border-l-4 border-l-violet-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ArrowDownLeft className="size-4 text-violet-500" />
                    Payables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{formatCurrency(metricsByCurrency[selectedCurrency]?.payables || 0, selectedCurrency)}</p>
                </CardContent>
              </Card>

              {/* Outstanding Invoices */}
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <FileText className="size-4 text-orange-500" />
                    Outstanding
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{metricsByCurrency[selectedCurrency]?.outstandingInvoices || 0} Invoices</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <Link href="/finance/income">
                <Button variant="secondary" className="w-full justify-start">
                  <DollarSign className="size-4 mr-2" />
                  <span className="hidden md:inline">Record</span> Revenue
                </Button>
              </Link>
              <Link href="/finance/transactions/expenses">
                <Button variant="secondary" className="w-full justify-start">
                  <Receipt className="size-4 mr-2" />
                  <span className="hidden md:inline">Record</span> Expense
                </Button>
              </Link>
              <Link href="/finance/transactions/payments">
                <Button variant="secondary" className="w-full justify-start">
                  <HandCoins className="size-4 mr-2" />
                  <span className="hidden md:inline">Receive</span> Payment
                </Button>
              </Link>
              <Link href="/finance/invoicing/customer-invoices">
                <Button variant="secondary" className="w-full justify-start">
                  <FileText className="size-4 mr-2" />
                  Create Invoice
                </Button>
              </Link>
              <Link href="/finance/accounting/general-ledger">
                <Button variant="secondary" className="w-full justify-start">
                  <FileSpreadsheet className="size-4 mr-2" />
                  Journal Entry
                </Button>
              </Link>
              <Link href="/finance/banking/bank-accounts">
                <Button variant="secondary" className="w-full justify-start">
                  <Send className="size-4 mr-2" />
                  Bank Transfer
                </Button>
              </Link>
              <Link href="/finance/banking/bank-reconciliation">
                <Button variant="secondary" className="w-full justify-start">
                  <Scale className="size-4 mr-2" />
                  Reconciliation
                </Button>
              </Link>
              <Link href="/finance/reports">
                <Button variant="secondary" className="w-full justify-start">
                  <BarChart3 className="size-4 mr-2" />
                  Reports
                </Button>
              </Link>
            </div>
          </section>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Revenue & Profit Trends */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="size-4 text-emerald-500" />
                      Revenue Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={revenueByMonth}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="size-4 text-blue-500" />
                      Profit Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsLineChart data={profitByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </section>

              {/* Treasury & Banking */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Landmark className="size-5 text-primary" />
                      Treasury & Banking
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {AVAILABLE_CURRENCIES.map((currency) => {
                      const currencyAccounts = bankAccounts.filter(b => text(b.currency) === currency.code);
                      const totalBalance = currencyAccounts.reduce((sum, b) => sum + toNumber(b.balance), 0);
                      
                      if (currencyAccounts.length === 0) return null;
                      
                      return (
                        <div key={currency.code} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{currency.flag}</span>
                              <div>
                                <h3 className="font-semibold">{currency.name}</h3>
                                <p className="text-sm text-muted-foreground">Total Balance</p>
                              </div>
                            </div>
                            <p className="text-xl font-bold">{formatCurrency(totalBalance, currency.code)}</p>
                          </div>
                          <div className="grid gap-2">
                            {currencyAccounts.map((account) => (
                              <div key={text(account.id)} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                                <div>
                                  <p className="font-medium">{text(account.bank_name)}</p>
                                  <p className="text-sm text-muted-foreground">{text(account.account_name)}</p>
                                </div>
                                <p className="font-semibold">{formatCurrency(toNumber(account.balance), currency.code)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Receivables & Payables Aging */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpRight className="size-4 text-emerald-600" />
                      Receivables Aging
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={[
                        { name: "Current", value: receivablesAging.current },
                        { name: "30 Days", value: receivablesAging.days30 },
                        { name: "60 Days", value: receivablesAging.days60 },
                        { name: "90 Days", value: receivablesAging.days90 },
                        { name: "120+", value: receivablesAging.days120 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value), selectedCurrency)} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                          {[
                            { name: "Current", value: receivablesAging.current },
                            { name: "30 Days", value: receivablesAging.days30 },
                            { name: "60 Days", value: receivablesAging.days60 },
                            { name: "90 Days", value: receivablesAging.days90 },
                            { name: "120+", value: receivablesAging.days120 }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={AGING_COLORS[index]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <ArrowDownLeft className="size-4 text-rose-600" />
                      Payables Aging
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={[
                        { name: "Current", value: payablesAging.current },
                        { name: "30 Days", value: payablesAging.days30 },
                        { name: "60 Days", value: payablesAging.days60 },
                        { name: "90 Days", value: payablesAging.days90 },
                        { name: "120+", value: payablesAging.days120 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value), selectedCurrency)} />
                        <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]}>
                          {[
                            { name: "Current", value: payablesAging.current },
                            { name: "30 Days", value: payablesAging.days30 },
                            { name: "60 Days", value: payablesAging.days60 },
                            { name: "90 Days", value: payablesAging.days90 },
                            { name: "120+", value: payablesAging.days120 }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={AGING_COLORS[index]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </section>

              {/* Recent Transactions */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="size-5 text-primary" />
                      Recent Transactions
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input 
                        placeholder="Search transactions..." 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)} 
                        className="w-full sm:w-64"
                      />
                      <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expenses</SelectItem>
                          <SelectItem value="invoice">Invoices</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.slice(0, 10).map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(text(transaction.date || transaction.created_at))}
                          </TableCell>
                          <TableCell className="font-medium max-w-xs truncate">
                            {text(transaction.description || transaction.customer_name)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              transaction.type === "income" ? "default" :
                              transaction.type === "expense" ? "destructive" : "outline"
                            }>
                              {transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(toNumber(transaction.amount), text(transaction.currency))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Cash Flow */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Banknote className="size-4 text-cyan-500" />
                    Cash Flow
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="inflow" name="Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expenses By Category */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PieChart className="size-4 text-violet-500" />
                    Expense Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => entry.category}
                        outerRadius={70}
                        dataKey="amount"
                      >
                        {expensesByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value), selectedCurrency)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Fleet Profitability */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Truck className="size-4 text-orange-500" />
                    Fleet Profitability
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {fleetProfitability.map((vehicle, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{vehicle.vehicleName}</p>
                          <p className="text-xs text-muted-foreground">Profit Margin</p>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-semibold", vehicle.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                            {formatCurrency(vehicle.profit, selectedCurrency)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Alerts & Notifications */}
              <Card className="border-rose-200 dark:border-rose-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="size-4 text-rose-600" />
                    Alerts & Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {alerts.length === 0 ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 p-4 border border-emerald-200 dark:border-emerald-900 rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                      <CheckCircle2 className="size-5" />
                      <p className="font-medium">All systems normal - no urgent alerts</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alerts.map((alert, index) => (
                        <div key={index} className={cn(
                          "p-4 border rounded-lg flex items-start gap-3",
                          alert.severity === "high" ? "border-rose-500 bg-rose-50 dark:bg-rose-950 dark:border-rose-800" :
                          alert.severity === "medium" ? "border-amber-500 bg-amber-50 dark:bg-amber-950 dark:border-amber-800" :
                          "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
                        )}>
                          <AlertTriangle className={cn(
                            "size-5 mt-0.5",
                            alert.severity === "high" ? "text-rose-600 dark:text-rose-400" :
                            alert.severity === "medium" ? "text-amber-600 dark:text-amber-400" :
                            "text-blue-600 dark:text-blue-400"
                          )} />
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{alert.type}</p>
                            <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
