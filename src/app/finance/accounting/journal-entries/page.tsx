"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/components/supabase-provider";
import { AuditTrailService } from "@/services/audit-trail-service";
import { ChartOfAccountsService, type COAAccount } from "@/services/chart-of-accounts-service";
import { formatCurrency } from "@/components/ui/currency-badge";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Copy,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

const CURRENCIES = ["TZS", "USD", "EUR", "KES"] as const;
const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

interface Line {
  id: string;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  memo?: string;
}

interface Entry {
  id: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  currency: string | null;
  status: "posted" | "draft" | string;
  created_at: string;
  journal_entry_lines?: any[];
}

const emptyLine = (): Line => ({ 
  id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  account_code: "", 
  account_name: "", 
  debit_amount: 0, 
  credit_amount: 0, 
  memo: "" 
});

function AccountPicker({
  value,
  onChange,
  accounts,
  placeholder = "Account…",
  lineId,
}: {
  value: { code: string; name: string };
  onChange: (a: { code: string; name: string }) => void;
  accounts: COAAccount[];
  placeholder?: string;
  lineId: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return accounts
      .filter((a) => a.is_active !== false)
      .filter((a) => !t || `${a.code} ${a.name}`.toLowerCase().includes(t))
      .slice(0, 40);
  }, [accounts, q]);

  const handleOpen = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownWidth = Math.max(rect.width, 480);
    const dropdownHeight = 400;
    
    let left = rect.left;
    let top = rect.bottom + 4;
    
    // Adjust horizontal position if dropdown would go off screen
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16;
    }
    if (left < 16) left = 16;
    
    // Adjust vertical position if dropdown would go off screen bottom
    if (top + dropdownHeight > viewportHeight) {
      top = rect.top - dropdownHeight - 4;
    }
    
    setPosition({ top, left, width: dropdownWidth });
    setOpen(true);
  };

  const dropdownContent = (
    <div 
      ref={dropdownRef}
      className="fixed z-[10000] rounded-xl border border-border bg-card shadow-xl max-h-96 overflow-hidden flex flex-col"
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      <div className="p-3 border-b border-border">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code or name…"
          className="h-9"
        />
      </div>
      <div className="overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground italic text-center">No matching accounts.</div>
        ) : (
          filtered.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => {
                onChange({ code: a.code, name: a.name });
                setOpen(false);
                setQ("");
              }}
              className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center justify-between gap-4 border-b border-slate-50 last:border-0 transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-sm font-black text-muted-foreground shrink-0 w-14">{a.code}</span>
                <span className="text-sm text-foreground truncate">{a.name}</span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0 px-2 py-0.5 bg-muted rounded-full">
                {a.category}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={handleOpen}
        className={cn(
          "w-full text-left px-4 py-2.5 rounded-lg border border-border bg-card text-sm hover:border-indigo-300 transition-colors",
          !value.code && "text-muted-foreground",
        )}
      >
        {value.code ? (
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs font-black text-muted-foreground">{value.code}</span>
            <span className="text-foreground">{value.name}</span>
          </span>
        ) : (
          placeholder
        )}
      </button>
      {open && typeof window !== 'undefined' && createPortal(dropdownContent, document.body)}
    </>
  );
}

