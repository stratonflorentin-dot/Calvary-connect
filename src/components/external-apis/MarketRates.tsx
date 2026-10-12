"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Fuel } from "lucide-react";
import { ExternalPanel, ExternalPanelSkeleton, getExternal, UpdatedAt } from "./ExternalPanel";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type HistoryRow = { table_text: string };
type HistoryResult = { data?: HistoryRow[]; fetchedAt?: string; error?: string };
const FUELS = ["gasoline", "diesel", "kerosene"] as const;
function parseTrend(rows: HistoryRow[] | undefined) {
  const text = rows?.map((row) => row.table_text).join(" ") ?? "";
  const match = /Current price\s+([\d,.]+).*?Three months ago\s+([\d,.]+).*?One year ago\s+([\d,.]+)/i.exec(text);
  if (!match) return undefined;
      const current = Number(match[1].replaceAll(",", "")); const threeMonths = Number(match[2].replaceAll(",", "")); const oneYear = Number(match[3].replaceAll(",", ""));
      return { current, threeMonths, oneYear, threeMonthChange: threeMonths ? (current - threeMonths) / threeMonths * 100 : 0, yearlyChange: oneYear ? (current - oneYear) / oneYear * 100 : 0 };
}

export default function MarketRates({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<Record<string, HistoryResult>>({});
  const [error, setError] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void Promise.all(FUELS.map(async (fuel) => [fuel, await getExternal<HistoryRow[]>(`/api/external/fuel/prices?region=tanzania&history=true&fuel=${fuel}`)] as const))
      .then((results) => {
        const failed = results.find(([, result]) => result.error);
        if (failed) setError(failed[1].error);
        setHistory(Object.fromEntries(results.map(([fuel, result]) => [fuel, result])));
      }).finally(() => setLoading(false));
  }, []);
  async function exportCsv() {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in to export market rates.");
      const response = await fetch('/api/external/fuel/prices?compare=true&format=csv', { headers: { authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) throw new Error("Market-rate export failed.");
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'east-africa-fuel-market.csv'; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed."); }
    finally { setExporting(false); }
  }
  if (loading) return <ExternalPanelSkeleton title="Fuel market trends" />;
  return <ExternalPanel title="Fuel market trends" eyebrow="Tanzania · TZS per liter" onClose={onClose}>
    <div className="mb-3 flex items-center justify-between gap-2"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Fuel className="h-4 w-4 text-primary" />Current vs 3 months and 1 year</p><Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportCsv()}>{exporting ? "Exporting…" : "Export CSV"}</Button></div>
    {error && <p role="status" className="mb-2 text-xs text-destructive">{error}</p>}
    <div className="space-y-3">{FUELS.map((fuel) => {
      const data = parseTrend(history[fuel]?.data);
      if (!data) return <div key={fuel} className="rounded-xl border border-border/60 p-3 text-xs capitalize">{fuel}: history unavailable</div>;
      const down = data.current < data.threeMonths;
      const max = Math.max(data.current, data.threeMonths, data.oneYear, 1);
      return <div key={fuel} className="rounded-xl border border-border/60 p-3">
        <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold capitalize">{fuel}</span><span className={`flex items-center gap-1 text-[10px] font-semibold ${down ? 'text-emerald-600' : 'text-rose-600'}`}>{down ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{data.threeMonthChange > 0 ? "+" : ""}{data.threeMonthChange.toFixed(1)}% / 3mo</span></div>
        <p className="mb-2 text-[10px] text-muted-foreground">{data.yearlyChange > 0 ? "+" : ""}{data.yearlyChange.toFixed(1)}% vs 1 year ago</p>
        <div className="flex h-14 items-end gap-3">{[["1yr", data.oneYear], ["3mo", data.threeMonths], ["Now", data.current]].map(([label, value]) => <div key={String(label)} className="flex flex-1 flex-col items-center gap-1"><span className="text-[9px] text-muted-foreground">{Number(value).toLocaleString()}</span><div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(8, Number(value) / max * 30)}px` }} /><span className="text-[9px] text-muted-foreground">{label}</span></div>)}</div>
      </div>;
    })}</div>
    <div className="mt-3"><UpdatedAt value={history.gasoline?.fetchedAt} /></div>
  </ExternalPanel>;
}
