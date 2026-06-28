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
  Download,
  FileText,
  Fuel,
  Globe,
  Layers,
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

// ── Multi-Currency Constants ─────────────────────────────────────────────────────
const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TZS", name: "Tanzanian Shilling", flag: "🇹🇿", dec: 0 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", dec: 2 },
  ZMW: { code: "ZMW", symbol: "K", name: "Zambian Kwacha", flag: "🇿🇲", dec: 2 },
  CDF: { code: "CDF", symbol: "FC", name: "Congolese Franc", flag: "🇨🇩", dec: 0 },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", flag: "🇰🇪", dec: 0 },
  UGX: { code: "UGX", symbol: "USh", name: "Ugandan Shilling", flag: "🇺🇬", dec: 0 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", dec: 2 },
};

// Reference exchange rates → USD (display only; amounts stay in native currency)
const TO_USD = { TZS: 1 / 2600, USD: 1, ZMW: 1 / 26.5, CDF: 1 / 2850, KES: 1 / 129, UGX: 1 / 3730, EUR: 1.08 };

const fmtAmt = (amount: number, currency = "TZS") => {
  const c = CURRENCIES[currency as keyof typeof CURRENCIES] || CURRENCIES.TZS;
  const n = Number(amount || 0);
  return c.dec === 0
    ? `${c.symbol} ${Math.round(n).toLocaleString()}`
    : `${c.symbol}${n.toLocaleString("en-US", { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec })}`;
};

const toUSD = (amount: number, currency: string) => Number(amount || 0) * (TO_USD[currency as keyof typeof TO_USD] || 1);

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
  return fmtAmt(amount, currency);
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

function CurrencyBadge({ currency }: { currency: string }) {
  const c = CURRENCIES[currency as keyof typeof CURRENCIES] || CURRENCIES.TZS;
  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
      {c.flag} {currency}
    </Badge>
  );
}

