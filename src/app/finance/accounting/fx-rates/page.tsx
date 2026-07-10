"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { KNOWN_CURRENCIES, REPORTING_CURRENCY, sortCurrencyKeys } from "@/lib/finance/multi-currency";
import { refreshRates, type FxRate } from "@/lib/finance/fx";
import { AuditTrailService } from "@/services/audit-trail-service";
import {
  ArrowLeft,
  ArrowRightLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function FxRatesPage() {
  const { toast } = useToast();
  const { user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<FxRate[]>([]);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    from_ccy: "USD",
    to_ccy: REPORTING_CURRENCY,
    rate: "",
    effective_date: new Date().toISOString().slice(0, 10),
    source: "",
    note: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("exchange_rates")
      .select("id, from_ccy:from_currency, to_ccy:to_currency, rate, effective_date, created_at")
      .order("effective_date", { ascending: false })
      .limit(500);
    setRates((data ?? []) as FxRate[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const latestPerPair = useMemo(() => {
    const seen = new Map<string, FxRate>();
    for (const r of rates) {
      const key = `${r.from_ccy}->${r.to_ccy}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    return [...seen.values()].sort((a, b) => {
      if (a.from_ccy !== b.from_ccy) return a.from_ccy.localeCompare(b.from_ccy);
      return a.to_ccy.localeCompare(b.to_ccy);
    });
  }, [rates]);

  const save = async () => {
    const rate = Number(form.rate);
    if (!form.from_ccy || !form.to_ccy || form.from_ccy === form.to_ccy) {
      toast({ title: "Choose two different currencies", variant: "destructive" });
      return;
    }
    if (!rate || rate <= 0) {
      toast({ title: "Enter a positive rate", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        from_ccy: form.from_ccy.toUpperCase(),
        to_ccy: form.to_ccy.toUpperCase(),
        rate,
        effective_date: form.effective_date,
      };
      const { data, error } = await supabase
        .from("exchange_rates")
        .insert({
          from_currency: payload.from_ccy,
          to_currency: payload.to_ccy,
          rate,
          effective_date: payload.effective_date,
        })
        .select("id, from_ccy:from_currency, to_ccy:to_currency, rate, effective_date")
        .maybeSingle();
      if (error) throw error;
      if (data?.id) {
        await AuditTrailService.log({
          user_id: user?.id,
          module: "finance",
          action: "create",
          entity_type: "payment" as any,
          entity_id: data.id,
          new_value: data,
          description: `FX rate ${payload.from_ccy}→${payload.to_ccy} = ${rate} on ${payload.effective_date}`,
        });
      }
      await refreshRates();
      toast({ title: "Rate saved", description: `1 ${payload.from_ccy} = ${rate} ${payload.to_ccy}` });
      setAdding(false);
      setForm({ ...form, rate: "", source: "", note: "" });
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const seedCommonPairs = async () => {
    const targets = KNOWN_CURRENCIES.filter((c) => c !== REPORTING_CURRENCY);
    const existing = new Set(latestPerPair.map((r) => `${r.from_ccy}->${r.to_ccy}`));
    const missing = targets.filter((c) => !existing.has(`${c}->${REPORTING_CURRENCY}`));
    if (missing.length === 0) {
      toast({ title: "Nothing to seed", description: "All common pairs already have a rate." });
      return;
    }
    const rows = missing.map((c) => ({
      from_currency: c,
      to_currency: REPORTING_CURRENCY,
      rate: 1,
      effective_date: new Date().toISOString().slice(0, 10),
    }));
    const { error } = await supabase.from("exchange_rates").insert(rows);
    if (error) {
      toast({ title: "Seed failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Placeholders created", description: `${rows.length} pair(s). Edit each with the real rate.` });
    load();
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
            <ArrowRightLeft className="w-6 h-6 text-fuchsia-600" /> FX Rates
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Historical exchange rates. Reports use the most recent rate on or before the report date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="h-9 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={seedCommonPairs} className="h-9 gap-2">
            <Sparkles className="w-3.5 h-3.5" /> Seed common pairs
          </Button>
          <Button size="sm" onClick={() => setAdding(true)} className="h-9 gap-2 bg-fuchsia-600 hover:bg-fuchsia-700">
            <Plus className="w-3.5 h-3.5" /> Record rate
          </Button>
        </div>
      </div>

      {/* Latest per pair */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-black text-foreground">Latest per Pair</h2>
          <p className="text-xs text-muted-foreground">Effective right now — the rate reports will pick up today</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : latestPerPair.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground italic">
            No rates on file. Use “Seed common pairs” or record one manually.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
            {latestPerPair.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {r.from_ccy} → {r.to_ccy}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{r.effective_date}</span>
                </div>
                <p className="text-xl font-black text-foreground mt-1">{Number(r.rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                {r.source && <p className="text-[10px] text-muted-foreground mt-0.5">Source: {r.source}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full history */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-black text-foreground">History</h2>
          <p className="text-xs text-muted-foreground">All recorded rates, newest first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="px-5 py-2">Effective</th>
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">To</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-5 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/60">
                  <td className="px-5 py-2 text-foreground text-xs">{r.effective_date}</td>
                  <td className="px-4 py-2 font-mono text-xs font-black text-foreground">{r.from_ccy}</td>
                  <td className="px-4 py-2 font-mono text-xs font-black text-foreground">{r.to_ccy}</td>
                  <td className="px-4 py-2 text-right font-bold text-foreground">
                    {Number(r.rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{r.source ?? "—"}</td>
                  <td className="px-5 py-2 text-muted-foreground text-xs">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-black text-foreground">Record FX Rate</h3>
                <p className="text-xs text-muted-foreground">1 unit of “from” equals rate units of “to” on the effective date</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAdding(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Select value={form.from_ccy} onValueChange={(v) => setForm({ ...form, from_ccy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{sortCurrencyKeys([...KNOWN_CURRENCIES]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Select value={form.to_ccy} onValueChange={(v) => setForm({ ...form, to_ccy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{sortCurrencyKeys([...KNOWN_CURRENCIES]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rate</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder={`1 ${form.from_ccy} = ? ${form.to_ccy}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Effective date</Label>
                <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Source</Label>
                  <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="BoT, bank feed, manual…" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Note</Label>
                  <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted">
              <Button variant="outline" onClick={() => setAdding(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={save} disabled={submitting} className="bg-fuchsia-600 hover:bg-fuchsia-700 gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Rate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
