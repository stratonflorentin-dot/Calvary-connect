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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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

function formatAmount(amount: number, currency = "TZS"): string {
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

function getCurrencyCode(row: FinanceRow | any): string {
  return text(row.currency, "TZS").toUpperCase();
}

function getRowDate(row: FinanceRow | any): string {
  return text(row.date ?? row.expense_date ?? row.due_date ?? row.created_at ?? row.updated_at, new Date().toISOString());
}

function getRowStatus(row: FinanceRow | any): string {
  return text(row.status, "draft").toLowerCase();
}

function safeText(value: unknown, fallback = "-"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function getInvoiceAmount(inv: any): number {
  return toNumber(inv.amount ?? inv.total ?? inv.total_amount);
}

function getIncomeAmount(inc: any): number {
  return toNumber(inc.amount ?? inc.total);
}

function getTaxAmount(tax: any): number {
  return toNumber(tax.amount);
}

function getAccountAmount(account: any): number {
  return toNumber(account.balance);
}


const STATUS_STYLES: Record<string, string> = {
  current: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  "1-30": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  "31-60": "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  "61-90": "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  "90+": "bg-red-700/10 text-red-700 dark:text-red-400 border-red-700/20",
};

function isReceivable(invoice: FinanceRow, coaData: FinanceRow[] = []): boolean {
  const type = text(invoice.type ?? invoice.invoice_type, "receivable").toLowerCase();
  // If it's a COA code, check if it's an Asset account (receivable) vs Liability (payable)
  if (type.match(/^\d+$/)) {
    const account = coaData.find((acc) => acc.code === type);
    if (account) {
      return account.type === "Assets";
    }
  }
  // Fallback to old logic for backward compatibility
  return type !== "payable" && type !== "ap";
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
  const { toast } = useToast();
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

  // Form states
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: "", customer_name: "", amount: "", currency: "TZS", type: "AR", due_date: "", description: "" });
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", currency: "TZS", category: "", vendor: "", date: "" });
  const [revenueForm, setRevenueForm] = useState({ description: "", amount: "", currency: "TZS", date: "" });
  const [taxForm, setTaxForm] = useState({ tax_name: "", amount: "", currency: "TZS", type: "", due_date: "" });
  const [bankAccountForm, setBankAccountForm] = useState({ account_name: "", account_number: "", bank_name: "", currency: "TZS", balance: "" });
  const [submitting, setSubmitting] = useState(false);

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

    console.log("[Finance] Chart of Accounts loaded:", chartOfAccounts.length, "items");
    if (chartOfAccounts.length > 0) {
      console.log("[Finance] Sample COA item:", chartOfAccounts[0]);
      console.log("[Finance] COA types:", [...new Set(chartOfAccounts.map((acc) => acc.type))]);
    }
    setData({ invoices, expenses, income, trips, vehicles, journalEntries, chartOfAccounts, taxes, bankAccounts });
    setLoading(false);
  };

  const saveInvoice = async () => {
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

  const saveTax = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("taxes").insert({
        tax_name: taxForm.tax_name,
        amount: parseFloat(taxForm.amount),
        currency: taxForm.currency,
        type: taxForm.type,
        due_date: taxForm.due_date,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadFinance();
      setModal(null);
      setTaxForm({ tax_name: "", amount: "", currency: "TZS", type: "", due_date: "" });
      toast({ title: "Success", description: "Tax obligation recorded successfully" });
    } catch (err) {
      console.error("Error saving tax:", err);
      toast({ title: "Error", description: "Failed to record tax", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const saveBankAccount = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("bank_accounts").insert({
        account_name: bankAccountForm.account_name,
        account_number: bankAccountForm.account_number,
        bank_name: bankAccountForm.bank_name,
        currency: bankAccountForm.currency,
        balance: parseFloat(bankAccountForm.balance),
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadFinance();
      setModal(null);
      setBankAccountForm({ account_name: "", account_number: "", bank_name: "", currency: "TZS", balance: "" });
      toast({ title: "Success", description: "Bank account added successfully" });
    } catch (err) {
      console.error("Error saving bank account:", err);
      toast({ title: "Error", description: "Failed to add bank account", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const metrics = useMemo(() => {
    const invoiceRevenue = data.invoices
      .filter((row) => isReceivable(row, data.chartOfAccounts))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const directIncome = data.income.reduce((sum, row) => sum + rowAmount(row), 0);
    const operatingExpense = data.expenses.reduce((sum, row) => sum + rowAmount(row), 0);
    const receivables = data.invoices
      .filter((row) => isReceivable(row, data.chartOfAccounts) && isUnpaid(row))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const payables = data.invoices
      .filter((row) => !isReceivable(row, data.chartOfAccounts) && isUnpaid(row))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const pendingExpenses = data.expenses.filter((row) => rowStatus(row) === "pending");
    const revenue = invoiceRevenue + directIncome;
    const net = revenue - operatingExpense;
    const margin = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
    
    // Logistics metrics
    const crossBorderExpenses = data.expenses.filter((row) => row.is_cross_border === true).reduce((sum, row) => sum + rowAmount(row), 0);
    const crossBorderRevenue = data.invoices.filter((row) => row.is_cross_border === true && isReceivable(row, data.chartOfAccounts)).reduce((sum, row) => sum + rowAmount(row), 0);
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

  const xbRevByCur = useMemo(() => sumByCurrency(data.invoices.filter((r) => r.is_cross_border === true && isReceivable(r, data.chartOfAccounts))), [data]);
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
      detail: text(row.customer_name ?? row.client_name ?? row.vendor, isReceivable(row, data.chartOfAccounts) ? "Receivable" : "Payable"),
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
        const isReceivableInv = isReceivable(row, data.chartOfAccounts);
        const isPayableInv = !isReceivable(row, data.chartOfAccounts);
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-1 bg-primary rounded-full"></div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Dashboard</h1>
                </div>
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary font-medium">
                  Live
                </Badge>
              </div>
              <p className="text-base text-muted-foreground max-w-2xl">
                Comprehensive financial management for multi-currency operations, invoicing, expenses, and reconciliation.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="gap-2 h-10" onClick={loadFinance} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Refresh Data
              </Button>
              <Button className="gap-2 h-10 bg-primary hover:bg-primary/90">
                <Download className="size-4" />
                Export Report
              </Button>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-4 md:p-6">
          {/* Key Metrics Bar */}
          <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Revenue</p>
              <p className="text-xl font-bold text-success">{formatCurrency(metrics.revenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">All currencies</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Expenses</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(metrics.operatingExpense)}</p>
              <p className="text-xs text-muted-foreground mt-1">All currencies</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Net Profit</p>
              <p className={cn("text-xl font-bold", metrics.net >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(metrics.net)}</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics.margin}% margin</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Receivables</p>
              <p className="text-xl font-bold text-warning">{formatCurrency(metrics.receivables)}</p>
              <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Payables</p>
              <p className="text-xl font-bold text-info">{formatCurrency(metrics.payables)}</p>
              <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Active Trips</p>
              <p className="text-xl font-bold text-primary">{metrics.tripCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics.vehicleCount} vehicles</p>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground">Quick Actions:</span>
            <Dialog open={modal === "invoice"} onOpenChange={(open) => setModal(open ? "invoice" : null)}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="size-4" />
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Create New Invoice</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inv-number">Invoice Number</Label>
                      <Input id="inv-number" placeholder="INV-001" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-type">Type (Chart of Accounts)</Label>
                      <Select value={invoiceForm.type} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, type: value })}>
                        <SelectTrigger id="inv-type"><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {data.chartOfAccounts.length === 0 ? (
                            <SelectItem value="" disabled>No Chart of Accounts configured</SelectItem>
                          ) : (
                            data.chartOfAccounts.map((acc) => (
                              <SelectItem key={acc.code} value={acc.code}>{acc.code} - {acc.name} ({acc.type})</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-customer">Customer / Vendor</Label>
                    <Input id="inv-customer" placeholder="Company name" value={invoiceForm.customer_name} onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inv-amount">Amount</Label>
                      <Input id="inv-amount" type="number" placeholder="0.00" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-currency">Currency</Label>
                      <Select value={invoiceForm.currency} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, currency: value })}>
                        <SelectTrigger id="inv-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-due">Due Date</Label>
                    <Input id="inv-due" type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-description">Description</Label>
                    <Input id="inv-description" placeholder="Invoice description" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                    <Button onClick={saveInvoice}>Create Invoice</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={modal === "expense"} onOpenChange={(open) => setModal(open ? "expense" : null)}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Receipt className="size-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Add New Expense</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="exp-amount">Amount</Label>
                      <Input id="exp-amount" type="number" placeholder="0.00" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exp-currency">Currency</Label>
                      <Select value={expenseForm.currency} onValueChange={(value) => setExpenseForm({ ...expenseForm, currency: value })}>
                        <SelectTrigger id="exp-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp-category">Category (Chart of Accounts)</Label>
                    <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}>
                      <SelectTrigger id="exp-category"><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {data.chartOfAccounts.length === 0 ? (
                          <SelectItem value="" disabled>No Chart of Accounts configured</SelectItem>
                        ) : (
                          data.chartOfAccounts.map((acc) => (
                            <SelectItem key={acc.code} value={acc.code}>{acc.code} - {acc.name} ({acc.type})</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp-vendor">Vendor</Label>
                    <Input id="exp-vendor" placeholder="Vendor name" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp-description">Description</Label>
                    <Input id="exp-description" placeholder="Expense description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp-date">Date</Label>
                    <Input id="exp-date" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                    <Button onClick={saveExpense}>Save Expense</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={modal === "revenue"} onOpenChange={(open) => setModal(open ? "revenue" : null)}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Wallet className="size-4" />
                  Record Revenue
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Record Revenue</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rev-amount">Amount</Label>
                      <Input id="rev-amount" type="number" placeholder="0.00" value={revenueForm.amount} onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-currency">Currency</Label>
                      <Select value={revenueForm.currency} onValueChange={(value) => setRevenueForm({ ...revenueForm, currency: value })}>
                        <SelectTrigger id="rev-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rev-description">Description</Label>
                    <Input id="rev-description" placeholder="Revenue source/description" value={revenueForm.description} onChange={(e) => setRevenueForm({ ...revenueForm, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rev-date">Date</Label>
                    <Input id="rev-date" type="date" value={revenueForm.date} onChange={(e) => setRevenueForm({ ...revenueForm, date: e.target.value })} />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                    <Button onClick={saveRevenue}>Save Revenue</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </section>

          {/* Multi-Currency Summary Cards */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              items={data.invoices.filter((r) => r.is_cross_border === true && isReceivable(r, data.chartOfAccounts))}
              icon={Globe}
              gradient="bg-gradient-to-br from-purple-600 to-indigo-700"
            />
            <MultiCurrencyCard
              title="Pending AR"
              items={data.invoices.filter((i) => isReceivable(i, data.chartOfAccounts) && isUnpaid(i))}
              icon={Building2}
              gradient="bg-gradient-to-br from-amber-600 to-orange-700"
            />
          </section>

          {/* Currency Filter */}
          <section className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter by currency:</span>
            <div className="flex gap-2 flex-wrap">
              {currencyOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setFilterCurrency(o.value)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105",
                    filterCurrency === o.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
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
          <div className="border-b border-border bg-card/50 backdrop-blur-sm">
            <div className="flex overflow-x-auto gap-1 p-1">
              {[
                { id: "overview", label: "Overview", icon: TrendingUp },
                { id: "expenses", label: "Expenses", icon: TrendingDown },
                { id: "revenue", label: "Revenue", icon: Wallet },
                { id: "invoices", label: "Invoices", icon: FileText },
                { id: "taxes", label: "Taxes", icon: Scale },
                { id: "logistics", label: "Logistics", icon: Truck },
                { id: "accounts", label: "Accounts", icon: Landmark },
                { id: "bank", label: "Bank Statement", icon: CreditCard },
                { id: "coa", label: "Chart of Accounts", icon: BookOpen },
                { id: "journal", label: "Journal Entries", icon: ClipboardList },
                { id: "aging", label: "Aging Report", icon: AlertTriangle },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="app-surface border-l-4 border-l-success">
                  <CardHeader className="pb-3">
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
                          <div key={cur} className="flex items-center justify-between p-3 bg-success/5 rounded-lg border border-success/10">
                            <span className="flex items-center gap-2 text-sm text-foreground font-medium">
                              <span className="text-lg">{c.flag}</span>
                              {cur} – {c.name}
                            </span>
                            <span className="font-bold text-success">{fmtAmt(amt, cur)}</span>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>

                <Card className="app-surface border-l-4 border-l-destructive">
                  <CardHeader className="pb-3">
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
                          <div key={cur} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                            <span className="flex items-center gap-2 text-sm text-foreground font-medium">
                              <span className="text-lg">{c.flag}</span>
                              {cur} – {c.name}
                            </span>
                            <span className="font-bold text-destructive">{fmtAmt(amt, cur)}</span>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              </div>

              <Card className="app-surface">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Net Profit / Loss by Currency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {Object.entries(profitByCur).map(([cur, net]) => {
                      const c = CURRENCIES[cur as keyof typeof CURRENCIES] || CURRENCIES.TZS;
                      return (
                        <div
                          key={cur}
                          className={cn(
                            "rounded-xl p-4 border-2 transition-all hover:scale-105",
                            net >= 0 ? "bg-success/10 border-success/30 shadow-sm" : "bg-destructive/10 border-destructive/30 shadow-sm"
                          )}
                        >
                          <p className="text-sm font-semibold text-muted-foreground mb-2">
                            {c.flag} {cur}
                          </p>
                          <p className={cn("text-xl font-bold", net >= 0 ? "text-success" : "text-destructive")}>
                            {fmtAmt(Math.abs(net), cur)}
                          </p>
                          <p className={cn("text-xs mt-1 font-medium", net >= 0 ? "text-success/70" : "text-destructive/70")}>
                            {net >= 0 ? "Profit" : "Loss"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="app-surface border-l-4 border-l-primary">
                <CardHeader className="pb-3">
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
                            <TableRow key={cur} className="hover:bg-muted/50">
                              <TableCell>
                                <span className="flex items-center gap-2 font-medium">
                                  <span className="text-lg">{c.flag}</span>
                                  {cur} – {c.name}
                                </span>
                              </TableCell>
                              <TableCell className="text-success font-semibold">{fmtAmt(rev, cur)}</TableCell>
                              <TableCell className="text-destructive font-semibold">{fmtAmt(exp, cur)}</TableCell>
                              <TableCell className={cn("font-bold text-base", net >= 0 ? "text-success" : "text-destructive")}>
                                {fmtAmt(Math.abs(net), cur)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm font-medium">
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
                  <Dialog open={modal === "expense"} onOpenChange={(open) => setModal(open ? "expense" : null)}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="size-4" />
                        Add Expense
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">Add New Expense</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="exp-amount">Amount</Label>
                            <Input id="exp-amount" type="number" placeholder="0.00" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="exp-currency">Currency</Label>
                            <Select value={expenseForm.currency} onValueChange={(value) => setExpenseForm({ ...expenseForm, currency: value })}>
                              <SelectTrigger id="exp-currency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(CURRENCIES).map((c) => (
                                  <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exp-category">Category (Chart of Accounts)</Label>
                          <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}>
                            <SelectTrigger id="exp-category"><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>
                              {data.chartOfAccounts.length === 0 ? (
                                <SelectItem value="" disabled>No Chart of Accounts configured</SelectItem>
                              ) : (
                                data.chartOfAccounts.map((acc) => (
                                  <SelectItem key={acc.code} value={acc.code}>{acc.code} - {acc.name} ({acc.type})</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exp-vendor">Vendor</Label>
                          <Input id="exp-vendor" placeholder="Vendor name" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exp-description">Description</Label>
                          <Input id="exp-description" placeholder="Expense description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exp-date">Date</Label>
                          <Input id="exp-date" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                          <Button onClick={saveExpense}>Save Expense</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
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
              <Card className="app-surface border border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="font-semibold text-foreground">Date</TableHead>
                          <TableHead className="font-semibold text-foreground">Category</TableHead>
                          <TableHead className="font-semibold text-foreground">Description</TableHead>
                          <TableHead className="font-semibold text-foreground">Vendor</TableHead>
                          <TableHead className="font-semibold text-foreground text-right">Amount</TableHead>
                          <TableHead className="font-semibold text-foreground">Currency</TableHead>
                          <TableHead className="font-semibold text-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.expenses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-16 text-center">
                              <Receipt className="mx-auto size-12 text-muted-foreground/30 mb-3" />
                              <p className="text-muted-foreground font-medium">No expenses recorded</p>
                              <p className="text-sm text-muted-foreground mt-1">Use the "Add Expense" button above to record your first expense</p>
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
                              <TableRow key={text(e.id)} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="text-muted-foreground font-medium whitespace-nowrap">{formatDate(rowDate(e))}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="font-medium">{text(e.category)}</Badge>
                                </TableCell>
                                <TableCell className="text-foreground">{text(e.description)}</TableCell>
                                <TableCell className="text-muted-foreground">{text(e.vendor)}</TableCell>
                                <TableCell className="font-bold text-destructive text-right whitespace-nowrap">
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
                </CardContent>
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
                    <Input className="pl-9 w-52" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <FormDialog open={modal === "revenue"} onOpenChange={(open) => setModal(open ? "revenue" : null)} title="Record Revenue" trigger={<Button className="gap-2"><Plus className="size-4" />Record Revenue</Button>}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rev-amount">Amount</Label>
                        <Input id="rev-amount" type="number" min="0" step="0.01" placeholder="0.00" value={revenueForm.amount} onChange={(e) => setRevenueForm({ ...revenueForm, amount: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rev-currency">Currency</Label>
                        <Select value={revenueForm.currency} onValueChange={(value) => setRevenueForm({ ...revenueForm, currency: value })}>
                          <SelectTrigger id="rev-currency"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.values(CURRENCIES).map((c) => (<SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-description">Description</Label>
                      <Input id="rev-description" placeholder="Revenue source/description" value={revenueForm.description} onChange={(e) => setRevenueForm({ ...revenueForm, description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rev-date">Date</Label>
                      <Input id="rev-date" type="date" value={revenueForm.date} onChange={(e) => setRevenueForm({ ...revenueForm, date: e.target.value })} />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="outline" onClick={() => setModal(null)} disabled={submitting}>Cancel</Button>
                      <Button onClick={saveRevenue} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Save Revenue</Button>
                    </div>
                  </FormDialog>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {Object.entries(revByCur).map(([cur, amt]) => {
                  const config = CURRENCIES[cur] || CURRENCIES.TZS;
                  return (
                    <div key={cur} className="bg-card border border-border rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">{config.flag} {cur}</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatAmount(amt, cur)}</p>
                    </div>
                  );
                })}
              </div>
              <Card className="border border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Source / Customer</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...data.invoices.filter(isReceivable), ...data.income].length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-16 text-center">
                              <EmptyState icon={Wallet} title="No revenue recorded" description='Use the "Record Revenue" button above to add your first revenue entry' />
                            </TableCell>
                          </TableRow>
                        ) : (
                          [...data.invoices.filter(isReceivable), ...data.income]
                            .filter((r) => filterCurrency === "ALL" || rowCurrency(r) === filterCurrency)
                            .filter((r) => [r.description, r.customer_name, r.client_name].some((s) => String(s).toLowerCase().includes(search.toLowerCase())))
                            .map((r) => (
                              <TableRow key={safeText(r.id)} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="text-muted-foreground font-medium whitespace-nowrap">{formatDate(getRowDate(r))}</TableCell>
                                <TableCell className="text-foreground font-medium">{safeText(r.customer_name ?? r.client_name ?? "Direct Income")}</TableCell>
                                <TableCell className="text-muted-foreground">{safeText(r.description)}</TableCell>
                                <TableCell className="font-bold text-emerald-700 dark:text-emerald-400 text-right whitespace-nowrap">{formatAmount(("amount" in r ? toNumber(r.amount) : getIncomeAmount(r as any)), getCurrencyCode(r))}</TableCell>
                                <TableCell><CurrencyBadge currency={getCurrencyCode(r)} /></TableCell>
                                <TableCell><StatusBadge status={getRowStatus(r)} /></TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Client Invoices</h2>
                <FormDialog open={modal === "invoice"} onOpenChange={(open) => setModal(open ? "invoice" : null)} title="Create New Invoice" trigger={<Button className="gap-2"><Plus className="size-4" />Create Invoice</Button>}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inv-number">Invoice Number</Label>
                      <Input id="inv-number" placeholder="INV-001" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-type">Type (Chart of Accounts)</Label>
                      <Select value={invoiceForm.type} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, type: value })}>
                        <SelectTrigger id="inv-type"><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {data.chartOfAccounts.length === 0 ? (
                            <SelectItem value="" disabled>No Chart of Accounts configured</SelectItem>
                          ) : (
                            data.chartOfAccounts.map((acc) => (
                              <SelectItem key={acc.code} value={acc.code}>{acc.code} - {acc.name} ({acc.type})</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-customer">Customer / Vendor</Label>
                    <Input id="inv-customer" placeholder="Company name" value={invoiceForm.customer_name} onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inv-amount">Amount</Label>
                      <Input id="inv-amount" type="number" min="0" step="0.01" placeholder="0.00" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-currency">Currency</Label>
                      <Select value={invoiceForm.currency} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, currency: value })}>
                        <SelectTrigger id="inv-currency"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((c) => (<SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-due">Due Date</Label>
                    <Input id="inv-due" type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-description">Description</Label>
                    <Input id="inv-description" placeholder="Invoice description" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setModal(null)} disabled={submitting}>Cancel</Button>
                    <Button onClick={saveInvoice} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Create Invoice</Button>
                  </div>
                </FormDialog>
              </div>
              <Card className="border border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Customer / Vendor</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.invoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-16 text-center">
                              <EmptyState icon={FileText} title="No invoices created" description='Use the "Create Invoice" button above to generate your first invoice' />
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.invoices
                            .filter((i) => filterCurrency === "ALL" || rowCurrency(i) === filterCurrency)
                            .map((inv) => (
                              <TableRow key={safeText(inv.id)} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-semibold text-foreground">{safeText(inv.invoice_number)}</TableCell>
                                <TableCell className="text-foreground font-medium">{safeText(inv.customer_name)}</TableCell>
                                <TableCell>
                                  <Badge variant={isReceivable(inv, data.chartOfAccounts) ? "default" : "secondary"} className="font-medium">{isReceivable(inv, data.chartOfAccounts) ? "AR" : "AP"}</Badge>
                                </TableCell>
                                <TableCell className={cn("font-bold text-right whitespace-nowrap", isReceivable(inv, data.chartOfAccounts) ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                                  {formatAmount(getInvoiceAmount(inv), getCurrencyCode(inv))}
                                </TableCell>
                                <TableCell><CurrencyBadge currency={getCurrencyCode(inv)} /></TableCell>
                                <TableCell className="text-muted-foreground font-medium whitespace-nowrap">{formatDate(getRowDate(inv))}</TableCell>
                                <TableCell><StatusBadge status={getRowStatus(inv)} /></TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "taxes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Tax Obligations</h2>
                <FormDialog open={modal === "tax"} onOpenChange={(open) => setModal(open ? "tax" : null)} title="Record Tax Obligation" trigger={<Button className="gap-2"><Plus className="size-4" />Record Tax</Button>}>
                  <div className="space-y-2">
                    <Label htmlFor="tax-name">Tax Name</Label>
                    <Input id="tax-name" placeholder="VAT, Income Tax, etc." value={taxForm.tax_name} onChange={(e) => setTaxForm({ ...taxForm, tax_name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tax-amount">Amount *</Label>
                      <Input id="tax-amount" type="number" min="0" step="0.01" placeholder="0.00" value={taxForm.amount} onChange={(e) => setTaxForm({ ...taxForm, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax-currency">Currency</Label>
                      <Select value={taxForm.currency} onValueChange={(value) => setTaxForm({ ...taxForm, currency: value })}>
                        <SelectTrigger id="tax-currency"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((c) => (<SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tax-type">Type</Label>
                      <Input id="tax-type" placeholder="VAT, Withholding, etc." value={taxForm.type} onChange={(e) => setTaxForm({ ...taxForm, type: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax-due">Due Date</Label>
                      <Input id="tax-due" type="date" value={taxForm.due_date} onChange={(e) => setTaxForm({ ...taxForm, due_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setModal(null)} disabled={submitting}>Cancel</Button>
                    <Button onClick={saveTax} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Save Tax</Button>
                  </div>
                </FormDialog>
              </div>
              <Card className="border border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Tax Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(!data.taxes || data.taxes.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-16 text-center">
                              <EmptyState icon={Scale} title="No tax obligations recorded" description='Use the "Record Tax" button above to add your first tax entry' />
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.taxes
                            .filter((t) => filterCurrency === "ALL" || rowCurrency(t) === filterCurrency)
                            .map((tax) => (
                              <TableRow key={safeText(tax.id)} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="text-foreground font-medium">{safeText(tax.tax_name)}</TableCell>
                                <TableCell><Badge variant="secondary" className="font-medium">{safeText(tax.type)}</Badge></TableCell>
                                <TableCell className="font-bold text-foreground text-right whitespace-nowrap">{formatAmount(getTaxAmount(tax), getCurrencyCode(tax))}</TableCell>
                                <TableCell><CurrencyBadge currency={getCurrencyCode(tax)} /></TableCell>
                                <TableCell className="text-muted-foreground font-medium whitespace-nowrap">{formatDate(getRowDate(tax))}</TableCell>
                                <TableCell><StatusBadge status={getRowStatus(tax)} /></TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "logistics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-blue-500 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Globe className="size-4" />
                      Cross-Border Operations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Expenses</span>
                      <span className="text-red-700 dark:text-red-400 font-medium">{formatAmount(metrics.crossBorderExpenses)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">{formatAmount(metrics.crossBorderRevenue)}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500 shadow-lg">
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
                <Card className="border-l-4 border-l-amber-500 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Fuel className="size-4" />
                      Fuel Costs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Fuel</span>
                      <span className="text-amber-700 dark:text-amber-400 font-medium">{formatAmount(metrics.fuelExpenses)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "accounts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Bank Accounts</h2>
                <FormDialog open={modal === "bank-account"} onOpenChange={(open) => setModal(open ? "bank-account" : null)} title="Add Bank Account" trigger={<Button className="gap-2"><Plus className="size-4" />Add Bank Account</Button>}>
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Account Name *</Label>
                    <Input id="bank-name" placeholder="Main Operating Account" value={bankAccountForm.account_name} onChange={(e) => setBankAccountForm({ ...bankAccountForm, account_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-bank">Bank Name *</Label>
                    <Input id="bank-bank" placeholder="Bank name" value={bankAccountForm.bank_name} onChange={(e) => setBankAccountForm({ ...bankAccountForm, bank_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-number">Account Number</Label>
                    <Input id="bank-number" placeholder="Account number" value={bankAccountForm.account_number} onChange={(e) => setBankAccountForm({ ...bankAccountForm, account_number: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bank-currency">Currency</Label>
                      <Select value={bankAccountForm.currency} onValueChange={(value) => setBankAccountForm({ ...bankAccountForm, currency: value })}>
                        <SelectTrigger id="bank-currency"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((c) => (<SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank-balance">Initial Balance *</Label>
                      <Input id="bank-balance" type="number" min="0" step="0.01" placeholder="0.00" value={bankAccountForm.balance} onChange={(e) => setBankAccountForm({ ...bankAccountForm, balance: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setModal(null)} disabled={submitting}>Cancel</Button>
                    <Button onClick={saveBankAccount} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Save Account</Button>
                  </div>
                </FormDialog>
              </div>
              <Card className="border border-border">
                <CardContent className="p-5">
                  {data.bankAccounts.length === 0 ? (
                    <EmptyState icon={Landmark} title="No bank accounts configured" description="Add your first bank account to track balances and reconcile statements" />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account Name</TableHead>
                            <TableHead>Bank</TableHead>
                            <TableHead>Account Number</TableHead>
                            <TableHead>Currency</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.bankAccounts.map((account) => (
                            <TableRow key={safeText(account.id)} className="hover:bg-muted/50">
                              <TableCell className="font-medium text-foreground">{safeText(account.account_name)}</TableCell>
                              <TableCell className="text-muted-foreground">{safeText(account.bank_name)}</TableCell>
                              <TableCell className="font-mono text-sm">{safeText(account.account_number)}</TableCell>
                              <TableCell><CurrencyBadge currency={getCurrencyCode(account)} /></TableCell>
                              <TableCell className="font-bold text-right">{formatAmount(toNumber(account.balance), getCurrencyCode(account))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "bank" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Bank Statement Reconciliation</h2>
              <Card className="border border-border">
                <CardContent className="p-5">
                  <EmptyState icon={CreditCard} title="Bank Statement Reconciliation" description="Import bank statements and match transactions to your ledger records. This feature connects to your configured bank accounts." action={<Button asChild variant="outline"><Link href="/finance/accounts">View Bank Accounts</Link></Button>} />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "coa" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Chart of Accounts</h2>
                <Button className="gap-2" variant="outline"><Plus className="size-4" />Add Account</Button>
              </div>
              {coaGroups.length === 0 ? (
                <Card className="border border-border">
                  <CardContent className="py-16 text-center">
                    <BookOpen className="mx-auto size-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Chart of Accounts Not Configured</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">Configure the chart_of_accounts table in Supabase to organize your financial accounts by type.</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-2xl mx-auto">
                      {["Assets", "Liabilities", "Equity", "Revenue", "Expenses"].map((type) => (
                        <div key={type} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                          <p className="text-sm font-medium text-muted-foreground">{type}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                coaGroups.map((group) => (
                  <Card key={group.type} className="border border-border">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-lg font-semibold">{group.type}</CardTitle>
                      <Badge variant="outline" className="text-xs">{group.rows.length} accounts</Badge>
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
                              <TableRow key={safeText(account.code)}>
                                <TableCell className="font-medium">{safeText(account.code)}</TableCell>
                                <TableCell>{safeText(account.name)}</TableCell>
                                <TableCell><CurrencyBadge currency={safeText(account.currency)} /></TableCell>
                                <TableCell className="font-semibold">{formatAmount(getAccountAmount(account), safeText(account.currency, "TZS"))}</TableCell>
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
                <Card className="border border-border">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No journal entries yet
                  </CardContent>
                </Card>
              ) : (
                data.journalEntries.map((je) => {
                  const lines = (je.lines as any[]) || [];
                  return (
                    <Card key={safeText(je.id)} className="border border-border">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-semibold">
                            {safeText(je.reference)} - {safeText(je.description)}
                          </CardTitle>
                          <Badge variant="outline">{formatDate(getRowDate(je))}</Badge>
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
                                  <TableCell>{safeText(line.account_name)}</TableCell>
                                  <TableCell><CurrencyBadge currency={safeText(line.currency)} /></TableCell>
                                  <TableCell className="text-emerald-700 dark:text-emerald-400">{formatAmount(toNumber(line.debit), safeText(line.currency, "TZS"))}</TableCell>
                                  <TableCell className="text-red-700 dark:text-red-400">{formatAmount(toNumber(line.credit), safeText(line.currency, "TZS"))}</TableCell>
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
                  <Card key={bucket.bucket} className="border border-border">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {bucket.bucket === "current" ? "Current" : `${bucket.bucket} days`}
                      </p>
                      <p className="text-lg font-bold text-foreground">{formatAmount(bucket.total)}</p>
                      <p className="text-xs text-muted-foreground">{bucket.count} items</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="border border-border">
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
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No outstanding items</TableCell>
                        </TableRow>
                      ) : (
                        agingReport.items
                          .sort((a, b) => b.daysOverdue - a.daysOverdue)
                          .map((inv) => (
                            <TableRow key={safeText(inv.id)} className="hover:bg-muted/50">
                              <TableCell className="font-medium text-foreground">{safeText(inv.invoice_number)}</TableCell>
                              <TableCell className="text-foreground">{safeText(inv.customer_name)}</TableCell>
                              <TableCell className={cn("font-medium", agingType === "receivable" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                                {formatAmount(getInvoiceAmount(inv))}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(getRowDate(inv))}</TableCell>
                              <TableCell className={cn("font-medium", inv.daysOverdue > 90 ? "text-red-700 dark:text-red-400" : inv.daysOverdue > 30 ? "text-amber-700 dark:text-amber-400" : inv.daysOverdue > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                                {inv.daysOverdue <= 0 ? `${Math.abs(inv.daysOverdue)}d to go` : `${inv.daysOverdue}d overdue`}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(STATUS_STYLES[inv.bucket] || STATUS_STYLES.current)}>
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
