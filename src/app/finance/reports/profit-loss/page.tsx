"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/components/ui/currency-badge";
import { normalizeCurrency, REPORTING_CURRENCY, sortCurrencyKeys } from "@/lib/finance/multi-currency";
import { loadRateMap } from "@/lib/finance/fx";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

type COAAccount = {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  account_type?: string | null;
};

type JEL = {
  account_code?: string | null;
  account_id?: string | null;
  debit_amount?: number | null;
  credit_amount?: number | null;
  entry_date?: string | null;
  status?: string | null;
  currency?: string | null;
};

type Section = "revenue" | "cogs" | "opex" | "other_expense" | "unknown";
const SECTION_LABEL: Record<Section, string> = {
  revenue: "Revenue",
  cogs: "Cost of Sales",
  opex: "Operating Expenses",
  other_expense: "Other Expenses",
  unknown: "Unclassified",
};
const SECTION_ACCENT: Record<Section, string> = {
  revenue: "border-l-emerald-500 bg-emerald-50/40",
  cogs: "border-l-orange-500 bg-orange-50/40",
  opex: "border-l-rose-500 bg-rose-50/40",
  other_expense: "border-l-amber-500 bg-amber-50/40",
  unknown: "border-l-slate-400 bg-slate-50/40",
};

function classify(category?: string | null, accountType?: string | null): Section {
  const c = (category ?? "").toUpperCase();
  const t = (accountType ?? "").toLowerCase();
  if (c === "REVENUE" || t.includes("revenue") || t.includes("income") || t.includes("sales")) return "revenue";
  if (c === "COST_OF_SALES" || t.includes("cogs") || t.includes("cost of sales")) return "cogs";
  if (c === "OPERATING_EXPENSES" || t.includes("operating")) return "opex";
  if (c === "OTHER_EXPENSES" || t.includes("other expense") || t.startsWith("expense")) return "other_expense";
  if (t.startsWith("expense") || t.startsWith("cost")) return "opex";
  return "unknown";
}

interface Row { code: string; name: string; section: Section; amount: number; }

function computeRowsByCurrency(accounts: COAAccount[], lines: JEL[], fromMs: number, toMs: number): Record<string, Row[]> {
  const byCur: Record<string, Map<string, Row>> = {};
  const ensureAccount = (cur: string, code: string, name: string, section: Section) => {
    if (!byCur[cur]) byCur[cur] = new Map();
    if (!byCur[cur].has(code)) {
      byCur[cur].set(code, { code, name, section, amount: 0 });
    }
    return byCur[cur].get(code)!;
  };

  for (const l of lines) {
    if (l.status && l.status !== "posted") continue;
    if (l.entry_date) {
      const t = new Date(l.entry_date).getTime();
      if (t < fromMs || t > toMs) continue;
    }
    const key = l.account_code ?? l.account_id ?? "";
    if (!key) continue;
    const acc = accounts.find((a) => (a.code ?? a.id) === key);
    const section = classify(acc?.category, acc?.account_type);
    if (section === "unknown") continue;
    const cur = normalizeCurrency(l.currency);
    const row = ensureAccount(cur, acc?.code ?? key, acc?.name ?? "(unnamed)", section);
    const debit = Number(l.debit_amount) || 0;
    const credit = Number(l.credit_amount) || 0;
    if (row.section === "revenue") {
      row.amount += credit - debit;
    } else {
      row.amount += debit - credit;
    }
  }
  const out: Record<string, Row[]> = {};
  for (const [cur, m] of Object.entries(byCur)) {
    out[cur] = [...m.values()].filter((r) => r.amount !== 0);
  }
  return out;
}

function sectionTotal(rows: Row[], section: Section): number {
  return rows.filter((r) => r.section === section).reduce((s, r) => s + r.amount, 0);
}

