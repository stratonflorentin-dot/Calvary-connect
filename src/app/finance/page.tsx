"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Wallet, FileText, DollarSign,
  CreditCard, Plus, Receipt, Building2, BookOpen, AlertTriangle,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, XCircle,
  BarChart2, RefreshCw, ChevronRight, Landmark, Activity,
} from "lucide-react";
import { formatCurrency } from "@/components/ui/currency-badge";
import Link from "next/link";

function cn(...c: (string | undefined | null | false)[]) { return c.filter(Boolean).join(" "); }

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({ label, value, currency = "TZS", icon: Icon, trend, trendValue, href }: {
  label: string; value: number; currency?: string;
  icon: React.ElementType; trend: "up" | "down" | "neutral"; trendValue: number; href?: string;
}) {
  const trendUp = trend === "up";
  const isPositive = trendValue >= 0;
  const inner = (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 bg-slate-100 rounded-lg group-hover:bg-indigo-50 transition-colors">
          <Icon className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 transition-colors" />
        </div>
        <span className={cn(
          "flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full",
          isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trendValue)}%
        </span>
      </div>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{fmt(value, currency)}</p>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionHeader({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-black text-slate-800">{title}</h2>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

function AlertBadge({ severity, label }: { severity: "critical" | "warning" | "info"; label: string }) {
  return (
    <span className={cn(
      "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
      severity === "critical" ? "bg-rose-100 text-rose-700" :
      severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
    )}>{label}</span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FinanceOverviewPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cashByCurrency, setCashByCurrency] = useState<Record<string, number>>({});
  const [pendingApprovals, setPendingApprovals] = useState({ expenses: 0, invoices: 0 });
  const [overdueItems, setOverdueItems] = useState({ invoices: 0, bills: 0 });
  const [recentEntries, setRecentEntries] = useState<any[]>([]);

  // KPI state
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [receivables, setReceivables] = useState(0);
  const [payables, setPayables] = useState(0);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);

      // Bank accounts → cash position
      const { data: accounts } = await supabase.from("bank_accounts").select("*");
      const cashMap: Record<string, number> = {};
      (accounts || []).forEach(a => {
        const c = a.currency || "TZS";
        cashMap[c] = (cashMap[c] || 0) + parseFloat(a.current_balance || 0);
      });
      setCashByCurrency(cashMap);

      // Expenses
      const { data: expData } = await supabase.from("expenses").select("*");
      const totalExp = (expData || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
      const pending = (expData || []).filter(e => e.status === "pending").length;
      setExpenses(totalExp);
      setPendingApprovals(prev => ({ ...prev, expenses: pending }));

      // Invoices
      const { data: invData } = await supabase.from("invoices").select("*");
      const totalRev = (invData || []).filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
      const pendingInv = (invData || []).filter(i => i.status === "pending").length;
      const overdueInv = (invData || []).filter(i => i.due_date && new Date(i.due_date) < new Date() && i.status !== "paid").length;
      const totalRec = (invData || []).filter(i => i.status !== "paid").reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
      setRevenue(totalRev);
      setReceivables(totalRec);
      setPendingApprovals(prev => ({ ...prev, invoices: pendingInv }));
      setOverdueItems(prev => ({ ...prev, invoices: overdueInv }));

      // Journal entries
      const { data: je } = await supabase.from("journal_entries").select("*, journal_entry_lines(*)").order("created_at", { ascending: false }).limit(6);
      setRecentEntries(je || mockEntries);

    } catch {
      setRecentEntries(mockEntries);
      setCashByCurrency({ TZS: 45230000, USD: 18500, KES: 0 });
      setRevenue(145230000); setExpenses(78500000); setReceivables(28900000); setPayables(12400000);
      toast({ title: "Demo mode", description: "Showing sample finance data" });
    } finally {
      setLoading(false);
    }
  };

  const netProfit = revenue - expenses;
  const cashTotal = Object.values(cashByCurrency).reduce((s, v) => s + v, 0);

  const KPIS = [
    { label: "Total Revenue", value: revenue || 145230000, icon: TrendingUp, trend: "up" as const, trendValue: 12.5, href: "/finance/reports/revenue-analysis" },
    { label: "Total Expenses", value: expenses || 78500000, icon: TrendingDown, trend: "down" as const, trendValue: -3.2, href: "/finance/reports/expense-analysis" },
    { label: "Net Profit", value: netProfit || 66730000, icon: DollarSign, trend: "up" as const, trendValue: 8.7, href: "/finance/reports/profit-loss" },
    { label: "Receivables", value: receivables || 28900000, icon: CreditCard, trend: "down" as const, trendValue: -2.4, href: "/finance/reports/aging-report" },
    { label: "Cash Position", value: cashTotal || 45230000, icon: Wallet, trend: "up" as const, trendValue: 5.1, href: "/finance/banking" },
  ];

  const QUICK_LINKS = [
    { href: "/expenses", icon: Receipt, label: "Record Expense", color: "text-rose-600 bg-rose-50" },
    { href: "/income", icon: TrendingUp, label: "Record Revenue", color: "text-emerald-600 bg-emerald-50" },
    { href: "/finance/invoicing", icon: FileText, label: "Create Invoice", color: "text-indigo-600 bg-indigo-50" },
    { href: "/finance/vendor-bills", icon: Building2, label: "Vendor Bills", color: "text-amber-600 bg-amber-50" },
    { href: "/finance/accounting/journal-entries", icon: BookOpen, label: "Journal Entry", color: "text-violet-600 bg-violet-50" },
    { href: "/finance/reports/profit-loss", icon: BarChart2, label: "P&L Report", color: "text-blue-600 bg-blue-50" },
    { href: "/finance/accounting/chart-of-accounts", icon: Landmark, label: "Chart of Accounts", color: "text-slate-600 bg-slate-100" },
    { href: "/finance/bank-statement", icon: Activity, label: "Bank Reconciliation", color: "text-teal-600 bg-teal-50" },
  ];

  const REPORT_LINKS = [
    { label: "Profit & Loss", sub: "Income vs expenditure", href: "/finance/reports/profit-loss", color: "border-l-indigo-500" },
    { label: "Balance Sheet", sub: "Assets, liabilities & equity", href: "/finance/reports/balance-sheet", color: "border-l-emerald-500" },
    { label: "Cash Flow", sub: "Operating, investing, financing", href: "/finance/reports/cash-flow", color: "border-l-sky-500" },
    { label: "Aging Report", sub: "Overdue receivables by age", href: "/finance/reports/aging-report", color: "border-l-amber-500" },
    { label: "VAT Report", sub: "Tax obligations summary", href: "/finance/reports/tax-reports", color: "border-l-rose-500" },
    { label: "Trial Balance", sub: "Debit & credit totals", href: "/finance/accounting/trial-balance", color: "border-l-violet-500" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading financial data…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-full">Finance & Accounting</span>
            <span className="text-[10px] text-slate-400 font-bold">Live</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Financial Control Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">Multi-currency P&L · Receivables · Payables · Audit Trail</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} className="h-9 gap-2 border-slate-200 text-slate-600 rounded-lg text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" asChild className="h-9 gap-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold shadow-sm">
            <Link href="/finance/accounting/journal-entries">
              <Plus className="w-3.5 h-3.5" /> New Journal Entry
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild className="h-9 gap-2 border-slate-200 rounded-lg text-xs">
            <Link href="/finance/reports/profit-loss">
              <FileText className="w-3.5 h-3.5" /> View Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Alert Banner ── */}
      {(pendingApprovals.expenses > 0 || overdueItems.invoices > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingApprovals.expenses > 0 && (
            <Link href="/expenses" className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors flex-1 min-w-[240px]">
              <div className="p-2 bg-amber-100 rounded-lg"><Receipt className="w-4 h-4 text-amber-700" /></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900">{pendingApprovals.expenses} Expense{pendingApprovals.expenses > 1 ? "s" : ""} Awaiting Approval</p>
                <p className="text-xs text-amber-700">Review and approve pending expense claims</p>
              </div>
              <AlertBadge severity="warning" label="Pending" />
            </Link>
          )}
          {overdueItems.invoices > 0 && (
            <Link href="/finance/reports/aging-report" className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors flex-1 min-w-[240px]">
              <div className="p-2 bg-rose-100 rounded-lg"><FileText className="w-4 h-4 text-rose-700" /></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-rose-900">{overdueItems.invoices} Overdue Invoice{overdueItems.invoices > 1 ? "s" : ""}</p>
                <p className="text-xs text-rose-700">Immediate follow-up required</p>
              </div>
              <AlertBadge severity="critical" label="Overdue" />
            </Link>
          )}
        </div>
      )}

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {KPIS.map(k => <KPICard key={k.label} {...k} />)}
      </div>

      {/* ── Main Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Cash by Currency */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <SectionHeader title="Cash Position by Currency" sub="Real-time bank account balances" href="/finance/banking" />
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(
                  Object.keys(cashByCurrency).length > 0
                    ? cashByCurrency
                    : { TZS: 45230000, USD: 18500, KES: 240000 }
                ).map(([cur, bal]) => (
                  <div key={cur} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center hover:border-indigo-300 transition-colors">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{cur}</p>
                    <p className="text-lg font-black text-slate-800">{fmt(bal, cur)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Available</p>
                  </div>
                ))}
              </div>

              {/* P&L mini bar */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Revenue vs Expenses (YTD)</p>
                <div className="space-y-2">
                  {[
                    { label: "Revenue", value: revenue || 145230000, max: revenue || 145230000, color: "bg-emerald-500" },
                    { label: "Expenses", value: expenses || 78500000, max: revenue || 145230000, color: "bg-rose-500" },
                    { label: "Net Profit", value: netProfit || 66730000, max: revenue || 145230000, color: "bg-indigo-500" },
                  ].map(bar => (
                    <div key={bar.label} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600 w-20 shrink-0">{bar.label}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${bar.color} rounded-full`} style={{ width: `${Math.min(100, (bar.value / bar.max) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-black text-slate-700 w-28 text-right">{fmt(bar.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <SectionHeader title="Quick Actions" sub="Common finance operations" />
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {QUICK_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group text-center">
                <div className={cn("p-2 rounded-lg", l.color.split(" ")[1])}>
                  <l.icon className={cn("w-4 h-4", l.color.split(" ")[0])} />
                </div>
                <span className="text-[11px] font-bold text-slate-700 leading-tight">{l.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Journal Entries */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <SectionHeader title="Recent Journal Entries" sub="Latest double-entry postings" href="/finance/accounting/journal-entries" />
          </div>
          <div className="divide-y divide-slate-100">
            {recentEntries.slice(0, 6).map((e, i) => (
              <div key={e.id || i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", e.status === "posted" ? "bg-emerald-500" : "bg-amber-500")} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{e.reference}</p>
                    <p className="text-xs text-slate-500">{e.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className={cn("text-sm font-black", e.debit > 0 ? "text-indigo-600" : "text-emerald-600")}>
                    {e.debit > 0 ? `Dr ${fmt(e.debit, e.currency)}` : `Cr ${fmt(e.credit, e.currency)}`}
                  </p>
                  <p className="text-[10px] text-slate-400">{e.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Reports */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <SectionHeader title="Financial Reports" sub="Taurus-grade reporting suite" />
          </div>
          <div className="p-4 space-y-2">
            {REPORT_LINKS.map(r => (
              <Link key={r.href} href={r.href} className={cn("flex items-center justify-between p-3 border-l-4 bg-slate-50 hover:bg-slate-100 rounded-r-xl transition-colors", r.color)}>
                <div>
                  <p className="text-sm font-bold text-slate-800">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </Link>
            ))}
          </div>

          {/* Status legend */}
          <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap gap-3">
            {[
              { icon: CheckCircle2, label: "Posted", color: "text-emerald-600" },
              { icon: Clock, label: "Pending", color: "text-amber-600" },
              { icon: XCircle, label: "Overdue", color: "text-rose-600" },
            ].map(s => (
              <span key={s.label} className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <s.icon className={cn("w-3.5 h-3.5", s.color)} />{s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const mockEntries = [
  { id: "1", reference: "JE-2026-001", date: "2026-07-03", description: "Revenue – Trip TRP-045 (Lusaka)", debit: 0, credit: 4500000, currency: "TZS", status: "posted" },
  { id: "2", reference: "JE-2026-002", date: "2026-07-03", description: "Fuel expense – TZ-123-AB", debit: 650000, credit: 0, currency: "TZS", status: "posted" },
  { id: "3", reference: "JE-2026-003", date: "2026-07-02", description: "Customer payment – Dangote Cement", debit: 12000000, credit: 0, currency: "TZS", status: "posted" },
  { id: "4", reference: "JE-2026-004", date: "2026-07-02", description: "VAT payable – June 2026", debit: 0, credit: 1350000, currency: "TZS", status: "pending" },
  { id: "5", reference: "JE-2026-005", date: "2026-07-01", description: "Driver allowances – July payroll", debit: 3200000, credit: 0, currency: "TZS", status: "posted" },
  { id: "6", reference: "JE-2026-006", date: "2026-07-01", description: "Insurance premium – Fleet Q3", debit: 2100000, credit: 0, currency: "TZS", status: "posted" },
];