function MultiCurrencyCard({
  title,
  items,
  amountKey = "amount",
  currencyKey = "currency",
  icon: Icon,
  gradient,
}: {
  title: string;
  items: FinanceRow[];
  amountKey?: string;
  currencyKey?: string;
  icon: ElementType;
  gradient: string;
}) {
  const byCode: Record<string, number> = {};
  items.forEach((i) => {
    const cur = text(i[currencyKey], "TZS");
    byCode[cur] = (byCode[cur] || 0) + toNumber(i[amountKey]);
  });
  const usdTotal = Object.entries(byCode).reduce((s, [cur, amt]) => s + toUSD(amt, cur), 0);
  const topCur = Object.entries(byCode)
    .sort((a, b) => toUSD(b[1], b[0]) - toUSD(a[1], a[0]))
    .slice(0, 2);

  return (
    <div className={cn("rounded-2xl p-5 text-white", gradient)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-white/70">{title}</p>
        <Icon className="size-8 text-white/25" />
      </div>
      <p className="text-xs text-white/60 mb-2">≈ ${usdTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD</p>
      <div className="space-y-1">
        {topCur.map(([cur, amt]) => {
          const c = CURRENCIES[cur as keyof typeof CURRENCIES] || CURRENCIES.TZS;
          return (
            <div key={cur} className="flex items-center justify-between">
              <span className="text-xs text-white/70">{c.flag} {cur}</span>
              <span className="text-sm font-bold">{fmtAmt(amt, cur)}</span>
            </div>
          );
        })}
        {Object.keys(byCode).length > 2 && <p className="text-xs text-white/50">+{Object.keys(byCode).length - 2} more currencies</p>}
      </div>
    </div>
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
  
  // Multi-currency state
  const [activeTab, setActiveTab] = useState("overview");
  const [modal, setModal] = useState<string | null>(null);
  const [filterCurrency, setFilterCurrency] = useState("ALL");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

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

  // Multi-currency derived aggregates
  const sumByCurrency = (items: FinanceRow[], key = "amount", curKey = "currency") => {
    const out: Record<string, number> = {};
    items.forEach((i) => {
      const cur = text(i[curKey], "TZS");
      out[cur] = (out[cur] || 0) + toNumber(i[key]);
    });
    return out;
  };

  const revByCur = useMemo(() => sumByCurrency([...data.invoices.filter(isReceivable), ...data.income]), [data]);
  const expByCur = useMemo(() => sumByCurrency(data.expenses), [data]);
  const profitByCur = useMemo(() => {
    const allCurs = [...new Set([...Object.keys(revByCur), ...Object.keys(expByCur)])];
    const out: Record<string, number> = {};
    allCurs.forEach((c) => {
      out[c] = (revByCur[c] || 0) - (expByCur[c] || 0);
    });
    return out;
  }, [revByCur, expByCur]);

  const xbRevByCur = useMemo(() => sumByCurrency(data.invoices.filter((r) => r.is_cross_border === true && isReceivable(r))), [data]);
  const xbExpByCur = useMemo(() => sumByCurrency(data.expenses.filter((e) => e.is_cross_border === true)), [data]);

  // Currency filter options
  const currencyOptions = useMemo(() => [
    { value: "ALL", label: "All Currencies" },
    ...Object.values(CURRENCIES).map((c) => ({ value: c.code, label: `${c.flag} ${c.code}` })),
  ], []);

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

          {/* Currency Filter */}
          <section className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Filter by currency:</span>
            <div className="flex gap-2 flex-wrap">
              {currencyOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setFilterCurrency(o.value)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                    filterCurrency === o.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MultiCurrencyCard
              title="Revenue"
              items={[...data.invoices.filter(isReceivable), ...data.income]}
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-emerald-600 to-green-700"
            />
            <MultiCurrencyCard
              title="Expenses"
              items={data.expenses}
              icon={TrendingDown}
              gradient="bg-gradient-to-br from-rose-600 to-red-700"
            />
            <MultiCurrencyCard
              title="Cross-Border Revenue"
              items={data.invoices.filter((r) => r.is_cross_border === true && isReceivable(r))}
              icon={Globe}
              gradient="bg-gradient-to-br from-purple-600 to-indigo-700"
            />
            <MultiCurrencyCard
              title="Pending AR"
              items={data.invoices.filter((i) => isReceivable(i) && isUnpaid(i))}
              icon={Building2}
              gradient="bg-gradient-to-br from-amber-600 to-orange-700"
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

          {/* Multi-Currency Tabs */}
          <div className="border-b border-border">
            <div className="flex overflow-x-auto gap-1 bg-muted/50 p-1">
              {[
                { id: "overview", label: "Overview" },
                { id: "expenses", label: "Expenses" },
                { id: "revenue", label: "Revenue" },
                { id: "invoices", label: "Invoices" },
                { id: "taxes", label: "Taxes" },
                { id: "logistics", label: "Logistics" },
                { id: "accounts", label: "Accounts" },
                { id: "bank", label: "Bank Statement" },
                { id: "coa", label: "Chart of Accounts" },
                { id: "journal", label: "Journal Entries" },
                { id: "aging", label: "Aging Report" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="app-surface">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="size-4 text-success" />
                      Revenue by Currency
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(revByCur)
                      .sort((a, b) => toUSD(b[1], b[0]) - toUSD(a[1], a[0]))
                      .map(([cur, amt]) => {
                        const c = CURRENCIES[cur as keyof typeof CURRENCIES] || CURRENCIES.TZS;
                        return (
                          <div key={cur} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <span className="flex items-center gap-2 text-sm text-foreground">
                              <span className="text-base">{c.flag}</span>
                              {cur} – {c.name}
                            </span>
                            <span className="font-bold text-success">{fmtAmt(amt, cur)}</span>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>

                <Card className="app-surface">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <TrendingDown className="size-4 text-destructive" />
                      Expenses by Currency
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(expByCur)
                      .sort((a, b) => toUSD(b[1], b[0]) - toUSD(a[1], a[0]))
                      .map(([cur, amt]) => {
                        const c = CURRENCIES[cur as keyof typeof CURRENCIES] || CURRENCIES.TZS;
                        return (
                          <div key={cur} className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg">
                            <span className="flex items-center gap-2 text-sm text-foreground">
                              <span className="text-base">{c.flag}</span>
                              {cur}
                            </span>
                            <span className="font-bold text-destructive">{fmtAmt(amt, cur)}</span>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              </div>

              <Card className="app-surface">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Net Profit / Loss by Currency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(profitByCur).map(([cur, net]) => {
                      const c = CURRENCIES[cur as keyof typeof CURRENCIES] || CURRENCIES.TZS;
                      return (
                        <div
                          key={cur}
                          className={cn(
                            "rounded-xl p-4 border",
                            net >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"
                          )}
                        >
                          <p className="text-sm font-semibold text-muted-foreground mb-1">
                            {c.flag} {cur}
                          </p>
                          <p className={cn("text-lg font-bold", net >= 0 ? "text-success" : "text-destructive")}>
                            {fmtAmt(Math.abs(net), cur)}
                          </p>
                          <p className={cn("text-xs mt-0.5", net >= 0 ? "text-success/70" : "text-destructive/70")}>
                            {net >= 0 ? "Profit" : "Loss"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="app-surface">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Globe className="size-4 text-primary" />
                    Cross-Border Performance by Currency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Currency</TableHead>
                          <TableHead>XB Revenue</TableHead>
                          <TableHead>XB Expenses</TableHead>
                          <TableHead>XB Net</TableHead>
                          <TableHead>≈ USD Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys({ ...xbRevByCur, ...xbExpByCur }).map((cur) => {
                          const rev = xbRevByCur[cur] || 0;
                          const exp = xbExpByCur[cur] || 0;
                          const net = rev - exp;
                          const c = CURRENCIES[cur as keyof typeof CURRENCIES] || CURRENCIES.TZS;
                          return (
                            <TableRow key={cur}>
                              <TableCell>
                                <span className="flex items-center gap-2 font-medium">
                                  <span className="text-base">{c.flag}</span>
                                  {cur} – {c.name}
                                </span>
                              </TableCell>
                              <TableCell className="text-success font-medium">{fmtAmt(rev, cur)}</TableCell>
                              <TableCell className="text-destructive font-medium">{fmtAmt(exp, cur)}</TableCell>
                              <TableCell className={cn("font-bold", net >= 0 ? "text-success" : "text-destructive")}>
                                {fmtAmt(Math.abs(net), cur)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                ${toUSD(Math.abs(net), cur).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "expenses" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-xl font-bold text-foreground">Expense Management</h2>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9 w-52"
                      placeholder="Search…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button className="gap-2">
                    <Plus className="size-4" />
                    Add Expense
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {Object.entries(expByCur).map(([cur, amt]) => {
                  const c = CURRENCIES[cur as keyof typeof CURRENCIES] || CURRENCIES.TZS;
                  return (
                    <div key={cur} className="bg-card border border-border rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {c.flag} {cur}
                      </p>
                      <p className="text-sm font-bold text-destructive">{fmtAmt(amt, cur)}</p>
                    </div>
                  );
                })}
              </div>
              <Card className="app-surface">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.expenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                            No expenses found
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.expenses
                          .filter((e) => filterCurrency === "ALL" || rowCurrency(e) === filterCurrency)
                          .filter((e) =>
                            [e.description, e.category, e.vendor].some((s) =>
                              String(s).toLowerCase().includes(search.toLowerCase())
                            )
                          )
                          .map((e) => (
                            <TableRow key={text(e.id)}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(rowDate(e))}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{text(e.category)}</Badge>
                              </TableCell>
                              <TableCell className="text-foreground max-w-[200px] truncate">{text(e.description)}</TableCell>
                              <TableCell className="font-bold text-destructive whitespace-nowrap">
                                {formatCurrency(rowAmount(e), rowCurrency(e))}
                              </TableCell>
                              <TableCell>
                                <CurrencyBadge currency={rowCurrency(e)} />
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={rowStatus(e)} />
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "revenue" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-xl font-bold text-foreground">Revenue Management</h2>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9 w-52"
                      placeholder="Search…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button className="gap-2" variant="default">
                    <Plus className="size-4" />
                    Record Revenue
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {Object.entries(revByCur).map(([cur, amt]) => {
                  const c = CURRENCIES[cur as keyof typeof CURRENCIES] || CURRENCIES.TZS;
                  return (
                    <div key={cur} className="bg-card border border-border rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {c.flag} {cur}
                      </p>
                      <p className="text-sm font-bold text-success">{fmtAmt(amt, cur)}</p>
                    </div>
                  );
                })}
              </div>
              <Card className="app-surface">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...data.invoices.filter(isReceivable), ...data.income].length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                            No revenue records
                          </TableCell>
                        </TableRow>
                      ) : (
                        [...data.invoices.filter(isReceivable), ...data.income]
                          .filter((r) => filterCurrency === "ALL" || rowCurrency(r) === filterCurrency)
                          .filter((r) =>
                            [r.description, r.customer_name, r.client_name].some((s) =>
                              String(s).toLowerCase().includes(search.toLowerCase())
                            )
                          )
                          .map((r) => (
                            <TableRow key={text(r.id)}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(rowDate(r))}</TableCell>
                              <TableCell className="text-foreground max-w-[200px] truncate">
                                {text(r.description ?? r.customer_name ?? r.client_name)}
                              </TableCell>
                              <TableCell className="font-bold text-success whitespace-nowrap">
                                {formatCurrency(rowAmount(r), rowCurrency(r))}
                              </TableCell>
                              <TableCell>
                                <CurrencyBadge currency={rowCurrency(r)} />
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={rowStatus(r)} />
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Client Invoices</h2>
                <Button className="gap-2">
                  <Plus className="size-4" />
                  Create Invoice
                </Button>
              </div>
              <Card className="app-surface">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer / Vendor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.invoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            No invoices
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.invoices
                          .filter((i) => filterCurrency === "ALL" || rowCurrency(i) === filterCurrency)
                          .map((inv) => (
                            <TableRow key={text(inv.id)}>
                              <TableCell className="font-medium text-foreground">{text(inv.invoice_number)}</TableCell>
                              <TableCell className="text-foreground">{text(inv.customer_name)}</TableCell>
                              <TableCell>
                                <Badge variant={isReceivable(inv) ? "default" : "secondary"}>
                                  {isReceivable(inv) ? "AR" : "AP"}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "font-bold whitespace-nowrap",
                                  isReceivable(inv) ? "text-success" : "text-destructive"
                                )}
                              >
                                {formatCurrency(rowAmount(inv), rowCurrency(inv))}
                              </TableCell>
                              <TableCell>
                                <CurrencyBadge currency={rowCurrency(inv)} />
                              </TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(rowDate(inv))}</TableCell>
                              <TableCell>
                                <StatusBadge status={rowStatus(inv)} />
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "taxes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Tax Obligations</h2>
                <Button className="gap-2">
                  <Plus className="size-4" />
                  Record Tax
                </Button>
              </div>
              <Card className="app-surface">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tax Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!data.taxes || data.taxes.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                            Tax table not configured or empty
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.taxes
                          .filter((t) => filterCurrency === "ALL" || rowCurrency(t) === filterCurrency)
                          .map((tax) => (
                            <TableRow key={text(tax.id)}>
                              <TableCell className="text-foreground">{text(tax.tax_name)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{text(tax.type)}</Badge>
                              </TableCell>
                              <TableCell className="font-bold text-foreground">{formatCurrency(rowAmount(tax), rowCurrency(tax))}</TableCell>
                              <TableCell>
                                <CurrencyBadge currency={rowCurrency(tax)} />
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(rowDate(tax))}</TableCell>
                              <TableCell>
                                <StatusBadge status={rowStatus(tax)} />
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "logistics" && (
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
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-success shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Thermometer className="size-4" />
                      Cold Chain Operations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Reefer cargo tracking and temperature monitoring.</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-warning shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Fuel className="size-4" />
                      Fuel Costs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Fuel</span>
                      <span className="text-warning font-medium">{formatCurrency(metrics.fuelExpenses)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "accounts" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Bank Accounts</h2>
              <Card className="app-surface">
                <CardContent className="p-5">
                  <p className="text-muted-foreground">Bank account management - Configure in Supabase bank_accounts table</p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "bank" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Bank Statement</h2>
              <Card className="app-surface">
                <CardContent className="p-5">
                  <p className="text-muted-foreground">Bank statement reconciliation - Configure in Supabase</p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "coa" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Chart of Accounts</h2>
              {coaGroups.length === 0 ? (
                <Card className="app-surface">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    Chart of Accounts table not configured or empty
                  </CardContent>
                </Card>
              ) : (
                coaGroups.map((group) => (
                  <Card key={group.type} className="app-surface">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">{group.type}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Code</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Currency</TableHead>
                              <TableHead>Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.rows.map((account) => (
                              <TableRow key={text(account.code)}>
                                <TableCell className="font-medium">{text(account.code)}</TableCell>
                                <TableCell>{text(account.name)}</TableCell>
                                <TableCell>
                                  <CurrencyBadge currency={text(account.currency)} />
                                </TableCell>
                                <TableCell className="font-semibold">{formatCurrency(rowAmount(account), rowCurrency(account))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "journal" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Journal Entries</h2>
              {(!data.journalEntries || data.journalEntries.length === 0) ? (
                <Card className="app-surface">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No journal entries yet
                  </CardContent>
                </Card>
              ) : (
                data.journalEntries.map((je) => {
                  const lines = (je.lines as FinanceRow[]) || [];
                  return (
                    <Card key={text(je.id)} className="app-surface">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-semibold">
                            {text(je.reference)} - {text(je.description)}
                          </CardTitle>
                          <Badge variant="outline">{formatDate(rowDate(je))}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Account</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead>Debit</TableHead>
                                <TableHead>Credit</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lines.map((line, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{text(line.account_name)}</TableCell>
                                  <TableCell>
                                    <CurrencyBadge currency={text(line.currency)} />
                                  </TableCell>
                                  <TableCell className="text-success">{formatCurrency(rowAmount(line), rowCurrency(line))}</TableCell>
                                  <TableCell className="text-destructive">{formatCurrency(rowAmount(line), rowCurrency(line))}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "aging" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Aging Report</h2>
                <div className="flex gap-2">
                  <Button
                    variant={agingType === "receivable" ? "default" : "outline"}
                    onClick={() => setAgingType("receivable")}
                  >
                    Receivables
                  </Button>
                  <Button
                    variant={agingType === "payable" ? "default" : "outline"}
                    onClick={() => setAgingType("payable")}
                  >
                    Payables
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-5">
                {agingReport.totals.map((bucket) => (
                  <Card key={bucket.bucket} className="app-surface">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {bucket.bucket}
                      </p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(bucket.total)}</p>
                      <p className="text-xs text-muted-foreground">{bucket.count} items</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="app-surface">
                <div className="overflow-x-auto">
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
          )}
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
