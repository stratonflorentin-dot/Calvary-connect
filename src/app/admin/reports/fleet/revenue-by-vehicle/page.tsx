"use client";

import React, { useState, useEffect, startTransition } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { supabase } from '@/lib/supabase';
import {
  Truck,
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Wallet,
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

interface VehicleRevenueStat {
  id: string;
  plateNumber: string;
  makeModel: string;
  currency: string;
  mixedCurrencies: boolean;
  tripsCount: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
}

interface SummaryStats {
  totalVehiclesActive: number;
  totalRevenueByCurrency: Record<string, number>;
  totalExpensesByCurrency: Record<string, number>;
  netProfitByCurrency: Record<string, number>;
  bestPerformingVehicle: string;
}

export default function VehicleRevenuePage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date states
  const defaultFrom = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const defaultTo = new Date().toISOString().split('T')[0];
  const [fromDateInput, setFromDateInput] = useState(defaultFrom);
  const [toDateInput, setToDateInput] = useState(defaultTo);
  const [appliedFrom, setAppliedFrom] = useState(defaultFrom);
  const [appliedTo, setAppliedTo] = useState(defaultTo);

  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRevenueStat[]>([]);

  // Hydration fallback support for DOM values
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
      const res = await fetch(`/api/reports/revenue-by-vehicle?from=${fromStr}&to=${toStr}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const result = await res.json();
      if (result.success) {
        setSummary(result.summary);
        setVehicles(result.data);
      } else {
        setError(result.error || 'Failed to load vehicle revenue report.');
      }
    } catch (err: any) {
      console.error(err);
      setError('A network or database error occurred while querying vehicle revenue.');
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

  const formatAmount = (amount: number, currency: string) => {
    return amount.toLocaleString('en-TZ') + ' ' + currency;
  };

  const formatByCurrency = (byCurrency: Record<string, number>) => {
    const entries = Object.entries(byCurrency);
    if (entries.length === 0) return formatAmount(0, 'TZS');
    return entries.map(([cur, amt]) => formatAmount(amt, cur)).join(' · ');
  };

  const topVehicle = vehicles.length > 0 ? vehicles[0] : null;

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      vehicles.map((v) => ({
        Plate: v.plateNumber,
        Vehicle: v.makeModel,
        Currency: v.currency,
        MixedCurrencies: v.mixedCurrencies ? 'Yes' : 'No',
        Trips: v.tripsCount,
        Revenue: v.totalRevenue,
        Expenses: v.totalExpenses,
        NetProfit: v.netProfit,
        ProfitMarginPercent: v.profitMarginPercent,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, sheet, 'Vehicle Revenue');
    XLSX.writeFile(workbook, `vehicle-revenue-${appliedFrom}_${appliedTo}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Vehicle Revenue Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Period: ${appliedFrom} to ${appliedTo}`, 14, 30);
    if (summary) {
      doc.text(`Total Revenue: ${formatByCurrency(summary.totalRevenueByCurrency)}`, 14, 38);
      doc.text(`Net Profit: ${formatByCurrency(summary.netProfitByCurrency)}`, 14, 46);
    }
    autoTable(doc, {
      startY: 54,
      head: [['Plate', 'Vehicle', 'Trips', 'Revenue', 'Expenses', 'Net Profit', 'Margin']],
      body: vehicles.map((v) => [
        v.plateNumber,
        v.makeModel,
        v.tripsCount,
        formatAmount(v.totalRevenue, v.currency),
        formatAmount(v.totalExpenses, v.currency),
        formatAmount(v.netProfit, v.currency),
        `${v.profitMarginPercent}%`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [3, 105, 161] },
    });
    doc.save(`vehicle-revenue-${appliedFrom}_${appliedTo}.pdf`);
  };

  return (
    <div id="report-root" className="flex min-h-screen bg-background" data-initial-from={defaultFrom} data-initial-to={defaultTo}>
      <Sidebar role={role} />
      
      <main className="flex-1 min-w-0 md:ml-64 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          
          <div className="flex items-center gap-2">
            <Link href="/reports" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary transition-colors uppercase tracking-wider">
              <ArrowLeft className="size-3.5" />
              Back to Reports
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground font-headline tracking-tighter">Vehicle Revenue Report</h1>
              <p className="text-sm text-muted-foreground mt-1">Financial performance audit for fleet vehicles, displaying gross margins, operational expenses, and net profit per truck.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={exportExcel} disabled={vehicles.length === 0} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50">
                <Download className="size-4" /> Excel
              </button>
              <button onClick={exportPDF} disabled={vehicles.length === 0} className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50">
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
              <button 
                onClick={handleApplyFilters}
                disabled={loading}
                className="w-full md:w-auto px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <RefreshCw className="size-4 animate-spin" />}
                Apply Filters
              </button>
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

          {/* Report Data */}
          {!loading && !error && summary && (
            <div className="space-y-6">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Active Vehicles */}
                <div className="bg-info/10 border border-info/20 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-info/20 p-2 rounded-full w-fit mb-2">
                    <Truck className="size-5 text-info" />
                  </div>
                  <p className="text-xs font-bold text-info/80 uppercase tracking-wider">Active Vehicles</p>
                  <p className="text-2xl font-black text-info mt-1">{summary.totalVehiclesActive}</p>
                </div>

                {/* Total Revenue */}
                <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-success/20 p-2 rounded-full w-fit mb-2">
                    <DollarSign className="size-5 text-success" />
                  </div>
                  <p className="text-xs font-bold text-success/80 uppercase tracking-wider">Gross Revenues</p>
                  <p className="text-2xl font-black text-success mt-1 truncate">{formatByCurrency(summary.totalRevenueByCurrency)}</p>
                </div>

                {/* Total Expenses */}
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-destructive/20 p-2 rounded-full w-fit mb-2">
                    <Wallet className="size-5 text-destructive" />
                  </div>
                  <p className="text-xs font-bold text-destructive/80 uppercase tracking-wider">Operating Expenses</p>
                  <p className="text-2xl font-black text-destructive mt-1 truncate">{formatByCurrency(summary.totalExpensesByCurrency)}</p>
                </div>

                {/* Net Profit */}
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-accent/20 p-2 rounded-full w-fit mb-2">
                    <Wallet className="size-5 text-accent-foreground" />
                  </div>
                  <p className="text-xs font-bold text-accent-foreground/80 uppercase tracking-wider">Net Profit Earnings</p>
                  <p className="text-2xl font-black text-accent-foreground mt-1 truncate">{formatByCurrency(summary.netProfitByCurrency)}</p>
                </div>

              </div>

              {/* Data Table & Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Table */}
                <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Truck className="size-5 text-primary" />
                      Vehicle Financial Ledger Overview
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted border-b border-border">
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Vehicle Plate</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Make & Model</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Trips Count</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Revenue</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Expenses</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Net Profit</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Profit Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {vehicles.map((vehicle) => {
                          const isTop = topVehicle && vehicle.id === topVehicle.id;
                          return (
                            <tr 
                              key={vehicle.id}
                              className={`transition-colors hover:bg-muted/50 ${
                                isTop ? 'bg-info/10 border-l-2 border-info' : ''
                              }`}
                            >
                              <td className="px-6 py-4">
                                <span className="font-bold text-foreground block">{vehicle.plateNumber}</span>
                              </td>
                              <td className="px-6 py-4 font-semibold text-foreground">
                                {vehicle.makeModel}
                              </td>
                              <td className="px-6 py-4 text-center font-semibold text-foreground">
                                {vehicle.tripsCount}
                              </td>
                              <td className="px-6 py-4 text-right text-primary font-bold font-mono">
                                {formatAmount(vehicle.totalRevenue, vehicle.currency)}
                                {vehicle.mixedCurrencies && (
                                  <span className="ml-1.5 text-[10px] font-bold text-warning" title="This vehicle also has revenue in another currency, not included in this figure">mixed</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right text-foreground font-mono">
                                {formatAmount(vehicle.totalExpenses, vehicle.currency)}
                              </td>
                              <td className={`px-6 py-4 text-right font-bold font-mono ${vehicle.netProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                                {formatAmount(vehicle.netProfit, vehicle.currency)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  vehicle.profitMarginPercent >= 40 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : vehicle.profitMarginPercent >= 20
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {vehicle.profitMarginPercent}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Chart */}
                <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-sm p-4">
                  <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp className="size-5 text-primary" />
                    Revenue, Expenses & Profit Comparison by Vehicle
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vehicles}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="plateNumber" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value: any, name: any, props: any) => [formatAmount(value, props?.payload?.currency || 'TZS'), name]} />
                        <Legend />
                        <Bar dataKey="totalRevenue" name="Revenue" fill="#0369A1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalExpenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="netProfit" name="Net Profit" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
