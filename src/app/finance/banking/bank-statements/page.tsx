"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { formatCurrency } from "@/components/ui/currency-badge";
import { Landmark, Plus } from "lucide-react";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";

const ACCOUNTANT_PAGES = [
  { label: "Dashboard", href: "/finance" },
  { label: "Customer invoices", href: "/finance/invoicing/customer-invoices" },
  { label: "Expenses & fuel", href: "/accountant/expenses" },
  { label: "Reconciliation", href: "/finance/banking/bank-statements" },
];

const STATUS_VARIANT: Record<string, "accent" | "neutral"> = {
  draft: "neutral",
  posted: "accent",
};

interface BatchRow {
  id: string;
  reference: string;
  bank_account_id: string;
  period_from: string;
  period_to: string;
  status: string;
  open_line_count: number;
  difference: number;
  created_at: string;
  bank_account?: { account_name: string; bank_name: string; currency: string } | null;
  line_count?: number;
}

interface AccountOption {
  id: string;
  account_name: string;
  bank_name: string;
}

export default function BankStatementsListPage() {
  const { isLoading: roleLoading } = useRole();
  const router = useRouter();
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [batchRes, accRes] = await Promise.all([
      supabase
        .from("bank_statement_batches")
        .select("*, bank_account:bank_accounts(account_name, bank_name, currency)")
        .order("created_at", { ascending: false }),
      supabase.from("bank_accounts").select("id, account_name, bank_name").order("account_name"),
    ]);
    const batchList = (batchRes.data as unknown as BatchRow[]) ?? [];
    if (batchList.length > 0) {
      const { data: lineCounts } = await supabase
        .from("bank_statement_lines")
        .select("bank_statement_batch_id")
        .in("bank_statement_batch_id", batchList.map((b) => b.id));
      const counts = new Map<string, number>();
      for (const l of lineCounts ?? []) {
        counts.set(l.bank_statement_batch_id, (counts.get(l.bank_statement_batch_id) ?? 0) + 1);
      }
      batchList.forEach((b) => (b.line_count = counts.get(b.id) ?? 0));
    }
    setBatches(batchList);
    setAccounts((accRes.data as AccountOption[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () =>
      batches.filter(
        (b) => (accountFilter === "all" || b.bank_account_id === accountFilter) && (statusFilter === "all" || b.status === statusFilter),
      ),
    [batches, accountFilter, statusFilter],
  );

  if (roleLoading) return null;

  return (
    <IndustryRoleShell roleLabel="Accountant" pages={ACCOUNTANT_PAGES}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">Import bank statements and reconcile them against your books.</p>
        <IndustryButton variant="primary" asChild className="gap-1.5">
          <Link href="/finance/banking/bank-statements/new"><Plus className="size-4" /> New statement</Link>
        </IndustryButton>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="text-[13px] bg-transparent border border-[var(--ci-divider)] px-[9px] py-[6px] outline-none focus-visible:border-[var(--ci-accent)]">
          <option value="all">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.bank_name} · {a.account_name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-[13px] bg-transparent border border-[var(--ci-divider)] px-[9px] py-[6px] outline-none focus-visible:border-[var(--ci-accent)]">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
      </div>

      <IndustryCard>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Reference</IndustryTh>
              <IndustryTh>Bank account</IndustryTh>
              <IndustryTh>Period</IndustryTh>
              <IndustryTh align="right">Transactions</IndustryTh>
              <IndustryTh align="right">Difference</IndustryTh>
              <IndustryTh align="center">Status</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">Loading…</IndustryTd></tr>
            ) : visible.length === 0 ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">No statements yet. Import one to start reconciling.</IndustryTd></tr>
            ) : (
              visible.map((b) => {
                const meta = STATUS_VARIANT[b.status] ?? "neutral";
                const diff = Number(b.difference) || 0;
                return (
                  <IndustryTr key={b.id} onClick={() => router.push(`/finance/banking/bank-statements/${b.id}`)}>
                    <IndustryTd mono>{b.reference}</IndustryTd>
                    <IndustryTd>{b.bank_account?.bank_name} · {b.bank_account?.account_name}</IndustryTd>
                    <IndustryTd mono className="text-[12px]">{b.period_from} → {b.period_to}</IndustryTd>
                    <IndustryTd align="right" mono>{b.line_count ?? 0}</IndustryTd>
                    <IndustryTd align="right" mono className={diff !== 0 ? "text-[#8c1d18]" : ""}>{formatCurrency(diff, b.bank_account?.currency ?? "TZS")}</IndustryTd>
                    <IndustryTd align="center"><IndustryTag variant={meta}>{b.status}</IndustryTag></IndustryTd>
                  </IndustryTr>
                );
              })
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>
    </IndustryRoleShell>
  );
}
