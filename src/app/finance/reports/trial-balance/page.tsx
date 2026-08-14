"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/components/ui/currency-badge";
import {
  ArrowLeft,
  Calculator,
  Download,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeCurrency, sortCurrencyKeys } from "@/lib/finance/multi-currency";

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense" | "unknown";

interface COA {
  id: string;
  code: string;
  name: string;
  account_type?: string | null;
  category?: string | null;
  is_active?: boolean | null;
}

interface JELine {
  account_id?: string | null;
  account_code?: string | null;
  debit?: number | null;
  credit?: number | null;
  currency?: string | null;
  entry_date?: string | null;
  status?: string | null;
}

interface Row {
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "revenue", "expense", "unknown"];
const TYPE_LABEL: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
  unknown: "Unclassified",
};
const TYPE_ACCENT: Record<AccountType, string> = {
  asset: "border-l-emerald-500 bg-emerald-50/40",
  liability: "border-l-orange-500 bg-orange-50/40",
  equity: "border-l-violet-500 bg-violet-50/40",
  revenue: "border-l-indigo-500 bg-indigo-50/40",
  expense: "border-l-rose-500 bg-rose-50/40",
  unknown: "border-l-slate-400 bg-muted/40",
};

function classifyType(raw?: string | null): AccountType {
  const t = (raw ?? "").toLowerCase();
  if (t.startsWith("asset")) return "asset";
  if (t.startsWith("liab")) return "liability";
  if (t.startsWith("equity") || t.includes("capital")) return "equity";
  if (t.startsWith("rev") || t.includes("income") || t.includes("sales")) return "revenue";
  if (t.startsWith("exp") || t.includes("cost")) return "expense";
  return "unknown";
}

/** Debit-normal (asset, expense) accounts show a positive balance when debits > credits. */
function isDebitNormal(type: AccountType): boolean {
  return type === "asset" || type === "expense";
}

