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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, TrendingDown, Wallet, FileText, Receipt, ClipboardList, 
  Landmark, RefreshCw, Download, Plus, DollarSign, CreditCard, 
  Building2, AlertTriangle, CheckCircle2, ArrowRight, Search, 
  Calendar, Bell, Settings, Printer, ArrowUpRight, ArrowDownLeft, Activity,
  PieChart, BarChart3, LineChart, Target, Shield, Zap
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { 
  AreaChart, Area, BarChart, Bar, LineChart as RechartsLineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell 
} from "recharts";
import { CurrencyBadge, formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { CurrencySelector } from "@/components/finance/currency-selector";

type FinanceRow = Record<string, unknown>;

export default function CFODashboardPage() {
  const { toast } = useToast();
  const { role } = useRole();
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

  // Financial health ratios
  const financialHealth = useMemo(() => {
    const tzsMetrics = metricsByCurrency["TZS"] || {};
    const currentAssets = tzsMetrics.bankBalance + tzsMetrics.receivables || 0;
    const currentLiabilities = tzsMetrics.payables + tzsMetrics.taxDue || 0;
    const workingCapital = currentAssets - currentLiabilities;
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const grossMargin = tzsMetrics.revenue > 0 ? (tzsMetrics.grossProfit / tzsMetrics.revenue) * 100 : 0;
    const netMargin = tzsMetrics.revenue > 0 ? (tzsMetrics.netProfit / tzsMetrics.revenue) * 100 : 0;
    const cashRatio = currentLiabilities > 0 ? tzsMetrics.bankBalance / currentLiabilities : 0;
    
    return {
      workingCapital,
      currentRatio,
      grossMargin,
      netMargin,
      cashRatio,
    };
  }, [metricsByCurrency]);

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
    
    return alertList;
  }, [invoices, expenses, metricsByCurrency]);

  // Chart data
  const revenueByMonth = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    income.forEach((item) => {
      const month = new Date(text(item.date)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + toNumber(item.amount);
    });
    return Object.entries(monthlyData).map(([month, amount]) => ({ month, amount }));
  }, [income]);

  const expensesByCategory = useMemo(() => {
    const categoryData: Record<string, number> = {};
    expenses.forEach((item) => {
      const category = text(item.category, "Other");
      categoryData[category] = (categoryData[category] || 0) + toNumber(item.amount);
    });
    return Object.entries(categoryData).map(([category, amount]) => ({ category, amount }));
  }, [expenses]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const handleExportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      metricsByCurrency,
      financialHealth,
      alerts,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cfo-dashboard-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Dashboard exported successfully" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || "CEO"} />
      <main className="flex-1 md:ml-60">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 md:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">CFO Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Calvary Connect - Financial Overview</p>
                </div>
                <Badge variant="outline" className="hidden md:inline-flex">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative hidden md:block">
                  <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search..." 
                    className="pl-8 w-64" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Bell className="size-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleExportReport}>
                  <Download className="size-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Printer className="size-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Settings className="size-4" />
                </Button>
                <Button variant="outline" onClick={loadFinance} disabled={loading}>
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
          </div>
        </header>

        <div className="container mx-auto px-4 md:px-8 py-6 space-y-6">
          {/* Executive KPIs */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="size-5" /> Executive KPIs
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {AVAILABLE_CURRENCIES.slice(0, 2).map((currency) => {
                const metrics = metricsByCurrency[currency.code];
                if (!metrics || metrics.revenue === 0) return null;
                
                return (
                  <Card key={currency.code} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <span>{currency.flag}</span> Revenue
                        </CardTitle>
                        <CurrencyBadge currency={currency.code} size="sm" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(metrics.revenue, currency.code)}</p>
                      <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                        <TrendingUp className="size-3" />
                        <span>+12.5%</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {AVAILABLE_CURRENCIES.slice(0, 2).map((currency) => {
                const metrics = metricsByCurrency[currency.code];
                if (!metrics || metrics.expenses === 0) return null;
                
                return (
                  <Card key={`exp-${currency.code}`} className="border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <span>{currency.flag}</span> Expenses
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(metrics.expenses, currency.code)}</p>
                      <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                        <TrendingDown className="size-3" />
                        <span>+8.2%</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {AVAILABLE_CURRENCIES.slice(0, 1).map((currency) => {
                const metrics = metricsByCurrency[currency.code];
                if (!metrics) return null;
                
                return (
                  <Card key={`profit-${currency.code}`} className="border-l-4 border-l-emerald-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <span>{currency.flag}</span> Net Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={cn("text-2xl font-bold", metrics.netProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {formatCurrency(metrics.netProfit, currency.code)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                        <TrendingUp className="size-3" />
                        <span>+15.3%</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Treasury & Banking */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Landmark className="size-5" /> Treasury & Banking
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {AVAILABLE_CURRENCIES.map((currency) => {
                const currencyAccounts = bankAccounts.filter(b => text(b.currency) === currency.code);
                const totalBalance = currencyAccounts.reduce((sum, b) => sum + toNumber(b.balance), 0);
                
                if (currencyAccounts.length === 0) return null;
                
                return (
                  <Card key={currency.code}>
                    <CardHeader className="bg-muted/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-3">
                          <span className="text-2xl">{currency.flag}</span>
                          <span>{currency.name}</span>
                          <CurrencyBadge currency={currency.code} />
                        </CardTitle>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total Balance</p>
                          <p className="text-2xl font-bold">{formatCurrency(totalBalance, currency.code)}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {currencyAccounts.map((account) => (
                          <div key={text(account.id)} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-semibold">{text(account.bank_name)}</p>
                              <p className="text-sm text-muted-foreground">{text(account.account_name)}</p>
                            </div>
                            <p className="font-semibold">{formatCurrency(toNumber(account.balance), currency.code)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Receivables & Payables */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="size-5" /> Receivables & Payables
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpRight className="size-5 text-emerald-600" /> Accounts Receivable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Outstanding</p>
                        <p className="text-xl font-bold">{formatCurrency(receivablesAging.current + receivablesAging.days30 + receivablesAging.days60 + receivablesAging.days90 + receivablesAging.days120, "TZS")}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Overdue</p>
                        <p className="text-xl font-bold text-red-600">{formatCurrency(receivablesAging.days30 + receivablesAging.days60 + receivablesAging.days90 + receivablesAging.days120, "TZS")}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Current</span>
                        <span>{formatCurrency(receivablesAging.current, "TZS")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>30 Days</span>
                        <span>{formatCurrency(receivablesAging.days30, "TZS")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>60 Days</span>
                        <span>{formatCurrency(receivablesAging.days60, "TZS")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>90 Days</span>
                        <span>{formatCurrency(receivablesAging.days90, "TZS")}</span>
                      </div>
                      <div className="flex justify-between text-sm text-red-600">
                        <span>120+ Days</span>
                        <span>{formatCurrency(receivablesAging.days120, "TZS")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownLeft className="size-5 text-red-600" /> Accounts Payable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {AVAILABLE_CURRENCIES.slice(0, 2).map((currency) => {
                      const metrics = metricsByCurrency[currency.code];
                      if (!metrics || metrics.payables === 0) return null;
                      
                      return (
                        <div key={currency.code} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{currency.flag}</span>
                            <span>{currency.name}</span>
                          </div>
                          <p className="font-semibold">{formatCurrency(metrics.payables, currency.code)}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Revenue & Expense Analytics */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="size-5" /> Revenue & Expense Analytics
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={revenueByMonth}>
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
                  <CardTitle>Expenses by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => entry.category}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="amount"
                      >
                        {expensesByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Financial Health & Alerts */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="size-5" /> Financial Health & Alerts
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Health Ratios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Working Capital</p>
                      <p className="text-lg font-bold">{formatCurrency(financialHealth.workingCapital, "TZS")}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Current Ratio</p>
                      <p className="text-lg font-bold">{financialHealth.currentRatio.toFixed(2)}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Gross Margin</p>
                      <p className="text-lg font-bold">{financialHealth.grossMargin.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Net Margin</p>
                      <p className="text-lg font-bold">{financialHealth.netMargin.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Cash Ratio</p>
                      <p className="text-lg font-bold">{financialHealth.cashRatio.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="size-5 text-amber-600" /> Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {alerts.length === 0 ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="size-5" />
                      <p>All systems normal</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {alerts.map((alert, index) => (
                        <div key={index} className={cn(
                          "p-3 border rounded-lg flex items-start gap-2",
                          alert.severity === "high" ? "border-red-500 bg-red-50 dark:bg-red-950" :
                          alert.severity === "medium" ? "border-amber-500 bg-amber-50 dark:bg-amber-950" :
                          "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        )}>
                          <AlertTriangle className={cn(
                            "size-4 mt-0.5",
                            alert.severity === "high" ? "text-red-600" :
                            alert.severity === "medium" ? "text-amber-600" :
                            "text-blue-600"
                          )} />
                          <div>
                            <p className="font-semibold text-sm">{alert.type}</p>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="size-5" /> Quick Actions
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/finance/income">
                <Button variant="outline" size="sm">
                  <DollarSign className="size-4 mr-2" /> Record Revenue
                </Button>
              </Link>
              <Link href="/finance/reports/expense-analysis">
                <Button variant="outline" size="sm">
                  <Receipt className="size-4 mr-2" /> Record Expense
                </Button>
              </Link>
              <Link href="/finance/banking/bank-accounts">
                <Button variant="outline" size="sm">
                  <Landmark className="size-4 mr-2" /> Bank Accounts
                </Button>
              </Link>
              <Link href="/finance/invoicing/customer-invoices">
                <Button variant="outline" size="sm">
                  <FileText className="size-4 mr-2" /> Create Invoice
                </Button>
              </Link>
              <Link href="/finance/accounting/chart-of-accounts">
                <Button variant="outline" size="sm">
                  <ClipboardList className="size-4 mr-2" /> Chart of Accounts
                </Button>
              </Link>
              <Link href="/finance/reports">
                <Button variant="outline" size="sm">
                  <Activity className="size-4 mr-2" /> Reports
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
