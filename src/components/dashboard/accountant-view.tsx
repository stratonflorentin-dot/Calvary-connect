"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RoleDashboard } from "./shared/role-dashboard";
import { EmptyState } from "@/components/shell";
import { useCurrency } from "@/hooks/use-currency";
import { normalizeCurrency, sortCurrencyKeys } from "@/lib/finance/multi-currency";
import { daysOverdue, isOpenForAging, summarize, summarizeByCurrency } from "@/lib/finance/aging";
import {
  BookOpen,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Landmark,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Always show these even when the balance/outstanding total is zero, so the
// accountant dashboard consistently surfaces both operating currencies.
const PINNED_CURRENCIES = ["TZS", "USD"];

export function AccountantView() {
  const { format } = useCurrency();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const load = async () => {
    const [i, e, b] = await Promise.all([
      supabase.from("invoices").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("bank_accounts").select("*"),
    ]);
    setInvoices(i.data ?? []);
    setExpenses(e.data ?? []);
    setBanks(b.data ?? []);
  };

  useEffect(() => { load(); }, []);

  // Cash, receivables and payables are kept per-currency — never summed
  // across currencies (see memory: multi-currency).
  const cashByCurrency = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of banks) {
      const cur = normalizeCurrency(a.currency);
      out[cur] = (out[cur] || 0) + Number(a.current_balance || 0);
    }
    return out;
  }, [banks]);

  const arByCcy = useMemo(() => summarizeByCurrency(
    invoices
      .filter((i) => (i.type ?? "receivable") === "receivable" && isOpenForAging(i.status))
      .map((i) => ({ amount: Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0), due_date: i.due_date, status: i.status, currency: i.currency })),
  ), [invoices]);

  const apByCcy = useMemo(() => summarizeByCurrency(
    invoices
      .filter((i) => i.type === "payable" && isOpenForAging(i.status))
      .map((i) => ({ amount: Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0), due_date: i.due_date, status: i.status, currency: i.currency })),
  ), [invoices]);

  // Recognized (approved/paid) expenses, kept per-currency like cash/AR/AP.
  const expensesByCurrency = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of expenses) {
      if (e.status !== "approved" && e.status !== "paid") continue;
      const cur = normalizeCurrency(e.currency);
      out[cur] = (out[cur] || 0) + Number(e.amount || 0);
    }
    return out;
  }, [expenses]);

  const currencies = useMemo(() => {
    const set = new Set<string>(PINNED_CURRENCIES);
    Object.keys(cashByCurrency).forEach((c) => set.add(c));
    Object.keys(arByCcy).forEach((c) => set.add(c));
    Object.keys(apByCcy).forEach((c) => set.add(c));
    Object.keys(expensesByCurrency).forEach((c) => set.add(c));
    return sortCurrencyKeys(Array.from(set));
  }, [cashByCurrency, arByCcy, apByCcy, expensesByCurrency]);

  const stats = useMemo(() => {
    const pendingExpenses = expenses.filter((e) => e.status === "pending").length;
    const arOverdue = invoices.filter((i) => (i.type ?? "receivable") === "receivable" && isOpenForAging(i.status) && daysOverdue(i.due_date) > 0).length;
    return { pendingExpenses, arOverdue };
  }, [invoices, expenses]);

  const recentPending = useMemo(() => expenses.filter((e) => e.status === "pending").slice(0, 5), [expenses]);

  const apTotalLabel = useMemo(
    () => currencies
      .map((c) => ({ c, v: apByCcy[c]?.totalOutstanding ?? 0 }))
      .filter(({ v }) => v > 0)
      .map(({ c, v }) => format(v, c))
      .join(" + ") || format(0, "TZS"),
    [currencies, apByCcy, format],
  );

  const currencyKpis = currencies.flatMap((cur) => {
    const cash = cashByCurrency[cur];
    const ar = arByCcy[cur] ?? summarize([]);
    const ap = apByCcy[cur] ?? summarize([]);
    const expensesTotal = expensesByCurrency[cur];
    const kpis: { label: string; value: string; icon: any; accent: string; href: string }[] = [];
    if (cash !== undefined || PINNED_CURRENCIES.includes(cur)) {
      kpis.push({ label: `Cash (${cur})`, value: format(cash ?? 0, cur), icon: Wallet, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]", href: "/finance/banking/bank-accounts" });
    }
    kpis.push({ label: `Receivables (${cur})`, value: format(ar.totalOutstanding, cur), icon: CreditCard, accent: "bg-primary/10 text-primary", href: "/finance/invoicing/customer-invoices" });
    kpis.push({ label: `Payables (${cur})`, value: format(ap.totalOutstanding, cur), icon: Building2, accent: "bg-orange-100 text-orange-700", href: "/finance/invoicing/vendor-bills" });
    if (expensesTotal !== undefined || PINNED_CURRENCIES.includes(cur)) {
      kpis.push({ label: `Expenses (${cur})`, value: format(expensesTotal ?? 0, cur), icon: Receipt, accent: "bg-red-100 text-red-700", href: "/finance/reports/expense-analysis" });
    }
    return kpis;
  });

  return (
    <RoleDashboard
      eyebrow="Accountant Console"
      title="Welcome"
      subtitle={`${stats.pendingExpenses} expenses to review · ${stats.arOverdue} overdue AR · ${apTotalLabel} owed to vendors`}
      onRefresh={load}
      storageKey="accountant-dash"
      kpis={[
        ...currencyKpis,
        { label: "Overdue AR", value: stats.arOverdue, icon: TrendingDown, accent: "bg-red-100 text-red-700", href: "/finance/reports/aging-report" },
      ]}
      sections={[
        {
          title: "Pending expense approvals",
          subtitle: `${stats.pendingExpenses} awaiting your decision`,
          href: "/approvals",
          padded: false,
          colSpan: 2,
          content: recentPending.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Inbox zero" description="No pending expenses." />
          ) : (
            <ul className="divide-y divide-border">
              {recentPending.map((e) => (
                <li key={e.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{e.description ?? "Expense"}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.type ?? "general"} · {new Date(e.created_at ?? e.date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-black text-foreground">{format(Number(e.amount || 0), e.currency ?? "TZS")}</span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          title: "Reports at a glance",
          subtitle: "Jump to the numbers",
          content: (
            <div className="grid grid-cols-1 gap-2">
              {[
                { href: "/finance/reports/profit-loss", label: "P&L", icon: TrendingUp },
                { href: "/finance/reports/trial-balance", label: "Trial Balance", icon: Calculator },
                { href: "/finance/reports/aging-report", label: "Aging Report", icon: ClipboardList },
                { href: "/finance/accounting/journal-entries", label: "Journal Entries", icon: BookOpen },
                { href: "/finance/banking/bank-reconciliation", label: "Bank Reconciliation", icon: Landmark },
                { href: "/finance/accounting/fx-rates", label: "FX Rates", icon: Sparkles },
              ].map((l) => {
                const Icon = l.icon;
                return (
                  <Link key={l.href} href={l.href} className="flex items-center justify-between rounded-xl border border-border p-3 hover:border-primary/30 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold">{l.label}</span>
                    </div>
                    <span className="text-muted-foreground">→</span>
                  </Link>
                );
              })}
            </div>
          ),
        },
      ]}
      quickActions={[
        { href: "/approvals", label: "Approvals", icon: ClipboardList, tone: "bg-fuchsia-100 text-fuchsia-700" },
        { href: "/finance/invoicing/customer-invoices", label: "AR Invoices", icon: CreditCard, tone: "bg-primary/10 text-primary" },
        { href: "/finance/invoicing/vendor-bills", label: "Vendor Bills", icon: Building2, tone: "bg-orange-100 text-orange-700" },
        { href: "/finance/accounting/journal-entries", label: "Journal", icon: BookOpen, tone: "bg-violet-100 text-violet-700" },
        { href: "/expenses", label: "Expenses", icon: Receipt, tone: "bg-red-100 text-red-700" },
        { href: "/finance", label: "Finance", icon: Wallet, tone: "bg-emerald-100 text-emerald-700" },
      ]}
    />
  );
}

export default AccountantView;