export default function TrialBalancePage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<COA[]>([]);
  const [lines, setLines] = useState<JELine[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [coaRes, lineRes] = await Promise.all([
        supabase.from("accounts").select("id, code, name, type:category, currency, balance:current_balance").eq("is_active", true),
        supabase.from("journal_entry_lines").select("*, journal_entries(entry_date, status, currency)"),
      ]);
      setAccounts(coaRes.data ?? []);
      const flat: JELine[] = (lineRes.data ?? []).map((l: any) => ({
        account_id: l.account_id,
        account_code: l.account_code ?? l.code,
        debit: l.debit,
        credit: l.credit,
        currency: normalizeCurrency(l.journal_entries?.currency ?? l.currency),
        entry_date: l.journal_entries?.entry_date ?? l.entry_date,
        status: l.journal_entries?.status ?? l.status,
      }));
      setLines(flat);
    } catch (err: any) {
      console.error("[trial-balance]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rowsByCurrency = useMemo<Record<string, Row[]>>(() => {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;

    const buckets: Record<string, Map<string, Row>> = {};

    for (const l of lines) {
      if (l.status && l.status !== "posted") continue;
      if (l.entry_date) {
        const t = new Date(l.entry_date).getTime();
        if (t < fromMs || t > toMs) continue;
      }
      const cur = normalizeCurrency(l.currency);
      if (!buckets[cur]) buckets[cur] = new Map();
      const key = l.account_code ?? l.account_id ?? "unknown";
      let row = buckets[cur].get(key);
      if (!row) {
        const acc = accounts.find((a) => (a.code ?? a.id) === key);
        row = {
          code: acc?.code ?? key,
          name: acc?.name ?? "(uncatalogued)",
          type: classifyType(acc?.account_type ?? acc?.category),
          debit: 0,
          credit: 0,
          balance: 0,
        };
        buckets[cur].set(key, row);
      }
      row.debit += Number(l.debit) || 0;
      row.credit += Number(l.credit) || 0;
    }

    const out: Record<string, Row[]> = {};
    for (const [cur, m] of Object.entries(buckets)) {
      const list = [...m.values()];
      for (const r of list) {
        r.balance = isDebitNormal(r.type) ? r.debit - r.credit : r.credit - r.debit;
      }
      out[cur] = list
        .filter((r) => r.debit !== 0 || r.credit !== 0)
        .sort((a, b) => a.code.localeCompare(b.code));
    }
    return out;
  }, [accounts, lines, from, to]);

  const currencies = useMemo(() => sortCurrencyKeys(Object.keys(rowsByCurrency)), [rowsByCurrency]);

  const groupedByCurrency = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Record<string, Record<AccountType, Row[]>> = {};
    for (const cur of currencies) {
      const filter = q
        ? (rowsByCurrency[cur] ?? []).filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(q))
        : (rowsByCurrency[cur] ?? []);
      const g: Record<AccountType, Row[]> = { asset: [], liability: [], equity: [], revenue: [], expense: [], unknown: [] };
      for (const r of filter) g[r.type].push(r);
      out[cur] = g;
    }
    return out;
  }, [rowsByCurrency, currencies, search]);

  const totalsByCurrency = useMemo(() => {
    const out: Record<string, { debit: number; credit: number; diff: number }> = {};
    for (const cur of currencies) {
      const rows = rowsByCurrency[cur] ?? [];
      const d = rows.reduce((s, r) => s + r.debit, 0);
      const c = rows.reduce((s, r) => s + r.credit, 0);
      out[cur] = { debit: d, credit: c, diff: d - c };
    }
    return out;
  }, [rowsByCurrency, currencies]);

  const exportCsv = () => {
    const header = ["Currency", "Code", "Name", "Type", "Debit", "Credit", "Balance"];
    const body: string[] = [header.join(",")];
    for (const cur of currencies) {
      for (const r of rowsByCurrency[cur] ?? []) {
        body.push([cur, r.code, r.name, r.type, r.debit, r.credit, r.balance].join(","));
      }
    }
    const blob = new Blob([body.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/finance" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Finance
          </Link>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Calculator className="w-6 h-6 text-violet-600" /> Trial Balance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currencies.length} currenc{currencies.length === 1 ? "y" : "ies"}
            {currencies.map((cur) => {
              const t = totalsByCurrency[cur];
              return ` · ${cur} Dr ${fmt(t.debit, cur)} / Cr ${fmt(t.credit, cur)}${t.diff === 0 ? " ✓" : ""}`;
            }).join("")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 border-0 focus-visible:ring-0 px-1" />
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">To</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 border-0 focus-visible:ring-0 px-1" />
          </div>
          <Button variant="outline" size="sm" onClick={load} className="h-9 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={exportCsv} className="h-9 gap-2 bg-violet-600 hover:bg-violet-700">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Balanced banner */}
      {/* Filter row */}
      <div className="flex items-center justify-end">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filter accounts…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-card" />
        </div>
      </div>

      {/* Per-currency TB */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : currencies.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground italic">
          No posted journal entries in this period.
        </div>
      ) : (
        currencies.map((cur) => {
          const t = totalsByCurrency[cur];
          const grouped = groupedByCurrency[cur];
          return (
            <section key={`tb-${cur}`} className="space-y-4">
              <div className={cn(
                "flex items-center justify-between rounded-2xl border p-4",
                t.diff === 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
              )}>
                <div className="text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-card border border-border text-foreground">{cur}</span>
                    <p className={cn("font-black", t.diff === 0 ? "text-emerald-800" : "text-rose-800")}>
                      {t.diff === 0 ? "Balanced" : "Out of balance"}
                    </p>
                  </div>
                  <p className={cn("text-xs mt-0.5", t.diff === 0 ? "text-emerald-700" : "text-rose-700")}>
                    Debits {fmt(t.debit, cur)} · Credits {fmt(t.credit, cur)}
                    {t.diff !== 0 && ` · off by ${fmt(Math.abs(t.diff), cur)}`}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {TYPE_ORDER.map((type) => {
                  const list = grouped[type];
                  if (!list || list.length === 0) return null;
                  const debit = list.reduce((s, r) => s + r.debit, 0);
                  const credit = list.reduce((s, r) => s + r.credit, 0);
                  const balance = list.reduce((s, r) => s + r.balance, 0);
                  return (
                    <div key={type} className={cn("bg-card rounded-2xl border border-border border-l-4 overflow-hidden", TYPE_ACCENT[type])}>
                      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-foreground uppercase tracking-wide">{TYPE_LABEL[type]}</h3>
                          <p className="text-[10px] text-muted-foreground">{list.length} account{list.length === 1 ? "" : "s"}</p>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Debit</p>
                            <p className="text-sm font-bold text-foreground">{fmt(debit, cur)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Credit</p>
                            <p className="text-sm font-bold text-foreground">{fmt(credit, cur)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Balance</p>
                            <p className={cn("text-sm font-black", balance >= 0 ? "text-emerald-700" : "text-rose-700")}>{fmt(Math.abs(balance), cur)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/70">
                          <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <th className="px-5 py-2 w-24">Code</th>
                            <th className="px-4 py-2">Account</th>
                            <th className="px-4 py-2 text-right">Debit ({cur})</th>
                            <th className="px-4 py-2 text-right">Credit ({cur})</th>
                            <th className="px-5 py-2 text-right">Balance ({cur})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((r) => (
                            <tr key={r.code} className="border-t border-border hover:bg-muted/60">
                              <td className="px-5 py-2 font-mono text-xs font-black text-foreground">{r.code}</td>
                              <td className="px-4 py-2 text-foreground">{r.name}</td>
                              <td className="px-4 py-2 text-right text-foreground">{r.debit > 0 ? fmt(r.debit, cur) : "—"}</td>
                              <td className="px-4 py-2 text-right text-foreground">{r.credit > 0 ? fmt(r.credit, cur) : "—"}</td>
                              <td className={cn("px-5 py-2 text-right font-bold", r.balance >= 0 ? "text-emerald-700" : "text-rose-700")}>
                                {fmt(Math.abs(r.balance), cur)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
