"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  DollarSign,
  Lock,
  Plus,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/components/ui/currency-badge";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
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
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard, IndustryCardKicker } from "@/components/industry/card";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";

const ACCOUNTANT_PAGES = [
  { label: "Dashboard", href: "/finance" },
  { label: "Customer invoices", href: "/finance/invoicing/customer-invoices" },
  { label: "Expenses & fuel", href: "/accountant/expenses" },
  { label: "Reconciliation", href: "/finance/banking/bank-statements" },
];

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface CashByCurrency { [currency: string]: number }

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

// journal_entries has no header-level amount column — the real figure is
// the sum of its lines' debit_amount (== credit_amount on a balanced
// entry). Selecting a "total_amount" column here would 400, since it
// doesn't exist on this table (only journal_entry_lines has amounts).
function sumDebits(entry: { journal_entry_lines?: { debit_amount?: number | null }[] | null }): number {
  return (entry.journal_entry_lines ?? []).reduce((sum, l) => sum + (Number(l.debit_amount) || 0), 0);
}

function KPICard({ label, value, currency = "TZS", icon: Icon, delta, href }: { label: string; value: number; currency?: string; icon: React.ElementType; delta?: number; href?: string }) {
  const positive = (delta ?? 0) >= 0;
  const inner = (
    <IndustryCard hover className="gap-1.5">
      <div className="flex items-start justify-between">
        <Icon className="size-4 text-[var(--ci-text-tertiary)]" />
        {delta != null && (
          <IndustryTag variant={positive ? "accent" : "danger"}>{positive ? "+" : ""}{delta.toFixed(1)}%</IndustryTag>
        )}
      </div>
      <p className="ci-mono text-[20px] font-bold leading-none">{fmt(value, currency)}</p>
      <p className="ci-lbl">{label}</p>
    </IndustryCard>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function FinanceOverviewPage() {
  const { toast } = useToast();
  const { role } = useRole();
  const { user } = useSupabase();
  const canClosePeriod = ["CEO", "ADMIN"].includes(String(role || "").toUpperCase());
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashByCurrency, setCashByCurrency] = useState<CashByCurrency>({});
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [draftEntries, setDraftEntries] = useState<any[]>([]);
  const [unbilledTrips, setUnbilledTrips] = useState<any[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<{ status: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closingPeriod, setClosingPeriod] = useState(false);

  const ALL_QUICK_LINKS = [
    { href: "/finance/invoicing/customer-invoices", icon: Receipt, label: "New Invoice" },
    { href: "/finance/invoicing/vendor-bills", icon: Building2, label: "Vendor Bills" },
    { href: "/expenses", icon: Receipt, label: "Record Expense" },
    { href: "/income", icon: TrendingUp, label: "Record Revenue" },
    { href: "/finance/accounting/journal-entries", icon: DollarSign, label: "Journal Entry" },
    { href: "/finance/banking/bank-statements", icon: Wallet, label: "Bank Statements" },
    { href: "/approvals", icon: CheckCircle2, label: "Approvals Inbox" },
    { href: "/finance/reports/trial-balance", icon: DollarSign, label: "Trial Balance" },
    { href: "/finance/accounting/chart-of-accounts", icon: DollarSign, label: "Chart of Accounts", module: "finance_chart_of_accounts" as const },
    { href: "/finance/accounting/vehicle-loans", icon: Building2, label: "Vehicle Loans" },
    { href: "/finance/budgets", icon: Wallet, label: "Budgets" },
    { href: "/finance/cash-requests", icon: Wallet, label: "Cash Requests" },
    { href: "/finance/petty-cash", icon: Wallet, label: "Petty Cash" },
    { href: "/fleet/fuel-anomalies", icon: AlertTriangle, label: "Fuel Anomalies" },
  ];
  const QUICK_LINKS = ALL_QUICK_LINKS.filter((link) => (!link.module ? true : role ? canRead(role as any, link.module) : false));

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const [banks, inv, exp, je, drafts, trips, period] = await Promise.all([
        supabase.from("bank_accounts").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("journal_entries").select("*, journal_entry_lines(*)").order("created_at", { ascending: false }).limit(6),
        supabase.from("journal_entries").select("id, reference, description, currency, created_at, journal_entry_lines(debit_amount)").eq("status", "draft").order("created_at", { ascending: false }).limit(10),
        supabase.from("trips").select("id, trip_number, client, salesAmount:sales_amount, totalAmount:total_amount, status, created_at").eq("status", "delivered").limit(20),
        supabase.from("fiscal_periods").select("status").eq("year", now.getFullYear()).eq("month", now.getMonth() + 1).maybeSingle(),
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
      setDraftEntries(drafts.data ?? []);
      setCurrentPeriod(period.data ?? { status: "open" });

      const invoicedTripIds = new Set(allInvoices.map((i: any) => i.trip_id).filter(Boolean));
      const invoiceRefs = new Set(allInvoices.map((i: any) => i.invoice_number ?? ""));
      const unbilled = (trips.data ?? []).filter((t: any) => {
        const ref = `INV-${t.trip_number ?? t.id}`;
        return !invoicedTripIds.has(t.id) && !invoiceRefs.has(ref);
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

  const postEntry = async (entry: any) => {
    setBusyId(entry.id);
    const { error } = await supabase.rpc("post_journal_entry", { p_id: entry.id });
    setBusyId(null);
    if (error) {
      toast({ title: "Couldn't post entry", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Entry posted", description: `${entry.reference ?? entry.id.slice(0, 8)} is now in the ledger.` });
    load();
  };

  const approveExpense = async (expense: any) => {
    setBusyId(expense.id);
    const { error } = await supabase.from("expenses").update({ status: "approved", approved_by: user?.id, updated_at: new Date().toISOString() }).eq("id", expense.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Couldn't approve expense", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Expense approved" });
    load();
  };

  const closePeriod = async () => {
    const now = new Date();
    setClosingPeriod(true);
    const { error } = await supabase.rpc("close_fiscal_period", { p_year: now.getFullYear(), p_month: now.getMonth() + 1, p_lock: false });
    setClosingPeriod(false);
    if (error) {
      toast({ title: "Couldn't close period", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Period closed", description: "New journal entries dated inside it are now blocked." });
    load();
  };

  const pendingExpenses = useMemo(() => expenses.filter((e) => e.status === "pending"), [expenses]);

  const arInputs = useMemo(() => invoices.map((i) => ({ amount: i.total_amount ?? i.amount, due_date: i.due_date, status: i.status, customer_name: i.customer_name ?? i.client_name, invoice_number: i.invoice_number, id: i.id, currency: normalizeCurrency(i.currency) })), [invoices]);
  const apInputs = useMemo(() => bills.map((b) => ({ amount: b.total_amount ?? b.amount, due_date: b.due_date, status: b.status, vendor: b.customer_name ?? b.vendor, invoice_number: b.invoice_number, id: b.id, currency: normalizeCurrency(b.currency) })), [bills]);
  const arByCcy = useMemo(() => summarizeByCurrency(arInputs), [arInputs]);
  const apByCcy = useMemo(() => summarizeByCurrency(apInputs), [apInputs]);
  const arCurrencies = useMemo(() => sortCurrencyKeys(Object.keys(arByCcy)), [arByCcy]);
  const apCurrencies = useMemo(() => sortCurrencyKeys(Object.keys(apByCcy)), [apByCcy]);
  const arSummary = useMemo(() => arByCcy[REPORTING_CURRENCY] ?? summarize([]), [arByCcy]);

  const topDebtors = useMemo(() => topOverdue(invoices.map((i) => ({ id: i.id, amount: i.total_amount ?? i.amount, due_date: i.due_date, status: i.status, customer_name: i.customer_name ?? i.client_name, invoice_number: i.invoice_number, currency: i.currency })), 5), [invoices]);

  const revenueByCurrency = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const prevMonthEnd = monthStart;
    const result: Record<string, { mtd: number; ytd: number; prevMtd: number }> = {};
    for (const i of invoices) {
      const currency = normalizeCurrency(i.currency);
      if (!result[currency]) result[currency] = { mtd: 0, ytd: 0, prevMtd: 0 };
      const paidAt = i.paid_at ? new Date(i.paid_at).getTime() : null;
      if (i.status !== "paid" || !paidAt) continue;
      const amt = Number(i.total_amount ?? i.amount) || 0;
      if (paidAt >= monthStart) result[currency].mtd += amt;
      if (paidAt >= yearStart) result[currency].ytd += amt;
      if (paidAt >= prevMonthStart && paidAt < prevMonthEnd) result[currency].prevMtd += amt;
    }
    return result;
  }, [invoices]);

  const expenseStatsByCurrency = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const prevMonthEnd = monthStart;
    const result: Record<string, { mtd: number; ytd: number; prevMtd: number; pending: number }> = {};
    let totalPending = 0;
    for (const e of expenses) {
      const currency = normalizeCurrency(e.currency);
      if (!result[currency]) result[currency] = { mtd: 0, ytd: 0, prevMtd: 0, pending: 0 };
      if (e.status === "pending") totalPending += 1;
      if (e.status !== "approved" && e.status !== "paid") continue;
      const date = e.date ? new Date(e.date).getTime() : new Date(e.created_at ?? Date.now()).getTime();
      const amt = Number(e.amount) || 0;
      if (date >= monthStart) result[currency].mtd += amt;
      if (date >= yearStart) result[currency].ytd += amt;
      if (date >= prevMonthStart && date < prevMonthEnd) result[currency].prevMtd += amt;
    }
    return { byCurrency: result, totalPending };
  }, [expenses]);

  const revenue = revenueByCurrency[REPORTING_CURRENCY] ?? { mtd: 0, ytd: 0, prevMtd: 0 };
  const cashTotal = useMemo(() => cashByCurrency[REPORTING_CURRENCY] ?? 0, [cashByCurrency]);
  const netProfitYtd = revenue.ytd - (expenseStatsByCurrency.byCurrency[REPORTING_CURRENCY]?.ytd ?? 0);

  const allCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    Object.keys(cashByCurrency).forEach((c) => currencies.add(c));
    Object.keys(revenueByCurrency).forEach((c) => currencies.add(c));
    Object.keys(expenseStatsByCurrency.byCurrency).forEach((c) => currencies.add(c));
    Object.keys(arByCcy).forEach((c) => currencies.add(c));
    Object.keys(apByCcy).forEach((c) => currencies.add(c));
    return sortCurrencyKeys(Array.from(currencies));
  }, [cashByCurrency, revenueByCurrency, expenseStatsByCurrency, arByCcy, apByCcy]);

  const kpiNetProfitByCurrency = useMemo(() => {
    const out: Record<string, { mtd: number; prevMtd: number }> = {};
    for (const cur of allCurrencies) {
      const rev = revenueByCurrency[cur] ?? { mtd: 0, prevMtd: 0 };
      const exp = expenseStatsByCurrency.byCurrency[cur] ?? { mtd: 0, prevMtd: 0 };
      out[cur] = { mtd: rev.mtd - exp.mtd, prevMtd: rev.prevMtd - exp.prevMtd };
    }
    return out;
  }, [allCurrencies, revenueByCurrency, expenseStatsByCurrency]);

  const executiveKPIs = allCurrencies.flatMap((cur) => {
    const cash = cashByCurrency[cur] ?? 0;
    const rev = revenueByCurrency[cur] ?? { mtd: 0, prevMtd: 0 };
    const ar = (arByCcy[cur] ?? summarize([])).totalOutstanding;
    const ap = (apByCcy[cur] ?? summarize([])).totalOutstanding;
    const net = kpiNetProfitByCurrency[cur] ?? { mtd: 0, prevMtd: 0 };
    const isPrimary = cur === REPORTING_CURRENCY;
    const suffix = isPrimary ? "" : ` (${cur})`;
    const cards: { label: string; value: number; currency: string; icon: React.ElementType; delta?: number; href: string }[] = [];
    if (isPrimary || cash !== 0) cards.push({ label: `Available cash${suffix}`, value: cash, currency: cur, icon: Wallet, href: "/finance/banking/bank-accounts" });
    if (isPrimary || rev.mtd !== 0) cards.push({ label: `Revenue MTD${suffix}`, value: rev.mtd, currency: cur, icon: DollarSign, delta: pctDelta(rev.mtd, rev.prevMtd), href: "/finance/reports/profit-loss" });
    if (isPrimary || ar !== 0) cards.push({ label: `Receivables${suffix}`, value: ar, currency: cur, icon: CreditCard, href: "/finance/invoicing/customer-invoices" });
    if (isPrimary || net.mtd !== 0) cards.push({ label: `Operating result${suffix}`, value: net.mtd, currency: cur, icon: TrendingUp, delta: pctDelta(net.mtd, net.prevMtd), href: "/finance/reports/profit-loss" });
    if (isPrimary || ap !== 0) cards.push({ label: `Payables due${suffix}`, value: ap, currency: cur, icon: Building2, href: "/finance/invoicing/vendor-bills" });
    return cards;
  });

  const operatingTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const start = date.getTime();
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
      const rev = invoices.reduce((total, invoice) => {
        const postedAt = invoice.paid_at ?? invoice.issue_date ?? invoice.created_at;
        const time = postedAt ? new Date(postedAt).getTime() : 0;
        return normalizeCurrency(invoice.currency) === REPORTING_CURRENCY && invoice.status === "paid" && time >= start && time < end ? total + (Number(invoice.total_amount ?? invoice.amount) || 0) : total;
      }, 0);
      const expense = expenses.reduce((total, item) => {
        const postedAt = item.date ?? item.created_at;
        const time = postedAt ? new Date(postedAt).getTime() : 0;
        return normalizeCurrency(item.currency) === REPORTING_CURRENCY && (item.status === "approved" || item.status === "paid") && time >= start && time < end ? total + (Number(item.amount) || 0) : total;
      }, 0);
      return { label: date.toLocaleDateString("en-TZ", { month: "short" }), revenue: rev, expense, margin: rev - expense };
    });
  }, [invoices, expenses]);

  const REPORT_LINKS = [
    { label: "Profit & Loss", sub: "Income vs expenditure", href: "/finance/reports/profit-loss" },
    { label: "Balance Sheet", sub: "Assets, liabilities & equity", href: "/finance/reports/balance-sheet" },
    { label: "Cash Flow", sub: "Operating, investing, financing", href: "/finance/reports/cash-flow" },
    { label: "Aging Report", sub: "AR & AP aging buckets", href: "/finance/reports/aging-report" },
    { label: "Statement of Accounts", sub: "Per-customer running ledger", href: "/finance/reports/statement-of-accounts" },
    { label: "Trial Balance", sub: "GL debit / credit totals", href: "/finance/reports/trial-balance" },
    { label: "VAT / Tax Report", sub: "Statutory obligations", href: "/finance/reports/tax-reports" },
    { label: "Day-End Closings", sub: "Lock a month's postings", href: "/finance/accounting/day-end-closings" },
  ];

  const now = new Date();
  const periodStatus = currentPeriod?.status ?? "open";
  const blockingCount = draftEntries.length;
  const waitingCount = draftEntries.length + pendingExpenses.length;

  return (
    <IndustryRoleShell roleLabel="Accountant" pages={ACCOUNTANT_PAGES}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">
          {REPORTING_CURRENCY} YTD revenue {formatCurrencyShort(revenue.ytd, REPORTING_CURRENCY)} · YTD net {formatCurrencyShort(netProfitYtd, REPORTING_CURRENCY)} · Cash {formatCurrencyShort(cashTotal, REPORTING_CURRENCY)}
        </p>
        <div className="flex items-center gap-2">
          <IndustryButton variant="secondary" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </IndustryButton>
          <IndustryButton variant="primary" asChild className="gap-1.5">
            <Link href="/finance/invoicing/customer-invoices"><Plus className="size-4" /> New invoice</Link>
          </IndustryButton>
        </div>
      </div>

      {loading ? (
        <IndustryCard><p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-12">Loading financial data…</p></IndustryCard>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Waiting on you — approve/post queue, and period-close gate */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <IndustryCard>
              <div className="flex items-center justify-between">
                <IndustryCardKicker>Waiting on you ({waitingCount})</IndustryCardKicker>
              </div>
              {waitingCount === 0 ? (
                <p className="text-[12px] text-[var(--ci-text-tertiary)] py-2">Nothing needs a decision right now.</p>
              ) : (
                <div className="flex flex-col divide-y divide-[var(--ci-cell-divider)]">
                  {draftEntries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium truncate">{e.reference ?? `JE-${e.id.slice(0, 6)}`} <span className="text-[var(--ci-text-tertiary)]">— draft entry</span></p>
                        <p className="text-[11px] text-[var(--ci-text-tertiary)] truncate">{e.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="ci-mono text-[12px] font-bold">{fmt(sumDebits(e), e.currency ?? "TZS")}</span>
                        <IndustryButton variant="primary" disabled={busyId === e.id} onClick={() => postEntry(e)}>
                          {busyId === e.id ? "…" : "Approve & post"}
                        </IndustryButton>
                      </div>
                    </div>
                  ))}
                  {pendingExpenses.slice(0, 10).map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium truncate">{e.description ?? e.category} <span className="text-[var(--ci-text-tertiary)]">— expense</span></p>
                        <p className="text-[11px] text-[var(--ci-text-tertiary)] truncate capitalize">{e.category}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="ci-mono text-[12px] font-bold">{fmt(Number(e.amount) || 0, e.currency ?? "TZS")}</span>
                        <IndustryButton variant="primary" disabled={busyId === e.id} onClick={() => approveExpense(e)}>
                          {busyId === e.id ? "…" : "Approve"}
                        </IndustryButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </IndustryCard>

            <IndustryCard>
              <div className="flex items-center justify-between">
                <IndustryCardKicker><CalendarClock className="size-3 inline mr-1" />Period close — {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</IndustryCardKicker>
                <IndustryTag variant={periodStatus === "open" ? "warning" : "accent"}>{periodStatus === "locked" && <Lock className="size-2.5" />}{periodStatus}</IndustryTag>
              </div>
              {periodStatus === "open" ? (
                <>
                  <p className="text-[12px] text-[var(--ci-text-secondary)] py-1">
                    {blockingCount === 0 ? "No draft entries blocking a close." : `${blockingCount} draft journal entr${blockingCount === 1 ? "y" : "ies"} must be posted or voided before closing.`}
                  </p>
                  {canClosePeriod ? (
                    <IndustryButton variant={blockingCount === 0 ? "primary" : "secondary"} disabled={blockingCount > 0 || closingPeriod} onClick={closePeriod} className="w-fit gap-1.5">
                      <Lock className="size-3.5" /> {closingPeriod ? "Closing…" : "Close period"}
                    </IndustryButton>
                  ) : (
                    <p className="text-[11px] text-[var(--ci-text-tertiary)]">Only CEO/ADMIN can close a period.</p>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-[var(--ci-text-secondary)] py-1">This period is {periodStatus}. New entries dated inside it are blocked.</p>
              )}
              <Link href="/finance/accounting/day-end-closings" className="text-[11px] text-[var(--ci-accent)] hover:underline w-fit">Manage all periods →</Link>
            </IndustryCard>
          </div>

          {/* Operational attention rail */}
          {(arSummary.totalOverdue > 0 || unbilledTrips.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {arCurrencies.some((c) => arByCcy[c].totalOverdue > 0) && (
                <Link href="/finance/reports/aging-report">
                  <IndustryCard hover className="flex-row items-center gap-3">
                    <AlertTriangle className="size-4 text-[#8c1d18] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#8c1d18]">Overdue AR: {arCurrencies.filter((c) => arByCcy[c].totalOverdue > 0).map((c) => fmt(arByCcy[c].totalOverdue, c)).join(" · ")}</p>
                      <p className="text-[11px] text-[#8c1d18]">{Math.max(...arCurrencies.map((c) => arByCcy[c].worstDays), 0)} days worst-case</p>
                    </div>
                  </IndustryCard>
                </Link>
              )}
              {unbilledTrips.length > 0 && (
                <Link href="/trips">
                  <IndustryCard hover className="flex-row items-center gap-3">
                    <Sparkles className="size-4 text-[var(--ci-accent)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold">{unbilledTrips.length} unbilled deliveries</p>
                      <p className="text-[11px] text-[var(--ci-text-tertiary)]">Revenue waiting to be invoiced</p>
                    </div>
                  </IndustryCard>
                </Link>
              )}
            </div>
          )}

          {/* Executive KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {executiveKPIs.map((k) => <KPICard key={k.label} {...k} />)}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <IndustryCard className="xl:col-span-2">
              <div className="flex items-start justify-between">
                <IndustryCardKicker>Revenue & operating margin</IndustryCardKicker>
                <Link href="/finance/reports/profit-loss" className="text-[11px] text-[var(--ci-accent)] hover:underline flex items-center gap-0.5">Open P&L <ChevronRight className="size-3" /></Link>
              </div>
              <div className="h-[220px] pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={operatingTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--ci-divider)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--ci-text-tertiary)", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} width={55} tickFormatter={(value) => formatCurrencyShort(value, "").trim()} tick={{ fill: "var(--ci-text-tertiary)", fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => fmt(value, REPORTING_CURRENCY)} contentStyle={{ border: "1px solid var(--ci-divider)", fontSize: 12, borderRadius: 0 }} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--ci-accent)" strokeWidth={2} fill="var(--ci-accent)" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="margin" name="Operating margin" stroke="#2f7d4f" strokeWidth={2} fill="#2f7d4f" fillOpacity={0.08} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </IndustryCard>

            <IndustryCard>
              <div className="flex items-center justify-between">
                <IndustryCardKicker>Collections requiring action</IndustryCardKicker>
                <Link href="/finance/reports/aging-report" className="text-[11px] text-[var(--ci-accent)] hover:underline">All →</Link>
              </div>
              {topDebtors.length === 0 ? (
                <p className="text-[12px] text-[var(--ci-text-tertiary)] py-2">No overdue receivables. Collections are on track.</p>
              ) : (
                <div className="flex flex-col divide-y divide-[var(--ci-cell-divider)]">
                  {topDebtors.slice(0, 4).map((d: any) => (
                    <Link key={d.id} href="/finance/invoicing/customer-invoices" className="flex items-center justify-between gap-2 py-2 hover:bg-[var(--ci-row-hover)]">
                      <div className="min-w-0"><p className="text-[12px] font-medium truncate">{d.customer_name ?? "Unassigned customer"}</p><p className="text-[10px] text-[var(--ci-text-tertiary)]">{d.invoice_number} · {daysOverdue(d.due_date)}d overdue</p></div>
                      <p className="ci-mono text-[12px] font-bold text-[#8c1d18] shrink-0">{fmt(Number(d.amount) || 0, d.currency ?? REPORTING_CURRENCY)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </IndustryCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <IndustryCard>
              <div className="flex items-center justify-between">
                <IndustryCardKicker>AR aging — {arCurrencies.length === 0 ? "nothing outstanding" : arCurrencies.map((c) => fmt(arByCcy[c].totalOutstanding, c)).join(" · ")}</IndustryCardKicker>
                <Link href="/finance/reports/aging-report" className="text-[11px] text-[var(--ci-accent)] hover:underline">Full →</Link>
              </div>
              {arCurrencies.length === 0 ? <p className="text-[12px] text-[var(--ci-text-tertiary)] italic">No receivables.</p> : arCurrencies.map((cur) => {
                const s = arByCcy[cur];
                return (
                  <div key={`ar-${cur}`} className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-baseline justify-between"><span className="ci-lbl">{cur}</span><span className="ci-mono text-[12px] font-bold">{fmt(s.totalOutstanding, cur)} · {fmt(s.totalOverdue, cur)} overdue</span></div>
                    {AGING_BUCKETS.map((b) => {
                      const amt = s.totals[b.key];
                      const pct = s.totalOutstanding > 0 ? (amt / s.totalOutstanding) * 100 : 0;
                      return (
                        <div key={b.key} className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--ci-text-tertiary)] w-16 shrink-0">{b.label}</span>
                          <div className="flex-1 h-1 bg-[var(--ci-divider)]"><div className="h-full bg-[var(--ci-accent)]" style={{ width: `${pct}%` }} /></div>
                          <span className="ci-mono text-[10px] w-20 text-right shrink-0">{fmt(amt, cur)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </IndustryCard>

            <IndustryCard>
              <div className="flex items-center justify-between">
                <IndustryCardKicker>AP aging — {apCurrencies.length === 0 ? "nothing outstanding" : apCurrencies.map((c) => fmt(apByCcy[c].totalOutstanding, c)).join(" · ")}</IndustryCardKicker>
                <Link href="/finance/invoicing/vendor-bills" className="text-[11px] text-[var(--ci-accent)] hover:underline">Bills →</Link>
              </div>
              {apCurrencies.length === 0 ? <p className="text-[12px] text-[var(--ci-text-tertiary)] italic">No payables.</p> : apCurrencies.map((cur) => {
                const s = apByCcy[cur];
                return (
                  <div key={`ap-${cur}`} className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-baseline justify-between"><span className="ci-lbl">{cur}</span><span className="ci-mono text-[12px] font-bold">{fmt(s.totalOutstanding, cur)} · {fmt(s.totalOverdue, cur)} overdue</span></div>
                    {AGING_BUCKETS.map((b) => {
                      const amt = s.totals[b.key];
                      const pct = s.totalOutstanding > 0 ? (amt / s.totalOutstanding) * 100 : 0;
                      return (
                        <div key={b.key} className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--ci-text-tertiary)] w-16 shrink-0">{b.label}</span>
                          <div className="flex-1 h-1 bg-[var(--ci-divider)]"><div className="h-full bg-[var(--ci-accent)]" style={{ width: `${pct}%` }} /></div>
                          <span className="ci-mono text-[10px] w-20 text-right shrink-0">{fmt(amt, cur)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </IndustryCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <IndustryCard className="lg:col-span-2">
              <div className="flex items-center justify-between"><IndustryCardKicker>Top overdue customers</IndustryCardKicker><Link href="/finance/invoicing/customer-invoices" className="text-[11px] text-[var(--ci-accent)] hover:underline">All →</Link></div>
              {topDebtors.length === 0 ? <p className="text-[12px] text-[var(--ci-text-tertiary)] italic py-2">All caught up — no overdue receivables.</p> : (
                <div className="flex flex-col divide-y divide-[var(--ci-cell-divider)]">
                  {topDebtors.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0"><p className="text-[12px] font-medium truncate">{d.customer_name ?? "Unknown"}</p><p className="text-[10px] text-[var(--ci-text-tertiary)] ci-mono">{d.invoice_number}</p></div>
                      <div className="text-right shrink-0"><p className="ci-mono text-[12px] font-bold text-[#8c1d18]">{fmt(Number(d.amount) || 0, d.currency ?? "TZS")}</p><p className="text-[10px] text-[#8c1d18]">{daysOverdue(d.due_date)}d overdue</p></div>
                    </div>
                  ))}
                </div>
              )}
            </IndustryCard>

            <IndustryCard>
              <IndustryCardKicker>Cash by currency</IndustryCardKicker>
              {Object.keys(cashByCurrency).length === 0 ? <p className="text-[12px] text-[var(--ci-text-tertiary)] italic py-2">No bank accounts registered.</p> : (
                <div className="flex flex-col gap-1.5 mt-1">
                  {Object.entries(cashByCurrency).map(([cur, bal]) => (
                    <div key={cur} className="flex items-center justify-between border border-[var(--ci-divider)] px-[10px] py-[8px]">
                      <div className="flex items-center gap-2"><CircleDollarSign className="size-3.5 text-[var(--ci-text-tertiary)]" /><span className="ci-lbl">{cur}</span></div>
                      <span className="ci-mono text-[13px] font-bold">{fmt(bal, cur)}</span>
                    </div>
                  ))}
                </div>
              )}
            </IndustryCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <IndustryCard className="lg:col-span-2">
              <IndustryCardKicker>Quick actions</IndustryCardKicker>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {QUICK_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1.5 p-3 border border-[var(--ci-divider)] hover:border-[var(--ci-accent)] transition-colors text-center">
                    <l.icon className="size-4 text-[var(--ci-text-tertiary)]" />
                    <span className="text-[10px] font-semibold leading-tight">{l.label}</span>
                  </Link>
                ))}
              </div>
            </IndustryCard>

            <IndustryCard>
              <IndustryCardKicker>Financial reports</IndustryCardKicker>
              <div className="flex flex-col gap-1 mt-1">
                {REPORT_LINKS.map((r) => (
                  <Link key={r.href} href={r.href} className="flex items-center justify-between px-[10px] py-[8px] border-l-2 border-[var(--ci-accent)] bg-[color-mix(in_srgb,var(--ci-accent)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--ci-accent)_10%,transparent)] transition-colors">
                    <div><p className="text-[12px] font-semibold">{r.label}</p><p className="text-[10px] text-[var(--ci-text-tertiary)]">{r.sub}</p></div>
                    <ChevronRight className="size-3.5 text-[var(--ci-text-tertiary)] shrink-0" />
                  </Link>
                ))}
              </div>
            </IndustryCard>
          </div>

          <IndustryCard>
            <div className="flex items-center justify-between"><IndustryCardKicker>Recent journal entries</IndustryCardKicker><Link href="/finance/accounting/journal-entries" className="text-[11px] text-[var(--ci-accent)] hover:underline">All →</Link></div>
            {recentEntries.length === 0 ? <p className="text-[12px] text-[var(--ci-text-tertiary)] italic py-2">No journal entries yet.</p> : (
              <div className="flex flex-col divide-y divide-[var(--ci-cell-divider)]">
                {recentEntries.map((e: any, i: number) => (
                  <div key={e.id || i} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <IndustryTag variant={e.status === "posted" ? "accent" : "warning"} pulse={e.status !== "posted"}>{e.status}</IndustryTag>
                      <div className="min-w-0"><p className="text-[12px] font-medium truncate">{e.reference ?? `JE-${e.id?.slice(0, 6)}`}</p><p className="text-[10px] text-[var(--ci-text-tertiary)] truncate">{e.description}</p></div>
                    </div>
                    <div className="text-right shrink-0"><p className="ci-mono text-[12px] font-bold">{fmt(sumDebits(e), e.currency ?? "TZS")}</p><p className="text-[10px] text-[var(--ci-text-tertiary)]">{e.entry_date ?? e.created_at?.slice(0, 10)}</p></div>
                  </div>
                ))}
              </div>
            )}
          </IndustryCard>
        </div>
      )}
    </IndustryRoleShell>
  );
}
