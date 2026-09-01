"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/navigation/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityHeader, StatCard, DataTable, StatusBadge } from "@/components/shell";
import { CurrencyBadge, formatCurrency } from "@/components/ui/currency-badge";
import { TransferFundsDialog } from "@/components/financial/transfer-funds-dialog";
import { ChartOfAccountsService, COAAccount } from "@/services/chart-of-accounts-service";
import { formatDate } from "@/lib/utils";
import {
  ArrowRightLeft, BookOpen, ArrowUp, ArrowDown,
  Receipt, FileSpreadsheet, Wallet,
} from "lucide-react";

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  current_balance: number;
  currency: string;
  account_type: string;
  is_active: boolean;
  branch?: string;
  coa_account_code?: string;
  created_at?: string;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  currency?: string;
  transaction_type: string;
  journal_entry_id?: string | null;
}

interface StatementBatch {
  id: string;
  reference: string;
  period_from: string;
  period_to: string;
  status: string;
  open_line_count: number;
  difference: number;
  created_at: string;
}

interface Transfer {
  id: string;
  transfer_reference: string;
  transfer_date: string;
  from_bank_account_id: string;
  to_bank_account_id: string;
  source_amount: number;
  destination_amount: number;
  from_currency: string;
  to_currency: string;
  status: string;
  from_account?: { account_name: string } | null;
  to_account?: { account_name: string } | null;
}

