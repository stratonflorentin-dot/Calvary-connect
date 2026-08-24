"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { getListStagger, listItem } from "@/lib/animations";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Download,
  Fuel,
  Loader2,
  Route,
  Upload,
  Wallet,
  X,
} from "lucide-react";

interface FuelPerTripRow {
  trip_id: string;
  trip_number: string | null;
  origin: string;
  destination: string;
  status: string;
  distance_km: number | null;
  trip_date: string;
  vehicle_id: string | null;
  plate_number: string | null;
  currency: string;
  fuel_entry_count: number;
  total_liters: number;
  total_fuel_cost: number;
  liters_per_100km: number | null;
  fuel_cost_per_km: number | null;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const fmtAmount = (v: number, currency: string) => `${Math.round(v).toLocaleString("en-TZ")} ${currency}`;
const fmtByCurrency = (byCurrency: Record<string, number>) => {
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) return fmtAmount(0, "TZS");
  return entries.map(([cur, amt]) => fmtAmount(amt, cur)).join(" · ");
};

function toCsv(rows: FuelPerTripRow[]) {
  const headers = ["trip_number", "plate_number", "origin", "destination", "distance_km", "currency", "total_liters", "total_fuel_cost", "liters_per_100km", "fuel_cost_per_km", "trip_date"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.trip_number ?? "",
        r.plate_number ?? "",
        r.origin,
        r.destination,
        r.distance_km ?? "",
        r.currency,
        r.total_liters,
        r.total_fuel_cost,
        r.liters_per_100km ?? "",
        r.fuel_cost_per_km ?? "",
        r.trip_date,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
  }
  return lines.join("\n");
}

const importTemplate = `trip_number,plate_number,date,liters,amount,currency,description
TRP-000123,T123ABC,2026-08-01,120,360000,TZS,Fuel top-up at Dar depot`;

