"use client";

import { useEffect, useState } from "react";
import { Fuel, MapPin } from "lucide-react";
import { ExternalPanel, ExternalPanelSkeleton, getExternal, UpdatedAt } from "./ExternalPanel";

type Price = { fuel?: string; date: string; tzs: string; usd?: string };
type CityCap = { city: string; petrol: number; diesel: number; kerosene: number };
type HistoryRow = { table_text: string };
const HUBS = [
  { name: "Dar es Salaam", x: 71, y: 80 }, { name: "Mwanza", x: 33, y: 37 },
  { name: "Arusha", x: 68, y: 32 }, { name: "Mbeya", x: 32, y: 83 },
  { name: "Dodoma", x: 53, y: 57 }, { name: "Tanga", x: 82, y: 19 },
];

export default function FuelPriceMap({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<{ data?: Price[]; fetchedAt?: string; error?: string }>({});
  const [cityResult, setCityResult] = useState<{ data?: CityCap[]; fetchedAt?: string; effectiveDate?: string; error?: string }>({});
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>();
  const [trend, setTrend] = useState<{ current: number; threeMonths: number }>();

  useEffect(() => {
    void Promise.all([
      getExternal<Price[]>("/api/external/fuel/prices?region=tanzania"),
      getExternal<CityCap[]>("/api/external/fuel/ewura-caps"),
    ]).then(([national, city]) => { setResult(national); setCityResult(city); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCity) return;
    let active = true;
    void getExternal<HistoryRow[]>("/api/external/fuel/prices?region=tanzania&history=true&fuel=diesel").then((response) => {
      const text = response.data?.map((row) => row.table_text).join(" ") ?? "";
      const match = /Current price\s+([\d,.]+).*?Three months ago\s+([\d,.]+)/i.exec(text);
      if (active && match) setTrend({ current: Number(match[1].replaceAll(",", "")), threeMonths: Number(match[2].replaceAll(",", "")) });
    });
    return () => { active = false; };
  }, [selectedCity]);

  const prices = (result.data ?? []).filter((item) => item.fuel);
  const cityCaps = cityResult.data ?? [];
  const averageDiesel = cityCaps.length ? cityCaps.reduce((sum, row) => sum + row.diesel, 0) / cityCaps.length : 0;
  const selectedCap = cityCaps.find((row) => row.city === selectedCity);
  if (loading) return <ExternalPanelSkeleton title="Fuel prices" />;

  return <ExternalPanel title="Fuel prices by hub" eyebrow={cityCaps.length ? "EWURA monthly city caps" : "National benchmark"} onClose={onClose}>
    <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <Fuel className="h-4 w-4 shrink-0 text-primary" />
      {cityCaps.length ? "EWURA retail cap prices by city; station prices may be lower." : "City caps are temporarily unavailable; national reference prices are shown below."}
    </div>
    {cityResult.error && <p role="status" className="mb-3 text-xs text-muted-foreground">EWURA source: {cityResult.error}</p>}
    {result.error && <p role="status" className="mb-3 text-sm text-destructive">National benchmark: {result.error}</p>}
    <>
      <div className="relative mb-4 h-40 overflow-hidden rounded-xl border border-border/70 bg-[radial-gradient(ellipse_at_50%_50%,hsl(var(--muted))_0%,hsl(var(--card))_75%)]">
        {HUBS.map((hub) => {
          const cap = cityCaps.find((row) => row.city === hub.name);
          const delta = cap && averageDiesel ? (cap.diesel - averageDiesel) / averageDiesel : 0;
          const color = !cap ? "bg-slate-500" : delta < -0.02 ? "bg-emerald-600" : delta > 0.02 ? "bg-rose-600" : "bg-amber-500";
          return <div key={hub.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${hub.x}%`, top: `${hub.y}%` }}>
            <button type="button" aria-label={`Show ${hub.name} hub fuel trend`} title={cap ? `${hub.name}: diesel cap TZS ${cap.diesel.toLocaleString()}/L` : `${hub.name}: city price unavailable`} onClick={() => { setSelectedCity(hub.name); setTrend(undefined); }} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-background ${color} text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}><MapPin className="h-3.5 w-3.5" /></button>
            <span className="mt-0.5 block whitespace-nowrap rounded bg-background/90 px-1 text-[9px] font-medium">{hub.name}</span>
          </div>;
        })}
      </div>
      {selectedCity && <div className="mb-3 rounded-xl border border-border/60 bg-muted/40 p-3">
        <div className="flex items-center justify-between"><p className="text-xs font-semibold">{selectedCity} · EWURA retail cap</p><button type="button" onClick={() => setSelectedCity(undefined)} className="text-[10px] text-primary underline">Clear</button></div>
        {selectedCap ? <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]"><span>Petrol <b>{selectedCap.petrol.toLocaleString()}</b></span><span>Diesel <b>{selectedCap.diesel.toLocaleString()}</b></span><span>Kerosene <b>{selectedCap.kerosene.toLocaleString()}</b></span><span className="col-span-3 text-muted-foreground">TZS/L · effective {cityResult.effectiveDate ?? "per official notice"}</span></div> : <p className="mt-2 text-[10px] text-muted-foreground">This city is unavailable in the current EWURA feed.</p>}
        {selectedCap && !trend && <div className="mt-2 h-8 animate-pulse rounded bg-muted" aria-label="Loading national trend" />}
        {trend && <p className="mt-2 text-[10px] text-muted-foreground">National diesel benchmark: TZS {trend.threeMonths.toLocaleString()} → {trend.current.toLocaleString()}/L over 3 months.</p>}
      </div>}
      <div className="space-y-2">{prices.map((row) => {
        const value = Number(row.tzs);
        return <div key={row.fuel} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2" title={`${row.fuel}: TZS ${value.toLocaleString()} per liter`}>
          <span className="text-xs font-medium">{row.fuel}</span><span className="text-sm font-semibold text-primary">TZS {value.toLocaleString()}/L</span>
        </div>;
      })}{prices.length === 0 && <p className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">The national benchmark feed is unavailable.</p>}</div>
      <div className="mt-3 space-y-1"><div className="flex items-center justify-between gap-2"><span className="text-[10px] text-muted-foreground">GlobalPetrolPrices national reference · {prices[0]?.date ?? "current feed"}</span><UpdatedAt value={result.fetchedAt} /></div>{cityCaps.length > 0 && <p className="text-[10px] text-muted-foreground">EWURA caps effective {cityResult.effectiveDate ?? "per official notice"} · fetched {cityResult.fetchedAt ? new Date(cityResult.fetchedAt).toLocaleString() : ""}</p>}</div>
    </>
  </ExternalPanel>;
}
