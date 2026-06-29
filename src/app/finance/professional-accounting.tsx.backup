"use client";

import Link from "next/link";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Fuel,
  Globe,
  Landmark,
  Loader2,
  MapPin,
  Plus,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type FinanceRow = Record<string, unknown>;

type FinanceState = {
  invoices: FinanceRow[];
  expenses: FinanceRow[];
  income: FinanceRow[];
  trips: FinanceRow[];
  vehicles: FinanceRow[];
  journalEntries: FinanceRow[];
  chartOfAccounts: FinanceRow[];
  taxes: FinanceRow[];
  bankAccounts: FinanceRow[];
};

type Activity = {
  id: string;
  type: "revenue" | "expense" | "invoice" | "journal";
  title: string;
  detail: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
};

const EMPTY_STATE: FinanceState = {
  invoices: [],
  expenses: [],
  income: [],
  trips: [],
  vehicles: [],
  journalEntries: [],
  chartOfAccounts: [],
  taxes: [],
  bankAccounts: [],
};

const statusStyles: Record<string, string> = {
  paid: "border-success/20 bg-success/10 text-success",
  approved: "border-success/20 bg-success/10 text-success",
  active: "border-success/20 bg-success/10 text-success",
  pending: "border-warning/20 bg-warning/10 text-warning",
  submitted: "border-primary/20 bg-primary/10 text-primary",
  overdue: "border-destructive/20 bg-destructive/10 text-destructive",
  rejected: "border-destructive/20 bg-destructive/10 text-destructive",
  draft: "border-muted bg-muted/50 text-muted-foreground",
  "1-30": "border-warning/20 bg-warning/10 text-warning",
  "31-60": "border-orange/20 bg-orange/10 text-orange",
  "61-90": "border-destructive/20 bg-destructive/10 text-destructive",
  "90+": "border-destructive/20 bg-destructive/10 text-destructive",
  current: "border-success/20 bg-success/10 text-success",
};

const accountTypeStyles: Record<string, string> = {
  Asset: "border-primary/20 bg-primary/10 text-primary",
  Liability: "border-destructive/20 bg-destructive/10 text-destructive",
  Equity: "border-accent/20 bg-accent/10 text-accent",
  Revenue: "border-success/20 bg-success/10 text-success",
  Expense: "border-warning/20 bg-warning/10 text-warning",
};

const accountingAreas: Array<{
  title: string;
  description: string;
  href: string;
  icon: ElementType;
  tone: string;
}> = [
  {
    title: "Chart of Accounts",
    description: "Maintain assets, liabilities, equity, revenue, and expense accounts.",
    href: "/finance/chart-of-accounts",
    icon: BookOpen,
    tone: "bg-primary/10 text-primary border-primary/20",
  },
  {
    title: "Journal Entries",
    description: "Review operational postings from trips, fuel, payroll, and maintenance.",
    href: "/finance",
    icon: Receipt,
    tone: "bg-muted/50 text-muted-foreground border-muted",
  },
  {
    title: "Customer Invoices",
    description: "Track receivables, outstanding balances, and collection pressure.",
    href: "/finance",
    icon: FileText,
    tone: "bg-success/10 text-success border-success/20",
  },
  {
    title: "Expense Approval",
    description: "Approve driver, vendor, fuel, maintenance, and payroll expenses.",
    href: "/accountant/expenses",
    icon: TrendingDown,
    tone: "bg-destructive/10 text-destructive border-destructive/20",
  },
  {
    title: "Bank Reconciliation",
    description: "Import statements and match deposits or withdrawals to ledger records.",
    href: "/finance/bank-statement",
    icon: Landmark,
    tone: "bg-info/10 text-info border-info/20",
  },
  {
    title: "Statutory Reports",
    description: "Prepare payroll and statutory finance reporting for compliance.",
    href: "/admin/hr/payroll/statutory",
    icon: Banknote,
    tone: "bg-warning/10 text-warning border-warning/20",
  },
  {
    title: "Route Profitability",
    description: "Connect trips, vehicle costs, fuel, and revenue by route.",
    href: "/admin/reports/fleet/route-profitability",
    icon: Truck,
    tone: "bg-accent/10 text-accent border-accent/20",
  },
  {
    title: "Financial Reports",
    description: "Open board-ready reports for revenue, expenses, margins, and vehicles.",
    href: "/reports",
    icon: ClipboardList,
    tone: "bg-success/10 text-success border-success/20",
  },
];

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = "-"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function rowAmount(row: FinanceRow): number {
  return toNumber(row.amount ?? row.total ?? row.total_amount ?? row.balance ?? row.price);
}

