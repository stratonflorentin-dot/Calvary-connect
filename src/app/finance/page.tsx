"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Building2,
  Calculator,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileText,
  Fuel,
  Landmark,
  Plus,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/components/ui/currency-badge";
import { useRole } from "@/hooks/use-role";
import { canRead } from "@/lib/permissions";
import {
  AGING_BUCKETS,
  daysOverdue,
  formatCurrencyShort,
  summarize,
  summarizeByCurrency,
  topOverdue,
} from "@/lib/finance/aging";
import { normalizeCurrency, REPORTING_CURRENCY, sortCurrencyKeys } from "@/lib/finance/multi-currency";

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

interface CashByCurrency {
  [currency: string]: number;
}

interface RangeStat {
  mtd: number;
  ytd: number;
  prevMtd: number;
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function KPICard({
  label,
  value,
  currency = "TZS",
  icon: Icon,
  delta,
  href,
  accent,
}: {
  label: string;
  value: number;
  currency?: string;
  icon: React.ElementType;
  delta?: number;
  href?: string;
  accent: string;
}) {
  const positive = (delta ?? 0) >= 0;
  const inner = (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 transition-all group h-full">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-2.5 rounded-xl", accent)}>
          <Icon className="w-5 h-5" />
        </div>
        {delta != null && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
              positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            )}
          >
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-foreground tracking-tight">{fmt(value, currency)}</p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionHeader({ title, sub, href, actions }: { title: string; sub?: string; href?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-black text-foreground">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {href && (
          <Link href={href} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function FinanceOverviewPage() {
  const { toast } = useToast();
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashByCurrency, setCashByCurrency] = useState<CashByCurrency>({});
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [unbilledTrips, setUnbilledTrips] = useState<any[]>([]);

  const ALL_QUICK_LINKS = [
    { href: "/finance/invoicing/customer-invoices", icon: FileText, label: "New Invoice", color: "text-indigo-600 bg-indigo-50" },
    { href: "/finance/invoicing/vendor-bills", icon: Building2, label: "Vendor Bills", color: "text-orange-600 bg-orange-50" },
    { href: "/expenses", icon: Receipt, label: "Record Expense", color: "text-rose-600 bg-rose-50" },
    { href: "/income", icon: TrendingUp, label: "Record Revenue", color: "text-emerald-600 bg-emerald-50" },
    { href: "/finance/accounting/journal-entries", icon: BookOpen, label: "Journal Entry", color: "text-violet-600 bg-violet-50" },
    { href: "/finance/banking/bank-reconciliation", icon: Landmark, label: "Bank Reconciliation", color: "text-teal-600 bg-teal-50" },
    { href: "/approvals", icon: ClipboardList, label: "Approvals Inbox", color: "text-fuchsia-600 bg-fuchsia-50" },
    { href: "/finance/reports/trial-balance", icon: Calculator, label: "Trial Balance", color: "text-muted-foreground bg-muted" },
    { href: "/finance/accounting/chart-of-accounts", icon: BookOpen, label: "Chart of Accounts", color: "text-indigo-600 bg-indigo-50", module: 'finance_chart_of_accounts' as const },
  ];

  const QUICK_LINKS = ALL_QUICK_LINKS.filter(link => {
    if (!link.module) return true;
    return role ? canRead(role, link.module) : false;
  });

  const load = async () => {
    setLoading(true);
    try {
      const [banks, inv, exp, je, trips] = await Promise.all([
        supabase.from("bank_accounts").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("journal_entries")
          .select("*, journal_entry_lines(*)")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("trips").select("id, trip_number, client, salesAmount:sales_amount, totalAmount:total_amount, status, created_at").eq("status", "delivered").limit(20),
      ]);

      const cash: CashByCurrency = {};
      (banks.data ?? []).forEach((a: any) => {
        const c = a.currency || "TZS";
        cash[c] = (cash[c] || 0) + parseFloat(a.current_balance || 0);
      });
      setCashByCurrency(cash);

      const allInvoices = inv.data ?? [];
      setInvoices(allInvoices.filter((i: any) => (i.type ?? "receivable") === "receivable"));
      setBills(allInvoices.filter((i: any) => i.type === "payable"));
      setExpenses(exp.data ?? []);
      setRecentEntries(je.data ?? []);

      // A "delivered" trip with no matching invoice_number pattern is unbilled.
      const invoiceRefs = new Set(allInvoices.map((i: any) => i.invoice_number ?? ""));
      const unbilled = (trips.data ?? []).filter((t: any) => {
        const ref = `INV-${t.trip_number ?? t.id}`;
        return !invoiceRefs.has(ref);
      });
      setUnbilledTrips(unbilled);
    } catch (err: any) {
      console.warn("[finance] dashboard load", err?.message ?? err);
      toast({ title: "Load error", description: err?.message ?? "Unable to load finance data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arInputs = useMemo(
    () =>
      invoices.map((i) => ({
        amount: i.total_amount ?? i.amount,
        due_date: i.due_date,
        status: i.status,
        customer_name: i.customer_name ?? i.client_name,
        invoice_number: i.invoice_number,
        id: i.id,
        currency: normalizeCurrency(i.currency),
      })),
    [invoices],
  );

  const apInputs = useMemo(
    () =>
      bills.map((b) => ({
        amount: b.total_amount ?? b.amount,
        due_date: b.due_date,
        status: b.status,
        vendor: b.customer_name ?? b.vendor,
        invoice_number: b.invoice_number,
        id: b.id,
        currency: normalizeCurrency(b.currency),
      })),
    [bills],
  );

  const arByCcy = useMemo(() => summarizeByCurrency(arInputs), [arInputs]);
  const apByCcy = useMemo(() => summarizeByCurrency(apInputs), [apInputs]);
  const arCurrencies = useMemo(() => sortCurrencyKeys(Object.keys(arByCcy)), [arByCcy]);
  const apCurrencies = useMemo(() => sortCurrencyKeys(Object.keys(apByCcy)), [apByCcy]);

  // Reporting-currency-only totals for KPI cards. These intentionally do NOT
  // aggregate other currencies — see memory: multi-currency.
  const arSummary = useMemo(() => arByCcy[REPORTING_CURRENCY] ?? summarize([]), [arByCcy]);
  const apSummary = useMemo(() => apByCcy[REPORTING_CURRENCY] ?? summarize([]), [apByCcy]);

  const topDebtors = useMemo(() => topOverdue(invoices.map((i) => ({
    id: i.id,
    amount: i.total_amount ?? i.amount,
    due_date: i.due_date,
    status: i.status,
    customer_name: i.customer_name ?? i.client_name,
    invoice_number: i.invoice_number,
    currency: i.currency,
  })), 5), [invoices]);

  // Revenue / expense KPIs are shown in the reporting currency only.
  // Non-reporting-currency amounts are counted in the per-currency reports.
  const revenue = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const prevMonthEnd = monthStart;

    let mtd = 0, ytd = 0, prevMtd = 0;
    for (const i of invoices) {
      if (normalizeCurrency(i.currency) !== REPORTING_CURRENCY) continue;
      const paidAt = i.paid_at ? new Date(i.paid_at).getTime() : null;
      if (i.status !== "paid" || !paidAt) continue;
      const amt = Number(i.total_amount ?? i.amount) || 0;
      if (paidAt >= monthStart) mtd += amt;
      if (paidAt >= yearStart) ytd += amt;
      if (paidAt >= prevMonthStart && paidAt < prevMonthEnd) prevMtd += amt;
    }
    return { mtd, ytd, prevMtd } as RangeStat;
  }, [invoices]);

  const expenseStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const prevMonthEnd = monthStart;

    let mtd = 0, ytd = 0, prevMtd = 0, pending = 0;
    for (const e of expenses) {
      const inReporting = normalizeCurrency(e.currency) === REPORTING_CURRENCY;
      if (e.status === "pending") pending += 1;
      if (!inReporting) continue;
      if (e.status !== "approved" && e.status !== "paid") continue;
      const date = e.date ? new Date(e.date).getTime() : new Date(e.created_at ?? Date.now()).getTime();
      const amt = Number(e.amount) || 0;
      if (date >= monthStart) mtd += amt;
      if (date >= yearStart) ytd += amt;
      if (date >= prevMonthStart && date < prevMonthEnd) prevMtd += amt;
    }
    return { mtd, ytd, prevMtd, pending };
  }, [expenses]);

  // Cash "total" is deliberately per-currency; this variable holds the
  // reporting-currency slice only, since summing across currencies is wrong.
  const cashTotal = useMemo(() => cashByCurrency[REPORTING_CURRENCY] ?? 0, [cashByCurrency]);
  const netProfitMtd = revenue.mtd - expenseStats.mtd;
  const netProfitYtd = revenue.ytd - expenseStats.ytd;

  const KPIS = [
    {
      label: `Cash (${REPORTING_CURRENCY})`,
      value: cashTotal,
      icon: Wallet,
      accent: "bg-emerald-50 text-emerald-600",
      href: "/finance/banking/bank-accounts",
    },
    {
      label: `Revenue MTD (${REPORTING_CURRENCY})`,
      value: revenue.mtd,
      delta: pctDelta(revenue.mtd, revenue.prevMtd),
      icon: TrendingUp,
      accent: "bg-indigo-50 text-indigo-600",
      href: "/finance/reports/revenue-analysis",
    },
    {
      label: `Expenses MTD (${REPORTING_CURRENCY})`,
      value: expenseStats.mtd,
      delta: pctDelta(expenseStats.mtd, expenseStats.prevMtd),
      icon: TrendingDown,
      accent: "bg-rose-50 text-rose-600",
      href: "/finance/reports/expense-analysis",
    },
    {
      label: `Net Profit MTD (${REPORTING_CURRENCY})`,
      value: netProfitMtd,
      icon: DollarSign,
      accent: netProfitMtd >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
      href: "/finance/reports/profit-loss",
    },
    {
      label: `Receivables (${REPORTING_CURRENCY})`,
      value: arSummary.totalOutstanding,
      icon: CreditCard,
      accent: "bg-amber-50 text-amber-600",
      href: "/finance/invoicing/customer-invoices",
    },
    {
      label: `Payables (${REPORTING_CURRENCY})`,
      value: apSummary.totalOutstanding,
      icon: Building2,
      accent: "bg-orange-50 text-orange-600",
      href: "/finance/invoicing/vendor-bills",
    },
  ];

  const REPORT_LINKS = [
    { label: "Profit & Loss", sub: "Income vs expenditure", href: "/finance/reports/profit-loss", color: "border-l-indigo-500" },
    { label: "Balance Sheet", sub: "Assets, liabilities & equity", href: "/finance/reports/balance-sheet", color: "border-l-emerald-500" },
    { label: "Cash Flow", sub: "Operating, investing, financing", href: "/finance/reports/cash-flow", color: "border-l-sky-500" },
    { label: "Aging Report", sub: "AR & AP aging buckets", href: "/finance/reports/aging-report", color: "border-l-amber-500" },
    { label: "Trial Balance", sub: "GL debit / credit totals", href: "/finance/reports/trial-balance", color: "border-l-violet-500" },
    { label: "VAT / Tax Report", sub: "Statutory obligations", href: "/finance/reports/tax-reports", color: "border-l-rose-500" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading financial data…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-full">Finance & Accounting</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
          <h1 className="text-2xl font-black text-foreground">Financial Control Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {REPORTING_CURRENCY} YTD Revenue {formatCurrencyShort(revenue.ytd, REPORTING_CURRENCY)} · YTD Net {formatCurrencyShort(netProfitYtd, REPORTING_CURRENCY)} · Cash {formatCurrencyShort(cashTotal, REPORTING_CURRENCY)}
            {Object.keys(cashByCurrency).filter((c) => c !== REPORTING_CURRENCY).length > 0 && (
              <>
                {" · other currencies: "}
                {Object.entries(cashByCurrency)
                  .filter(([c]) => c !== REPORTING_CURRENCY)
                  .map(([c, v]) => `${c} ${formatCurrencyShort(v, c)}`)
                  .join(", ")}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} className="h-9 gap-2 border-border text-muted-foreground rounded-lg text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" asChild className="h-9 gap-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold shadow-sm">
            <Link href="/finance/invoicing/customer-invoices">
              <Plus className="w-3.5 h-3.5" /> New Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(expenseStats.pending > 0 || arSummary.totalOverdue > 0 || unbilledTrips.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {expenseStats.pending > 0 && (
            <Link href="/approvals" className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
              <div className="p-2 bg-amber-100 rounded-lg"><Receipt className="w-4 h-4 text-amber-700" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900">{expenseStats.pending} expense{expenseStats.pending > 1 ? "s" : ""} pending</p>
                <p className="text-xs text-amber-700">Route through approvals inbox</p>
              </div>
            </Link>
          )}
          {arCurrencies.some((c) => arByCcy[c].totalOverdue > 0) && (
            <Link href="/finance/reports/aging-report" className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors">
              <div className="p-2 bg-rose-100 rounded-lg"><AlertTriangle className="w-4 h-4 text-rose-700" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-rose-900">
                  Overdue AR: {arCurrencies.filter((c) => arByCcy[c].totalOverdue > 0).map((c) => `${c} ${fmt(arByCcy[c].totalOverdue, c)}`).join(" · ")}
                </p>
                <p className="text-xs text-rose-700">
                  {Math.max(...arCurrencies.map((c) => arByCcy[c].worstDays), 0)} days worst-case
                </p>
              </div>
            </Link>
          )}
          {unbilledTrips.length > 0 && (
            <Link href="/trips" className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors">
              <div className="p-2 bg-indigo-100 rounded-lg"><Sparkles className="w-4 h-4 text-indigo-700" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-indigo-900">{unbilledTrips.length} unbilled deliveries</p>
                <p className="text-xs text-indigo-700">Revenue waiting to be invoiced</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPIS.map((k) => <KPICard key={k.label} {...k} />)}
      </div>

      {/* AR / AP aging strips — per currency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionHeader
              title="Accounts Receivable Aging"
              sub={arCurrencies.length === 0
                ? "Nothing outstanding"
                : arCurrencies.map((c) => `${c} ${fmt(arByCcy[c].totalOutstanding, c)}`).join(" · ")}
              href="/finance/reports/aging-report"
            />
          </div>
          <div className="p-5 space-y-5">
            {arCurrencies.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No receivables.</p>
            ) : arCurrencies.map((cur) => {
              const s = arByCcy[cur];
              return (
                <div key={`ar-${cur}`} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted text-foreground">{cur}</span>
                    <span className="text-xs font-black text-foreground">
                      {fmt(s.totalOutstanding, cur)} · {fmt(s.totalOverdue, cur)} overdue
                    </span>
                  </div>
                  {AGING_BUCKETS.map((b) => {
                    const amt = s.totals[b.key];
                    const pct = s.totalOutstanding > 0 ? (amt / s.totalOutstanding) * 100 : 0;
                    return (
                      <div key={b.key} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-24 shrink-0">{b.label}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full", b.color)} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-right w-32 shrink-0">
                          <p className="text-xs font-black text-foreground">{fmt(amt, cur)}</p>
                          <p className="text-[10px] text-muted-foreground">{s.counts[b.key]} inv</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionHeader
              title="Accounts Payable Aging"
              sub={apCurrencies.length === 0
                ? "Nothing outstanding"
                : apCurrencies.map((c) => `${c} ${fmt(apByCcy[c].totalOutstanding, c)}`).join(" · ")}
              href="/finance/invoicing/vendor-bills"
            />
          </div>
          <div className="p-5 space-y-5">
            {apCurrencies.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No payables.</p>
            ) : apCurrencies.map((cur) => {
              const s = apByCcy[cur];
              return (
                <div key={`ap-${cur}`} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted text-foreground">{cur}</span>
                    <span className="text-xs font-black text-foreground">
                      {fmt(s.totalOutstanding, cur)} · {fmt(s.totalOverdue, cur)} overdue
                    </span>
                  </div>
                  {AGING_BUCKETS.map((b) => {
                    const amt = s.totals[b.key];
                    const pct = s.totalOutstanding > 0 ? (amt / s.totalOutstanding) * 100 : 0;
                    return (
                      <div key={b.key} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-24 shrink-0">{b.label}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full", b.color)} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-right w-32 shrink-0">
                          <p className="text-xs font-black text-foreground">{fmt(amt, cur)}</p>
                          <p className="text-[10px] text-muted-foreground">{s.counts[b.key]} bills</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top debtors + Cash */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionHeader title="Top Overdue Customers" sub="Follow-up recommended" href="/finance/invoicing/customer-invoices" />
          </div>
          {topDebtors.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic">All caught up — no overdue receivables.</div>
          ) : (
            <div className="divide-y divide-border">
              {topDebtors.map((d: any) => {
                const days = daysOverdue(d.due_date);
                return (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/60">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-black text-xs">
                        {(d.customer_name ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{d.customer_name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground truncate font-mono">{d.invoice_number}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-rose-600">{fmt(Number(d.amount) || 0, d.currency ?? "TZS")}</p>
                      <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">{days} days overdue</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionHeader title="Cash by Currency" sub="Consolidated bank balance" href="/finance/banking/bank-accounts" />
          </div>
          <div className="p-5 space-y-2">
            {Object.keys(cashByCurrency).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No bank accounts registered.</p>
            ) : (
              Object.entries(cashByCurrency).map(([cur, bal]) => (
                <div key={cur} className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CircleDollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{cur}</p>
                      <p className="text-xs text-muted-foreground">Available</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-foreground">{fmt(bal, cur)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick actions + reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionHeader title="Quick Actions" sub="Common finance operations" />
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-center">
                <div className={cn("p-2 rounded-lg", l.color.split(" ")[1])}>
                  <l.icon className={cn("w-4 h-4", l.color.split(" ")[0])} />
                </div>
                <span className="text-[11px] font-bold text-foreground leading-tight">{l.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionHeader title="Financial Reports" sub="Statutory-grade reporting suite" />
          </div>
          <div className="p-4 space-y-2">
            {REPORT_LINKS.map((r) => (
              <Link key={r.href} href={r.href} className={cn("flex items-center justify-between p-3 border-l-4 bg-muted hover:bg-muted/60 rounded-r-xl transition-colors", r.color)}>
                <div>
                  <p className="text-sm font-bold text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent journal entries */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <SectionHeader title="Recent Journal Entries" sub="Latest double-entry postings" href="/finance/accounting/journal-entries" />
        </div>
        <div className="divide-y divide-border">
          {recentEntries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic">No journal entries yet.</div>
          ) : (
            recentEntries.map((e: any, i: number) => (
              <div key={e.id || i} className="flex items-center justify-between px-5 py-3 hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", e.status === "posted" ? "bg-emerald-500" : "bg-amber-500")} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{e.reference ?? `JE-${e.id?.slice(0, 6)}`}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-black text-foreground">{fmt(Number(e.total_amount ?? e.debit ?? 0), e.currency ?? "TZS")}</p>
                  <p className="text-[10px] text-muted-foreground">{e.entry_date ?? e.created_at?.slice(0, 10)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