export default function JournalEntriesPage() {
  const { toast } = useToast();
  const { user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Entry | null>(null);
  const [posting, setPosting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "posted" | "draft">("all");

  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    reference: "",
    description: "",
    currency: "TZS",
  });
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  const load = async () => {
    setLoading(true);
    try {
      const [e, a] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("*, journal_entry_lines(*)")
          .order("entry_date", { ascending: false })
          .limit(200),
        ChartOfAccountsService.getAccounts(),
      ]);
      setEntries((e.data ?? []) as Entry[]);
      setAccounts(a);
    } catch (err: any) {
      toast({ title: "Load error", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0);
    const c = lines.reduce((s, l) => s + (Number(l.credit_amount) || 0), 0);
    return { debit: d, credit: c, diff: d - c, balanced: d > 0 && d === c };
  }, [lines]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (statusFilter !== "all" && (e.status ?? "posted") !== statusFilter) return false;
      if (q) {
        const hay = [e.reference, e.description, e.entry_date].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, statusFilter]);

  const openNew = () => {
    setForm({
      entry_date: new Date().toISOString().slice(0, 10),
      reference: `JE-${new Date().getFullYear()}-${String(entries.length + 1).padStart(4, "0")}`,
      description: "",
      currency: "TZS",
    });
    setLines([emptyLine(), emptyLine()]);
    setCreating(true);
  };

  const reverse = (e: Entry) => {
    setForm({
      entry_date: new Date().toISOString().slice(0, 10),
      reference: `${e.reference ?? "JE"}-REV`,
      description: `Reversal of ${e.reference ?? e.id}`,
      currency: e.currency ?? "TZS",
    });
    const src = (e.journal_entry_lines ?? []) as any[];
    setLines(
      src.map((l) => ({
        account_code: l.account_code,
        account_name: l.account_name,
        debit_amount: Number(l.credit_amount) || 0,
        credit_amount: Number(l.debit_amount) || 0,
        memo: l.memo ?? l.description ?? undefined,
      })),
    );
    setCreating(true);
    setDetail(null);
  };

  const post = async (asDraft = false) => {
    if (!form.description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    const usable = lines.filter((l) => l.account_code && (l.debit_amount > 0 || l.credit_amount > 0));
    if (usable.length < 2) {
      toast({ title: "Need at least 2 lines", variant: "destructive" });
      return;
    }
    if (!asDraft && !totals.balanced) {
      toast({
        title: "Not balanced",
        description: `Debits ${fmt(totals.debit, form.currency)} · Credits ${fmt(totals.credit, form.currency)}`,
        variant: "destructive",
      });
      return;
    }
    setPosting(true);
    try {
      const { data: header, error: hErr } = await supabase
        .from("journal_entries")
        .insert({
          entry_date: form.entry_date,
          reference: form.reference,
          description: form.description,
          currency: form.currency,
          status: "draft",
          total_amount: totals.debit,
          created_by: user?.id ?? null,
        })
        .select()
        .maybeSingle();
      if (hErr) throw hErr;

      const linePayload = usable.map((l) => ({
        journal_entry_id: header!.id,
        account_code: l.account_code,
        account_name: l.account_name,
        debit_amount: Number(l.debit_amount) || 0,
        credit_amount: Number(l.credit_amount) || 0,
        description: l.memo || null,
      }));
      const { error: lErr } = await supabase.from("journal_entry_lines").insert(linePayload);
      if (lErr) throw lErr;

      if (!asDraft) {
        // Server-side validated transition (balance check, period check, role check)
        const { error: postErr } = await supabase.rpc("post_journal_entry", { p_id: header!.id });
        if (postErr) {
          const fnMissing = postErr.code === "PGRST202" || /post_journal_entry/i.test(postErr.message ?? "");
          if (fnMissing) {
            // Migration 006 not applied yet — legacy direct post
            const { error: updErr } = await supabase
              .from("journal_entries")
              .update({ status: "posted", is_posted: true, posted_at: new Date().toISOString() })
              .eq("id", header!.id);
            if (updErr) throw updErr;
          } else {
            throw postErr;
          }
        }
      }

      await AuditTrailService.log({
        user_id: user?.id,
        module: "finance",
        action: "create",
        entity_type: "journal_entry",
        entity_id: header!.id,
        new_value: { ...header, lines: linePayload },
        description: `${asDraft ? "Draft" : "Posted"} ${form.reference}: ${form.description}`,
      });

      toast({ title: asDraft ? "Draft saved" : "Journal posted", description: form.reference });
      setCreating(false);
      load();
    } catch (err: any) {
      toast({ title: "Post failed", description: err?.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));
  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/finance" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Finance
          </Link>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-violet-600" /> Journal Entries
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {entries.length} entries · {entries.filter((e) => (e.status ?? "posted") === "posted").length} posted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="h-9 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={openNew} className="h-9 gap-2 bg-violet-600 hover:bg-violet-700">
            <Plus className="w-3.5 h-3.5" /> New Entry
          </Button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "posted", "draft"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-full border transition-colors",
              statusFilter === s
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-border bg-card text-foreground hover:bg-muted/60",
            )}
          >
            {s === "all" ? "All statuses" : s === "posted" ? "Posted only" : "Drafts only"}
          </button>
        ))}
        <div className="ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference or description…" className="pl-9 h-9" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Lines</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…</td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-muted-foreground"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" /> No entries.</td></tr>
              ) : filteredEntries.map((e) => {
                const lineCount = e.journal_entry_lines?.length ?? 0;
                const total = (e.journal_entry_lines ?? []).reduce((s: number, l: any) => s + (Number(l.debit_amount) || 0), 0);
                return (
                  <tr key={e.id} className="border-b border-border hover:bg-muted/60 cursor-pointer" onClick={() => setDetail(e)}>
                    <td className="px-4 py-3 text-foreground text-xs">{new Date(e.entry_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{e.reference ?? `JE-${e.id.slice(0, 6)}`}</td>
                    <td className="px-4 py-3 text-foreground">{e.description}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{lineCount}</td>
                    <td className="px-4 py-3 text-right font-black text-foreground">{fmt(total, e.currency ?? "TZS")}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn(
                        "text-[10px] uppercase font-black tracking-wider border",
                        (e.status ?? "posted") === "posted"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-amber-100 text-amber-700 border-amber-200",
                      )}>
                        {e.status ?? "posted"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl my-4 sm:my-8 mx-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-black text-foreground">New Journal Entry</h3>
                <p className="text-xs text-muted-foreground">Double-entry — debits must equal credits</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCreating(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-3 sm:p-5 space-y-4">
              {/* Header fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reference</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. June rent payment" />
                </div>
              </div>

              {/* Lines */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="hidden sm:grid grid-cols-[1fr_140px_140px_180px_36px] gap-2 px-3 py-2 bg-muted border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <div>Account</div>
                  <div className="text-right">Debit</div>
                  <div className="text-right">Credit</div>
                  <div>Memo</div>
                  <div />
                </div>
                {lines.map((l, i) => (
                  <div key={l.id} className="p-3 border-b border-slate-50 last:border-0 space-y-3 sm:space-y-0">
                    <div className="sm:hidden">
                      <Label className="text-xs mb-1 block">Account</Label>
                      <AccountPicker
                        value={{ code: l.account_code, name: l.account_name }}
                        accounts={accounts}
                        lineId={l.id}
                        onChange={(a) => updateLine(i, { account_code: a.code, account_name: a.name })}
                      />
                    </div>
                    <div className="hidden sm:grid grid-cols-[1fr_140px_140px_180px_36px] gap-2 items-center">
                      <AccountPicker
                        value={{ code: l.account_code, name: l.account_name }}
                        accounts={accounts}
                        lineId={l.id}
                        onChange={(a) => updateLine(i, { account_code: a.code, account_name: a.name })}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={l.debit_amount || ""}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          updateLine(i, { debit_amount: v, credit_amount: v ? 0 : l.credit_amount });
                        }}
                        className="text-right h-9"
                        placeholder="0.00"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={l.credit_amount || ""}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          updateLine(i, { credit_amount: v, debit_amount: v ? 0 : l.debit_amount });
                        }}
                        className="text-right h-9"
                        placeholder="0.00"
                      />
                      <Input
                        value={l.memo ?? ""}
                        onChange={(e) => updateLine(i, { memo: e.target.value })}
                        className="h-9"
                        placeholder="Optional line note"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="sm:hidden grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs mb-1 block">Debit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={l.debit_amount || ""}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            updateLine(i, { debit_amount: v, credit_amount: v ? 0 : l.credit_amount });
                          }}
                          className="text-right h-11"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Credit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={l.credit_amount || ""}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            updateLine(i, { credit_amount: v, debit_amount: v ? 0 : l.debit_amount });
                          }}
                          className="text-right h-11"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="sm:hidden">
                      <Label className="text-xs mb-1 block">Memo</Label>
                      <Input
                        value={l.memo ?? ""}
                        onChange={(e) => updateLine(i, { memo: e.target.value })}
                        className="h-11"
                        placeholder="Optional line note"
                      />
                    </div>
                    <div className="sm:hidden flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="px-3 py-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/50">
                  <Button variant="outline" size="sm" onClick={addLine} className="h-9 sm:h-8 gap-1 w-full sm:w-auto">
                    <Plus className="w-3.5 h-3.5" /> Add line
                  </Button>
                  <div className="flex items-center gap-4 sm:gap-6 text-xs w-full sm:w-auto justify-between sm:justify-end">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Debits</p>
                      <p className="font-black text-foreground text-sm">{fmt(totals.debit, form.currency)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Credits</p>
                      <p className="font-black text-foreground text-sm">{fmt(totals.credit, form.currency)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Diff</p>
                      <p className={cn("font-black text-sm", totals.balanced ? "text-emerald-700" : "text-rose-700")}>
                        {totals.balanced ? "Balanced" : fmt(Math.abs(totals.diff), form.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-5 py-4 border-t border-border bg-muted">
              <div className={cn("text-xs font-bold text-center sm:text-left", totals.balanced ? "text-emerald-700" : "text-rose-700")}>
                {totals.balanced
                  ? "Ready to post"
                  : totals.debit === 0 && totals.credit === 0
                  ? "Enter debit and credit amounts"
                  : `Off by ${fmt(Math.abs(totals.diff), form.currency)}`}
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setCreating(false)} disabled={posting} className="w-full sm:w-auto">Cancel</Button>
                <Button variant="outline" onClick={() => post(true)} disabled={posting} className="w-full sm:w-auto">Save as Draft</Button>
                <Button onClick={() => post(false)} disabled={posting || !totals.balanced} className="bg-violet-600 hover:bg-violet-700 gap-2 w-full sm:w-auto">
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Post Entry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-card rounded-2xl shadow-2xl mt-16">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Journal Entry</p>
                <h3 className="text-lg font-black text-foreground font-mono">{detail.reference ?? `JE-${detail.id.slice(0, 6)}`}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => reverse(detail)} className="gap-1 h-8">
                  <Copy className="w-3.5 h-3.5" /> Reverse
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDetail(null)}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Date</p>
                  <p className="font-bold text-foreground">{new Date(detail.entry_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Currency</p>
                  <p className="font-bold text-foreground">{detail.currency ?? "TZS"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Status</p>
                  <Badge className={cn(
                    "text-[10px] uppercase font-black tracking-wider border",
                    (detail.status ?? "posted") === "posted"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-amber-100 text-amber-700 border-amber-200",
                  )}>
                    {detail.status ?? "posted"}
                  </Badge>
                </div>
                <div className="col-span-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Description</p>
                  <p className="text-foreground">{detail.description}</p>
                </div>
              </div>
              <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
                <thead className="bg-muted">
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.journal_entry_lines ?? []).map((l: any) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-black text-muted-foreground mr-2">{l.account_code}</span>
                        <span className="text-foreground">{l.account_name}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{Number(l.debit_amount) > 0 ? fmt(Number(l.debit_amount), detail.currency ?? "TZS") : "—"}</td>
                      <td className="px-3 py-2 text-right">{Number(l.credit_amount) > 0 ? fmt(Number(l.credit_amount), detail.currency ?? "TZS") : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{l.memo ?? l.description ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted">
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