function rowCurrency(row: FinanceRow): string {
  return text(row.currency, "TZS").toUpperCase();
}

function rowDate(row: FinanceRow): string {
  return text(row.date ?? row.expense_date ?? row.due_date ?? row.created_at ?? row.updated_at, new Date().toISOString());
}

function rowStatus(row: FinanceRow): string {
  return text(row.status, "draft").toLowerCase();
}

function formatCurrency(amount: number, currency = "TZS"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TZS" ? 0 : 2,
  }).format(amount);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isReceivable(invoice: FinanceRow): boolean {
  const type = text(invoice.type ?? invoice.invoice_type, "receivable").toLowerCase();
  return type !== "payable";
}

function isUnpaid(row: FinanceRow): boolean {
  return !["paid", "approved", "resolved"].includes(rowStatus(row));
}

async function safeTable(table: string, limit = 80): Promise<FinanceRow[]> {
  const { data, error } = await supabase.from(table).select("*").limit(limit);
  if (error) {
    console.warn(`[Finance] ${table} unavailable:`, error.message);
    return [];
  }
  return (data ?? []) as FinanceRow[];
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", statusStyles[status] ?? statusStyles.draft)}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
  helper,
}: {
  title: string;
  value: string;
  icon: ElementType;
  tone: "blue" | "green" | "amber" | "red" | "slate";
  helper: string;
}) {
  const tones = {
    blue: "bg-primary/10 text-primary border-primary/20",
    green: "bg-success/10 text-success border-success/20",
    amber: "bg-warning/10 text-warning border-warning/20",
    red: "bg-destructive/10 text-destructive border-destructive/20",
    slate: "bg-muted/50 text-muted-foreground border-muted",
  };

  return (
    <div className="app-kpi">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-normal text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg border", tones[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({
  title,
  description,
  href,
  icon: Icon,
  status,
}: {
  title: string;
  description: string;
  href: string;
  icon: ElementType;
  status: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">{status}</p>
        </div>
      </div>
    </Link>
  );
}

