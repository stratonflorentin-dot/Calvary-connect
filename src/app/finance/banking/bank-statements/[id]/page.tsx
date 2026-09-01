"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { findPaymentMatches, matchConfidenceLabel, type MatchConfidence, type PaymentCandidate } from "@/lib/finance/reconciliation-matching";
import { applyTransition } from "@/lib/workflow/engine";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { formatCurrency } from "@/components/ui/currency-badge";
import {
  ArrowLeft, ArrowRight, EyeOff, Landmark, Link2, Loader2,
  Plus, Search, ShieldCheck, Undo2, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

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

interface Batch {
  id: string;
  reference: string;
  bank_account_id: string;
  period_from: string;
  period_to: string;
  opening_balance: number | null;
  closing_balance: number | null;
  status: string;
  open_line_count: number;
  difference: number;
  notes: string | null;
  bank_account?: { account_name: string; bank_name: string; currency: string } | null;
}

interface MatchRow {
  id: string;
  matched_entity_type: string;
  matched_entity_id: string;
  matched_amount: number;
}

type MatchStatus = "unmatched" | "matched" | "confirmed" | "ignored" | "posted";

interface Line {
  id: string;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  debit_amount: number;
  credit_amount: number;
  balance: number | null;
  match_status: MatchStatus;
  journal_entry_id: string | null;
  posted_at: string | null;
  ignore_reason: string | null;
  matches: MatchRow[];
}

interface BookEntry {
  id: string;
  kind: "invoice_payment" | "expense" | "journal_line";
  date: string;
  description: string;
  reference?: string | null;
  amount: number; // positive = money in, negative = money out
  reconciled: boolean;
  reference_id: string;
  // invoice_payment only — feeds findPaymentMatches().
  paymentNumber?: string | null;
  invoiceNumber?: string | null;
  transactionReference?: string | null;
}

interface CoaAccount {
  code: string;
  name: string;
  category: string;
}

const STATUS_META: Record<MatchStatus, { label: string; variant: any }> = {
  unmatched: { label: "Pending", variant: "outline" },
  matched: { label: "Reconciled", variant: "default" },
  confirmed: { label: "Reconciled", variant: "default" },
  posted: { label: "Posted", variant: "secondary" },
  ignored: { label: "Ignored", variant: "outline" },
};

export default function BankStatementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const { user } = useSupabase();
  const { role } = useRole();
  const canManage = !!role && MANAGE_ROLES.includes(role);
  const canUnignore = !!role && UNIGNORE_ROLES.includes(role);

  const [batch, setBatch] = useState<Batch | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [book, setBook] = useState<BookEntry[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [newLine, setNewLine] = useState({ date: "", description: "", reference: "", debit: "", credit: "" });

  // Post modal
  const [postLine, setPostLine] = useState<Line | null>(null);
  const [postCoaCode, setPostCoaCode] = useState("");
  const [postCoaSearch, setPostCoaSearch] = useState("");
  const [postReference, setPostReference] = useState("");
  const [postDescription, setPostDescription] = useState("");

  // Reconcile modal
  const [reconcileLine, setReconcileLine] = useState<Line | null>(null);
  const [reconcileSearch, setReconcileSearch] = useState("");

  // Un-reconcile confirmation
  const [unreconcileLine, setUnreconcileLine] = useState<Line | null>(null);

  // Ignore modal
  const [ignoreLine, setIgnoreLine] = useState<Line | null>(null);
  const [ignoreReasonPreset, setIgnoreReasonPreset] = useState("");
  const [ignoreReasonExtra, setIgnoreReasonExtra] = useState("");

  // Post-with-open-lines (batch-level) confirmation
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postReason, setPostReason] = useState("");

  const locked = batch?.status === "posted";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: batchData, error: batchErr } = await supabase
        .from("bank_statement_batches")
        .select("*, bank_account:bank_accounts(account_name, bank_name, currency)")
        .eq("id", id)
        .single();
      if (batchErr) throw batchErr;
      setBatch(batchData as unknown as Batch);

      const [lineRes, matchRes] = await Promise.all([
        supabase.from("bank_statement_lines").select("*").eq("bank_statement_batch_id", id).order("transaction_date", { ascending: false }),
        supabase.from("reconciliation_matches").select("*"),
      ]);
      const lineIds = (lineRes.data ?? []).map((l: any) => l.id);
      const matchesByLine = new Map<string, MatchRow[]>();
      for (const m of matchRes.data ?? []) {
        if (!lineIds.includes(m.bank_statement_line_id)) continue;
        const list = matchesByLine.get(m.bank_statement_line_id) ?? [];
        list.push(m);
        matchesByLine.set(m.bank_statement_line_id, list);
      }
      setLines(
        (lineRes.data ?? []).map((l: any) => ({ ...l, matches: matchesByLine.get(l.id) ?? [] })),
      );

      const bankAccountId = (batchData as any).bank_account_id;
      const [payRes, expRes, jelRes] = await Promise.all([
        // The authoritative source for "was this invoice already paid" —
        // reconciling must find the same payments/payment_allocations
        // record the Payments page created, not re-derive one from
        // invoices.paid_at (which is a separate, looser signal that can
        // drift from what was actually recorded as a payment).
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
      ]);
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

      // COA picker — active, postable leaf accounts only, matching the bank
      // account's own currency (post_journal_entry rejects a currency
      // mismatch between the two lines of the same entry, so anything else
      // would just fail at Post time).
      const bankCurrency = (batchData as any)?.bank_account?.currency ?? "TZS";
      const { data: accountsData } = await supabase
        .from("accounts")
        .select("code, name, category, is_active, is_postable, is_bank_account, currency")
        .eq("is_active", true)
        .eq("is_postable", true)
        .eq("currency", bankCurrency)
        .order("code");
      setCoaAccounts(
        (accountsData ?? [])
          .filter((a: any) => !a.is_bank_account)
          .map((a: any) => ({ code: a.code, name: a.name, category: a.category })),
      );
    } catch (err: any) {
      toast({ title: "Couldn't load statement", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const currency = batch?.bank_account?.currency ?? "TZS";

  const summary = useMemo(() => {
    const statementNet = lines.reduce((s, l) => s + (Number(l.credit_amount) - Number(l.debit_amount)), 0);
    const reconciledNet = lines
      .filter((l) => l.match_status === "confirmed" || l.match_status === "posted" || l.match_status === "ignored")
      .reduce((s, l) => s + (Number(l.credit_amount) - Number(l.debit_amount)), 0);
    const openCount = lines.filter((l) => l.match_status === "unmatched" || l.match_status === "matched").length;
    const pending = lines.filter((l) => l.match_status === "unmatched" || l.match_status === "matched").length;
    const posted = lines.filter((l) => l.match_status === "posted").length;
    const reconciled = lines.filter((l) => l.match_status === "confirmed").length;
    const ignored = lines.filter((l) => l.match_status === "ignored").length;
    return { statementNet, difference: statementNet - reconciledNet, openCount, pending, posted, reconciled, ignored };
  }, [lines]);

  // Keeps bank_statement_batches.open_line_count/difference honest for the
  // list page and the Post transition's guard — recomputed after every
  // match-state-changing action rather than a trigger.
  const syncBatchSummary = async () => {
    await supabase
      .from("bank_statement_batches")
      .update({ open_line_count: summary.openCount, difference: summary.difference })
      .eq("id", id);
  };

  useEffect(() => {
    if (!loading && batch) syncBatchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.openCount, summary.difference, loading]);

  const claimedBookIds = useMemo(() => new Set(book.filter((e) => e.reconciled).map((e) => e.id)), [book]);
  const openBook = useMemo(() => book.filter((e) => !claimedBookIds.has(e.id)), [book, claimedBookIds]);

  const lineNet = (l: Line) => Number(l.credit_amount) - Number(l.debit_amount);

  const filteredCoaAccounts = useMemo(() => {
    const q = postCoaSearch.trim().toLowerCase();
    if (!q) return coaAccounts;
    return coaAccounts.filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [coaAccounts, postCoaSearch]);

  // ── POST ───────────────────────────────────────────────────────────────
  const openPost = (line: Line) => {
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
      const account = coaAccounts.find((a) => a.code === postCoaCode);
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "create",
        entity_type: "bank_statement_batch", entity_id: batch!.id,
        description: `Posted line "${postLine.description}" to ${postCoaCode}${account ? ` (${account.name})` : ""} — JE ${(data as any)?.journal_entry_id ?? ""}`,
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
  // Payments get the full transaction-reference / invoice-number-aware
  // matcher; expenses and journal lines (which carry no such reference)
  // keep the simpler amount+direction search that already existed.
  interface RankedCandidate { entry: BookEntry; confidence: MatchConfidence; reason: string }

  const reconcileCandidates = useMemo((): RankedCandidate[] => {
    if (!reconcileLine) return [];
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
      currency,
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
        currency,
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
      confidence: Math.abs(Math.abs(entry.amount) - Math.abs(net)) < 0.5 ? "likely" : "possible",
      reason: matchConfidenceLabel(Math.abs(Math.abs(entry.amount) - Math.abs(net)) < 0.5 ? "likely" : "possible"),
    }));

    let all = [...paymentResults, ...otherResults];
    if (q) {
      all = all.filter(({ entry }) => entry.description.toLowerCase().includes(q) || (entry.reference ?? "").toLowerCase().includes(q));
    }
    const rank: Record<MatchConfidence, number> = { exact: 0, high: 1, likely: 2, possible: 3 };
    return all.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
  }, [reconcileLine, openBook, reconcileSearch, currency]);

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
        entity_type: "bank_statement_batch", entity_id: batch!.id,
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
        entity_type: "bank_statement_batch", entity_id: batch!.id,
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
  const openIgnore = (line: Line) => {
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
        entity_type: "bank_statement_batch", entity_id: batch!.id,
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

  const submitUnignore = async (line: Line) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("unignore_bank_statement_line", { p_line_id: line.id });
      if (error) throw error;
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "update",
        entity_type: "bank_statement_batch", entity_id: batch!.id,
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

  const addLine = async () => {
    if (!newLine.date || (!newLine.debit && !newLine.credit)) {
      toast({ title: "Date and an amount are required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("bank_statement_lines").insert({
      bank_statement_batch_id: id,
      bank_account_id: batch!.bank_account_id,
      transaction_date: newLine.date,
      description: newLine.description,
      reference_number: newLine.reference || null,
      debit_amount: Number(newLine.debit) || 0,
      credit_amount: Number(newLine.credit) || 0,
      match_status: "unmatched",
    });
    if (error) {
      toast({ title: "Couldn't add line", description: error.message, variant: "destructive" });
      return;
    }
    setAddLineOpen(false);
    setNewLine({ date: "", description: "", reference: "", debit: "", credit: "" });
    load();
  };

  const post = async (reason?: string) => {
    if (!batch) return;
    setBusy(true);
    const result = await applyTransition({
      kind: "bank_statement_batch", entityId: batch.id, toState: "posted",
      actorId: user?.id ?? "", actorRole: (role as any) ?? undefined,
      payload: { reason },
    });
    setBusy(false);
    if (!result.ok) {
      if (result.code === "guard_failed") {
        setPostModalOpen(true);
      } else {
        toast({ title: "Couldn't post", description: result.message, variant: "destructive" });
      }
      return;
    }
    toast({ variant: "success", title: "Statement posted", description: "Lines are now locked." });
    setPostModalOpen(false);
    setPostReason("");
    setBatch({ ...batch, ...result.entity });
  };

  if (loading || !batch) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/finance/banking/bank-statements" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Bank Statements
          </Link>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" /> {batch.reference}
            <Badge variant={batch.status === "posted" ? "default" : "secondary"}>{batch.status === "posted" ? "Posted" : "Draft"}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {batch.bank_account?.bank_name} · {batch.bank_account?.account_name} · {batch.period_from} → {batch.period_to}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!locked && (
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setAddLineOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add line
            </Button>
          )}
          {!locked ? (
            <Button size="sm" className="h-9 gap-2 bg-primary hover:bg-primary/90" onClick={() => post()} disabled={busy}>
              <ShieldCheck className="w-3.5 h-3.5" /> Post statement
            </Button>
          ) : (
            <TransitionButtons kind="bank_statement_batch" entity={batch} actorId={user?.id ?? ""} actorRole={role as any} size="sm" onDone={(e) => setBatch({ ...batch, ...e })} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Statement Net", value: summary.statementNet },
          { label: "Difference", value: summary.difference, tone: summary.difference === 0 ? "text-success" : "text-destructive" },
          { label: "Open Lines", value: summary.openCount, raw: true },
          { label: "Closing Balance", value: batch.closing_balance ?? 0 },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{k.label}</p>
            <p className={cn("text-2xl font-black mt-1", (k as any).tone ?? "text-foreground")}>
              {k.raw ? k.value : fmt(Number(k.value), currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending", value: summary.pending, tone: "text-muted-foreground" },
          { label: "Posted", value: summary.posted, tone: "text-primary" },
          { label: "Reconciled", value: summary.reconciled, tone: "text-success" },
          { label: "Ignored", value: summary.ignored, tone: "text-muted-foreground" },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{k.label}</p>
            <p className={cn("text-2xl font-black mt-1", k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-black text-foreground">Statement lines</h2>
          <p className="text-xs text-muted-foreground">{lines.length} line(s)</p>
        </div>
        <div className="divide-y divide-border">
          {lines.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic">No lines yet. Add one above.</div>
          ) : lines.map((l) => {
            const net = lineNet(l);
            const meta = STATUS_META[l.match_status] ?? STATUS_META.unmatched;
            const isPending = l.match_status === "unmatched";
            const isReconciled = l.match_status === "matched" || l.match_status === "confirmed";
            return (
              <div key={l.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">{l.transaction_date}</p>
                      {l.reference_number && <span className="text-[10px] font-mono text-muted-foreground">{l.reference_number}</span>}
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <p className="text-sm text-foreground mt-0.5">{l.description || "—"}</p>
                    {l.match_status === "ignored" && l.ignore_reason && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">Reason: {l.ignore_reason}</p>
                    )}
                  </div>
                  <p className={cn("text-sm font-black shrink-0", net >= 0 ? "text-success" : "text-destructive")}>
                    {net >= 0 ? "+" : ""}{fmt(net, currency)}
                  </p>
                </div>

                {isReconciled && l.matches.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {l.matches.map((m) => {
                      const matchedEntry = book.find((e) => e.reference_id === m.matched_entity_id && e.kind === m.matched_entity_type);
                      return (
                      <div key={m.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-1.5">
                        <span className="text-muted-foreground">
                          {matchedEntry?.kind === "invoice_payment" ? (
                            <>Matched payment {matchedEntry.paymentNumber ?? ""}{matchedEntry.invoiceNumber ? ` · Invoice ${matchedEntry.invoiceNumber}` : ""} · {fmt(Number(m.matched_amount), currency)}</>
                          ) : (
                            <>{m.matched_entity_type.replace(/_/g, " ")} · {fmt(Number(m.matched_amount), currency)}</>
                          )}
                        </span>
                      </div>
                      );
                    })}
                  </div>
                )}

                {!locked && canManage && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add line dialog */}
      <Dialog open={addLineOpen} onOpenChange={setAddLineOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Add statement line</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Date *</Label><Input type="date" value={newLine.date} onChange={(e) => setNewLine((p) => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={newLine.description} onChange={(e) => setNewLine((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Reference</Label><Input value={newLine.reference} onChange={(e) => setNewLine((p) => ({ ...p, reference: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Debit (out)</Label><Input type="number" value={newLine.debit} onChange={(e) => setNewLine((p) => ({ ...p, debit: e.target.value, credit: "" }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Credit (in)</Label><Input type="number" value={newLine.credit} onChange={(e) => setNewLine((p) => ({ ...p, credit: e.target.value, debit: "" }))} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setAddLineOpen(false)}>Cancel</Button>
              <Button onClick={addLine} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                  <p className="text-foreground font-black">{fmt(Math.abs(lineNet(postLine)), currency)}</p>
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
                    value={postCoaCode ? `${postCoaCode} — ${coaAccounts.find((a) => a.code === postCoaCode)?.name ?? ""}` : postCoaSearch}
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
          <DialogHeader>
            <DialogTitle>Reconcile Transaction</DialogTitle>
          </DialogHeader>
          {reconcileLine && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground -mt-1">
                Links this bank line to an existing payment, expense, or journal entry. No new payment or journal entry is created.
              </p>
              <div>
                <p className="text-sm font-bold text-foreground">{reconcileLine.description || "—"}</p>
                <p className={cn("text-lg font-black mt-0.5", lineNet(reconcileLine) >= 0 ? "text-success" : "text-destructive")}>
                  {lineNet(reconcileLine) >= 0 ? "Money In" : "Money Out"} · {fmt(Math.abs(lineNet(reconcileLine)), currency)}
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
                      <span className={cn("text-sm font-bold shrink-0 ml-2", e.amount >= 0 ? "text-success" : "text-destructive")}>{fmt(Math.abs(e.amount), currency)}</span>
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
                    {fmt(Math.abs(lineNet(ignoreLine)), currency)} {lineNet(ignoreLine) >= 0 ? "IN" : "OUT"}
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

      {/* Post-with-open-lines confirmation (statement-level lock) */}
      <Dialog open={postModalOpen} onOpenChange={setPostModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Post with unmatched lines?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {summary.openCount} line(s) still aren't resolved. Explain why you're posting anyway — this is recorded on the audit trail.
            </p>
            <div className="space-y-1"><Label className="text-xs">Reason *</Label><Input value={postReason} onChange={(e) => setPostReason(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPostModalOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={() => post(postReason)} disabled={busy || !postReason.trim()} className="gap-2">
                <ArrowRight className="w-4 h-4" /> Post anyway
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
