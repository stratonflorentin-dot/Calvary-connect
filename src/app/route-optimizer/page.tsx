"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Route, MapPin, Clock, Zap, Navigation, RefreshCw, Plus,
  Trash2, ArrowDown, CheckCircle2, Loader2, AlertCircle,
  TrendingDown, Fuel, Copy, X, ChevronRight
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Waypoint {
  id: string;
  label: string;
  address: string;
  lat?: number;
  lon?: number;
}

interface RouteResult {
  distance_km: number;
  duration_min: number;
  fuel_liters: number;
  waypoints: string[];
  instructions: string[];
  legs: { from: string; to: string; distance_km: number; duration_min: number }[];
}

// ─── OSRM helper ─────────────────────────────────────────────────────────────
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "CalvaryConnect/1.0" } });
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

async function optimizeRoute(waypoints: Waypoint[]): Promise<RouteResult> {
  // Geocode any waypoints without coordinates
  const resolved = await Promise.all(
    waypoints.map(async (wp) => {
      if (wp.lat && wp.lon) return wp;
      const coords = await geocode(wp.address);
      return coords ? { ...wp, ...coords } : wp;
    })
  );

  // Filter resolved waypoints
  const valid = resolved.filter((wp) => wp.lat && wp.lon);
  if (valid.length < 2) throw new Error("Could not geocode enough waypoints.");

  // Build OSRM URL
  const coords = valid.map((wp) => `${wp.lon},${wp.lat}`).join(";");
  const url = `${OSRM_BASE}/${coords}?overview=false&steps=true&annotations=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error("Routing failed: " + data.message);

  const route = data.routes[0];
  const totalDist = route.distance / 1000; // metres → km
  const totalDur = route.duration / 60;    // seconds → minutes
  const fuelLitres = totalDist * 0.35;     // ~35L/100km average truck consumption

  // Extract per-leg info
  const legs = route.legs.map((leg: any, i: number) => ({
    from: valid[i].label || valid[i].address,
    to: valid[i + 1]?.label || valid[i + 1]?.address || "End",
    distance_km: +(leg.distance / 1000).toFixed(1),
    duration_min: +(leg.duration / 60).toFixed(0),
  }));

  // Extract top instructions (first step of each leg)
  const instructions = route.legs.flatMap((leg: any) =>
    (leg.steps || []).slice(0, 3).map((s: any) => s.maneuver?.instruction || s.name || "Continue")
  ).slice(0, 10);

  return {
    distance_km: +totalDist.toFixed(1),
    duration_min: +totalDur.toFixed(0),
    fuel_liters: +fuelLitres.toFixed(1),
    waypoints: valid.map((wp) => wp.label || wp.address),
    instructions,
    legs,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

let idCounter = 1;
const uid = () => `wp-${idCounter++}`;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RouteOptimizerPage() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: uid(), label: "Origin", address: "" },
    { id: uid(), label: "Destination", address: "" },
  ]);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const addWaypoint = () =>
    setWaypoints((prev) => [...prev, { id: uid(), label: `Stop ${prev.length - 1}`, address: "" }]);

  const removeWaypoint = (id: string) =>
    setWaypoints((prev) => prev.filter((wp) => wp.id !== id));

  const updateWaypoint = (id: string, key: keyof Waypoint, value: string) =>
    setWaypoints((prev) => prev.map((wp) => (wp.id === id ? { ...wp, [key]: value } : wp)));

  const handleOptimize = async () => {
    const filled = waypoints.filter((wp) => wp.address.trim());
    if (filled.length < 2) { setError("Please enter at least 2 addresses."); return; }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const r = await optimizeRoute(filled);
      setResult(r);
    } catch (e: any) {
      setError(e.message || "Route optimization failed. Check the addresses and try again.");
    }
    setLoading(false);
  };

  const copyRoute = () => {
    if (!result) return;
    const text = result.waypoints.join(" → ");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Suggestions from common Kenya/EAC cities ──────────────────────────────
  const SUGGESTIONS = [
    { label: "Nairobi → Mombasa", wps: ["Nairobi, Kenya", "Mombasa, Kenya"] },
    { label: "Nairobi → Kampala", wps: ["Nairobi, Kenya", "Busia, Kenya", "Kampala, Uganda"] },
    { label: "Mombasa → Dar es Salaam", wps: ["Mombasa, Kenya", "Dar es Salaam, Tanzania"] },
    { label: "Nairobi → Kigali", wps: ["Nairobi, Kenya", "Nakuru, Kenya", "Kigali, Rwanda"] },
  ];

  const loadSuggestion = (wps: string[]) => {
    setWaypoints(
      wps.map((addr, i) => ({
        id: uid(),
        label: i === 0 ? "Origin" : i === wps.length - 1 ? "Destination" : `Stop ${i}`,
        address: addr,
      }))
    );
    setResult(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 max-w-6xl mx-auto">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200">
            <Route className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 leading-tight">Route Optimizer</h1>
            <p className="text-xs text-slate-400">Powered by OSRM open routing engine</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Input Panel ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick routes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Routes</p>
            <div className="grid grid-cols-1 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => loadSuggestion(s.wps)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 text-left transition-all group"
                >
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700">{s.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Waypoints */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Waypoints</p>
              <button
                onClick={addWaypoint}
                className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Stop
              </button>
            </div>

            <div className="space-y-3">
              {waypoints.map((wp, i) => (
                <div key={wp.id} className="flex items-start gap-2">
                  {/* Connector */}
                  <div className="flex flex-col items-center shrink-0 pt-3">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      i === 0 ? "bg-green-500 border-green-500" :
                      i === waypoints.length - 1 ? "bg-red-500 border-red-500" :
                      "bg-blue-400 border-blue-400"
                    }`} />
                    {i < waypoints.length - 1 && <div className="w-0.5 h-4 bg-gray-200 mt-1" />}
                  </div>

                  <div className="flex-1 space-y-1">
                    <input
                      value={wp.label}
                      onChange={(e) => updateWaypoint(wp.id, "label", e.target.value)}
                      placeholder="Label"
                      className="w-full text-[10px] font-bold text-slate-500 bg-transparent border-none outline-none px-0 uppercase tracking-wider"
                    />
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        value={wp.address}
                        onChange={(e) => updateWaypoint(wp.id, "address", e.target.value)}
                        placeholder="Enter city or address…"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                      />
                    </div>
                  </div>

                  {waypoints.length > 2 && (
                    <button
                      onClick={() => removeWaypoint(wp.id)}
                      className="mt-3 p-1 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleOptimize}
              disabled={loading}
              className="w-full mt-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-200/60 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? "Calculating…" : "Optimize Route"}
            </button>

            {error && (
              <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Results Panel ── */}
        <div className="lg:col-span-3 space-y-4">
          {!result && !loading && (
            <div className="h-64 bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300">
              <Route className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-semibold">Enter waypoints to calculate route</p>
              <p className="text-xs mt-1">Results will appear here</p>
            </div>
          )}

          {loading && (
            <div className="h-64 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm font-medium">Geocoding addresses & calculating optimal route…</p>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Navigation, label: "Distance", value: `${result.distance_km} km`, color: "text-sky-600", bg: "bg-sky-50 border-sky-100" },
                  { icon: Clock, label: "Drive Time", value: fmtDur(result.duration_min), color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100" },
                  { icon: Fuel, label: "Est. Fuel", value: `${result.fuel_liters}L`, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className={`rounded-2xl border p-4 ${bg} flex flex-col items-center text-center shadow-sm`}>
                    <Icon className={`w-5 h-5 mb-1.5 ${color}`} />
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Optimized route */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Optimized Route
                  </h3>
                  <button onClick={copyRoute} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                    <Copy className="w-3.5 h-3.5" /> {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {result.waypoints.map((wp, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1.5 rounded-full ${
                        i === 0 ? "bg-green-100 text-green-700" :
                        i === result.waypoints.length - 1 ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{wp}</span>
                      {i < result.waypoints.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-leg breakdown */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Route className="w-4 h-4 text-indigo-500" /> Leg-by-Leg Breakdown
                </h3>
                <div className="space-y-3">
                  {result.legs.map((leg, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{leg.from} → {leg.to}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        <span className="text-sky-600 font-bold">{leg.distance_km} km</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-indigo-600 font-bold">{fmtDur(leg.duration_min)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fuel/cost estimate */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Cost Estimate
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-emerald-100 uppercase tracking-wider">Fuel (at ~KES 150/L)</p>
                    <p className="text-2xl font-black mt-1">
                      KES {(result.fuel_liters * 150).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-100 uppercase tracking-wider">Est. Driver Allowance</p>
                    <p className="text-2xl font-black mt-1">
                      KES {(result.duration_min / 60 * 400).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-100 mt-3">* Estimates only. Actual costs may vary based on conditions.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
