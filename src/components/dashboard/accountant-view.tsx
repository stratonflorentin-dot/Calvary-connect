"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RoleDashboard } from "./shared/role-dashboard";
import { EmptyState } from "@/components/shell";
import { useCurrency } from "@/hooks/use-currency";
import { REPORTING_CURRENCY, normalizeCurrency } from "@/lib/finance/multi-currency";
import { daysOverdue, isOpenForAging } from "@/lib/finance/aging";
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

  const stats = useMemo(() => {
    const cash = banks.filter((a) => normalizeCurrency(a.currency) === REPORTING_CURRENCY).reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const ar = invoices.filter((i) => (i.type ?? "receivable") === "receivable" && isOpenForAging(i.status)).reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0), 0);
    const ap = invoices.filter((i) => i.type === "payable" && isOpenForAging(i.status)).reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0), 0);
    const pendingExpenses = expenses.filter((e) => e.status === "pending").length;
    const arOverdue = invoices.filter((i) => (i.type ?? "receivable") === "receivable" && isOpenForAging(i.status) && daysOverdue(i.due_date) > 0).length;
    return { cash, ar, ap, pendingExpenses, arOverdue };
  }, [invoices, expenses, banks]);

  const recentPending = useMemo(() => expenses.filter((e) => e.status === "pending").slice(0, 5), [expenses]);

  return (
    <RoleDashboard
      eyebrow="Accountant Console"
      title="Welcome"
      subtitle={`${stats.pendingExpenses} expenses to review · ${stats.arOverdue} overdue AR · ${format(stats.ap)} owed to vendors`}
      onRefresh={load}
      storageKey="accountant-dash"
      kpis={[
        { label: `Cash (${REPORTING_CURRENCY})`, value: format(stats.cash), icon: Wallet, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]", href: "/finance/banking" },
        { label: "Receivables", value: format(stats.ar), icon: CreditCard, accent: "bg-primary/10 text-primary", href: "/finance/invoicing/customer-invoices" },
        { label: "Payables", value: format(stats.ap), icon: Building2, accent: "bg-orange-100 text-orange-700", href: "/finance/invoicing/vendor-bills" },
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
