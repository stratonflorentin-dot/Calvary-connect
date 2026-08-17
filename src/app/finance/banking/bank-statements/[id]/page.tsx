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
import { useToast } from "@/hooks/use-toast";
import { AuditTrailService } from "@/services/audit-trail-service";
import { applyTransition } from "@/lib/workflow/engine";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import { formatCurrency } from "@/components/ui/currency-badge";
import {
  ArrowLeft, ArrowRight, CheckCircle2, EyeOff, Landmark, Link2, Loader2,
  Plus, Receipt, ShieldCheck, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

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

interface Line {
  id: string;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  debit_amount: number;
  credit_amount: number;
  balance: number | null;
  match_status: "unmatched" | "matched" | "confirmed" | "ignored";
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
}

export default function BankStatementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const { user } = useSupabase();
  const { role } = useRole();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [book, setBook] = useState<BookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingLineId, setMatchingLineId] = useState<string | null>(null);
  const [ignoreLineId, setIgnoreLineId] = useState<string | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [expenseLine, setExpenseLine] = useState<Line | null>(null);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postReason, setPostReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [newLine, setNewLine] = useState({ date: "", description: "", reference: "", debit: "", credit: "" });

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
      const [invRes, expRes, jelRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, customer_name, client_name, type, status, paid_at, total_amount, amount, reconciled")
          .not("paid_at", "is", null)
          .order("paid_at", { ascending: false })
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
      for (const inv of invRes.data ?? []) {
        const amt = Number(inv.total_amount ?? inv.amount ?? 0);
        if (!inv.paid_at || amt <= 0) continue;
        entries.push({
          id: `inv-${inv.id}`, kind: "invoice_payment",
          date: String(inv.paid_at).slice(0, 10),
          description: `${inv.customer_name ?? inv.client_name ?? "Customer"} · ${inv.invoice_number}`,
          reference: inv.invoice_number,
          amount: inv.type === "payable" ? -amt : amt,
          reconciled: Boolean(inv.reconciled),
          reference_id: inv.id,
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
      .filter((l) => l.match_status === "confirmed" || l.match_status === "ignored")
      .reduce((s, l) => s + (Number(l.credit_amount) - Number(l.debit_amount)), 0);
    const openCount = lines.filter((l) => l.match_status === "unmatched" || l.match_status === "matched").length;
    return { statementNet, difference: statementNet - reconciledNet, openCount };
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

  const doMatch = async (line: Line, entry: BookEntry) => {
    const lineDir = lineNet(line) >= 0 ? 1 : -1;
    if ((entry.amount >= 0 ? 1 : -1) !== lineDir) {
      toast({ title: "Direction mismatch", description: "Bank direction doesn't match the book side.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error: matchErr } = await supabase.from("reconciliation_matches").insert({
        bank_statement_line_id: line.id,
        matched_entity_type: entry.kind,
        matched_entity_id: entry.reference_id,
        matched_amount: Math.abs(entry.amount),
        created_by: user?.id ?? null,
      });
      if (matchErr) throw matchErr;

      const table = entry.kind === "invoice_payment" ? "invoices" : entry.kind === "expense" ? "expenses" : "journal_entry_lines";
      await supabase.from(table).update({ reconciled: true }).eq("id", entry.reference_id);

      await supabase
        .from("bank_statement_lines")
        .update({ match_status: "matched", matched_by: user?.id ?? null, matched_at: new Date().toISOString() })
        .eq("id", line.id);

      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "reconcile" as any,
        entity_type: "bank_statement_batch", entity_id: batch!.id,
        description: `Matched line ${line.description} to ${entry.kind.replace(/_/g, " ")} ${entry.reference ?? entry.reference_id}`,
      });

      setMatchingLineId(null);
      load();
    } catch (err: any) {
      toast({ title: "Match failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const undoMatch = async (line: Line, match: MatchRow) => {
    setBusy(true);
    try {
      await supabase.from("reconciliation_matches").delete().eq("id", match.id);
      const table = match.matched_entity_type === "invoice_payment" ? "invoices" : match.matched_entity_type === "expense" ? "expenses" : "journal_entry_lines";
      await supabase.from(table).update({ reconciled: false }).eq("id", match.matched_entity_id);

      const remaining = line.matches.filter((m) => m.id !== match.id);
      await supabase
        .from("bank_statement_lines")
        .update({ match_status: remaining.length > 0 ? "matched" : "unmatched" })
        .eq("id", line.id);

      load();
    } catch (err: any) {
      toast({ title: "Couldn't undo match", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const confirmLine = async (line: Line) => {
    await supabase.from("bank_statement_lines").update({ match_status: "confirmed" }).eq("id", line.id);
    load();
  };

  const submitIgnore = async () => {
    if (!ignoreLineId) return;
    setBusy(true);
    await supabase
      .from("bank_statement_lines")
      .update({ match_status: "ignored", matched_by: user?.id ?? null, matched_at: new Date().toISOString() })
      .eq("id", ignoreLineId);
    await AuditTrailService.log({
      user_id: user?.id, module: "finance", action: "update",
      entity_type: "bank_statement_batch", entity_id: batch!.id,
      description: `Ignored a statement line${ignoreReason ? `: ${ignoreReason}` : ""}`,
    });
    setBusy(false);
    setIgnoreLineId(null);
    setIgnoreReason("");
    load();
  };

  const submitExpense = async () => {
    if (!expenseLine || !batch) return;
    setBusy(true);
    try {
      const { data: expense, error: expErr } = await supabase
        .from("expenses")
        .insert({
          type: "other",
          description: expenseDesc || expenseLine.description,
          amount: Number(expenseLine.debit_amount),
          currency,
          status: "paid",
          date: expenseLine.transaction_date,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (expErr) throw expErr;

      await supabase.from("expenses").update({ reconciled: true }).eq("id", expense.id);
      await supabase.from("reconciliation_matches").insert({
        bank_statement_line_id: expenseLine.id,
        matched_entity_type: "expense",
        matched_entity_id: expense.id,
        matched_amount: Number(expenseLine.debit_amount),
        created_by: user?.id ?? null,
      });
      await supabase
        .from("bank_statement_lines")
        .update({ match_status: "confirmed", matched_by: user?.id ?? null, matched_at: new Date().toISOString() })
        .eq("id", expenseLine.id);

      toast({ variant: "success", title: "Expense created and matched" });
      setExpenseLine(null);
      setExpenseDesc("");
      load();
    } catch (err: any) {
      toast({ title: "Couldn't create expense", description: err.message, variant: "destructive" });
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

  const STATUS_BADGE: Record<string, string> = {
    unmatched: "outline", matched: "secondary", confirmed: "default", ignored: "outline",
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
              <ShieldCheck className="w-3.5 h-3.5" /> Post
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
            return (
              <div key={l.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">{l.transaction_date}</p>
                      {l.reference_number && <span className="text-[10px] font-mono text-muted-foreground">{l.reference_number}</span>}
                      <Badge variant={STATUS_BADGE[l.match_status] as any}>{l.match_status}</Badge>
                    </div>
                    <p className="text-sm text-foreground mt-0.5">{l.description || "—"}</p>
                  </div>
                  <p className={cn("text-sm font-black shrink-0", net >= 0 ? "text-success" : "text-destructive")}>
                    {net >= 0 ? "+" : ""}{fmt(net, currency)}
                  </p>
                </div>

                {l.matches.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {l.matches.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-1.5">
                        <span className="text-muted-foreground">{m.matched_entity_type.replace(/_/g, " ")} · {fmt(Number(m.matched_amount), currency)}</span>
                        {!locked && (
                          <button onClick={() => undoMatch(l, m)} className="flex items-center gap-1 text-muted-foreground hover:text-destructive">
                            <Undo2 className="w-3 h-3" /> undo
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!locked && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {(l.match_status === "unmatched" || l.match_status === "matched") && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setMatchingLineId(matchingLineId === l.id ? null : l.id)}>
                        <Link2 className="w-3 h-3" /> Match
                      </Button>
                    )}
                    {l.match_status === "matched" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => confirmLine(l)}>
                        <CheckCircle2 className="w-3 h-3" /> Confirm
                      </Button>
                    )}
                    {l.match_status === "unmatched" && net < 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setExpenseLine(l); setExpenseDesc(l.description); }}>
                        <Receipt className="w-3 h-3" /> Create expense
                      </Button>
                    )}
                    {l.match_status === "unmatched" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setIgnoreLineId(l.id)}>
                        <EyeOff className="w-3 h-3" /> Ignore
                      </Button>
                    )}
                  </div>
                )}

                {matchingLineId === l.id && (
                  <div className="mt-3 border border-primary/20 bg-primary/5 rounded-xl p-3 max-h-64 overflow-y-auto space-y-1">
                    {openBook.filter((e) => (e.amount >= 0) === (net >= 0)).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No candidate book entries in the matching direction.</p>
                    ) : openBook.filter((e) => (e.amount >= 0) === (net >= 0)).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => doMatch(l, e)}
                        disabled={busy}
                        className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-card border border-transparent hover:border-border transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{e.kind.replace(/_/g, " ")}</span>
                          <p className="text-xs truncate">{e.description}</p>
                        </div>
                        <span className={cn("text-xs font-bold shrink-0 ml-2", e.amount >= 0 ? "text-success" : "text-destructive")}>{fmt(e.amount, currency)}</span>
                      </button>
                    ))}
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

      {/* Ignore dialog */}
      <Dialog open={!!ignoreLineId} onOpenChange={(o) => !o && setIgnoreLineId(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Ignore this line</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Marks this line as not needing a book match (e.g. a bank fee already accounted for elsewhere).</p>
            <div className="space-y-1"><Label className="text-xs">Reason (optional)</Label><Input value={ignoreReason} onChange={(e) => setIgnoreReason(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIgnoreLineId(null)} disabled={busy}>Cancel</Button>
              <Button onClick={submitIgnore} disabled={busy} className="gap-2"><EyeOff className="w-4 h-4" /> Ignore</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create expense dialog */}
      <Dialog open={!!expenseLine} onOpenChange={(o) => !o && setExpenseLine(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Create expense from this line</DialogTitle></DialogHeader>
          {expenseLine && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Creates a paid expense of {fmt(Number(expenseLine.debit_amount), currency)} on {expenseLine.transaction_date} and matches it to this line.
              </p>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setExpenseLine(null)} disabled={busy}>Cancel</Button>
                <Button onClick={submitExpense} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} Create & match
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Post-with-open-lines confirmation */}
      <Dialog open={postModalOpen} onOpenChange={setPostModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Post with unmatched lines?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {summary.openCount} line(s) still aren't confirmed. Explain why you're posting anyway — this is recorded on the audit trail.
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
