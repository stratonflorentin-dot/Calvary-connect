"use client";

import React, { useState, useEffect, startTransition } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { 
  Fuel, 
  DollarSign, 
  Route,
  Activity,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Truck
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

interface VehicleFuelStat {
  id: string;
  plateNumber: string;
  makeModel: string;
  totalLitresDispensed: number;
  totalFuelCostTZS: number;
  kmDriven: number;
  litresPer100km: number;
}

interface SummaryStats {
  totalLitresDispensed: number;
  totalFuelCostTZS: number;
  totalKmDriven: number;
  mostEfficientVehicle: string;
}

export default function FuelConsumptionPage() {
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
  const [vehicles, setVehicles] = useState<VehicleFuelStat[]>([]);

  // Hydration fallback from hybrid DOM attributes
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
      const res = await fetch(`/api/reports/fuel?from=${fromStr}&to=${toStr}`);
      const result = await res.json();
      if (result.success) {
        setSummary(result.summary);
        setVehicles(result.data);
      } else {
        setError(result.error || 'Failed to load fuel report data.');
      }
    } catch (err: any) {
      console.error(err);
      setError('A network or server error occurred while retrieving fuel data.');
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

  const formatTZS = (amount: number) => {
    return amount.toLocaleString('en-TZ') + ' TZS';
  };

  // The most efficient vehicle is the one with the lowest L/100km that has actually run km
  const runningVehicles = vehicles.filter(v => v.kmDriven > 0 && v.litresPer100km > 0);
  const bestVehicle = runningVehicles.length > 0
    ? runningVehicles.reduce((prev, curr) => (curr.litresPer100km < prev.litresPer100km ? curr : prev), runningVehicles[0])
    : null;

  return (
    <div id="report-root" className="flex min-h-screen bg-[#F0F1F5]" data-initial-from={defaultFrom} data-initial-to={defaultTo}>
      <Sidebar role={role} />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          
          <div className="flex items-center gap-2">
            <Link href="/reports" className="flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800 transition-colors uppercase tracking-wider">
              <ArrowLeft className="size-3.5" />
              Back to Reports
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-headline tracking-tighter">Fuel Consumption Report</h1>
              <p className="text-sm text-gray-600 mt-1">Detailed analysis of fuel logging, mileage metrics, and efficiency ratios for active trucks.</p>
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
              <button 
                onClick={handleApplyFilters}
                disabled={loading}
                className="w-full md:w-auto px-5 py-2 bg-sky-700 text-white rounded-lg text-sm font-medium hover:bg-sky-800 transition-colors flex items-center justify-center gap-2"
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

          {/* Report Data */}
          {!loading && !error && summary && (
            <div className="space-y-6">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Litres */}
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-sky-200/50 p-2 rounded-full w-fit mb-2">
                    <Fuel className="size-5 text-sky-800" />
                  </div>
                  <p className="text-xs font-bold text-sky-800/80 uppercase tracking-wider">Total Liters Dispensed</p>
                  <p className="text-2xl font-black text-sky-900 mt-1">{summary.totalLitresDispensed.toLocaleString()} L</p>
                </div>

                {/* Total Fuel Cost */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-emerald-200/50 p-2 rounded-full w-fit mb-2">
                    <DollarSign className="size-5 text-emerald-800" />
                  </div>
                  <p className="text-xs font-bold text-emerald-800/80 uppercase tracking-wider">Total Fuel Costs</p>
                  <p className="text-2xl font-black text-emerald-900 mt-1 truncate">{formatTZS(summary.totalFuelCostTZS)}</p>
                </div>

                {/* Total KM driven */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-indigo-200/50 p-2 rounded-full w-fit mb-2">
                    <Route className="size-5 text-indigo-800" />
                  </div>
                  <p className="text-xs font-bold text-indigo-800/80 uppercase tracking-wider">Distance Covered</p>
                  <p className="text-2xl font-black text-indigo-900 mt-1">{summary.totalKmDriven.toLocaleString()} km</p>
                </div>

                {/* Most Efficient */}
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
                  <div className="mx-auto bg-purple-200/50 p-2 rounded-full w-fit mb-2">
                    <Activity className="size-5 text-purple-800" />
                  </div>
                  <p className="text-xs font-bold text-purple-800/80 uppercase tracking-wider">Most Fuel Efficient</p>
                  <p className="text-base font-black text-purple-900 mt-1 truncate">{summary.mostEfficientVehicle}</p>
                </div>

              </div>

              {/* Data Table & Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Table */}
                <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Truck className="size-5 text-sky-700" />
                      Vehicle Fuel Efficiency Breakdown
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider">Vehicle Plate</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider">Make & Model</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Liters Dispensed</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Total Cost</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Distance (KM)</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Avg Consumption</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {vehicles.map((vehicle) => {
                          const isTop = bestVehicle && vehicle.id === bestVehicle.id;
                          return (
                            <tr 
                              key={vehicle.id}
                              className={`transition-colors hover:bg-gray-50/50 ${
                                isTop ? 'bg-sky-50 border-l-2 border-sky-700' : ''
                              }`}
                            >
                              <td className="px-6 py-4">
                                <span className="font-bold text-gray-900 block">{vehicle.plateNumber}</span>
                              </td>
                              <td className="px-6 py-4 font-semibold text-gray-700">
                                {vehicle.makeModel}
                              </td>
                              <td className="px-6 py-4 text-right text-gray-800 font-mono">
                                {vehicle.totalLitresDispensed.toLocaleString()} L
                              </td>
                              <td className="px-6 py-4 text-right text-gray-700 font-mono">
                                {formatTZS(vehicle.totalFuelCostTZS)}
                              </td>
                              <td className="px-6 py-4 text-right text-gray-800 font-mono">
                                {vehicle.kmDriven.toLocaleString()} km
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  vehicle.litresPer100km > 0 && vehicle.litresPer100km <= 25 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : vehicle.litresPer100km > 25 && vehicle.litresPer100km <= 38
                                    ? 'bg-amber-100 text-amber-800'
                                    : vehicle.litresPer100km > 38
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {vehicle.litresPer100km > 0 ? `${vehicle.litresPer100km} L/100km` : 'No Travel Data'}
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
                <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="size-5 text-sky-700" />
                    Fuel Cost (TZS) vs Distance Driven (KM) Comparison
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vehicles}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="plateNumber" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Fuel Cost (TZS)', angle: -90, position: 'insideLeft', offset: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Distance (KM)', angle: 90, position: 'insideRight', offset: 10 }} />
                        <Tooltip formatter={(value: any, name: any) => {
                          if (name === 'Fuel Costs') return [formatTZS(value), name];
                          return [`${value.toLocaleString()} km`, name];
                        }} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalFuelCostTZS" name="Fuel Costs" fill="#0369A1" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="kmDriven" name="Distance Covered" fill="#F59E0B" radius={[4, 4, 0, 0]} />
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