function AccountingAreaCard({
  title,
  description,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  href: string;
  icon: ElementType;
  tone: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md">
      <div className={cn("mb-4 flex size-10 items-center justify-center rounded-xl border shadow-sm", tone)}>
        <Icon className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function AccountingControlItem({
  title,
  detail,
  href,
  icon: Icon,
  complete,
  signal,
}: {
  title: string;
  detail: string;
  href: string;
  icon: ElementType;
  complete: boolean;
  signal: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl border shadow-sm",
          complete ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning",
        )}
      >
        {complete ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">{signal}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </Link>
  );
}

function QualityTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

export default function FinancialOperations() {
  const { role } = useRole();
  const [data, setData] = useState<FinanceState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedJournal, setExpandedJournal] = useState<string | null>(null);
  const [agingType, setAgingType] = useState<"receivable" | "payable">("receivable");

  const loadFinance = async () => {
    setLoading(true);
    const [invoices, expenses, income, trips, vehicles, journalEntries] = await Promise.all([
      safeTable("invoices"),
      safeTable("expenses"),
      safeTable("income"),
      safeTable("trips"),
      safeTable("vehicles"),
      safeTable("journal_entries"),
    ]);

    // Optional tables - handle gracefully if they don't exist
    const [chartOfAccounts, taxes, bankAccounts] = await Promise.all([
      safeTable("chart_of_accounts").catch(() => []),
      safeTable("taxes").catch(() => []),
      safeTable("bank_accounts").catch(() => []),
    ]);

    setData({ invoices, expenses, income, trips, vehicles, journalEntries, chartOfAccounts, taxes, bankAccounts });
    setLoading(false);
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const metrics = useMemo(() => {
    const invoiceRevenue = data.invoices
      .filter((row) => isReceivable(row))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const directIncome = data.income.reduce((sum, row) => sum + rowAmount(row), 0);
    const operatingExpense = data.expenses.reduce((sum, row) => sum + rowAmount(row), 0);
    const receivables = data.invoices
      .filter((row) => isReceivable(row) && isUnpaid(row))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const payables = data.invoices
      .filter((row) => !isReceivable(row) && isUnpaid(row))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const pendingExpenses = data.expenses.filter((row) => rowStatus(row) === "pending");
    const revenue = invoiceRevenue + directIncome;
    const net = revenue - operatingExpense;
    const margin = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
    
    // Logistics metrics
    const crossBorderExpenses = data.expenses.filter((row) => row.is_cross_border === true).reduce((sum, row) => sum + rowAmount(row), 0);
    const crossBorderRevenue = data.invoices.filter((row) => row.is_cross_border === true && isReceivable(row)).reduce((sum, row) => sum + rowAmount(row), 0);
    const fuelExpenses = data.expenses.filter((row) => (row.category as string)?.toLowerCase() === "fuel").reduce((sum, row) => sum + rowAmount(row), 0);
    
    // Tax metrics
    const pendingTaxes = (data.taxes || []).filter((row) => rowStatus(row) === "pending").reduce((sum, row) => sum + rowAmount(row), 0);
    const paidTaxes = (data.taxes || []).filter((row) => rowStatus(row) === "paid").reduce((sum, row) => sum + rowAmount(row), 0);

    return {
      revenue,
      directIncome,
      operatingExpense,
      receivables,
      payables,
      pendingExpenseValue: pendingExpenses.reduce((sum, row) => sum + rowAmount(row), 0),
      pendingExpenseCount: pendingExpenses.length,
      net,
      margin,
      invoiceCount: data.invoices.length,
      vehicleCount: data.vehicles.length,
      tripCount: data.trips.length,
      journalCount: data.journalEntries.length,
      approvedExpenseCount: data.expenses.filter((row) => ["approved", "paid"].includes(rowStatus(row))).length,
      crossBorderExpenses,
      crossBorderRevenue,
      fuelExpenses,
      pendingTaxes,
      paidTaxes,
    };
  }, [data]);

  const activities = useMemo<Activity[]>(() => {
    const revenueActivities = data.income.map((row, index) => ({
      id: `income-${text(row.id, String(index))}`,
      type: "revenue" as const,
      title: text(row.description ?? row.source ?? row.customer_name, "Income record"),
      detail: "Direct income",
      amount: rowAmount(row),
      currency: rowCurrency(row),
      status: rowStatus(row),
      date: rowDate(row),
    }));

    const expenseActivities = data.expenses.map((row, index) => ({
      id: `expense-${text(row.id, String(index))}`,
      type: "expense" as const,
      title: text(row.description ?? row.category, "Expense record"),
      detail: text(row.category ?? row.vendor, "Operating cost"),
      amount: rowAmount(row),
      currency: rowCurrency(row),
      status: rowStatus(row),
      date: rowDate(row),
    }));

    const invoiceActivities = data.invoices.map((row, index) => ({
      id: `invoice-${text(row.id, String(index))}`,
      type: "invoice" as const,
      title: text(row.invoice_number ?? row.reference, "Invoice"),
      detail: text(row.customer_name ?? row.client_name ?? row.vendor, isReceivable(row) ? "Receivable" : "Payable"),
      amount: rowAmount(row),
      currency: rowCurrency(row),
      status: rowStatus(row),
      date: rowDate(row),
    }));

    const journalActivities = data.journalEntries.map((row, index) => ({
      id: `journal-${text(row.id, String(index))}`,
      type: "journal" as const,
      title: text(row.description ?? row.reference, "Journal entry"),
      detail: "Ledger posting",
      amount: rowAmount(row),
      currency: rowCurrency(row),
      status: rowStatus(row),
      date: rowDate(row),
    }));

    return [...revenueActivities, ...expenseActivities, ...invoiceActivities, ...journalActivities]
      .filter((row) => `${row.title} ${row.detail} ${row.status}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 18);
  }, [data, search]);

  const reconciliationScore = Math.min(
    100,
    Math.round(
      ((data.invoices.filter((row) => rowStatus(row) === "paid").length +
        data.expenses.filter((row) => ["approved", "paid"].includes(rowStatus(row))).length) /
        Math.max(data.invoices.length + data.expenses.length, 1)) *
        100,
    ),
  );

  const overdueInvoices = data.invoices.filter((row) => {
    if (!isUnpaid(row)) return false;
    const due = new Date(rowDate(row)).getTime();
    return Number.isFinite(due) && due < Date.now();
  });

  const closeReadinessScore = Math.min(
    100,
    Math.round(
      ((reconciliationScore +
        (metrics.pendingExpenseCount === 0 ? 100 : 60) +
        (overdueInvoices.length === 0 ? 100 : 65) +
        (metrics.journalCount > 0 ? 100 : 55)) /
        4),
    ),
  );

  // Aging report calculation
  const agingReport = useMemo(() => {
    const now = new Date();
    const items = data.invoices
      .filter((row) => {
        const isReceivableInv = isReceivable(row);
        const isPayableInv = !isReceivable(row);
        const isUnpaidInv = isUnpaid(row);
        return (agingType === "receivable" && isReceivableInv && isUnpaidInv) ||
               (agingType === "payable" && isPayableInv && isUnpaidInv);
      })
      .map((inv) => {
        const dueDate = new Date(rowDate(inv));
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        let bucket: string;
        if (daysOverdue <= 0) bucket = "current";
        else if (daysOverdue <= 30) bucket = "1-30";
        else if (daysOverdue <= 60) bucket = "31-60";
        else if (daysOverdue <= 90) bucket = "61-90";
        else bucket = "90+";
        return { ...inv, daysOverdue, bucket };
      });

    const buckets = ["current", "1-30", "31-60", "61-90", "90+"];
    const totals = buckets.map((bucket) => ({
      bucket,
      total: items.filter((i) => i.bucket === bucket).reduce((sum, i) => sum + rowAmount(i), 0),
      count: items.filter((i) => i.bucket === bucket).length,
    }));
    const grandTotal = totals.reduce((sum, b) => sum + b.total, 0);

    return { items, totals, grandTotal };
  }, [data.invoices, agingType]);

  // Chart of Accounts grouping
  const coaGroups = useMemo(() => {
    if (!data.chartOfAccounts || data.chartOfAccounts.length === 0) {
      return [];
    }
    const types = ["Asset", "Liability", "Equity", "Revenue", "Expense"];
    return types.map((type) => ({
      type,
      rows: data.chartOfAccounts.filter((a) => text(a.account_type) === type),
      total: data.chartOfAccounts.filter((a) => text(a.account_type) === type).reduce((sum, a) => sum + rowAmount(a), 0),
    }));
  }, [data.chartOfAccounts]);

  const closeTasks = [
    {
      title: "Bank reconciliation",
      detail: "Match bank statement lines to invoices, income, expenses, and journals.",
      href: "/finance/bank-statement",
      icon: Landmark,
      complete: reconciliationScore >= 85,
      signal: `${reconciliationScore}% reconciled`,
    },
    {
      title: "Expense approvals",
      detail: "Clear pending driver, fuel, maintenance, payroll, and vendor costs.",
      href: "/accountant/expenses",
      icon: Receipt,
      complete: metrics.pendingExpenseCount === 0,
      signal: `${metrics.pendingExpenseCount} pending`,
    },
    {
      title: "Receivable follow-up",
      detail: "Review unpaid invoices and overdue customer balances.",
      href: "/finance",
      icon: FileText,
      complete: overdueInvoices.length === 0,
      signal: `${overdueInvoices.length} overdue`,
    },
    {
      title: "Ledger postings",
      detail: "Confirm operational journals from trips, payroll, fuel, and maintenance.",
      href: "/finance/chart-of-accounts",
      icon: BookOpen,
      complete: metrics.journalCount > 0,
      signal: `${metrics.journalCount} entries`,
    },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar role={(role || "ACCOUNTANT") as any} />
      <main className="min-w-0 flex-1 md:ml-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  Finance Command Center
                </Badge>
                <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                  Integrated ledger
                </Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal md:text-3xl">Accounting and Finance</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                One finance workspace for trip revenue, invoices, expenses, payables, receivables, reconciliation, and audit-ready reporting.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={loadFinance} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Refresh
              </Button>
              <Button asChild className="gap-2">
                <Link href="/finance/bank-statement">
                  <CreditCard className="size-4" />
                  Reconcile Bank
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-4 md:p-6">
          <section className="app-toolbar justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-muted bg-card text-muted-foreground">
                Current period
              </Badge>
              <span className="text-sm font-semibold text-foreground">
                {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </span>
              <span className="text-sm text-muted-foreground">Accounting basis: operational accrual view</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                {metrics.tripCount} trips
              </Badge>
              <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                {metrics.invoiceCount} invoices
              </Badge>
              <Badge variant="outline" className="border-muted bg-muted/50 text-muted-foreground">
                {metrics.journalCount} journals
              </Badge>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Revenue"
              value={formatCurrency(metrics.revenue)}
              icon={TrendingUp}
              tone="green"
              helper={`${metrics.invoiceCount} invoices plus direct income`}
            />
            <MetricCard
              title="Operating Expense"
              value={formatCurrency(metrics.operatingExpense)}
              icon={TrendingDown}
              tone="red"
              helper={`${metrics.pendingExpenseCount} pending approvals`}
            />
            <MetricCard
              title="Net Position"
              value={formatCurrency(metrics.net)}
              icon={Scale}
              tone={metrics.net >= 0 ? "blue" : "amber"}
              helper={`${metrics.margin}% operating margin`}
            />
            <MetricCard
              title="Receivables"
              value={formatCurrency(metrics.receivables)}
              icon={Wallet}
              tone="amber"
              helper={`${overdueInvoices.length} invoices need collection`}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="app-surface">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Month-End Close</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A practical close checklist for keeping the books audit-ready.
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "shrink-0",
                    closeReadinessScore >= 85
                      ? "border-success/20 bg-success/10 text-success"
                      : "border-warning/20 bg-warning/10 text-warning",
                  )}>
                    {closeReadinessScore}% ready
                  </Badge>
                </div>
                <Progress value={closeReadinessScore} />
                <div className="space-y-2">
                  {closeTasks.map((task) => (
                    <AccountingControlItem key={task.title} {...task} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Ledger Quality</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Fast checks that show whether operational records are flowing into accounting.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="gap-2">
                    <Link href="/reports">
                      <ClipboardList className="size-4" />
                      Open Reports
                    </Link>
                  </Button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <QualityTile label="Revenue sources" value={String(metrics.invoiceCount + data.income.length)} helper="Invoices plus income records" />
                  <QualityTile label="Approved costs" value={String(metrics.approvedExpenseCount)} helper="Expenses cleared for reporting" />
                  <QualityTile label="Fleet linkage" value={String(metrics.vehicleCount)} helper="Vehicles available for margin analysis" />
                  <QualityTile label="Net margin" value={`${metrics.margin}%`} helper="Revenue less operating expenses" />
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="app-surface p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Accounting Workbench</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Full accounting stays available here: accounts, journals, invoices, expenses, reconciliation, statutory reports, and fleet profitability.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-primary/20 bg-primary/10 text-primary shadow-sm">
                No dead accounting links
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {accountingAreas.map((area) => (
                <AccountingAreaCard key={area.title} {...area} />
              ))}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="app-surface">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Finance Workflow</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Follow the money from operations into accounting with clear handoffs.
                    </p>
                  </div>
                  <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-9"
                      placeholder="Search ledger activity..."
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <WorkflowStep
                    title="Trip Revenue"
                    description="Convert completed dispatch activity into customer invoices and revenue reports."
                    href="/trips"
                    icon={Truck}
                    status={`${metrics.tripCount} trips connected`}
                  />
                  <WorkflowStep
                    title="Income Register"
                    description="Track deposits, manual receipts, and non-trip income in one clean register."
                    href="/income"
                    icon={ArrowUpRight}
                    status={formatCurrency(metrics.directIncome)}
                  />
                  <WorkflowStep
                    title="Expense Control"
                    description="Review driver, fuel, maintenance, payroll, and vendor costs before approval."
                    href="/expenses"
                    icon={Receipt}
                    status={`${metrics.pendingExpenseCount} pending`}
                  />
                  <WorkflowStep
                    title="Bank Reconciliation"
                    description="Import statements and match deposits or withdrawals against the ledger."
                    href="/finance/bank-statement"
                    icon={Landmark}
                    status={`${reconciliationScore}% matched signal`}
                  />
                  <WorkflowStep
                    title="Chart of Accounts"
                    description="Maintain the accounting structure that powers reports and journal postings."
                    href="/finance/chart-of-accounts"
                    icon={BookOpen}
                    status="Account map ready"
                  />
                  <WorkflowStep
                    title="Audit Reports"
                    description="Review vehicle profitability, driver costs, fuel, route margin, and statutory reports."
                    href="/reports"
                    icon={ClipboardList}
                    status={`${metrics.vehicleCount} vehicles tracked`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardContent className="space-y-5 p-5">
                <div>
                  <h2 className="text-lg font-semibold">Control Status</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Operational finance checks that protect cash flow.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">Reconciliation health</span>
                      <span className="text-muted-foreground">{reconciliationScore}%</span>
                    </div>
                    <Progress value={reconciliationScore} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-muted/50 p-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payables</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(metrics.payables + metrics.pendingExpenseValue)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/50 p-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overdue</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{overdueInvoices.length}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {overdueInvoices.length > 0 ? (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive shadow-sm">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 size-4" />
                          <span>{overdueInvoices.length} unpaid invoice(s) are past due and should be followed up.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-success/20 bg-success/10 p-3 text-sm text-success shadow-sm">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 size-4" />
                          <span>No overdue invoice pressure detected in the current sample.</span>
                        </div>
                      </div>
                    )}
                    <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary shadow-sm">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 size-4" />
                        <span>Expenses, bank matching, and reports now sit in one accounting workflow.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/70 p-1 md:grid-cols-6 lg:grid-cols-8">
              <TabsTrigger value="activity">Ledger Activity</TabsTrigger>
              <TabsTrigger value="receivables">Receivables</TabsTrigger>
              <TabsTrigger value="payables">Payables</TabsTrigger>
              <TabsTrigger value="logistics">Logistics</TabsTrigger>
              <TabsTrigger value="taxes">Taxes</TabsTrigger>
              <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
              <TabsTrigger value="journal">Journal Entries</TabsTrigger>
              <TabsTrigger value="aging">Aging Report</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <div className="app-table-shell">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                          Loading finance records...
                        </TableCell>
                      </TableRow>
                    ) : activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No matching finance activity found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="max-w-[320px]">
                              <p className="truncate font-medium">{item.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell>{formatDate(item.date)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.amount, item.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="receivables">
              <FinanceList
                rows={data.invoices.filter((row) => isReceivable(row))}
                empty="No receivable invoices found."
                kind="receivable"
              />
            </TabsContent>

            <TabsContent value="payables">
              <FinanceList
                rows={[...data.invoices.filter((row) => !isReceivable(row)), ...data.expenses]}
                empty="No payable or expense records found."
                kind="payable"
              />
            </TabsContent>

            <TabsContent value="reports">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportLink href="/reports" icon={FileText} title="Financial Reports" description="Company reports and exportable summaries." />
                <ReportLink href="/admin/reports/fleet/revenue-by-vehicle" icon={Truck} title="Vehicle Revenue" description="Revenue, expenses, and margin by truck." />
                <ReportLink href="/admin/reports/fleet/route-profitability" icon={ArrowUpRight} title="Route Profitability" description="Gross margin by lane and destination." />
                <ReportLink href="/admin/hr/payroll/statutory" icon={Banknote} title="Statutory Reports" description="Payroll and statutory finance reporting." />
              </div>
            </TabsContent>

            <TabsContent value="logistics">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-l-4 border-l-primary shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Globe className="size-4" />
                        Cross-Border Operations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expenses</span>
                        <span className="text-destructive font-medium">{formatCurrency(metrics.crossBorderExpenses)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="text-success font-medium">{formatCurrency(metrics.crossBorderRevenue)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border">
                        <span className="text-muted-foreground">Net</span>
                        <span className={`font-bold ${metrics.crossBorderRevenue - metrics.crossBorderExpenses >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(metrics.crossBorderRevenue - metrics.crossBorderExpenses)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-info shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Thermometer className="size-4" />
                        Cold Chain Operations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="text-success font-medium">{formatCurrency(data.invoices.filter((i) => (i.cargo_type as string)?.toLowerCase() === "reefer").reduce((sum, i) => sum + rowAmount(i), 0))}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border">
                        <span className="text-muted-foreground">Net</span>
                        <span className="text-success font-bold">
                          {formatCurrency(data.invoices.filter((i) => (i.cargo_type as string)?.toLowerCase() === "reefer").reduce((sum, i) => sum + rowAmount(i), 0))}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-warning shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Fuel className="size-4" />
                        Fuel Costs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Fuel</span>
                        <span className="text-warning font-medium">{formatCurrency(metrics.fuelExpenses)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">% of Expenses</span>
                        <span className="text-warning font-medium">
                          {metrics.operatingExpense > 0 ? ((metrics.fuelExpenses / metrics.operatingExpense) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="size-5" />
                      Border Route Cost Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {["Tunduma", "Kasumbalesa", "Sirari", "Rusumo", "Mutukula", "Kabanga"].map((route) => {
                        const routeExpenses = data.expenses.filter((e) => 
                          (e.border_point as string)?.toLowerCase().includes(route.toLowerCase()) ||
                          (e.description as string)?.toLowerCase().includes(route.toLowerCase())
                        ).reduce((sum, e) => sum + rowAmount(e), 0);
                        const routeCount = data.expenses.filter((e) => 
                          (e.border_point as string)?.toLowerCase().includes(route.toLowerCase()) ||
                          (e.description as string)?.toLowerCase().includes(route.toLowerCase())
                        ).length;
                        return (
                          <div key={route} className="rounded-xl border border-border bg-muted/50 p-3 text-center">
                            <p className="text-xs font-semibold text-foreground mb-1">{route}</p>
                            <p className="text-base font-bold text-primary">{formatCurrency(routeExpenses)}</p>
                            <p className="text-xs text-muted-foreground">{routeCount} {routeCount === 1 ? "entry" : "entries"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="taxes">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Tax Obligations</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="shadow-lg">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Pending</p>
                      <p className="text-lg font-bold text-warning">{formatCurrency(metrics.pendingTaxes)}</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-lg">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                      <p className="text-lg font-bold text-success">{formatCurrency(metrics.paidTaxes)}</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-lg">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Overdue Items</p>
                      <p className="text-lg font-bold text-destructive">
                        {(data.taxes || []).filter((t) => rowStatus(t) === "pending" && new Date(rowDate(t)) < new Date()).length} items
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <Card className="shadow-lg">
                  <div className="app-table-shell">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tax Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(!data.taxes || data.taxes.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                              Tax table not configured or empty
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.taxes.map((tax) => {
                            const overdue = rowStatus(tax) === "pending" && new Date(rowDate(tax)) < new Date();
                            return (
                              <TableRow key={text(tax.id)} className="hover:bg-muted/50">
                                <TableCell className="font-medium text-foreground">{text(tax.tax_name)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                                    {text(tax.tax_type)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium text-foreground">{formatCurrency(rowAmount(tax))}</TableCell>
                                <TableCell className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                  {formatDate(rowDate(tax))}
                                  {overdue && (
                                    <Badge variant="outline" className="ml-2 border-destructive/20 bg-destructive/10 text-destructive">
                                      Overdue
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={rowStatus(tax)} />
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="coa">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Chart of Accounts</h2>
                </div>
                {coaGroups.length === 0 ? (
                  <Card className="shadow-lg">
                    <CardContent className="py-10 text-center text-muted-foreground">
                      Chart of Accounts table not configured or empty
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {coaGroups.map((group) => (
                        <Card key={group.type} className={cn("shadow-lg", accountTypeStyles[group.type])}>
                          <CardContent className="p-4 text-center">
                            <p className="text-xs font-semibold uppercase mb-1">{group.type}s</p>
                            <p className="font-bold text-sm">{formatCurrency(Math.abs(group.total))}</p>
                            <p className="text-xs opacity-70">{group.rows.length} accounts</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {coaGroups.map((group) => (
                      <Card key={group.type} className="shadow-lg">
                        <CardHeader className={cn("px-4 py-2.5 border-b border-border flex items-center justify-between", accountTypeStyles[group.type])}>
                          <span className="font-semibold text-sm">{group.type}s</span>
                          <span className="font-bold text-sm">{formatCurrency(Math.abs(group.total))}</span>
                        </CardHeader>
                        <div className="app-table-shell">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Account Name</TableHead>
                                <TableHead>Normal Bal.</TableHead>
                                <TableHead className="text-right">Balance (TZS)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.rows.map((account) => (
                                <TableRow key={text(account.id)} className="hover:bg-muted/50">
                                  <TableCell className="font-mono text-xs text-muted-foreground">{text(account.account_code)}</TableCell>
                                  <TableCell className="text-foreground">{text(account.account_name)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={text(account.normal_balance) === "debit" ? "border-primary/20 bg-primary/10 text-primary" : "border-success/20 bg-success/10 text-success"}>
                                      {text(account.normal_balance)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className={`text-right font-medium ${rowAmount(account) < 0 ? "text-destructive" : "text-foreground"}`}>
                                    {formatCurrency(rowAmount(account))}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </Card>
                    ))}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="journal">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Journal Entries</h2>
                </div>
                <div className="space-y-3">
                  {(!data.journalEntries || data.journalEntries.length === 0) && (
                    <Card className="shadow-lg">
                      <CardContent className="py-10 text-center text-muted-foreground">
                        No journal entries yet
                      </CardContent>
                    </Card>
                  )}
                  {(data.journalEntries || []).map((je) => {
                    const lines = (je.lines as FinanceRow[]) || [];
                    const totalDebit = lines.reduce((sum: number, l: FinanceRow) => sum + rowAmount(l), 0);
                    const isExpanded = expandedJournal === text(je.id);
                    return (
                      <Card key={text(je.id)} className="shadow-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedJournal(isExpanded ? null : text(je.id))}
                          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground font-mono">{text(je.reference)}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(rowDate(je))}</p>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{text(je.description)}</p>
                              <p className="text-xs text-muted-foreground">
                                {lines.length} lines · {formatCurrency(totalDebit)} each side
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                              Balanced
                            </Badge>
                            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border">
                            <div className="app-table-shell">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {lines.map((line, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="font-mono text-xs text-muted-foreground">{text(line.account_code)}</TableCell>
                                      <TableCell className={rowAmount(line) > 0 ? "text-foreground" : "pl-8 text-foreground"}>
                                        {text(line.account_name)}
                                      </TableCell>
                                      <TableCell className="text-right text-foreground">
                                        {rowAmount(line) > 0 ? formatCurrency(rowAmount(line)) : "—"}
                                      </TableCell>
                                      <TableCell className="text-right text-foreground">
                                        {rowAmount(line) < 0 ? formatCurrency(Math.abs(rowAmount(line))) : "—"}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="aging">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">Aging Report</h2>
                  <div className="flex gap-2">
                    <Button
                      variant={agingType === "receivable" ? "default" : "outline"}
                      onClick={() => setAgingType("receivable")}
                      className={agingType === "receivable" ? "" : "border-border text-muted-foreground"}
                    >
                      Accounts Receivable
                    </Button>
                    <Button
                      variant={agingType === "payable" ? "default" : "outline"}
                      onClick={() => setAgingType("payable")}
                      className={agingType === "payable" ? "" : "border-border text-muted-foreground"}
                    >
                      Accounts Payable
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {agingReport.totals.map((bucket) => {
                    const percentage = agingReport.grandTotal > 0 ? (bucket.total / agingReport.grandTotal) * 100 : 0;
                    return (
                      <Card key={bucket.bucket} className="shadow-lg">
                        <CardContent className="p-4">
                          <Badge variant="outline" className={cn("mb-2", statusStyles[bucket.bucket] || statusStyles.current)}>
                            {bucket.bucket === "current" ? "Current" : `${bucket.bucket} days`}
                          </Badge>
                          <p className="text-xl font-bold text-foreground">{formatCurrency(bucket.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            {bucket.count} invoices · {percentage.toFixed(1)}%
                          </p>
                          <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <Card className="shadow-lg border-warning/20 bg-warning/10">
                  <CardContent className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-warning">
                      Total Outstanding {agingType === "receivable" ? "(AR)" : "(AP)"}
                    </span>
                    <span className="text-lg font-bold text-warning">{formatCurrency(agingReport.grandTotal)}</span>
                  </CardContent>
                </Card>

                <Card className="shadow-lg">
                  <div className="app-table-shell">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Customer / Vendor</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Aging Bucket</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agingReport.items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                              No outstanding items
                            </TableCell>
                          </TableRow>
                        ) : (
                          agingReport.items
                            .sort((a, b) => b.daysOverdue - a.daysOverdue)
                            .map((inv) => (
                              <TableRow key={text(inv.id)} className="hover:bg-muted/50">
                                <TableCell className="font-medium text-foreground">{text(inv.invoice_number)}</TableCell>
                                <TableCell className="text-foreground">{text(inv.customer_name)}</TableCell>
                                <TableCell className={`font-medium ${agingType === "receivable" ? "text-success" : "text-destructive"}`}>
                                  {formatCurrency(rowAmount(inv))}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{formatDate(rowDate(inv))}</TableCell>
                                <TableCell
                                  className={cn(
                                    "font-medium",
                                    inv.daysOverdue > 90
                                      ? "text-destructive"
                                      : inv.daysOverdue > 30
                                      ? "text-warning"
                                      : inv.daysOverdue > 0
                                      ? "text-warning"
                                      : "text-success"
                                  )}
                                >
                                  {inv.daysOverdue <= 0 ? `${Math.abs(inv.daysOverdue)}d to go` : `${inv.daysOverdue}d overdue`}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={cn(statusStyles[inv.bucket] || statusStyles.current)}>
                                    {inv.bucket === "current" ? "Current" : `${inv.bucket} days`}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function FinanceList({
  rows,
  empty,
  kind,
}: {
  rows: FinanceRow[];
  empty: string;
  kind: "receivable" | "payable";
}) {
  return (
    <div className="app-table-shell">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{kind === "receivable" ? "Customer / Ref" : "Vendor / Ref"}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.slice(0, 24).map((row, index) => (
              <TableRow key={text(row.id, `${kind}-${index}`)}>
                <TableCell>
                  <div className="max-w-[360px]">
                    <p className="truncate font-medium">
                      {text(row.invoice_number ?? row.description ?? row.customer_name ?? row.vendor, "Finance record")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {text(row.customer_name ?? row.client_name ?? row.category ?? row.vendor, kind)}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={rowStatus(row)} />
                </TableCell>
                <TableCell>{formatDate(rowDate(row))}</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(rowAmount(row), rowCurrency(row))}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ReportLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent shadow-sm">
          <Icon className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}
