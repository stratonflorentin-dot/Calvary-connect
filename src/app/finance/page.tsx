"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  FileText,
  DollarSign,
  CreditCard,
  Plus,
  Receipt,
  Building2,
  Landmark,
  BookOpen,
} from "lucide-react";
import { formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import Link from "next/link";

interface KPI {
  label: string;
  value: number;
  currency: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: "up" | "down";
  trendValue: number;
}

export default function FinanceOverviewPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [cashByCurrency, setCashByCurrency] = useState<Record<string, number>>({});
  const [recentJournalEntries, setRecentJournalEntries] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<{ expenses: number; invoices: number }>({ expenses: 0, invoices: 0 });
  const [overdueItems, setOverdueItems] = useState<{ invoices: number; bills: number }>({ invoices: 0, bills: 0 });

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    try {
      setLoading(true);

      // Load accounts
      const { data: accountsData } = await supabase.from("bank_accounts").select("*");
      const cashByCurr: Record<string, number> = {};
      (accountsData || []).forEach(acc => {
        const curr = acc.currency || "TZS";
        cashByCurr[curr] = (cashByCurr[curr] || 0) + (parseFloat(acc.current_balance) || 0);
      });
      setCashByCurrency(cashByCurr);

      // Load expenses (pending)
      const { data: expensesData } = await supabase.from("expenses").select("*").eq("status", "pending");
      const pendingExpenses = expensesData?.length || 0;

      // Load invoices (pending and overdue)
      const { data: invoicesData } = await supabase.from("invoices").select("*");
      const pendingInvoices = (invoicesData || []).filter(inv => inv.status === "pending").length;
      const overdueInvoices = (invoicesData || []).filter(inv => {
        if (!inv.due_date) return false;
        return new Date(inv.due_date) < new Date() && inv.status !== "paid";
      }).length;

      setPendingApprovals({ expenses: pendingExpenses, invoices: pendingInvoices });
      setOverdueItems({ invoices: overdueInvoices, bills: 0 });

      // Mock KPIs for now
      setKpis([
        { label: "Total Revenue", value: 45230000, currency: "TZS", icon: TrendingUp, trend: "up", trendValue: 12.5 },
        { label: "Total Expenses", value: 28750000, currency: "TZS", icon: TrendingDown, trend: "up", trendValue: 3.2 },
        { label: "Net Profit", value: 16480000, currency: "TZS", icon: DollarSign, trend: "up", trendValue: 8.7 },
        { label: "Total Receivables", value: 8920000, currency: "TZS", icon: CreditCard, trend: "down", trendValue: -2.4 },
        { label: "Total Payables", value: 5430000, currency: "TZS", icon: Receipt, trend: "down", trendValue: -1.8 },
      ]);

      // Mock journal entries
      setRecentJournalEntries([
        { id: "1", reference: "JE-2026-001", date: new Date().toISOString().split('T')[0], description: "Revenue from trip TRP-045", account: "4101", debit: 0, credit: 1500000, currency: "TZS", status: "posted" },
        { id: "2", reference: "JE-2026-002", date: new Date().toISOString().split('T')[0], description: "Fuel expense - Truck TZ-123-AB", account: "5101", debit: 450000, credit: 0, currency: "TZS", status: "posted" },
        { id: "3", reference: "JE-2026-003", date: new Date().toISOString().split('T')[0], description: "Customer payment - ABC Corp", account: "1102", debit: 2000000, credit: 0, currency: "TZS", status: "posted" },
      ]);

    } catch (error) {
      console.error("Failed to load finance data:", error);
      toast({ title: "Error", description: "Failed to load finance overview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading finance overview...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finance Overview</h1>
          <p className="text-muted-foreground">Executive financial summary</p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/finance/accounting/journal-entries">
              <Plus className="size-4 mr-2" />
              New Journal Entry
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/finance/reports/profit-loss">
              <FileText className="size-4 mr-2" />
              View Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <Card key={index}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
                  <Icon className={cn(
                    "size-5",
                    kpi.trend === "up" ? "text-green-600" : "text-red-600"
                  )} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(kpi.value, kpi.currency)}
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium mt-1",
                  kpi.trend === "up" ? "text-green-600" : "text-red-600"
                )}>
                  {kpi.trend === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {Math.abs(kpi.trendValue)}% vs last month
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Position by Currency */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5" />
              Cash Position by Currency
            </CardTitle>
            <CardDescription>
              Real-time balances grouped by currency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(cashByCurrency).length > 0 ? (
                Object.entries(cashByCurrency).map(([currency, balance]) => (
                  <Card key={currency} className="border border-border">
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">{currency}</div>
                      <div className="text-xl font-bold">{formatCurrency(balance, currency)}</div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                AVAILABLE_CURRENCIES.map((curr) => (
                  <Card key={curr.code} className="border border-border">
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">{curr.code}</div>
                      <div className="text-xl font-bold">{formatCurrency(0, curr.code)}</div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/expenses">
                <Plus className="size-4 mr-2" />
                Record Expense
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/income">
                <Plus className="size-4 mr-2" />
                Record Revenue
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/finance/receivables/customer-invoices">
                <FileText className="size-4 mr-2" />
                Create Invoice
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/finance/banking/bank-accounts">
                <Building2 className="size-4 mr-2" />
                Manage Bank Accounts
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/finance/accounting/chart-of-accounts">
                <BookOpen className="size-4 mr-2" />
                Chart of Accounts
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Journal Entries */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Journal Entries</CardTitle>
                <CardDescription>Latest accounting transactions</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/finance/accounting/journal-entries">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentJournalEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{entry.reference}</div>
                    <div className="text-sm text-muted-foreground">{entry.description}</div>
                  </div>
                  <div className="text-right">
                    <div className={entry.debit > 0 ? "text-blue-600 font-medium" : "text-green-600 font-medium"}>
                      {entry.debit > 0 ? `Dr ${formatCurrency(entry.debit, entry.currency)}` : `Cr ${formatCurrency(entry.credit, entry.currency)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">{entry.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts & Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingApprovals.expenses > 0 && (
              <Link href="/expenses" className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-full">
                    <Receipt className="size-5 text-yellow-700" />
                  </div>
                  <div>
                    <div className="font-medium text-yellow-900">Pending Expenses</div>
                    <div className="text-xs text-yellow-700">{pendingApprovals.expenses} expense{ pendingApprovals.expenses === 1 ? '' : 's' } waiting for approval</div>
                  </div>
                </div>
                <div className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                  {pendingApprovals.expenses}
                </div>
              </Link>
            )}
            {overdueItems.invoices > 0 && (
              <Link href="/finance/receivables/aging-report" className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-full">
                    <FileText className="size-5 text-red-700" />
                  </div>
                  <div>
                    <div className="font-medium text-red-900">Overdue Invoices</div>
                    <div className="text-xs text-red-700">{overdueItems.invoices} overdue invoice{ overdueItems.invoices === 1 ? '' : 's' }</div>
                  </div>
                </div>
                <div className="bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                  {overdueItems.invoices}
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

