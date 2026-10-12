"use client";

import { useEffect, useState } from "react";
import { Anchor, ExternalLink, Ship } from "lucide-react";
import { ExternalPanel, ExternalPanelSkeleton, getExternal, UpdatedAt } from "./ExternalPanel";

type Table = { rows?: string[] };
export default function PortCongestion({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<{ data?: Table[]; fetchedAt?: string; error?: string }>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getExternal<Table[]>('/api/external/tpa/vessel-schedule').then(setResult).finally(() => setLoading(false)); }, []);
  if (loading) return <ExternalPanelSkeleton title="TPA vessel schedule" />;
  const schedules = result.data?.[1]?.rows ?? [];
  const queue = result.data?.[2]?.rows ?? [];
  const vessels = schedules.slice(2).filter(Boolean);
  const waiting = queue.slice(1).filter((row) => row.includes("Waiting to berth"));
  const shipNames = new Set(vessels.map((row) => /^\S+\s+(.+?)\s+\d{1,3}(?:\.\d+)?\s+\d/.exec(row)?.[1]?.trim()).filter((name): name is string => !!name));
  const upcomingEtf = vessels.map((row) => {
    const dates = [...row.matchAll(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?/g)].map((match) => match[0]);
    const value = dates.at(-1);
    return value ? { row, value, timestamp: Date.parse(value.replace(" ", "T") + (value.length === 10 ? "T00:00:00Z" : "Z")) } : undefined;
  }).filter((item): item is { row: string; value: string; timestamp: number } => !!item && Number.isFinite(item.timestamp) && item.timestamp > Date.now()).sort((a, b) => a.timestamp - b.timestamp)[0];
  return <ExternalPanel title="Dar es Salaam port" eyebrow="Tanzania Ports Authority" onClose={onClose}>
    {result.error ? <p role="status" className="text-sm text-destructive">{result.error}</p> : <>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/60 p-3"><Ship className="mb-2 h-4 w-4 text-primary" /><p className="text-xl font-bold">{shipNames.size || vessels.length}</p><p className="text-[10px] text-muted-foreground">Listed vessels at berth</p></div>
        <div className="rounded-xl bg-muted/60 p-3"><Anchor className="mb-2 h-4 w-4 text-amber-600" /><p className="text-xl font-bold">{waiting.length}</p><p className="text-[10px] text-muted-foreground">Waiting queue records</p></div>
      </div>
      {upcomingEtf && <p className="mb-2 rounded-lg bg-primary/5 px-3 py-2 text-[11px]">Next listed ETF: <strong>{upcomingEtf.value}</strong></p>}
      <p className="mb-2 text-[10px] text-muted-foreground">Counts and the next estimated time finished (ETF) are read from TPA’s current public snapshot.</p>
      <div className="max-h-48 space-y-1 overflow-y-auto">{vessels.slice(0, 8).map((row, index) => <p key={`${row}-${index}`} className="rounded-md border border-border/50 px-2 py-1.5 text-[10px]">{row}</p>)}</div>
      <div className="mt-3 flex items-center justify-between"><UpdatedAt value={result.fetchedAt} /><a className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" href="https://ports.go.tz/index.php/en/services/eport-services/shipping-list" target="_blank" rel="noreferrer">TPA details <ExternalLink className="h-3 w-3" /></a></div>
    </>}
  </ExternalPanel>;
}