export default function ProfitLossPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<COAAccount[]>([]);
  const [lines, setLines] = useState<JEL[]>([]);
  const [consolidated, setConsolidated] = useState(false);
  const [rateMap, setRateMap] = useState<Record<string, number>>({});
  const [rateLoading, setRateLoading] = useState(false);

  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    try {
      const [coaRes, jeRes] = await Promise.all([
        supabase.from("accounts").select("*"),
        supabase.from("journal_entry_lines").select("*, journal_entries(entry_date, status, currency)"),
      ]);
      setAccounts((coaRes.data ?? []) as COAAccount[]);
      const flat: JEL[] = (jeRes.data ?? []).map((l: any) => ({
        account_code: l.account_code,
        account_id: l.account_id,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount,
        entry_date: l.journal_entries?.entry_date ?? l.entry_date,
        status: l.journal_entries?.status ?? l.status,
        currency: normalizeCurrency(l.journal_entries?.currency ?? l.currency),
      }));
      setLines(flat);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const currentByCcy = useMemo(() => {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
    return computeRowsByCurrency(accounts, lines, fromMs, toMs);
  }, [accounts, lines, from, to]);

  const previousByCcy = useMemo(() => {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    const len = toMs - fromMs;
    const prevTo = fromMs - 1;
    const prevFrom = prevTo - len;
    return computeRowsByCurrency(accounts, lines, prevFrom, prevTo);
  }, [accounts, lines, from, to]);

  const currencies = useMemo(
    () => sortCurrencyKeys(Array.from(new Set([...Object.keys(currentByCcy), ...Object.keys(previousByCcy)]))),
    [currentByCcy, previousByCcy],
  );

  // Load FX rates as-of the "to" date whenever consolidation is toggled on.
  useEffect(() => {
    if (!consolidated) return;
    const others = currencies.filter((c) => c !== REPORTING_CURRENCY);
    if (others.length === 0) {
      setRateMap({});
      return;
    }
    setRateLoading(true);
    loadRateMap(others, REPORTING_CURRENCY, to)
      .then(setRateMap)
      .finally(() => setRateLoading(false));
  }, [consolidated, currencies, to]);

  const missingRates = useMemo(() => {
    if (!consolidated) return [] as string[];
    return currencies
      .filter((c) => c !== REPORTING_CURRENCY)
      .filter((c) => rateMap[`${c}->${REPORTING_CURRENCY}`] == null);
  }, [consolidated, currencies, rateMap]);

  const consolidatedTotals = useMemo(() => {
    if (!consolidated) return null;
    let revenue = 0, cogs = 0, opex = 0, other = 0;
    let prevRevenue = 0, prevCogs = 0, prevOpex = 0, prevOther = 0;
    for (const cur of currencies) {
      const rate = cur === REPORTING_CURRENCY ? 1 : rateMap[`${cur}->${REPORTING_CURRENCY}`];
      if (rate == null) continue;
      const current = currentByCcy[cur] ?? [];
      const previous = previousByCcy[cur] ?? [];
      revenue += sectionTotal(current, "revenue") * rate;
      cogs += sectionTotal(current, "cogs") * rate;
      opex += sectionTotal(current, "opex") * rate;
      other += sectionTotal(current, "other_expense") * rate;
      prevRevenue += sectionTotal(previous, "revenue") * rate;
      prevCogs += sectionTotal(previous, "cogs") * rate;
      prevOpex += sectionTotal(previous, "opex") * rate;
      prevOther += sectionTotal(previous, "other_expense") * rate;
    }
    const gross = revenue - cogs;
    const operating = gross - opex;
    const net = operating - other;
    const prevGross = prevRevenue - prevCogs;
    const prevOperating = prevGross - prevOpex;
    const prevNet = prevOperating - prevOther;
    return { revenue, cogs, opex, other, gross, operating, net, prevRevenue, prevCogs, prevOpex, prevOther, prevGross, prevOperating, prevNet };
  }, [consolidated, currencies, rateMap, currentByCcy, previousByCcy]);

  const pctDelta = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const exportCsv = () => {
    const header = ["Currency", "Section", "Code", "Name", "Amount"];
    const rows: string[] = [header.join(",")];
    for (const cur of currencies) {
      const current = currentByCcy[cur] ?? [];
      for (const r of current) rows.push([cur, SECTION_LABEL[r.section], r.code, r.name, r.amount].join(","));
      const rev = sectionTotal(current, "revenue");
      const cogs = sectionTotal(current, "cogs");
      const opex = sectionTotal(current, "opex");
      const other = sectionTotal(current, "other_expense");
      const gross = rev - cogs;
      const operating = gross - opex;
      const net = operating - other;
      rows.push("");
      rows.push([cur, "Revenue", "", "Total revenue", rev].join(","));
      rows.push([cur, "COGS", "", "Total COGS", cogs].join(","));
      rows.push([cur, "Gross Profit", "", "", gross].join(","));
      rows.push([cur, "Opex", "", "Total operating", opex].join(","));
      rows.push([cur, "Operating Profit", "", "", operating].join(","));
      rows.push([cur, "Other Expense", "", "", other].join(","));
      rows.push([cur, "Net Profit", "", "", net].join(","));
      rows.push("");
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections: Section[] = ["revenue", "cogs", "opex", "other_expense", "unknown"];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/finance" className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Finance
          </Link>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" /> Profit & Loss
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {from} → {to} · vs prior-period baseline · {currencies.length} currenc{currencies.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 border-0 focus-visible:ring-0 px-1" />
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">To</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 border-0 focus-visible:ring-0 px-1" />
          </div>
          <button
            onClick={() => setConsolidated((v) => !v)}
            className={cn(
              "h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-2 transition-colors",
              consolidated
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
            title={`Consolidate all currencies into ${REPORTING_CURRENCY} using FX rates as-of the ‘To’ date`}
          >
            Consolidated ({REPORTING_CURRENCY})
          </button>
          <Button variant="outline" size="sm" onClick={load} className="h-9 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={exportCsv} className="h-9 gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Consolidated view */}
      {consolidated && (
        <div className="bg-white border border-indigo-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/50 flex items-baseline justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">Consolidated</span>
                <h2 className="text-sm font-black text-slate-800">P&L in {REPORTING_CURRENCY}</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Non-{REPORTING_CURRENCY} amounts converted using rates effective on or before {to}
              </p>
            </div>
            {rateLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
          </div>
          {missingRates.length > 0 && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 flex items-baseline justify-between gap-3">
              <p>
                <strong>Missing FX rates:</strong> {missingRates.join(", ")}. Those currencies are excluded from the consolidated totals.
              </p>
              <Link href="/finance/accounting/fx-rates" className="font-bold underline whitespace-nowrap">
                Add rates <ChevronRight className="inline w-3 h-3" />
              </Link>
            </div>
          )}
          {consolidatedTotals && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "Revenue", value: consolidatedTotals.revenue, prev: consolidatedTotals.prevRevenue },
                { label: "Gross Profit", value: consolidatedTotals.gross, prev: consolidatedTotals.prevGross, sub: consolidatedTotals.revenue > 0 ? `${((consolidatedTotals.gross / consolidatedTotals.revenue) * 100).toFixed(1)}% margin` : undefined },
                { label: "Operating Profit", value: consolidatedTotals.operating, prev: consolidatedTotals.prevOperating },
                { label: "Net Profit", value: consolidatedTotals.net, prev: consolidatedTotals.prevNet, sub: consolidatedTotals.revenue > 0 ? `${((consolidatedTotals.net / consolidatedTotals.revenue) * 100).toFixed(1)}% margin` : undefined },
              ].map((k) => {
                const d = pctDelta(k.value, k.prev);
                return (
                  <div key={k.label} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{k.label}</p>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5",
                        d >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                      )}>
                        {d >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(d).toFixed(1)}%
                      </span>
                    </div>
                    <p className={cn("text-xl font-black mt-1", k.value >= 0 ? "text-slate-900" : "text-rose-700")}>
                      {fmt(k.value, REPORTING_CURRENCY)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{k.sub ?? `Prior ${fmt(k.prev, REPORTING_CURRENCY)}`}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Per-currency P&L */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : currencies.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400 italic">
          No posted journal entries in this period.
        </div>
      ) : (
        currencies.map((cur) => {
          const current = currentByCcy[cur] ?? [];
          const previous = previousByCcy[cur] ?? [];
          const revenue = sectionTotal(current, "revenue");
          const cogs = sectionTotal(current, "cogs");
          const opex = sectionTotal(current, "opex");
          const other = sectionTotal(current, "other_expense");
          const gross = revenue - cogs;
          const operating = gross - opex;
          const net = operating - other;

          const prevRevenue = sectionTotal(previous, "revenue");
          const prevCogs = sectionTotal(previous, "cogs");
          const prevOpex = sectionTotal(previous, "opex");
          const prevOther = sectionTotal(previous, "other_expense");
          const prevGross = prevRevenue - prevCogs;
          const prevOperating = prevGross - prevOpex;
          const prevNet = prevOperating - prevOther;

          const grossMarginPct = revenue > 0 ? (gross / revenue) * 100 : 0;
          const netMarginPct = revenue > 0 ? (net / revenue) * 100 : 0;

          const kpis = [
            { label: "Revenue", value: revenue, prev: prevRevenue },
            { label: "Gross Profit", value: gross, prev: prevGross, sub: `${grossMarginPct.toFixed(1)}% margin` },
            { label: "Operating Profit", value: operating, prev: prevOperating },
            { label: "Net Profit", value: net, prev: prevNet, sub: `${netMarginPct.toFixed(1)}% margin` },
          ];

          return (
            <section key={`pnl-${cur}`} className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-black text-slate-800 flex items-baseline gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{cur}</span>
                  P&L
                </h2>
                <p className="text-xs text-slate-500">All amounts native {cur} · no FX applied</p>
              </div>

              {/* KPI strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpis.map((k) => {
                  const delta = pctDelta(k.value, k.prev);
                  const positive = k.value >= 0;
                  return (
                    <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-5">
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{k.label}</p>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5",
                          delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                        )}>
                          {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(delta).toFixed(1)}%
                        </span>
                      </div>
                      <p className={cn("text-2xl font-black tracking-tight mt-1", positive ? "text-slate-900" : "text-rose-700")}>
                        {fmt(k.value, cur)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {k.sub ?? `Prior ${fmt(k.prev, cur)}`}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Sections */}
              <div className="space-y-4">
                {sections.map((section) => {
                  const rows = current.filter((r) => r.section === section);
                  if (rows.length === 0) return null;
                  const total = rows.reduce((s, r) => s + r.amount, 0);
                  const prevRows = previous.filter((r) => r.section === section);
                  const prevSectionTotal = prevRows.reduce((s, r) => s + r.amount, 0);
                  const prevByCode = new Map(prevRows.map((r) => [r.code, r.amount]));

                  return (
                    <div key={section} className={cn("bg-white rounded-2xl border border-slate-200 border-l-4 overflow-hidden", SECTION_ACCENT[section])}>
                      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">{SECTION_LABEL[section]}</h3>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Prior</p>
                            <p className="text-sm text-slate-500">{fmt(prevSectionTotal, cur)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Current</p>
                            <p className="text-sm font-black text-slate-800">{fmt(total, cur)}</p>
                          </div>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/70">
                          <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <th className="px-5 py-2 w-24">Code</th>
                            <th className="px-4 py-2">Account</th>
                            <th className="px-4 py-2 text-right">Prior</th>
                            <th className="px-4 py-2 text-right">Current</th>
                            <th className="px-5 py-2 text-right">Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => {
                            const prev = prevByCode.get(r.code) ?? 0;
                            const d = pctDelta(r.amount, prev);
                            return (
                              <tr key={r.code} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-5 py-2 font-mono text-xs font-black text-slate-800">{r.code}</td>
                                <td className="px-4 py-2 text-slate-700">{r.name}</td>
                                <td className="px-4 py-2 text-right text-slate-500 text-xs">{fmt(prev, cur)}</td>
                                <td className="px-4 py-2 text-right font-bold text-slate-800">{fmt(r.amount, cur)}</td>
                                <td className={cn("px-5 py-2 text-right text-xs font-bold", d >= 0 ? "text-emerald-700" : "text-rose-700")}>
                                  {d >= 0 ? "+" : ""}{d.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-3">Summary ({cur})</h3>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: "Revenue", val: revenue, tone: "text-slate-800" },
                      { label: "− Cost of Sales", val: cogs, tone: "text-slate-500" },
                      { label: "= Gross Profit", val: gross, tone: "font-black text-emerald-700 border-t border-slate-100 pt-2 mt-1" },
                      { label: "− Operating Expenses", val: opex, tone: "text-slate-500" },
                      { label: "= Operating Profit", val: operating, tone: "font-black text-slate-800 border-t border-slate-100 pt-2 mt-1" },
                      { label: "− Other Expenses", val: other, tone: "text-slate-500" },
                      { label: "= Net Profit", val: net, tone: cn("font-black text-lg border-t-2 border-slate-200 pt-2 mt-1", net >= 0 ? "text-emerald-700" : "text-rose-700") },
                    ].map((r) => (
                      <div key={r.label} className={cn("flex items-center justify-between", r.tone)}>
                        <span>{r.label}</span>
                        <span className="font-mono">{fmt(r.val, cur)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