export default function BankAccountDetailPage() {
  const { role } = useRole();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [allAccounts, setAllAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [statements, setStatements] = useState<StatementBatch[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [coaAccount, setCoaAccount] = useState<COAAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: accountData, error: accountError } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("id", accountId)
        .single();
      if (accountError) throw accountError;
      setAccount(accountData);

      const [txRes, stmtRes, transferRes, allAccRes] = await Promise.all([
        supabase.from("bank_transactions").select("*").eq("bank_account_id", accountId).order("transaction_date", { ascending: false }),
        supabase.from("bank_statement_batches").select("*").eq("bank_account_id", accountId).order("created_at", { ascending: false }),
        supabase
          .from("bank_transfers")
          .select("*, from_account:from_bank_account_id(account_name), to_account:to_bank_account_id(account_name)")
          .or(`from_bank_account_id.eq.${accountId},to_bank_account_id.eq.${accountId}`)
          .order("transfer_date", { ascending: false }),
        supabase.from("bank_accounts").select("*").order("account_name"),
      ]);

      setTransactions(txRes.data || []);
      setStatements(stmtRes.data || []);
      setTransfers((transferRes.data as unknown as Transfer[]) || []);
      setAllAccounts(allAccRes.data || []);

      if (accountData.coa_account_code) {
        const coa = await ChartOfAccountsService.getAccountByCode(accountData.coa_account_code);
        setCoaAccount(coa);
      } else {
        setCoaAccount(null);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load bank account", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const stats = useMemo(() => {
    const totalDebits = transactions.reduce((s, t) => s + (Number(t.debit) || 0), 0);
    const totalCredits = transactions.reduce((s, t) => s + (Number(t.credit) || 0), 0);
    const lastTransaction = transactions[0] ?? null;
    const openStatements = statements.filter((s) => s.status === "draft" && s.open_line_count > 0).length;
    return { totalDebits, totalCredits, lastTransaction, openStatements };
  }, [transactions, statements]);

  if (!role) return null;

  if (loading || !account) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role} />
        <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <EntityHeader
            crumbs={[
              { label: "Bank Accounts", href: "/finance/banking/bank-accounts" },
              { label: account.account_name },
            ]}
            eyebrow="Bank Account"
            title={account.account_name}
            subtitle={`${account.bank_name} · ${account.account_number}`}
            status={account.is_active ? "active" : "inactive"}
            badges={
              <>
                <CurrencyBadge currency={account.currency} />
                <Badge variant="outline" className="capitalize">{account.account_type.replace("_", " ")}</Badge>
                {coaAccount && (
                  <Link href="/finance/accounting/chart-of-accounts" className="inline-flex">
                    <Badge variant="outline" className="gap-1 hover:bg-muted">
                      <BookOpen className="size-3" /> {coaAccount.code} · {coaAccount.name}
                    </Badge>
                  </Link>
                )}
              </>
            }
            primaryMetricLabel="Current Balance"
            primaryMetricValue={formatCurrency(account.current_balance || 0, account.currency)}
            primaryMetricTone={account.current_balance >= 0 ? "default" : "danger"}
            metadata={[
              { label: "Total In", value: formatCurrency(stats.totalCredits, account.currency) },
              { label: "Total Out", value: formatCurrency(stats.totalDebits, account.currency) },
              { label: "Transactions", value: transactions.length },
            ]}
            secondaryActions={
              <Button asChild variant="outline" size="sm">
                <Link href="/finance/banking/bank-accounts">Manage Accounts</Link>
              </Button>
            }
            primaryAction={
              <Button size="sm" onClick={() => setTransferOpen(true)} className="gap-2" disabled={allAccounts.filter((a) => a.is_active).length < 2}>
                <ArrowRightLeft className="size-4" /> Transfer Funds
              </Button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Current Balance" value={formatCurrency(account.current_balance || 0, account.currency)} icon={Wallet} />
            <StatCard label="Total Deposits" value={formatCurrency(stats.totalCredits, account.currency)} icon={ArrowUp} accent="bg-success/10 text-success" />
            <StatCard label="Total Withdrawals" value={formatCurrency(stats.totalDebits, account.currency)} icon={ArrowDown} accent="bg-destructive/10 text-destructive" />
            <StatCard
              label="Open Statements"
              value={stats.openStatements}
              sub={stats.lastTransaction ? `Last activity ${formatDate(stats.lastTransaction.transaction_date)}` : "No activity yet"}
              icon={FileSpreadsheet}
            />
          </div>

          <Tabs defaultValue="transactions">
            <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-3">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="statements">Statements</TabsTrigger>
              <TabsTrigger value="transfers">Transfers</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions">
              <DataTable
                data={transactions}
                getRowId={(t) => t.id}
                emptyIcon={Receipt}
                emptyTitle="No transactions yet"
                emptyDescription="Deposits, withdrawals, and transfers posted to this account will appear here."
                initialSort={{ key: "date", dir: "desc" }}
                columns={[
                  { key: "date", header: "Date", accessor: (t) => <span className="text-xs text-muted-foreground">{formatDate(t.transaction_date)}</span>, sortValue: (t) => t.transaction_date },
                  { key: "type", header: "Type", accessor: (t) => <StatusBadge status={t.transaction_type} />, sortValue: (t) => t.transaction_type },
                  { key: "description", header: "Description", accessor: (t) => <span className="truncate">{t.description || "—"}</span> },
                  { key: "reference", header: "Reference", hideBelow: "lg", accessor: (t) => <span className="text-xs text-muted-foreground">{t.reference || "—"}</span> },
                  { key: "debit", header: "Debit", align: "right", accessor: (t) => t.debit > 0 ? <span className="text-destructive font-medium">{formatCurrency(t.debit, t.currency || account.currency)}</span> : "—", sortValue: (t) => Number(t.debit) || 0 },
                  { key: "credit", header: "Credit", align: "right", accessor: (t) => t.credit > 0 ? <span className="text-success font-medium">{formatCurrency(t.credit, t.currency || account.currency)}</span> : "—", sortValue: (t) => Number(t.credit) || 0 },
                ]}
              />
            </TabsContent>

            <TabsContent value="statements">
              <DataTable
                data={statements}
                getRowId={(s) => s.id}
                onRowClick={(s) => router.push(`/finance/banking/bank-statements/${s.id}`)}
                emptyIcon={FileSpreadsheet}
                emptyTitle="No statements yet"
                emptyDescription="Imported bank statements for this account will appear here."
                initialSort={{ key: "period", dir: "desc" }}
                columns={[
                  { key: "reference", header: "Reference", accessor: (s) => <span className="font-mono text-xs font-black text-foreground">{s.reference}</span> },
                  { key: "period", header: "Period", accessor: (s) => <span className="text-xs text-muted-foreground">{formatDate(s.period_from)} – {formatDate(s.period_to)}</span>, sortValue: (s) => s.period_from },
                  { key: "open", header: "Open Lines", align: "right", hideBelow: "md", accessor: (s) => s.open_line_count },
                  { key: "difference", header: "Difference", align: "right", hideBelow: "md", accessor: (s) => <span className={s.difference !== 0 ? "text-warning font-medium" : "text-muted-foreground"}>{formatCurrency(s.difference, account.currency)}</span> },
                  { key: "status", header: "Status", accessor: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
                ]}
              />
            </TabsContent>

            <TabsContent value="transfers">
              <DataTable
                data={transfers}
                getRowId={(t) => t.id}
                emptyIcon={ArrowRightLeft}
                emptyTitle="No transfers yet"
                emptyDescription="Fund transfers into or out of this account will appear here."
                initialSort={{ key: "date", dir: "desc" }}
                columns={[
                  { key: "date", header: "Date", accessor: (t) => <span className="text-xs text-muted-foreground">{formatDate(t.transfer_date)}</span>, sortValue: (t) => t.transfer_date },
                  { key: "reference", header: "Transfer ID", accessor: (t) => <span className="font-mono text-xs font-black text-foreground">{t.transfer_reference}</span> },
                  {
                    key: "direction", header: "Direction",
                    accessor: (t) => t.from_bank_account_id === accountId
                      ? <span className="inline-flex items-center gap-1 text-destructive text-xs font-bold"><ArrowUp className="size-3" /> To {t.to_account?.account_name ?? "—"}</span>
                      : <span className="inline-flex items-center gap-1 text-success text-xs font-bold"><ArrowDown className="size-3" /> From {t.from_account?.account_name ?? "—"}</span>,
                  },
                  {
                    key: "amount", header: "Amount", align: "right",
                    accessor: (t) => t.from_bank_account_id === accountId
                      ? formatCurrency(t.source_amount, t.from_currency)
                      : formatCurrency(t.destination_amount, t.to_currency),
                  },
                  { key: "status", header: "Status", accessor: (t) => <StatusBadge status={t.status} />, sortValue: (t) => t.status },
                ]}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <TransferFundsDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        accounts={allAccounts}
        defaultFromAccountId={accountId}
        onCompleted={load}
      />
    </div>
  );
}
