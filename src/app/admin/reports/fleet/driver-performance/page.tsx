"use client";

import React, { useState, useEffect, startTransition } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Route,
  DollarSign,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  Star,
  RefreshCw,
  TrendingUp,
  Sparkles,
  X,
  Download,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DriverStat {
  id: string;
  name: string;
  employeeId: string;
  completedTripsCount: number;
  totalDistanceKm: number;
  distanceTracked: boolean;
  currency: string;
  mixedRevenueCurrencies: boolean;
  totalRevenue: number;
  totalFuelCostTZS: number;
  totalFuelLiters: number;
  fuelPriceIsEstimate: boolean;
  incidentsCount: number | null;
  incidentsTracked: boolean;
  onTimeDeliveryRate: number | null;
  onTimeSampleSize: number;
  averagePerformanceScore: number | null;
  hasReviews: boolean;
}

interface SummaryStats {
  totalDriversActive: number;
  totalTrips: number;
  totalRevenueByCurrency: Record<string, number>;
  avgOnTimePercent: number | null;
}

export default function DriverPerformancePage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI performance summary panel
  const [summaryDriver, setSummaryDriver] = useState<DriverStat | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const runAiSummary = async (driver: DriverStat) => {
    setSummaryDriver(driver);
    setSummaryText(null);
    setSummaryLoading(true);
    try {
      const res = await fetch('/api/ai/driver-performance-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate summary');
      setSummaryText(json.summary);
    } catch (err: any) {
      setSummaryText(`Could not generate a summary: ${err.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Date states
  const defaultFrom = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const defaultTo = new Date().toISOString().split('T')[0];
  const [fromDateInput, setFromDateInput] = useState(defaultFrom);
  const [toDateInput, setToDateInput] = useState(defaultTo);
  const [appliedFrom, setAppliedFrom] = useState(defaultFrom);
  const [appliedTo, setAppliedTo] = useState(defaultTo);

  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [drivers, setDrivers] = useState<DriverStat[]>([]);
  // Persisted driver_scorecards, keyed by driver_id — a separate,
  // deliberately-not-date-ranged snapshot (completion/on-time/compliance
  // rates over each driver's full history), recomputed on demand rather
  // than on every page load.
  const [scorecards, setScorecards] = useState<Record<string, { overall_score: number | null; completion_rate: number | null; on_time_rate: number | null; compliance_rate: number | null; computed_at: string }>>({});
  const [recomputing, setRecomputing] = useState(false);

  const fetchScorecards = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/reports/driver-scorecards', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await res.json();
    if (result.success) {
      const byDriver: typeof scorecards = {};
      for (const row of result.data) byDriver[row.driver_id] = row;
      setScorecards(byDriver);
    }
  };

  const recomputeScores = async () => {
    setRecomputing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/reports/driver-scorecards', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await res.json();
      if (result.success) await fetchScorecards();
    } finally {
      setRecomputing(false);
    }
  };

  useEffect(() => { fetchScorecards(); }, []);

  // DOM attribute hydration check for hybrid Blade environments
  useEffect(() => {
    const rootEl = document.getElementById('report-root');
    if (rootEl) {
      const initialFrom = rootEl.getAttribute('data-initial-from');
      const initialTo = rootEl.getAttribute('data-initial-to');
      if (initialFrom) {
        setFromDateInput(initialFrom);
        setAppliedFrom(initialFrom);
      }
      if (initialTo) {
        setToDateInput(initialTo);
        setAppliedTo(initialTo);
      }
    }
  }, []);

  const fetchData = async (fromStr: string, toStr: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/reports/driver-performance?from=${fromStr}&to=${toStr}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const result = await res.json();
      if (result.success) {
        setSummary(result.summary);
        setDrivers(result.data);
      } else {
        setError(result.error || 'Failed to load report data.');
      }
    } catch (err: any) {
      console.error(err);
      setError('A network or server error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(appliedFrom, appliedTo);
  }, [appliedFrom, appliedTo]);

  const handleApplyFilters = () => {
    startTransition(() => {
      setAppliedFrom(fromDateInput);
      setAppliedTo(toDateInput);
    });
  };

  if (!role) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="flex items-center gap-3">
          <RefreshCw className="size-6 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading user role...</span>
        </div>
      </div>
    );
  }

  // Formatting helper
  const formatTZS = (amount: number) => {
    return amount.toLocaleString('en-TZ') + ' TZS';
  };
  const formatAmount = (amount: number, currency: string) => {
    return amount.toLocaleString('en-TZ') + ' ' + currency;
  };
  const formatByCurrency = (byCurrency: Record<string, number>) => {
    const entries = Object.entries(byCurrency);
    if (entries.length === 0) return formatAmount(0, 'TZS');
    return entries.map(([cur, amt]) => formatAmount(amt, cur)).join(' · ');
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      rankedDrivers.map((d) => ({
        Driver: d.name,
        EmployeeId: d.employeeId,
        Trips: d.completedTripsCount,
        DistanceKm: d.distanceTracked ? d.totalDistanceKm : '',
        Currency: d.currency,
        MixedCurrencies: d.mixedRevenueCurrencies ? 'Yes' : 'No',
        Revenue: d.totalRevenue,
        FuelCostTZS: d.totalFuelCostTZS,
        FuelLiters: d.totalFuelLiters,
        OnTimePercent: d.onTimeDeliveryRate ?? '',
        Score: scorecards[d.id]?.overall_score ?? '',
        Rating: d.hasReviews ? d.averagePerformanceScore : '',
      })),
    );
    XLSX.utils.book_append_sheet(workbook, sheet, 'Driver Performance');
    XLSX.writeFile(workbook, `driver-performance-${appliedFrom}_${appliedTo}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Driver Performance Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Period: ${appliedFrom} to ${appliedTo}`, 14, 30);
    if (summary) {
      doc.text(`Total Revenue: ${formatByCurrency(summary.totalRevenueByCurrency)}`, 14, 38);
    }
    autoTable(doc, {
      startY: 46,
      head: [['Driver', 'Trips', 'Distance', 'Revenue', 'On-Time', 'Score']],
      body: rankedDrivers.map((d) => [
        d.name,
        d.completedTripsCount,
        d.distanceTracked ? `${d.totalDistanceKm.toLocaleString()} km` : '—',
        formatAmount(d.totalRevenue, d.currency),
        d.onTimeDeliveryRate === null ? '—' : `${d.onTimeDeliveryRate}%`,
        scorecards[d.id]?.overall_score ?? '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [3, 105, 161] },
    });
    doc.save(`driver-performance-${appliedFrom}_${appliedTo}.pdf`);
  };

  // Composite rank: performance score, then on-time rate, then trip volume.
  // Drivers with no reviews/no on-time data rank last on those tiebreakers,
  // not first — null must never sort as if it beat a real low score.
  const rankedDrivers = [...drivers].sort((a, b) => {
    const aScore = a.averagePerformanceScore ?? -1;
    const bScore = b.averagePerformanceScore ?? -1;
    if (bScore !== aScore) return bScore - aScore;
    const aOnTime = a.onTimeDeliveryRate ?? -1;
    const bOnTime = b.onTimeDeliveryRate ?? -1;
    if (bOnTime !== aOnTime) return bOnTime - aOnTime;
    return b.completedTripsCount - a.completedTripsCount;
  });
  const medal = (rank: number) => (rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : null);

  return (
    <div id="report-root" className="flex min-h-screen bg-background" data-initial-from={defaultFrom} data-initial-to={defaultTo}>
      <Sidebar role={role} />
      
      <main className="flex-1 min-w-0 md:ml-64 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Breadcrumb / Back button */}
          <div className="flex items-center gap-2">
            <Link href="/reports" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary transition-colors uppercase tracking-wider">
              <ArrowLeft className="size-3.5" />
              Back to Reports
            </Link>
          </div>

          {/* Page Title & Controls */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground font-headline tracking-tighter">Driver Performance Report</h1>
              <p className="text-sm text-muted-foreground mt-1">Analytics on driver trips, revenues, efficiency, and performance ratings.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={exportExcel} disabled={drivers.length === 0} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50">
                <Download className="size-4" /> Excel
              </button>
              <button onClick={exportPDF} disabled={drivers.length === 0} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50">
                <FileText className="size-4" /> PDF
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-4">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">From Date</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={fromDateInput}
                      onChange={(e) => setFromDateInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring" 
                    />
                    <Calendar className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">To Date</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={toDateInput}
                      onChange={(e) => setToDateInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring" 
                    />
                    <Calendar className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={handleApplyFilters}
                  disabled={loading}
                  className="w-full md:w-auto px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading && <RefreshCw className="size-4 animate-spin" />}
                  Apply Filters
                </button>
                <button
                  onClick={recomputeScores}
                  disabled={recomputing}
                  title="Recalculate the persisted Score column from each driver's full trip/compliance history"
                  className="w-full md:w-auto px-5 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`size-4 ${recomputing ? 'animate-spin' : ''}`} />
                  Recalculate Scores
                </button>
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 animate-pulse" />
                ))}
              </div>
              <div className="bg-card border border-border rounded-xl shadow-sm p-6 h-96 animate-pulse" />
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center max-w-lg mx-auto">
              <AlertTriangle className="size-8 text-destructive mx-auto mb-3" />
              <h3 className="text-lg font-bold text-destructive">Unable to load report</h3>
              <p className="text-sm text-destructive/80 mt-1 mb-4">{error}</p>
              <button
                onClick={() => fetchData(appliedFrom, appliedTo)}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-semibold hover:bg-destructive/90 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="size-4" />
                Try Again
              </button>
            </div>
          )}

          {/* Report Dashboard */}
          {!loading && !error && summary && (
            <div className="space-y-6">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Active Drivers */}
                <div className="bg-info/10 border border-info/20 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-info/20 p-2 rounded-full w-fit mb-2">
                    <Users className="size-5 text-info" />
                  </div>
                  <p className="text-xs font-bold text-info/80 uppercase tracking-wider">Active Drivers</p>
                  <p className="text-2xl font-black text-info mt-1">{summary.totalDriversActive}</p>
                </div>

                {/* Total Trips */}
                <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-success/20 p-2 rounded-full w-fit mb-2">
                    <Route className="size-5 text-success" />
                  </div>
                  <p className="text-xs font-bold text-success/80 uppercase tracking-wider">Trips Completed</p>
                  <p className="text-2xl font-black text-success mt-1">{summary.totalTrips}</p>
                </div>

                {/* Total Revenue */}
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-primary/20 p-2 rounded-full w-fit mb-2">
                    <DollarSign className="size-5 text-primary" />
                  </div>
                  <p className="text-xs font-bold text-primary/80 uppercase tracking-wider">Gross Revenue</p>
                  <p className="text-2xl font-black text-primary mt-1 truncate">{formatByCurrency(summary.totalRevenueByCurrency)}</p>
                </div>

                {/* On-Time Rate */}
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-accent/20 p-2 rounded-full w-fit mb-2">
                    <CheckCircle2 className="size-5 text-accent-foreground" />
                  </div>
                  <p className="text-xs font-bold text-accent-foreground/80 uppercase tracking-wider">On-Time Delivery</p>
                  <p className="text-2xl font-black text-accent-foreground mt-1">{summary.avgOnTimePercent === null ? "No data" : `${summary.avgOnTimePercent}%`}</p>
                </div>

              </div>

              {/* Data Table & Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Table Section */}
                <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Users className="size-5 text-primary" />
                      Performance Breakdown
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted border-b border-border">
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Rank</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Driver</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Trips</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Distance (KM)</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Fuel Dispatched</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Revenue Generated</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">On-Time</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center" title="Weighted: completion 40% + on-time 30% + compliance 30%. Blank when nothing about the driver is measurable yet — never a default floor.">Score</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Incidents</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Rating</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">AI Summary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rankedDrivers.map((driver, rank) => {
                          const isTop3 = rank < 3;
                          return (
                            <tr
                              key={driver.id}
                              className={`transition-colors hover:bg-muted/50 ${
                                isTop3 ? 'bg-info/10 border-l-2 border-info' : ''
                              }`}
                            >
                              <td className="px-6 py-4 text-center font-black text-foreground">
                                {medal(rank) ?? `#${rank + 1}`}
                              </td>
                              <td className="px-6 py-4">
                                <div>
                                  <span className="font-bold text-foreground block">{driver.name}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">ID: {driver.employeeId}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center font-semibold text-foreground">
                                {driver.completedTripsCount}
                              </td>
                              <td className="px-6 py-4 text-right text-foreground font-mono">
                                {driver.distanceTracked ? `${driver.totalDistanceKm.toLocaleString()} km` : (
                                  <span className="text-xs text-muted-foreground font-sans">Not recorded</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right text-foreground">
                                <div>
                                  <span className="font-mono block">
                                    {driver.totalFuelLiters.toLocaleString()} Liters{driver.fuelPriceIsEstimate ? " (est.)" : ""}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block font-semibold">{formatTZS(driver.totalFuelCostTZS)}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-primary font-bold font-mono">
                                {formatAmount(driver.totalRevenue, driver.currency)}
                                {driver.mixedRevenueCurrencies && (
                                  <span className="ml-1.5 text-[10px] font-bold text-warning" title="This driver also has revenue in another currency, not included in this figure">mixed</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {driver.onTimeDeliveryRate === null ? (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">No data</span>
                                ) : (
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    driver.onTimeDeliveryRate >= 95
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : driver.onTimeDeliveryRate >= 90
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {driver.onTimeDeliveryRate}% ({driver.onTimeSampleSize}/{driver.completedTripsCount})
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {(() => {
                                  const card = scorecards[driver.id];
                                  if (!card || card.overall_score === null) {
                                    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">Not yet scored</span>;
                                  }
                                  const s = card.overall_score;
                                  return (
                                    <span
                                      title={`Completion ${card.completion_rate ?? '—'}% · On-time ${card.on_time_rate ?? '—'}% · Compliance ${card.compliance_rate ?? '—'}%`}
                                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                        s >= 80 ? 'bg-emerald-100 text-emerald-800' : s >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {s}/100
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 text-center text-xs text-muted-foreground">
                                {driver.incidentsTracked ? driver.incidentsCount : "Not tracked"}
                              </td>
                              <td className="px-6 py-4">
                                {driver.hasReviews ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Star className="size-4 text-amber-400 fill-amber-400" />
                                    <span className="text-sm font-bold text-foreground">{driver.averagePerformanceScore}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground block text-center">No reviews yet</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={() => runAiSummary(driver)}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                >
                                  <Sparkles className="size-3.5" /> Summarize
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Chart Section */}
                <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-sm p-4">
                  <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp className="size-5 text-primary" />
                    Revenue & Trips Completed Comparison
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankedDrivers}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Revenue', angle: -90, position: 'insideLeft', offset: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Trips Count', angle: 90, position: 'insideRight', offset: 10 }} />
                        <Tooltip formatter={(value: any, name: any, props: any) => {
                          if (name === 'Revenue Generated') return [formatAmount(value, props?.payload?.currency || 'TZS'), name];
                          return [value, name];
                        }} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalRevenue" name="Revenue Generated" fill="#0369A1" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="completedTripsCount" name="Trips Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </main>

      {summaryDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" /> AI Summary — {summaryDriver.name}
              </CardTitle>
              <button onClick={() => setSummaryDriver(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <p className="text-sm text-muted-foreground">Generating…</p>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-line">{summaryText}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
