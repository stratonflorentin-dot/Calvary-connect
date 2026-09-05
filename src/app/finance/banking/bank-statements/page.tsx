"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRole } from "@/hooks/use-role";
import { formatCurrency } from "@/components/ui/currency-badge";
import { ArrowLeft, Landmark, Loader2, Plus } from "lucide-react";
import { EmptyState } from "@/components/shell";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  posted: { label: "Posted", variant: "default" },
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
  const { role, isLoading: roleLoading } = useRole();
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
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/finance" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Finance
          </Link>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" /> Bank Statements
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Import bank statements and reconcile them against your books</p>
        </div>
        <Button asChild size="sm" className="h-9 gap-2 bg-primary hover:bg-primary/90">
          <Link href="/finance/banking/bank-statements/new">
            <Plus className="w-3.5 h-3.5" /> New statement
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bank_name} · {a.account_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No statements yet"
            description="Import a bank statement to start reconciling."
            action={
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                <Link href="/finance/banking/bank-statements/new"><Plus className="w-4 h-4" /> New statement</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Bank account</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((b) => {
                  const meta = STATUS_BADGE[b.status] ?? { label: b.status, variant: "outline" as const };
                  return (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-muted/40" onClick={() => (window.location.href = `/finance/banking/bank-statements/${b.id}`)}>
                      <TableCell className="font-mono text-xs font-semibold">{b.reference}</TableCell>
                      <TableCell>{b.bank_account?.bank_name} · {b.bank_account?.account_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.period_from} → {b.period_to}</TableCell>
                      <TableCell className="text-right">{b.line_count ?? 0}</TableCell>
                      <TableCell className={`text-right font-mono ${Number(b.difference) !== 0 ? "text-destructive" : "text-success"}`}>
                        {formatCurrency(Number(b.difference) || 0, b.bank_account?.currency ?? "TZS")}
                      </TableCell>
                      <TableCell className="text-center"><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
