"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/components/ui/currency-badge";
import {
  AGING_BUCKETS,
  bucketFor,
  daysOverdue,
  isOpenForAging,
  summarize,
  summarizeByCurrency,
  type AgingBucketKey,
} from "@/lib/finance/aging";
import { normalizeCurrency, sortCurrencyKeys } from "@/lib/finance/multi-currency";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

type Kind = "ar" | "ap";

interface Row {
  id: string;
  party: string;
  invoice_number: string;
  due_date: string | null;
  balance: number;
  currency: string;
  bucket: AgingBucketKey;
  days: number;
}

export default function AgingReportPage() {
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>("ar");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("invoices").select("*");
      const list = data ?? [];
      setInvoices(list.filter((i: any) => (i.type ?? "receivable") === "receivable"));
      setBills(list.filter((i: any) => i.type === "payable"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const source = kind === "ar" ? invoices : bills;

  const inputs = useMemo(
    () =>
      source.map((s) => ({
        amount: (Number(s.total_amount ?? s.amount ?? 0)) - Number(s.paid_amount ?? 0),
        due_date: s.due_date,
        status: s.status,
        id: s.id,
        currency: normalizeCurrency(s.currency),
      })),
    [source],
  );

  const summaryByCcy = useMemo(() => summarizeByCurrency(inputs), [inputs]);
  const currencies = useMemo(() => sortCurrencyKeys(Object.keys(summaryByCcy)), [summaryByCcy]);

  const rows = useMemo<Row[]>(() => {
    return source
      .filter((s) => isOpenForAging(s.status))
      .map((s) => {
        const balance = Number(s.total_amount ?? s.amount ?? 0) - Number(s.paid_amount ?? 0);
        return {
          id: s.id,
          party: s.customer_name ?? s.client_name ?? s.vendor ?? "Unknown",
          invoice_number: s.invoice_number,
          due_date: s.due_date,
          balance,
          currency: s.currency ?? "TZS",
          bucket: bucketFor(s.due_date),
          days: daysOverdue(s.due_date),
        };
      })
      .filter((r) => r.balance > 0)
      .sort((a, b) => b.days - a.days);
  }, [source]);

  const byPartyByCurrency = useMemo(() => {
    const map: Record<string, Map<string, { party: string; total: number; buckets: Record<AgingBucketKey, number> }>> = {};
    for (const r of rows) {
      const cur = r.currency;
      if (!map[cur]) map[cur] = new Map();
      let entry = map[cur].get(r.party);
      if (!entry) {
        entry = { party: r.party, total: 0, buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 } };
        map[cur].set(r.party, entry);
      }
      entry.buckets[r.bucket] += r.balance;
      entry.total += r.balance;
    }
    const out: Record<string, { party: string; total: number; buckets: Record<AgingBucketKey, number> }[]> = {};
    for (const [cur, m] of Object.entries(map)) {
      out[cur] = [...m.values()].sort((a, b) => b.total - a.total);
    }
    return out;
  }, [rows]);

  const rowsByCurrency = useMemo(() => {
    const out: Record<string, Row[]> = {};
    for (const r of rows) {
      if (!out[r.currency]) out[r.currency] = [];
      out[r.currency].push(r);
    }
    return out;
  }, [rows]);

  const exportCsv = () => {
    const header = ["Party", "Invoice #", "Due", "Days", "Bucket", "Balance"];
    const body = rows.map((r) => [r.party, r.invoice_number, r.due_date, r.days, r.bucket, r.balance].join(","));
    const csv = [header.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind === "ar" ? "receivables" : "payables"}-aging.csv`;
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
            <AlertTriangle className="w-6 h-6 text-amber-600" /> Aging Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {kind === "ar" ? "Receivables" : "Payables"} across {currencies.length} currenc{currencies.length === 1 ? "y" : "ies"}
            {currencies.map((c) => {
              const s = summaryByCcy[c];
              return ` · ${c} ${fmt(s.totalOutstanding, c)}`;
            }).join("")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setKind("ar")}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1",
                kind === "ar" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <FileText className="w-3.5 h-3.5" /> Receivables
            </button>
            <button
              onClick={() => setKind("ap")}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1",
                kind === "ap" ? "bg-orange-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Building2 className="w-3.5 h-3.5" /> Payables
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="h-9 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={exportCsv} className="h-9 gap-2 bg-slate-800 hover:bg-slate-900">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Aging strip — per currency */}
      {loading ? null : currencies.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground italic">
          Nothing outstanding.
        </div>
      ) : (
        currencies.map((cur) => {
          const s = summaryByCcy[cur];
          return (
            <div key={`strip-${cur}`} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted text-foreground">{cur}</span>
                  <h2 className="text-sm font-black text-foreground">Portfolio distribution</h2>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmt(s.totalOutstanding, cur)} outstanding · {fmt(s.totalOverdue, cur)} overdue · worst {s.worstDays}d
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {AGING_BUCKETS.map((b) => (
                  <div key={b.key} className={cn("rounded-xl border p-4", b.color)}>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", b.textColor)}>{b.label}</p>
                    <p className="text-lg font-black text-foreground mt-1">{fmt(s.totals[b.key], cur)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.counts[b.key]} open</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* By party — one block per currency */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : currencies.length === 0 ? null : (
        currencies.map((cur) => {
          const parties = byPartyByCurrency[cur] ?? [];
          const s = summaryByCcy[cur];
          if (parties.length === 0) return null;
          return (
            <div key={`party-${cur}`} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-baseline justify-between">
                <div>
                  <h2 className="text-sm font-black text-foreground">
                    By {kind === "ar" ? "Customer" : "Vendor"}
                    <span className="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{cur}</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">Aggregated open balances in {cur}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted border-b border-border">
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-2">{kind === "ar" ? "Customer" : "Vendor"}</th>
                    {AGING_BUCKETS.map((b) => (
                      <th key={b.key} className="px-4 py-2 text-right">{b.label}</th>
                    ))}
                    <th className="px-5 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parties.map((p) => (
                    <tr key={p.party} className="border-t border-border hover:bg-muted/60">
                      <td className="px-5 py-2 font-bold text-foreground">{p.party}</td>
                      {AGING_BUCKETS.map((b) => (
                        <td key={b.key} className="px-4 py-2 text-right text-muted-foreground">
                          {p.buckets[b.key] > 0 ? fmt(p.buckets[b.key], cur) : "—"}
                        </td>
                      ))}
                      <td className="px-5 py-2 text-right font-black text-foreground">{fmt(p.total, cur)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted font-black">
                    <td className="px-5 py-2 text-foreground">Total ({cur})</td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b.key} className="px-4 py-2 text-right text-foreground">{fmt(s.totals[b.key], cur)}</td>
                    ))}
                    <td className="px-5 py-2 text-right text-foreground">{fmt(s.totalOutstanding, cur)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {/* Line detail — one block per currency */}
      {loading ? null : currencies.map((cur) => {
        const list = (rowsByCurrency[cur] ?? []).sort((a, b) => b.days - a.days);
        if (list.length === 0) return null;
        return (
          <div key={`lines-${cur}`} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-black text-foreground">
                Open Line Items
                <span className="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{cur}</span>
              </h2>
              <p className="text-xs text-muted-foreground">Sorted by days overdue, oldest first · {list.length} line{list.length === 1 ? "" : "s"}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted border-b border-border">
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-2">{kind === "ar" ? "Customer" : "Vendor"}</th>
                    <th className="px-4 py-2">Invoice #</th>
                    <th className="px-4 py-2">Due</th>
                    <th className="px-4 py-2 text-right">Days</th>
                    <th className="px-4 py-2">Bucket</th>
                    <th className="px-5 py-2 text-right">Balance ({cur})</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const meta = AGING_BUCKETS.find((b) => b.key === r.bucket);
                    return (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/60">
                        <td className="px-5 py-2 font-medium text-foreground">{r.party}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.invoice_number}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}</td>
                        <td className={cn("px-4 py-2 text-right text-xs font-bold", r.days > 0 ? "text-red-600" : "text-muted-foreground")}>
                          {r.days > 0 ? `${r.days} late` : `${Math.abs(r.days)} until due`}
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", meta?.color, meta?.textColor)}>
                            {meta?.label}
                          </span>
                        </td>
                        <td className="px-5 py-2 text-right font-black text-foreground">{fmt(r.balance, r.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
