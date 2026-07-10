"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/components/supabase-provider";
import { AuditTrailService } from "@/services/audit-trail-service";
import { formatCurrency } from "@/components/ui/currency-badge";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  current_balance: number;
}

interface BankLine {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference?: string | null;
  debit: number;
  credit: number;
  balance?: number | null;
  reconciled: boolean;
  matched_entity_type?: string | null;
  matched_entity_id?: string | null;
}

interface BookEntry {
  id: string;
  kind: "invoice_payment" | "expense" | "journal_line" | "sale";
  date: string;
  description: string;
  reference?: string | null;
  amount: number; // positive = money in; negative = money out
  reconciled: boolean;
  reference_id?: string | null;
}

/**
 * Parse a CSV with a permissive header. Expected columns (case-insensitive):
 *   date, description, reference, debit, credit, balance
 * `debit` = money out of the bank; `credit` = money into the bank.
 */
function parseCsv(text: string): Omit<BankLine, "id" | "bank_account_id" | "reconciled" | "matched_entity_type" | "matched_entity_id">[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    date: header.findIndex((h) => h.includes("date")),
    description: header.findIndex((h) => h.includes("desc") || h.includes("narr") || h.includes("particular")),
    reference: header.findIndex((h) => h.includes("ref") || h.includes("chq")),
    debit: header.findIndex((h) => h === "debit" || h.includes("withdraw") || h.includes("dr")),
    credit: header.findIndex((h) => h === "credit" || h.includes("deposit") || h.includes("cr")),
    balance: header.findIndex((h) => h.includes("balance")),
  };
  if (idx.date < 0 || (idx.debit < 0 && idx.credit < 0)) return [];
  const rows = lines.slice(1).map((row) => {
    const cols = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const asNum = (v: string | undefined) => {
      if (!v) return 0;
      const cleaned = v.replace(/,/g, "").replace(/[^\d.-]/g, "");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      transaction_date: cols[idx.date] ?? "",
      description: idx.description >= 0 ? cols[idx.description] ?? "" : "",
      reference: idx.reference >= 0 ? cols[idx.reference] ?? null : null,
      debit: idx.debit >= 0 ? asNum(cols[idx.debit]) : 0,
      credit: idx.credit >= 0 ? asNum(cols[idx.credit]) : 0,
      balance: idx.balance >= 0 ? asNum(cols[idx.balance]) : null,
    };
  }).filter((r) => r.transaction_date && (r.debit > 0 || r.credit > 0));
  return rows;
}

function bookAmount(entry: BookEntry): number {
  return entry.amount;
}

function suggestMatch(line: BankLine, entries: BookEntry[]): BookEntry | null {
  // Money in on the bank should match a positive book entry (customer payment).
  // Money out on the bank should match a negative book entry (vendor payment / expense).
  const bankNet = line.credit - line.debit;
  const wantSign = bankNet >= 0 ? 1 : -1;
  const target = Math.abs(bankNet);
  if (target === 0) return null;
  let best: { entry: BookEntry; score: number } | null = null;
  for (const e of entries) {
    if (e.reconciled) continue;
    const amt = bookAmount(e);
    if ((amt >= 0 ? 1 : -1) !== wantSign) continue;
    const diff = Math.abs(Math.abs(amt) - target);
    if (diff > target * 0.02) continue; // within 2%
    // Prefer nearer dates
    const dayDiff = Math.abs(new Date(e.date).getTime() - new Date(line.transaction_date).getTime()) / (1000 * 60 * 60 * 24);
    const score = diff + dayDiff;
    if (!best || score < best.score) best = { entry: e, score };
  }
  return best?.entry ?? null;
}

