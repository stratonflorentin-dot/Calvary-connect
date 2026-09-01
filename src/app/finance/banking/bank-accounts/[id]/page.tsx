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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityHeader, StatCard, DataTable, DataTableFilterSelect, StatusBadge } from "@/components/shell";
import { CurrencyBadge, formatCurrency } from "@/components/ui/currency-badge";
import { TransferFundsDialog } from "@/components/financial/transfer-funds-dialog";
import { ChartOfAccountsService, COAAccount } from "@/services/chart-of-accounts-service";
import { AuditTrailService } from "@/services/audit-trail-service";
import { useSupabase } from "@/components/supabase-provider";
import { findPaymentMatches, type MatchConfidence, type PaymentCandidate } from "@/lib/finance/reconciliation-matching";
import { formatDate, cn } from "@/lib/utils";
import {
  ArrowRightLeft, BookOpen, ArrowUp, ArrowDown,
  Receipt, FileSpreadsheet, Wallet, Scale, Link2, EyeOff, Undo2,
  ShieldCheck, Search, Loader2,
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

type MatchStatus = "unmatched" | "matched" | "confirmed" | "ignored" | "posted";

interface MatchRow {
  id: string;
  matched_entity_type: string;
  matched_entity_id: string;
  matched_amount: number;
}

interface ReconLine {
  id: string;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  debit_amount: number;
  credit_amount: number;
  match_status: MatchStatus;
  journal_entry_id: string | null;
  ignore_reason: string | null;
  bank_statement_batch_id: string;
  batch?: { reference: string; status: string } | null;
  matches: MatchRow[];
}

/** Same shape the Bank Statement detail page builds — an open book entry
 *  eligible to be reconciled against (payment / expense / journal line). */
interface BookEntry {
  id: string;
  kind: "invoice_payment" | "expense" | "journal_line";
  date: string;
  description: string;
  reference?: string | null;
  amount: number; // positive = money in, negative = money out
  reconciled: boolean;
  reference_id: string;
  paymentNumber?: string | null;
  invoiceNumber?: string | null;
  transactionReference?: string | null;
}

interface CoaOption {
  code: string;
  name: string;
}

interface MatchedPayment {
  paymentId: string;
  paymentNumber: string | null;
  customerName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
}

const MANAGE_ROLES = ["CEO", "ADMIN", "ACCOUNTANT"];
const UNIGNORE_ROLES = ["CEO", "ADMIN"];

const IGNORE_REASONS = [
  "Duplicate transaction",
  "Already recorded elsewhere",
  "Bank-only informational transaction",
  "Personal/non-business transaction",
  "Incorrect bank entry",
  "Other",
];

export default function BankAccountDetailPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const canManage = !!role && MANAGE_ROLES.includes(role);
  const canUnignore = !!role && UNIGNORE_ROLES.includes(role);

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [allAccounts, setAllAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [matchedPayments, setMatchedPayments] = useState<Map<string, MatchedPayment>>(new Map());
  const [statements, setStatements] = useState<StatementBatch[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [coaAccount, setCoaAccount] = useState<COAAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);

  // Reconciliation tab
  const [reconLines, setReconLines] = useState<ReconLine[]>([]);
  const [book, setBook] = useState<BookEntry[]>([]);
  const [reconCoaAccounts, setReconCoaAccounts] = useState<CoaOption[]>([]);
  const [reconStatusFilter, setReconStatusFilter] = useState("open");
  const [busy, setBusy] = useState(false);

  const [postLine, setPostLine] = useState<ReconLine | null>(null);
  const [postCoaCode, setPostCoaCode] = useState("");
  const [postCoaSearch, setPostCoaSearch] = useState("");
  const [postReference, setPostReference] = useState("");
  const [postDescription, setPostDescription] = useState("");

  const [reconcileLine, setReconcileLine] = useState<ReconLine | null>(null);
  const [reconcileSearch, setReconcileSearch] = useState("");

  const [unreconcileLine, setUnreconcileLine] = useState<ReconLine | null>(null);

  const [ignoreLine, setIgnoreLine] = useState<ReconLine | null>(null);
  const [ignoreReasonPreset, setIgnoreReasonPreset] = useState("");
  const [ignoreReasonExtra, setIgnoreReasonExtra] = useState("");

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

      const txList = (txRes.data as BankTransaction[]) || [];
      setTransactions(txList);

      // Payment → Invoice → Customer visibility for each bank transaction —
      // payments.bank_transaction_id (125_payment_bank_transaction_linking.sql)
      // is the authoritative link; no separate matching engine needed here.
      const txIds = txList.map((t) => t.id);
      if (txIds.length > 0) {
        const { data: payMatchData } = await supabase
          .from("payments")
          .select("id, payment_number, bank_transaction_id, counterparty_name, payment_allocations(invoice_id, invoices(invoice_number))")
          .in("bank_transaction_id", txIds);
        const map = new Map<string, MatchedPayment>();
        for (const p of payMatchData ?? []) {
          const allocations = ((p as any).payment_allocations ?? []) as { invoice_id: string; invoices: { invoice_number: string } | null }[];
          map.set(p.bank_transaction_id as string, {
            paymentId: p.id,
            paymentNumber: p.payment_number,
            customerName: p.counterparty_name,
            invoiceId: allocations[0]?.invoice_id ?? null,
            invoiceNumber: allocations[0]?.invoices?.invoice_number ?? null,
          });
        }
        setMatchedPayments(map);
      } else {
        setMatchedPayments(new Map());
      }

      const batches = (stmtRes.data as StatementBatch[]) || [];
      setStatements(batches);
      setTransfers((transferRes.data as unknown as Transfer[]) || []);
      setAllAccounts(allAccRes.data || []);

      if (accountData.coa_account_code) {
        const coa = await ChartOfAccountsService.getAccountByCode(accountData.coa_account_code);
        setCoaAccount(coa);
      } else {
        setCoaAccount(null);
      }

      // Reconciliation tab — every line across every statement batch for
      // this account (not just one batch), same match_status/RPC set the
      // Bank Statement detail page already uses (124_bank_statement_line_posting.sql).
      const batchIds = batches.map((b) => b.id);
      if (batchIds.length > 0) {
        const [lineRes, matchRes, payRes, expRes, jelRes, accountsRes] = await Promise.all([
          supabase
            .from("bank_statement_lines")
            .select("*, batch:bank_statement_batch_id(reference, status)")
            .in("bank_statement_batch_id", batchIds)
            .order("transaction_date", { ascending: false }),
          supabase.from("reconciliation_matches").select("*"),
          supabase
            .from("payments")
            .select("id, payment_number, amount, currency, direction, payment_date, counterparty_name, reference, transaction_reference, reconciled, status, payment_allocations(invoice_id, invoices(invoice_number))")
            .eq("status", "posted")
            .order("payment_date", { ascending: false })
            .limit(500),
          supabase
            .from("expenses")
            .select("id, description, amount, date, status, reconciled")
            .eq("status", "paid")
            .order("date", { ascending: false })
            .limit(500),
          supabase
            .from("journal_entry_lines")
            .select("id, account_code, account_name, debit_amount, credit_amount, memo:description, reconciled, journal_entries(id, entry_date, reference, description, status)")
            .order("id", { ascending: false })
            .limit(500),
          supabase
            .from("accounts")
            .select("code, name, category, is_active, is_postable, is_bank_account, currency")
            .eq("is_active", true)
            .eq("is_postable", true)
            .eq("currency", accountData.currency)
            .order("code"),
        ]);

        const lineIds = (lineRes.data ?? []).map((l: any) => l.id);
        const matchesByLine = new Map<string, MatchRow[]>();
        for (const m of matchRes.data ?? []) {
          if (!lineIds.includes(m.bank_statement_line_id)) continue;
          const list = matchesByLine.get(m.bank_statement_line_id) ?? [];
          list.push(m);
          matchesByLine.set(m.bank_statement_line_id, list);
        }
        setReconLines((lineRes.data ?? []).map((l: any) => ({ ...l, matches: matchesByLine.get(l.id) ?? [] })));

        const entries: BookEntry[] = [];
        for (const p of payRes.data ?? []) {
          const amt = Number(p.amount) || 0;
          if (amt <= 0) continue;
          const allocations = ((p as any).payment_allocations ?? []) as { invoice_id: string; invoices: { invoice_number: string } | null }[];
          const invoiceNumber = allocations[0]?.invoices?.invoice_number ?? null;
          entries.push({
            id: `pay-${p.id}`, kind: "invoice_payment",
            date: String(p.payment_date ?? "").slice(0, 10),
            description: `${p.counterparty_name ?? "Customer"} · ${invoiceNumber ?? p.reference ?? p.payment_number ?? ""}`,
            reference: invoiceNumber ?? p.reference,
            amount: p.direction === "out" ? -amt : amt,
            reconciled: Boolean(p.reconciled),
            reference_id: p.id,
            paymentNumber: p.payment_number,
            invoiceNumber,
            transactionReference: p.transaction_reference,
          });
        }
        for (const exp of expRes.data ?? []) {
          const amt = Number(exp.amount) || 0;
          if (amt <= 0) continue;
          entries.push({
            id: `exp-${exp.id}`, kind: "expense",
            date: String(exp.date ?? "").slice(0, 10),
            description: exp.description ?? "Expense",
            reference: null, amount: -amt,
            reconciled: Boolean(exp.reconciled),
            reference_id: exp.id,
          });
        }
        for (const l of jelRes.data ?? []) {
          const je = (l as any).journal_entries;
          if (je?.status && je.status !== "posted") continue;
          const debit = Number(l.debit_amount) || 0;
          const credit = Number(l.credit_amount) || 0;
          const net = debit - credit;
          if (net === 0) continue;
          entries.push({
            id: `jel-${l.id}`, kind: "journal_line",
            date: je?.entry_date ?? "",
            description: `${je?.reference ?? "JE"} · ${l.memo ?? l.account_name}`,
            reference: je?.reference, amount: net,
            reconciled: Boolean(l.reconciled),
            reference_id: l.id,
          });
        }
        setBook(entries);

        setReconCoaAccounts(
          (accountsRes.data ?? [])
            .filter((a: any) => !a.is_bank_account)
            .map((a: any) => ({ code: a.code, name: a.name })),
        );
      } else {
        setReconLines([]);
        setBook([]);
        setReconCoaAccounts([]);
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

  const lineNet = (l: ReconLine) => Number(l.credit_amount) - Number(l.debit_amount);

  // Same definition of "resolved" the Bank Statement detail page uses:
  // posted/confirmed/ignored lines are done; unmatched/matched are still open.
  const reconStats = useMemo(() => {
    const bookBalance = Number(account?.current_balance) || 0;
    // Most recently dated statement batch for this account stands in for
    // "the bank's own statement balance" — there is no separate
    // statement-balance field outside a batch's own closing_balance.
    const latestBatch = [...statements].sort((a, b) => (b.period_from ?? "").localeCompare(a.period_from ?? ""))[0] ?? null;
    const statementBalance = latestBatch ? Number((latestBatch as any).closing_balance ?? NaN) : null;

    const reconciledNet = reconLines
      .filter((l) => l.match_status === "confirmed" || l.match_status === "posted" || l.match_status === "ignored")
      .reduce((s, l) => s + lineNet(l), 0);
    const pendingNet = reconLines
      .filter((l) => l.match_status === "unmatched" || l.match_status === "matched")
      .reduce((s, l) => s + lineNet(l), 0);

    const pendingCount = reconLines.filter((l) => l.match_status === "unmatched" || l.match_status === "matched").length;
    const postedCount = reconLines.filter((l) => l.match_status === "posted").length;
    const reconciledCount = reconLines.filter((l) => l.match_status === "confirmed").length;
    const ignoredCount = reconLines.filter((l) => l.match_status === "ignored").length;

    return {
      bookBalance,
      statementBalance,
      difference: statementBalance !== null && !Number.isNaN(statementBalance) ? statementBalance - bookBalance : null,
      reconciledNet, pendingNet,
      pendingCount, postedCount, reconciledCount, ignoredCount,
    };
  }, [account, statements, reconLines]);

  const claimedBookIds = useMemo(() => new Set(book.filter((e) => e.reconciled).map((e) => e.id)), [book]);
  const openBook = useMemo(() => book.filter((e) => !claimedBookIds.has(e.id)), [book, claimedBookIds]);

  const filteredReconLines = useMemo(() => {
    if (reconStatusFilter === "all") return reconLines;
    if (reconStatusFilter === "open") return reconLines.filter((l) => l.match_status === "unmatched" || l.match_status === "matched");
    return reconLines.filter((l) => l.match_status === reconStatusFilter);
  }, [reconLines, reconStatusFilter]);

  const filteredCoaAccounts = useMemo(() => {
    const q = postCoaSearch.trim().toLowerCase();
    if (!q) return reconCoaAccounts;
    return reconCoaAccounts.filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [reconCoaAccounts, postCoaSearch]);

  interface RankedCandidate { entry: BookEntry; confidence: MatchConfidence; reason: string }

  const reconcileCandidates = useMemo((): RankedCandidate[] => {
    if (!reconcileLine || !account) return [];
    const net = lineNet(reconcileLine);
    const q = reconcileSearch.trim().toLowerCase();

    const paymentEntries = openBook.filter((e) => e.kind === "invoice_payment");
    const otherEntries = openBook.filter((e) => e.kind !== "invoice_payment" && (e.amount >= 0) === (net >= 0));

    const paymentCandidates: PaymentCandidate[] = paymentEntries.map((e) => ({
      id: e.reference_id,
      paymentNumber: e.paymentNumber ?? null,
      invoiceNumber: e.invoiceNumber ?? null,
      customerName: e.description.split(" · ")[0] ?? null,
      amount: e.amount,
      currency: account.currency,
      paymentDate: e.date,
      transactionReference: e.transactionReference ?? null,
      bankTransactionId: null,
      reconciled: e.reconciled,
    }));

    const paymentMatches = findPaymentMatches(
      {
        referenceNumber: reconcileLine.reference_number,
        description: reconcileLine.description,
        amount: net,
        date: reconcileLine.transaction_date,
        currency: account.currency,
      },
      paymentCandidates,
    );

    const paymentResults: RankedCandidate[] = paymentMatches
      .map((m) => {
        const entry = paymentEntries.find((e) => e.reference_id === m.candidate.id);
        return entry ? { entry, confidence: m.confidence, reason: m.reason } : null;
      })
      .filter((x): x is RankedCandidate => !!x);

    const otherResults: RankedCandidate[] = otherEntries.map((entry) => ({
      entry,
      confidence: (Math.abs(Math.abs(entry.amount) - Math.abs(net)) < 0.5 ? "likely" : "possible") as MatchConfidence,
      reason: Math.abs(Math.abs(entry.amount) - Math.abs(net)) < 0.5 ? "Amount and date match" : "Amount matches",
    }));

    let all = [...paymentResults, ...otherResults];
    if (q) {
      all = all.filter(({ entry }) => entry.description.toLowerCase().includes(q) || (entry.reference ?? "").toLowerCase().includes(q));
    }
    const rank: Record<MatchConfidence, number> = { exact: 0, high: 1, likely: 2, possible: 3 };
    return all.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
  }, [reconcileLine, openBook, reconcileSearch, account]);

  // ── POST ───────────────────────────────────────────────────────────────
  const openPost = (line: ReconLine) => {
    setPostLine(line);
    setPostCoaCode("");
    setPostCoaSearch("");
    setPostReference(line.reference_number ?? "");
    setPostDescription(line.description ?? "");
  };

  const submitPost = async () => {
    if (!postLine) return;
    if (!postCoaCode) {
      toast({ title: "Please select a COA account.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("post_bank_statement_line", {
        p_line_id: postLine.id,
        p_coa_account_code: postCoaCode,
        p_reference: postReference || null,
        p_description: postDescription || null,
      });
      if (error) throw error;
      const coa = reconCoaAccounts.find((a) => a.code === postCoaCode);
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "create",
        entity_type: "bank_statement_batch", entity_id: postLine.bank_statement_batch_id,
        description: `Posted line "${postLine.description}" to ${postCoaCode}${coa ? ` (${coa.name})` : ""} — JE ${(data as any)?.journal_entry_id ?? ""}`,
      });
      toast({ variant: "success", title: "Transaction posted", description: "Journal entry created." });
      setPostLine(null);
      load();
    } catch (err: any) {
      toast({ title: "Couldn't post", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ── RECONCILE ──────────────────────────────────────────────────────────
  const doReconcile = async (candidate: RankedCandidate) => {
    if (!reconcileLine) return;
    const entry = candidate.entry;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("reconcile_bank_statement_line", {
        p_line_id: reconcileLine.id,
        p_entity_type: entry.kind,
        p_entity_id: entry.reference_id,
        p_entity_amount: entry.amount,
      });
      if (error) throw error;
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "reconcile",
        entity_type: "bank_statement_batch", entity_id: reconcileLine.bank_statement_batch_id,
        description: `Reconciled line "${reconcileLine.description}" to ${entry.kind.replace(/_/g, " ")} ${entry.reference ?? entry.reference_id} (${candidate.reason})`,
      });
      toast({ variant: "success", title: "Reconciled" });
      setReconcileLine(null);
      setReconcileSearch("");
      load();
    } catch (err: any) {
      toast({ title: "Couldn't reconcile", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ── UN-RECONCILE ───────────────────────────────────────────────────────
  const submitUnreconcile = async () => {
    if (!unreconcileLine) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("unreconcile_bank_statement_line", { p_line_id: unreconcileLine.id });
      if (error) throw error;
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "update",
        entity_type: "bank_statement_batch", entity_id: unreconcileLine.bank_statement_batch_id,
        description: `Un-reconciled line "${unreconcileLine.description}"`,
      });
      toast({ variant: "success", title: "Reconciliation removed" });
      setUnreconcileLine(null);
      load();
    } catch (err: any) {
      toast({ title: "Couldn't un-reconcile", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ── IGNORE / UN-IGNORE ────────────────────────────────────────────────
  const openIgnore = (line: ReconLine) => {
    setIgnoreLine(line);
    setIgnoreReasonPreset("");
    setIgnoreReasonExtra("");
  };

  const submitIgnore = async () => {
    if (!ignoreLine) return;
    const reason = [ignoreReasonPreset, ignoreReasonExtra.trim()].filter(Boolean).join(" — ") || null;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("ignore_bank_statement_line", {
        p_line_id: ignoreLine.id,
        p_reason: reason,
      });
      if (error) throw error;
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "update",
        entity_type: "bank_statement_batch", entity_id: ignoreLine.bank_statement_batch_id,
        description: `Ignored line "${ignoreLine.description}"${reason ? `: ${reason}` : ""}`,
      });
      toast({ variant: "success", title: "Transaction ignored" });
      setIgnoreLine(null);
      load();
    } catch (err: any) {
      toast({ title: "Couldn't ignore", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const submitUnignore = async (line: ReconLine) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("unignore_bank_statement_line", { p_line_id: line.id });
      if (error) throw error;
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "update",
        entity_type: "bank_statement_batch", entity_id: line.bank_statement_batch_id,
        description: `Reversed ignore on line "${line.description}"`,
      });
      toast({ variant: "success", title: "Ignore reversed" });
      load();
    } catch (err: any) {
      toast({ title: "Couldn't reverse ignore", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!role) return null;

  if (loading || !account) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role} />
        <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto space-y-6">
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
            <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-4">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="statements">Statements</TabsTrigger>
              <TabsTrigger value="transfers">Transfers</TabsTrigger>
              <TabsTrigger value="reconciliation">
                Reconciliation{reconStats.pendingCount > 0 ? ` (${reconStats.pendingCount})` : ""}
              </TabsTrigger>
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
                  {
                    key: "matched", header: "Matched Payment", hideBelow: "lg",
                    accessor: (t) => {
                      const m = matchedPayments.get(t.id);
                      if (!m) return <span className="text-xs text-muted-foreground">—</span>;
                      return (
                        <div className="text-xs">
                          <span className="text-foreground font-medium">{m.paymentNumber ?? "Payment"}</span>
                          {m.invoiceId && m.invoiceNumber && (
                            <>
                              {" · "}
                              <Link href={`/finance/invoicing/customer-invoices/${m.invoiceId}`} className="text-primary hover:underline">
                                {m.invoiceNumber}
                              </Link>
                            </>
                          )}
                          {m.customerName && <p className="text-muted-foreground truncate max-w-[160px]">{m.customerName}</p>}
                        </div>
                      );
                    },
                  },
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

            <TabsContent value="reconciliation" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard
                  label="Statement Balance"
                  value={reconStats.statementBalance !== null ? formatCurrency(reconStats.statementBalance, account.currency) : "No statement yet"}
                  icon={FileSpreadsheet}
                />
                <StatCard label="Book Balance" value={formatCurrency(reconStats.bookBalance, account.currency)} icon={Wallet} />
                <StatCard
                  label="Difference"
                  value={reconStats.difference !== null ? formatCurrency(reconStats.difference, account.currency) : "—"}
                  icon={Scale}
                  accent={reconStats.difference === null || reconStats.difference === 0 ? undefined : "bg-warning/10 text-warning"}
                />
                <StatCard label="Reconciled" value={formatCurrency(reconStats.reconciledNet, account.currency)} sub={`${reconStats.reconciledCount + reconStats.postedCount + reconStats.ignoredCount} line(s)`} icon={ShieldCheck} accent="bg-success/10 text-success" />
                <StatCard label="Pending" value={formatCurrency(reconStats.pendingNet, account.currency)} sub={`${reconStats.pendingCount} line(s)`} icon={Link2} accent="bg-warning/10 text-warning" />
              </div>

              <DataTable
                data={filteredReconLines}
                getRowId={(l) => l.id}
                emptyIcon={ShieldCheck}
                emptyTitle={reconLines.length === 0 ? "No statement lines yet" : "Nothing matches this filter"}
                emptyDescription={reconLines.length === 0 ? "Import a bank statement for this account to begin reconciling." : "Try a different status filter."}
                initialSort={{ key: "date", dir: "desc" }}
                filters={
                  <DataTableFilterSelect
                    value={reconStatusFilter}
                    onValueChange={setReconStatusFilter}
                    placeholder="Status"
                    options={[
                      { value: "open", label: "Needs attention" },
                      { value: "all", label: "All statuses" },
                      { value: "unmatched", label: "Pending" },
                      { value: "posted", label: "Posted" },
                      { value: "confirmed", label: "Reconciled" },
                      { value: "ignored", label: "Ignored" },
                    ]}
                  />
                }
                columns={[
                  { key: "date", header: "Date", accessor: (l) => <span className="text-xs text-muted-foreground whitespace-nowrap">{l.transaction_date}</span>, sortValue: (l) => l.transaction_date },
                  {
                    key: "statement", header: "Statement", hideBelow: "md",
                    accessor: (l) => (
                      <Link href={`/finance/banking/bank-statements/${l.bank_statement_batch_id}`} className="text-xs font-mono text-primary hover:underline">
                        {l.batch?.reference ?? "—"}
                      </Link>
                    ),
                  },
                  {
                    key: "description", header: "Description",
                    accessor: (l) => (
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate max-w-[240px]">{l.description || "—"}</p>
                        {l.reference_number && <p className="text-[10px] font-mono text-muted-foreground truncate">{l.reference_number}</p>}
                      </div>
                    ),
                    sortValue: (l) => l.description ?? "",
                  },
                  {
                    key: "amount", header: "Amount", align: "right",
                    accessor: (l) => (
                      <span className={cn("font-bold", lineNet(l) >= 0 ? "text-success" : "text-destructive")}>
                        {formatCurrency(Math.abs(lineNet(l)), account.currency)}
                      </span>
                    ),
                    sortValue: (l) => lineNet(l),
                  },
                  {
                    key: "status", header: "Status",
                    accessor: (l) => <StatusBadge status={l.match_status === "unmatched" ? "pending" : l.match_status === "confirmed" || l.match_status === "matched" ? "reconciled" : l.match_status} />,
                    sortValue: (l) => l.match_status,
                  },
                  {
                    key: "matched", header: "Matched Record", hideBelow: "lg",
                    accessor: (l) => {
                      if (!(l.match_status === "matched" || l.match_status === "confirmed") || l.matches.length === 0) {
                        return <span className="text-xs text-muted-foreground">—</span>;
                      }
                      return (
                        <div className="space-y-0.5">
                          {l.matches.map((m) => {
                            const matchedEntry = book.find((e) => e.reference_id === m.matched_entity_id && e.kind === m.matched_entity_type);
                            return (
                              <p key={m.id} className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                {matchedEntry?.kind === "invoice_payment" ? (
                                  <>{matchedEntry.paymentNumber ?? "Payment"}{matchedEntry.invoiceNumber ? ` · ${matchedEntry.invoiceNumber}` : ""}</>
                                ) : (
                                  <>{m.matched_entity_type.replace(/_/g, " ")}</>
                                )}
                              </p>
                            );
                          })}
                        </div>
                      );
                    },
                  },
                ]}
                rowActions={(l) => {
                  const locked = l.batch?.status === "posted";
                  if (locked || !canManage) return null;
                  const isPending = l.match_status === "unmatched";
                  const isReconciled = l.match_status === "matched" || l.match_status === "confirmed";
                  return (
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {isPending && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openPost(l)}>
                            <Wallet className="w-3 h-3" /> Post
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setReconcileLine(l); setReconcileSearch(""); }}>
                            <Link2 className="w-3 h-3" /> Reconcile
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => openIgnore(l)}>
                            <EyeOff className="w-3 h-3" /> Ignore
                          </Button>
                        </>
                      )}
                      {isReconciled && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setUnreconcileLine(l)}>
                          <Undo2 className="w-3 h-3" /> Un-reconcile
                        </Button>
                      )}
                      {l.match_status === "ignored" && canUnignore && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => submitUnignore(l)}>
                          <Undo2 className="w-3 h-3" /> Un-ignore
                        </Button>
                      )}
                    </div>
                  );
                }}
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

      {/* Post transaction dialog */}
      <Dialog open={!!postLine} onOpenChange={(o) => !o && setPostLine(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Post Bank Transaction</DialogTitle></DialogHeader>
          {postLine && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Date</p>
                  <p className="text-foreground">{postLine.transaction_date}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Type</p>
                  <p className={cn("font-bold", lineNet(postLine) >= 0 ? "text-success" : "text-destructive")}>
                    {lineNet(postLine) >= 0 ? "Money In" : "Money Out"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Amount</p>
                  <p className="text-foreground font-black">{formatCurrency(Math.abs(lineNet(postLine)), account.currency)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Bank description</p>
                  <p className="text-muted-foreground truncate">{postLine.description || "—"}</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Allocate to COA *</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9"
                    placeholder="Search account code or name…"
                    value={postCoaCode ? `${postCoaCode} — ${reconCoaAccounts.find((a) => a.code === postCoaCode)?.name ?? ""}` : postCoaSearch}
                    onChange={(e) => { setPostCoaCode(""); setPostCoaSearch(e.target.value); }}
                    onFocus={() => setPostCoaCode("")}
                  />
                </div>
                {!postCoaCode && (
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                    {filteredCoaAccounts.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic px-3 py-2">No matching accounts.</p>
                    ) : filteredCoaAccounts.slice(0, 50).map((a) => (
                      <button
                        key={a.code}
                        type="button"
                        onClick={() => { setPostCoaCode(a.code); setPostCoaSearch(""); }}
                        className="w-full text-left px-3 py-2 hover:bg-muted/70 transition-colors flex items-center justify-between gap-2"
                      >
                        <span className="text-sm text-foreground truncate">{a.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{a.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1"><Label className="text-xs">Reference</Label><Input value={postReference} onChange={(e) => setPostReference(e.target.value)} placeholder="optional" /></div>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={postDescription} onChange={(e) => setPostDescription(e.target.value)} /></div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setPostLine(null)} disabled={busy}>Cancel</Button>
                <Button onClick={submitPost} disabled={busy || !postCoaCode} className="gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Post Transaction
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reconcile dialog */}
      <Dialog open={!!reconcileLine} onOpenChange={(o) => !o && setReconcileLine(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Reconcile Transaction</DialogTitle></DialogHeader>
          {reconcileLine && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground -mt-1">
                Links this bank line to an existing payment, expense, or journal entry. No new payment or journal entry is created.
              </p>
              <div>
                <p className="text-sm font-bold text-foreground">{reconcileLine.description || "—"}</p>
                <p className={cn("text-lg font-black mt-0.5", lineNet(reconcileLine) >= 0 ? "text-success" : "text-destructive")}>
                  {lineNet(reconcileLine) >= 0 ? "Money In" : "Money Out"} · {formatCurrency(Math.abs(lineNet(reconcileLine)), account.currency)}
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search invoice #, reference, customer/supplier…"
                  value={reconcileSearch}
                  onChange={(e) => setReconcileSearch(e.target.value)}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1.5">
                  {reconcileCandidates.length > 0 ? "Possible matches" : "No candidates"}
                </p>
                <div className="max-h-72 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {reconcileCandidates.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic px-3 py-3">No open book entries in the matching direction.</p>
                  ) : reconcileCandidates.map(({ entry: e, confidence, reason }) => (
                    <button
                      key={e.id}
                      onClick={() => doReconcile({ entry: e, confidence, reason })}
                      disabled={busy}
                      className="w-full text-left flex items-center justify-between px-3 py-2.5 hover:bg-muted/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{e.kind.replace(/_/g, " ")}</span>
                          <Badge variant={confidence === "exact" ? "default" : "outline"} className="h-4 px-1.5 text-[9px] uppercase tracking-wider">
                            {reason}
                          </Badge>
                        </div>
                        <p className="text-sm truncate">{e.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {e.date}
                          {e.paymentNumber && ` · ${e.paymentNumber}`}
                          {e.transactionReference && ` · ${e.transactionReference}`}
                        </p>
                      </div>
                      <span className={cn("text-sm font-bold shrink-0 ml-2", e.amount >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(Math.abs(e.amount), account.currency)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setReconcileLine(null)} disabled={busy}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Un-reconcile confirmation */}
      <Dialog open={!!unreconcileLine} onOpenChange={(o) => !o && setUnreconcileLine(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Un-reconcile Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Are you sure you want to remove this reconciliation?</p>
            <p className="text-xs text-muted-foreground">The existing accounting transaction will NOT be deleted.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUnreconcileLine(null)} disabled={busy}>Cancel</Button>
              <Button onClick={submitUnreconcile} disabled={busy} variant="destructive" className="gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Un-reconcile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ignore dialog */}
      <Dialog open={!!ignoreLine} onOpenChange={(o) => !o && setIgnoreLine(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Ignore Transaction</DialogTitle></DialogHeader>
          {ignoreLine && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Transaction</p>
                  <p className="text-foreground">{ignoreLine.transaction_date}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Amount</p>
                  <p className={cn("font-bold", lineNet(ignoreLine) >= 0 ? "text-success" : "text-destructive")}>
                    {formatCurrency(Math.abs(lineNet(ignoreLine)), account.currency)} {lineNet(ignoreLine) >= 0 ? "IN" : "OUT"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Description</p>
                  <p className="text-muted-foreground truncate">{ignoreLine.description || "—"}</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <Select value={ignoreReasonPreset} onValueChange={setIgnoreReasonPreset}>
                  <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                  <SelectContent>
                    {IGNORE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Additional explanation</Label>
                <Input value={ignoreReasonExtra} onChange={(e) => setIgnoreReasonExtra(e.target.value)} placeholder="optional" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setIgnoreLine(null)} disabled={busy}>Cancel</Button>
                <Button onClick={submitIgnore} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />} Ignore Transaction
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
