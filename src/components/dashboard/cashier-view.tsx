"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RoleDashboard } from "./shared/role-dashboard";
import { EmptyState } from "@/components/shell";
import { formatCurrency } from "@/components/ui/currency-badge";
import { ArrowDownCircle, ArrowUpCircle, BookOpen, Receipt, Wallet } from "lucide-react";

/**
 * A Cashier's job is the petty cash box, full stop — they never needed the
 * fleet/AR/AP/revenue Executive dashboard they were falling through to
 * (the role switch in src/app/page.tsx had no CASHIER case, so it defaulted
 * to AdminDashboard). Scoped to exactly the two pages route-config.ts
 * actually grants a Cashier: Petty Cash and Journal Entries.
 */
export function CashierView() {
  const [rows, setRows] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [pettyCashCurrency, setPettyCashCurrency] = useState("TZS");

  const load = async () => {
    const [{ data: txns }, { data: setting }] = await Promise.all([
      supabase
        .from("petty_cash_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("petty_cash_settings")
        .select("accounts:account_code(currency)")
        .eq("id", true)
        .maybeSingle(),
    ]);
    const list = txns ?? [];
    setRows(list);
    setBalance(list[0]?.running_balance ?? 0);
    setPettyCashCurrency((setting as any)?.accounts?.currency ?? "TZS");
  };

  useEffect(() => { load(); }, []);

  const todayTotals = useMemo(() => {
    const today = new Date().toDateString();
    const todays = rows.filter((r) => new Date(r.transaction_date).toDateString() === today);
    const paidOut = todays.filter((r) => r.type === "debit").reduce((s, r) => s + Number(r.amount || 0), 0);
    const topUps = todays.filter((r) => r.type === "credit").reduce((s, r) => s + Number(r.amount || 0), 0);
    return { paidOut, topUps, count: todays.length };
  }, [rows]);

  return (
    <RoleDashboard
      eyebrow="Cashier Console"
      title="Welcome"
      subtitle={`${formatCurrency(balance, pettyCashCurrency)} in the cash box · ${todayTotals.count} entries today`}
      onRefresh={load}
      storageKey="cashier-dash"
      kpis={[
        { label: `Cash box balance`, value: formatCurrency(balance, pettyCashCurrency), icon: Wallet, accent: "bg-success/10 text-success", href: "/finance/petty-cash" },
        { label: "Paid out today", value: formatCurrency(todayTotals.paidOut, pettyCashCurrency), icon: ArrowUpCircle, accent: "bg-destructive/10 text-destructive", href: "/finance/petty-cash" },
        { label: "Topped up today", value: formatCurrency(todayTotals.topUps, pettyCashCurrency), icon: ArrowDownCircle, accent: "bg-primary/10 text-primary", href: "/finance/petty-cash" },
      ]}
      sections={[
        {
          title: "Recent petty cash entries",
          subtitle: "Last 10 transactions",
          href: "/finance/petty-cash",
          padded: false,
          colSpan: 3,
          content: rows.length === 0 ? (
            <EmptyState icon={Receipt} title="No entries yet" description="Record your first petty cash transaction." />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${r.type === "debit" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {r.type === "debit" ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{r.description ?? "Petty cash entry"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.transaction_number} · {new Date(r.transaction_date).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-sm font-black ${r.type === "debit" ? "text-destructive" : "text-success"}`}>
                    {r.type === "debit" ? "-" : "+"}{formatCurrency(Number(r.amount || 0), pettyCashCurrency)}
                  </span>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
      quickActions={[
        { href: "/finance/petty-cash", label: "Petty Cash", icon: Wallet, tone: "bg-success/10 text-success" },
        { href: "/finance/accounting/journal-entries", label: "Journal Entries", icon: BookOpen, tone: "bg-primary/10 text-primary" },
      ]}
    />
  );
}

export default CashierView;