export default function FuelPerTripReportPage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FuelPerTripRow[]>([]);
  const [summary, setSummary] = useState({ trips: 0, tripsWithFuelLogged: 0, totalLitersByCurrency: {} as Record<string, number>, totalFuelCostByCurrency: {} as Record<string, number>, totalDistanceKm: 0 });

  const defaultFrom = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const defaultTo = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const fetchData = async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/reports/fuel-per-trip?from=${from}&to=${to}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const result = await res.json();
      if (result.success) {
        setRows(result.rows);
        setSummary(result.summary);
      } else {
        setError(result.error || "Failed to load fuel-per-trip data.");
      }
    } catch (err: any) {
      console.error(err);
      setError("A network or server error occurred while retrieving fuel data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fuel-per-trip_${fromDate}_${toDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ variant: "success", title: "Report exported", description: `${rows.length} trip(s) exported to CSV.` });
  };

  const downloadTemplate = () => {
    const blob = new Blob([importTemplate], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fuel_per_trip_import_template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const [headerLine, ...dataLines] = lines;
    if (!headerLine) return [];
    const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    return dataLines.map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      return headers.reduce<Record<string, string>>((rec, h, i) => {
        rec[h] = values[i] ?? "";
        return rec;
      }, {});
    });
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", title: "No file selected", description: "Choose a CSV or JSON file first." });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const isJson = file.name.toLowerCase().endsWith(".json");
      const records = isJson ? JSON.parse(text) : parseCsv(text);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/reports/fuel-per-trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ records }),
      });
      const result: ImportResult = await res.json();
      setImportResult(result);

      if (result.success > 0) {
        toast({ variant: "success", title: "Fuel entries imported", description: `${result.success} imported${result.failed > 0 ? `, ${result.failed} failed` : ""}.` });
        fetchData(fromDate, toDate);
      } else {
        toast({ variant: "destructive", title: "Import failed", description: "No fuel entries were imported — check the errors below." });
      }
    } catch (err) {
      console.error("Fuel import error:", err);
      toast({ variant: "destructive", title: "Import failed", description: "Could not read or send that file." });
    } finally {
      setImporting(false);
    }
  };

  if (!role) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading user role...</span>
        </div>
      </div>
    );
  }

  const totalLitersAllCurrencies = Object.values(summary.totalLitersByCurrency).reduce((s, v) => s + v, 0);
  const avgLitersPer100km = summary.totalDistanceKm > 0 ? (totalLitersAllCurrencies / summary.totalDistanceKm) * 100 : null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-64 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <Link href="/admin/reports/fleet/fuel" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider w-fit">
            <ArrowLeft className="size-3.5" />
            Back to Fuel Consumption
          </Link>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground font-headline tracking-tighter">Fuel Per Trip</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real fuel cost and consumption per trip — from logged fuel entries, no estimated figures.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Download className="size-4" /> Template
              </button>
              <button
                onClick={() => setImportOpen((v) => !v)}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Upload className="size-4" /> Import
              </button>
              <button
                onClick={handleExport}
                disabled={rows.length === 0}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="size-4" /> Export CSV
              </button>
            </div>
          </div>

          {importOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-xl shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Import fuel entries</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV or JSON. Each row must reference an existing trip by <code className="text-foreground">trip_number</code>; include{" "}
                    <code className="text-foreground">plate_number</code> if the trip has no vehicle assigned yet.
                  </p>
                </div>
                <button onClick={() => setImportOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? "")}
                  className="hidden"
                  id="fuel-import-file"
                />
                <label
                  htmlFor="fuel-import-file"
                  className="px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  {selectedFileName || "Select CSV or JSON file"}
                </label>
                <button
                  onClick={handleImport}
                  disabled={importing || !selectedFileName}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {importing ? "Importing..." : "Upload"}
                </button>
              </div>

              {importResult && (
                <div className={`mt-4 rounded-lg border p-3 text-sm ${importResult.failed === 0 ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning"}`}>
                  <p className="font-semibold">
                    {importResult.success} imported, {importResult.failed} failed.
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-destructive max-h-32 overflow-y-auto">
                      {importResult.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>- {e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </motion.div>
          )}

          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">From Date</label>
                  <div className="relative">
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                    <Calendar className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">To Date</label>
                  <div className="relative">
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                    <Calendar className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <button
                onClick={() => fetchData(fromDate, toDate)}
                disabled={loading}
                className="w-full md:w-auto px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Apply Filters
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 animate-pulse" />
                ))}
              </div>
              <div className="bg-card border border-border rounded-xl shadow-sm p-6 h-96 animate-pulse" />
            </div>
          ) : error ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center max-w-lg mx-auto">
              <AlertTriangle className="size-8 text-destructive mx-auto mb-3" />
              <h3 className="text-lg font-bold text-destructive">Unable to load report</h3>
              <p className="text-sm text-destructive/80 mt-1 mb-4">{error}</p>
              <button onClick={() => fetchData(fromDate, toDate)} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-semibold hover:bg-destructive/90 transition-colors inline-flex items-center gap-2">
                <Loader2 className="size-4" /> Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile icon={Route} label="Trips" value={summary.trips} accent="bg-primary/10 text-primary" />
                <StatTile icon={Fuel} label="Trips with fuel logged" value={summary.tripsWithFuelLogged} accent="bg-info/10 text-info" />
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-warning/10 text-warning">
                    <Wallet className="size-4" />
                  </div>
                  <p className="text-xl font-bold text-foreground truncate">{fmtByCurrency(summary.totalFuelCostByCurrency)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total fuel cost</p>
                </div>
                <StatTile
                  icon={Fuel}
                  label="Avg L/100km"
                  value={avgLitersPer100km ?? 0}
                  format={avgLitersPer100km == null ? () => "—" : (v) => v.toFixed(1)}
                  accent="bg-success/10 text-success"
                />
              </div>

              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                {rows.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-sm">No trips in this date range.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b border-border">
                        <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <th className="px-4 py-3">Trip</th>
                          <th className="px-4 py-3">Vehicle</th>
                          <th className="px-4 py-3">Route</th>
                          <th className="px-4 py-3 text-right">Distance</th>
                          <th className="px-4 py-3 text-right">Liters</th>
                          <th className="px-4 py-3 text-right">Fuel Cost</th>
                          <th className="px-4 py-3 text-right">L/100km</th>
                          <th className="px-4 py-3 text-right">Cost/km</th>
                        </tr>
                      </thead>
                      <motion.tbody
                        variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(rows.length) } } }}
                        initial="hidden"
                        animate="visible"
                        className="divide-y divide-border"
                      >
                        {rows.map((r) => (
                          <motion.tr key={`${r.trip_id}::${r.currency}`} variants={listItem} className="hover:bg-muted/40 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{r.trip_number ?? `TRP-${r.trip_id.slice(0, 6)}`}</td>
                            <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.plate_number ?? "Unassigned"}</td>
                            <td className="px-4 py-3 text-xs text-foreground">{r.origin} → {r.destination}</td>
                            <td className="px-4 py-3 text-right text-foreground">{r.distance_km != null ? `${r.distance_km} km` : "—"}</td>
                            <td className="px-4 py-3 text-right text-foreground">{r.total_liters > 0 ? `${r.total_liters.toLocaleString()} L` : "—"}</td>
                            <td className="px-4 py-3 text-right font-bold text-foreground">{r.total_fuel_cost > 0 ? fmtAmount(r.total_fuel_cost, r.currency) : "—"}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{r.liters_per_100km ?? "—"}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{r.fuel_cost_per_km != null ? fmtAmount(r.fuel_cost_per_km, r.currency) : "—"}</td>
                          </motion.tr>
                        ))}
                      </motion.tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  format,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  format?: (v: number) => string;
  accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${accent}`}>
        <Icon className="size-4" />
      </div>
      <p className="text-xl font-bold text-foreground">
        <AnimatedCounter value={value} format={format} />
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
