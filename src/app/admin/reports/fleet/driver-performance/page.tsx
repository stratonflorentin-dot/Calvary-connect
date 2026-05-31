"use client";

import React, { useState, useEffect, startTransition } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
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
  TrendingUp
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

interface DriverStat {
  id: string;
  name: string;
  employeeId: string;
  completedTripsCount: number;
  totalDistanceKm: number;
  totalRevenueTZS: number;
  totalFuelCostTZS: number;
  totalFuelLiters: number;
  incidentsCount: number;
  onTimeDeliveryRate: number;
  averagePerformanceScore: number;
}

interface SummaryStats {
  totalDriversActive: number;
  totalTrips: number;
  totalRevenue: number;
  avgOnTimePercent: number;
}

export default function DriverPerformancePage() {
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
  const [drivers, setDrivers] = useState<DriverStat[]>([]);

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
      const res = await fetch(`/api/reports/driver-performance?from=${fromStr}&to=${toStr}`);
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
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3">
          <RefreshCw className="size-6 animate-spin text-sky-700" />
          <span className="text-sm font-medium text-gray-600">Loading user role...</span>
        </div>
      </div>
    );
  }

  // Formatting helper
  const formatTZS = (amount: number) => {
    return amount.toLocaleString('en-TZ') + ' TZS';
  };

  // Find top performer (highest completed trips)
  const topPerformer = drivers.length > 0
    ? drivers.reduce((prev, curr) => (curr.completedTripsCount > prev.completedTripsCount ? curr : prev), drivers[0])
    : null;

  return (
    <div id="report-root" className="flex min-h-screen bg-[#F0F1F5]" data-initial-from={defaultFrom} data-initial-to={defaultTo}>
      <Sidebar role={role} />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Breadcrumb / Back button */}
          <div className="flex items-center gap-2">
            <Link href="/reports" className="flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800 transition-colors uppercase tracking-wider">
              <ArrowLeft className="size-3.5" />
              Back to Reports
            </Link>
          </div>

          {/* Page Title & Controls */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-headline tracking-tighter">Driver Performance Report</h1>
              <p className="text-sm text-gray-600 mt-1">Analytics on driver trips, revenues, efficiency, and performance ratings.</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">From Date</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={fromDateInput}
                      onChange={(e) => setFromDateInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-700" 
                    />
                    <Calendar className="absolute left-3 top-2.5 size-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">To Date</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={toDateInput}
                      onChange={(e) => setToDateInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-700" 
                    />
                    <Calendar className="absolute left-3 top-2.5 size-4 text-gray-400" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={handleApplyFilters}
                  disabled={loading}
                  className="w-full md:w-auto px-5 py-2 bg-sky-700 text-white rounded-lg text-sm font-medium hover:bg-sky-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading && <RefreshCw className="size-4 animate-spin" />}
                  Apply Filters
                </button>
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 h-24 animate-pulse" />
                ))}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 h-96 animate-pulse" />
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-lg mx-auto">
              <AlertTriangle className="size-8 text-red-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-red-800">Unable to load report</h3>
              <p className="text-sm text-red-600 mt-1 mb-4">{error}</p>
              <button 
                onClick={() => fetchData(appliedFrom, appliedTo)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors inline-flex items-center gap-2"
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
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-sky-200/50 p-2 rounded-full w-fit mb-2">
                    <Users className="size-5 text-sky-800" />
                  </div>
                  <p className="text-xs font-bold text-sky-800/80 uppercase tracking-wider">Active Drivers</p>
                  <p className="text-2xl font-black text-sky-900 mt-1">{summary.totalDriversActive}</p>
                </div>

                {/* Total Trips */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-emerald-200/50 p-2 rounded-full w-fit mb-2">
                    <Route className="size-5 text-emerald-800" />
                  </div>
                  <p className="text-xs font-bold text-emerald-800/80 uppercase tracking-wider">Trips Completed</p>
                  <p className="text-2xl font-black text-emerald-900 mt-1">{summary.totalTrips}</p>
                </div>

                {/* Total Revenue */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-indigo-200/50 p-2 rounded-full w-fit mb-2">
                    <DollarSign className="size-5 text-indigo-800" />
                  </div>
                  <p className="text-xs font-bold text-indigo-800/80 uppercase tracking-wider">Gross Revenue</p>
                  <p className="text-2xl font-black text-indigo-900 mt-1 truncate">{formatTZS(summary.totalRevenue)}</p>
                </div>

                {/* On-Time Rate */}
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-purple-200/50 p-2 rounded-full w-fit mb-2">
                    <CheckCircle2 className="size-5 text-purple-800" />
                  </div>
                  <p className="text-xs font-bold text-purple-800/80 uppercase tracking-wider">On-Time Delivery</p>
                  <p className="text-2xl font-black text-purple-900 mt-1">{summary.avgOnTimePercent}%</p>
                </div>

              </div>

              {/* Data Table & Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Table Section */}
                <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Users className="size-5 text-sky-700" />
                      Performance Breakdown
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider">Driver</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Trips</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Distance (KM)</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Fuel Dispatched</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Revenue Generated</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">On-Time %</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {drivers.map((driver) => {
                          const isTop = topPerformer && driver.id === topPerformer.id;
                          return (
                            <tr 
                              key={driver.id}
                              className={`transition-colors hover:bg-gray-50/50 ${
                                isTop ? 'bg-sky-50 border-l-2 border-sky-700' : ''
                              }`}
                            >
                              <td className="px-6 py-4">
                                <div>
                                  <span className="font-bold text-gray-900 block">{driver.name}</span>
                                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">ID: {driver.employeeId}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center font-semibold text-gray-900">
                                {driver.completedTripsCount}
                              </td>
                              <td className="px-6 py-4 text-right text-gray-700 font-mono">
                                {driver.totalDistanceKm.toLocaleString()} km
                              </td>
                              <td className="px-6 py-4 text-right text-gray-700">
                                <div>
                                  <span className="font-mono block">{driver.totalFuelLiters.toLocaleString()} Liters</span>
                                  <span className="text-[10px] text-gray-500 block font-semibold">{formatTZS(driver.totalFuelCostTZS)}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-sky-800 font-bold font-mono">
                                {formatTZS(driver.totalRevenueTZS)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  driver.onTimeDeliveryRate >= 95 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : driver.onTimeDeliveryRate >= 90
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {driver.onTimeDeliveryRate}%
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <Star className="size-4 text-amber-400 fill-amber-400" />
                                  <span className="text-sm font-bold text-gray-700">{driver.averagePerformanceScore}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Chart Section */}
                <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="size-5 text-sky-700" />
                    Revenue & Trips Completed Comparison
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={drivers}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Revenue (TZS)', angle: -90, position: 'insideLeft', offset: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Trips Count', angle: 90, position: 'insideRight', offset: 10 }} />
                        <Tooltip formatter={(value: any, name: any) => {
                          if (name === 'Revenue Generated') return [formatTZS(value), name];
                          return [value, name];
                        }} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalRevenueTZS" name="Revenue Generated" fill="#0369A1" radius={[4, 4, 0, 0]} />
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
    </div>
  );
}