export default function BankReconciliationPage() {
  const { toast } = useToast();
  const { user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [lines, setLines] = useState<BankLine[]>([]);
  const [book, setBook] = useState<BookEntry[]>([]);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAccounts = async () => {
    const { data } = await supabase.from("bank_accounts").select("*").order("account_name");
    setAccounts(data ?? []);
    if (!accountId && data && data.length > 0) setAccountId(data[0].id);
  };

  const loadForAccount = async (id: string) => {
    setLoading(true);
    try {
      const [lineRes, invRes, expRes, jelRes] = await Promise.all([
        supabase
          .from("bank_statements")
          .select("id, bank_account_id, transaction_date, description, reference:reference_number, debit:debit_amount, credit:credit_amount, balance, reconciled, matched_entity_type, matched_entity_id")
          .eq("bank_account_id", id)
          .order("transaction_date", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, invoice_number, customer_name, client_name, type, status, paid_at, total_amount, amount, currency, reconciled")
          .not("paid_at", "is", null)
          .order("paid_at", { ascending: false })
          .limit(500),
        supabase
          .from("expenses")
          .select("id, description, amount, date, status, reconciled")
          .eq("status", "approved")
          .order("date", { ascending: false })
          .limit(500),
        supabase
          .from("journal_entry_lines")
          .select("id, account_code, account_name, debit_amount, credit_amount, memo:description, reconciled, journal_entries(id, entry_date, reference, description, status)")
          .order("id", { ascending: false })
          .limit(500),
      ]);

      setLines((lineRes.data ?? []) as BankLine[]);

      const entries: BookEntry[] = [];
      for (const inv of invRes.data ?? []) {
        const amt = Number(inv.total_amount ?? inv.amount ?? 0);
        if (!inv.paid_at || amt <= 0) continue;
        entries.push({
          id: `inv-${inv.id}`,
          kind: "invoice_payment",
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
          id: `exp-${exp.id}`,
          kind: "expense",
          date: String(exp.date ?? "").slice(0, 10),
          description: exp.description ?? "Expense",
          reference: null,
          amount: -amt,
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
          id: `jel-${l.id}`,
          kind: "journal_line",
          date: je?.entry_date ?? "",
          description: `${je?.reference ?? "JE"} · ${l.memo ?? l.account_name}`,
          reference: je?.reference,
          amount: net > 0 ? net : net, // preserve sign
          reconciled: Boolean(l.reconciled),
          reference_id: l.id,
        });
      }
      setBook(entries);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (accountId) loadForAccount(accountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const account = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);
  const currency = account?.currency ?? "TZS";

  const totals = useMemo(() => {
    const bankIn = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    const bankOut = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const bankNet = bankIn - bankOut;
    const bookNet = book.reduce((s, e) => s + e.amount, 0);
    const reconciledBank = lines.filter((l) => l.reconciled).reduce((s, l) => s + (Number(l.credit) - Number(l.debit)), 0);
    const openLines = lines.filter((l) => !l.reconciled);
    const openBook = book.filter((e) => !e.reconciled);
    return {
      bankIn, bankOut, bankNet, bookNet,
      reconciledBank, difference: bankNet - bookNet,
      openLines: openLines.length, openBook: openBook.length,
    };
  }, [lines, book]);

  const uploadStatement = async (file: File) => {
    if (!accountId) return;
    setUploading(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast({ title: "Nothing to import", description: "Could not detect columns (date, debit/credit, description).", variant: "destructive" });
        return;
      }
      const payload = parsed.map((r) => ({
        bank_account_id: accountId,
        transaction_date: r.transaction_date,
        description: r.description,
        reference_number: r.reference,
        debit_amount: r.debit,
        credit_amount: r.credit,
        balance: r.balance,
        reconciled: false,
      }));
      const { error } = await supabase.from("bank_statements").insert(payload);
      if (error) throw error;
      await AuditTrailService.log({
        user_id: user?.id,
        module: "finance",
        action: "create",
        entity_type: "payment",
        entity_id: accountId,
        description: `Imported ${payload.length} statement line(s) for ${account?.account_name ?? "bank account"}`,
      });
      toast({ title: "Imported", description: `${payload.length} statement line(s) added.` });
      loadForAccount(accountId);
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const matchPair = async () => {
    if (!selectedLine || !selectedEntry) return;
    const line = lines.find((l) => l.id === selectedLine);
    const entry = book.find((e) => e.id === selectedEntry);
    if (!line || !entry) return;

    const bankNet = line.credit - line.debit;
    if ((bankNet >= 0) !== (entry.amount >= 0)) {
      toast({ title: "Direction mismatch", description: "Bank direction doesn't match the book side. Match cancelled.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("bank_statements")
      .update({
        reconciled: true,
        matched_entity_type: entry.kind,
        matched_entity_id: entry.reference_id,
      })
      .eq("id", line.id);
    if (error) {
      toast({ title: "Match failed", description: error.message, variant: "destructive" });
      return;
    }

    // Best-effort mark the counterparty as reconciled too
    if (entry.kind === "invoice_payment") {
      await supabase.from("invoices").update({ reconciled: true }).eq("id", entry.reference_id);
    } else if (entry.kind === "expense") {
      await supabase.from("expenses").update({ reconciled: true }).eq("id", entry.reference_id);
    } else if (entry.kind === "journal_line") {
      await supabase.from("journal_entry_lines").update({ reconciled: true }).eq("id", entry.reference_id);
    }

    await AuditTrailService.log({
      user_id: user?.id,
      module: "finance",
      action: "reconcile" as any,
      entity_type: "payment",
      entity_id: line.id,
      description: `Reconciled bank line to ${entry.kind.replace(/_/g, " ")} ${entry.reference ?? entry.reference_id}`,
    });

    setSelectedLine(null);
    setSelectedEntry(null);
    loadForAccount(accountId);
  };

  const autoMatch = async () => {
    const openLines = lines.filter((l) => !l.reconciled);
    let matched = 0;
    for (const l of openLines) {
      const suggestion = suggestMatch(l, book);
      if (!suggestion) continue;
      await supabase.from("bank_statements").update({
        reconciled: true,
        matched_entity_type: suggestion.kind,
        matched_entity_id: suggestion.reference_id,
      }).eq("id", l.id);
      matched += 1;
    }
    if (matched > 0) {
      await AuditTrailService.log({
        user_id: user?.id,
        module: "finance",
        action: "reconcile" as any,
        entity_type: "payment",
        entity_id: accountId,
        description: `Auto-matched ${matched} bank line(s) on ${account?.account_name}`,
      });
    }
    toast({ title: "Auto-match complete", description: `${matched} line(s) reconciled.` });
    loadForAccount(accountId);
  };

  const unmatch = async (id: string) => {
    await supabase.from("bank_statements").update({
      reconciled: false,
      matched_entity_type: null,
      matched_entity_id: null,
    }).eq("id", id);
    loadForAccount(accountId);
  };

  const finalise = async () => {
    if (!accountId) return;
    const closingBalance = lines[0]?.balance ?? null;
    const { error } = await supabase.from("bank_reconciliations").insert({
      bank_account_id: accountId,
      period_end: new Date().toISOString().slice(0, 10),
      opening_balance: null,
      closing_balance: closingBalance,
      book_balance: totals.bookNet,
      difference: totals.difference,
      lines_reconciled: lines.filter((l) => l.reconciled).length,
      reconciled_by: user?.id ?? null,
      status: totals.difference === 0 ? "balanced" : "unbalanced",
    });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    await AuditTrailService.log({
      user_id: user?.id,
      module: "finance",
      action: "reconcile" as any,
      entity_type: "payment",
      entity_id: accountId,
      description: `Reconciliation finalised for ${account?.account_name} · difference ${fmt(totals.difference, currency)}`,
    });
    toast({ title: "Reconciliation saved", description: totals.difference === 0 ? "Balanced ✓" : `Off by ${fmt(totals.difference, currency)}` });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/finance" className="text-[10px] text-muted-foreground hover:text-slate-600 flex items-center gap-0.5 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Finance
          </Link>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Landmark className="w-6 h-6 text-teal-600" /> Bank Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Match bank statement lines against your books until the balances agree
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="h-9 w-64">
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.bank_name} · {a.account_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadStatement(e.target.files[0])}
          />
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => fileRef.current?.click()} disabled={uploading || !accountId}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Import CSV
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={autoMatch} disabled={loading || !accountId}>
            <Link2 className="w-3.5 h-3.5" /> Auto-match
          </Button>
          <Button size="sm" className="h-9 gap-2 bg-teal-600 hover:bg-teal-700" onClick={finalise} disabled={loading || !accountId}>
            <ShieldCheck className="w-3.5 h-3.5" /> Finalise
          </Button>
        </div>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Statement Net", value: totals.bankNet, tone: "text-slate-800" },
          { label: "Book Net", value: totals.bookNet, tone: "text-slate-800" },
          { label: "Difference", value: totals.difference, tone: totals.difference === 0 ? "text-emerald-700" : "text-rose-700" },
          { label: "Open Lines", value: totals.openLines, tone: "text-slate-800", raw: true },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{k.label}</p>
            <p className={cn("text-2xl font-black mt-1", k.tone)}>
              {k.raw ? k.value : fmt(Number(k.value), currency)}
            </p>
            {k.label === "Difference" && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {totals.difference === 0 ? "Balanced — safe to finalise" : "Match more lines to close the gap"}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Match action bar */}
      {(selectedLine || selectedEntry) && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-indigo-200 bg-indigo-50">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-800">
            <ArrowRight className="w-4 h-4" />
            {selectedLine && selectedEntry
              ? "Ready to match"
              : selectedLine
              ? "Pick a book entry to match"
              : "Pick a bank line to match"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedLine(null); setSelectedEntry(null); }}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
            <Button size="sm" onClick={matchPair} disabled={!selectedLine || !selectedEntry} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
              <Link2 className="w-3.5 h-3.5" /> Match Pair
            </Button>
          </div>
        </div>
      )}

      {/* Two-column view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank side */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-800">Bank Statement Lines</h2>
              <p className="text-xs text-slate-500">{lines.length} imported · {totals.openLines} open</p>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : lines.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                No statement lines yet. Use Import CSV to load a bank statement.
              </div>
            ) : lines.map((l) => {
              const net = l.credit - l.debit;
              const active = selectedLine === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => !l.reconciled && setSelectedLine(active ? null : l.id)}
                  disabled={l.reconciled}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-3",
                    active && "bg-indigo-50",
                    l.reconciled ? "opacity-60" : "hover:bg-slate-50 cursor-pointer",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-500">{new Date(l.transaction_date).toLocaleDateString()}</p>
                      {l.reference && <span className="text-[10px] font-mono text-muted-foreground">{l.reference}</span>}
                      {l.reconciled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Reconciled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 truncate mt-0.5">{l.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-black", net >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {net >= 0 ? "+" : ""}{fmt(net, currency)}
                    </p>
                    {l.balance != null && <p className="text-[10px] text-muted-foreground">bal {fmt(l.balance, currency)}</p>}
                  </div>
                  {l.reconciled && (
                    <span
                      onClick={(e) => { e.stopPropagation(); unmatch(l.id); }}
                      className="text-[10px] text-muted-foreground hover:text-red-600 cursor-pointer flex items-center gap-0.5"
                    >
                      <Undo2 className="w-3 h-3" /> undo
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Book side */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-800">Book Entries</h2>
              <p className="text-xs text-slate-500">{book.length} candidates · {totals.openBook} open</p>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : book.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">No book entries to reconcile.</div>
            ) : book.map((e) => {
              const active = selectedEntry === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => !e.reconciled && setSelectedEntry(active ? null : e.id)}
                  disabled={e.reconciled}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-3",
                    active && "bg-indigo-50",
                    e.reconciled ? "opacity-60" : "hover:bg-slate-50 cursor-pointer",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {e.kind.replace(/_/g, " ")}
                      </span>
                      <p className="text-xs text-slate-500">{e.date}</p>
                      {e.reconciled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Reconciled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 truncate mt-0.5">{e.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-black", e.amount >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {e.amount >= 0 ? "+" : ""}{fmt(e.amount, currency)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
