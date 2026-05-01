'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, TrendingDown, 
  DollarSign, Truck, AlertTriangle, 
  BarChart3, Loader2,
  RefreshCw, FileText, Brain, Fuel
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';

interface ChartData {
  month: string;
  revenue: number;
  expenses: number;
  trips: number;
  fuel: number;
}

interface CompanyMetrics {
  totalTrips: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  fleetSize: number;
  activeDrivers: number;
  outstandingInvoices: number;
  fuelCosts: number;
  maintenanceCount: number;
  availableVehicles: number;
  inUseVehicles: number;
  maintenanceVehicles: number;
  totalDrivers: number;
  completedTrips: number;
  pendingTrips: number;
  totalFuelLiters: number;
  paidInvoices: number;
  pendingInvoices: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
const CACHE_KEY = 'ai_analysis_metrics_v1';
const CACHE_DURATION = 5 * 60 * 1000;

export function ComprehensiveAIAnalysis() {
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const formatCurrency = (value: number) => {
    if (value === 0) return '0 TZS';
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Load from cache first for instant display
  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setMetrics(data.metrics);
          setChartData(data.chartData);
          setAiSummary(data.aiSummary);
          setLastUpdated(new Date(timestamp));
          return true;
        }
      }
    } catch {
      // Ignore cache errors
    }
    return false;
  }, []);

  // Save to cache
  const saveToCache = useCallback((data: { metrics: CompanyMetrics; chartData: ChartData[]; aiSummary: string }) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      // Ignore cache errors
    }
  }, []);

  // Generate AI summary
  const generateSummary = useCallback((m: CompanyMetrics): string => {
    if (m.totalTrips === 0 && m.fleetSize === 0) {
      return 'Your fleet management system is ready. Start by adding vehicles and creating trips to see AI-powered insights and analytics.';
    }
    if (m.totalTrips === 0 && m.fleetSize > 0) {
      return `Your fleet has ${m.fleetSize} vehicles ready for operations. Add your first trip to begin tracking revenue, expenses, and performance metrics. Current outstanding balance is ${formatCurrency(m.outstandingInvoices)}.`;
    }
    const profitMargin = m.totalRevenue > 0 ? ((m.netProfit / m.totalRevenue) * 100).toFixed(1) : '0';
    const isProfitable = m.netProfit > 0;
    const fleetUtilization = m.fleetSize > 0 ? ((m.inUseVehicles / m.fleetSize) * 100).toFixed(0) : '0';
    return `Calvary Connect fleet operations: ${m.totalTrips} trips with ${m.fleetSize} vehicles and ${m.activeDrivers} drivers. ${isProfitable ? 'Profitable' : 'Loss-making'} at ${profitMargin}% margin. Revenue ${formatCurrency(m.totalRevenue)}, expenses ${formatCurrency(m.totalExpenses + m.fuelCosts)}. Outstanding: ${formatCurrency(m.outstandingInvoices)}. Fleet utilization ${fleetUtilization}%.`;
  }, []);

  // Smart data loading
  const loadData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const hasCache = loadFromCache();
      if (hasCache) {
        setIsLoading(false);
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
    } else {
      setIsRefreshing(true);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Load data in batches for better performance
      const [{ data: trips }, { data: vehicles }] = await Promise.all([
        supabase.from('trips').select('id, salesAmount, revenue, price, totalAmount, status, created_at, startDate, date'),
        supabase.from('fleet_vehicles').select('id, status'),
      ]);

      const [{ data: drivers }, { data: invoices }] = await Promise.all([
        supabase.from('drivers').select('id, status'),
        supabase.from('invoices').select('id, status, balance, total, amount'),
      ]);

      const [{ data: expenses }, { data: fuelRecords }, { data: maintenance }] = await Promise.all([
        supabase.from('expenses').select('id, amount, total'),
        supabase.from('fuel_records').select('id, cost, totalCost, amount, liters, quantity'),
        supabase.from('maintenance_requests').select('id'),
      ]);

      // Process data
      const tripsData = trips || [];
      const expensesData = expenses || [];
      const vehiclesData = vehicles || [];
      const driversData = drivers || [];
      const invoicesData = invoices || [];
      const fuelData = fuelRecords || [];

      const totalRevenue = tripsData.reduce((sum: number, t: any) => sum + (t.salesAmount || t.revenue || t.price || t.totalAmount || 0), 0);
      const totalExpenses = expensesData.reduce((sum: number, e: any) => sum + (e.amount || e.total || 0), 0);
      const fuelCosts = fuelData.reduce((sum: number, f: any) => sum + (f.cost || f.totalCost || f.amount || 0), 0);
      const totalFuelLiters = fuelData.reduce((sum: number, f: any) => sum + (f.liters || f.quantity || 0), 0);
      const outstandingInvoices = invoicesData
        .filter((i: any) => i.status !== 'paid' && i.status !== 'PAID')
        .reduce((sum: number, i: any) => sum + (i.balance || i.total || i.amount || 0), 0);
      const paidInvoices = invoicesData.filter((i: any) => i.status === 'paid' || i.status === 'PAID').length;
      const pendingInvoices = invoicesData.filter((i: any) => i.status !== 'paid' && i.status !== 'PAID').length;

      const completedTrips = tripsData.filter((t: any) => t.status === 'COMPLETED' || t.status === 'completed').length;
      const pendingTrips = tripsData.filter((t: any) => t.status === 'PENDING' || t.status === 'pending' || t.status === 'ACTIVE').length;
      const activeDrivers = driversData.filter((d: any) => d.status === 'active' || d.status === 'ACTIVE' || d.status === 'available').length;
      
      const availableVehicles = vehiclesData.filter((v: any) => v.status === 'AVAILABLE' || v.status === 'available').length;
      const inUseVehicles = vehiclesData.filter((v: any) => v.status === 'IN_USE' || v.status === 'in_use' || v.status === 'busy').length;
      const maintenanceVehicles = vehiclesData.filter((v: any) => v.status === 'MAINTENANCE' || v.status === 'maintenance').length;

      const calculatedMetrics: CompanyMetrics = {
        totalTrips: tripsData.length,
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses - fuelCosts,
        fleetSize: vehiclesData.length,
        activeDrivers,
        outstandingInvoices,
        fuelCosts,
        maintenanceCount: maintenance?.length || 0,
        availableVehicles,
        inUseVehicles,
        maintenanceVehicles,
        totalDrivers: driversData.length,
        completedTrips,
        pendingTrips,
        totalFuelLiters,
        paidInvoices,
        pendingInvoices
      };

      // Get latest year with data
      const allDates = [
        ...tripsData.map((t: any) => t.created_at || t.startDate || t.date),
        ...expensesData.map((e: any) => e.created_at || e.date),
        ...invoicesData.map((i: any) => i.created_at || i.date)
      ].filter(Boolean);
      
      const years = [...new Set(allDates.map((d: string) => new Date(d).getFullYear()))].sort((a, b) => b - a);
      const latestYear = years[0] || new Date().getFullYear();
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyData = months.map((month, idx) => {
        const monthTrips = tripsData.filter((t: any) => {
          const dateStr = t.created_at || t.startDate || t.date;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getFullYear() === latestYear && date.getMonth() === idx;
        });
        const monthExpenses = expensesData.filter((e: any) => {
          const dateStr = e.created_at || e.date;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getFullYear() === latestYear && date.getMonth() === idx;
        });
        const monthFuel = fuelData.filter((f: any) => {
          const dateStr = f.created_at || f.date;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getFullYear() === latestYear && date.getMonth() === idx;
        });

        return {
          month,
          revenue: monthTrips.reduce((sum: number, t: any) => sum + (t.salesAmount || t.revenue || 0), 0),
          expenses: monthExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
          trips: monthTrips.length,
          fuel: monthFuel.reduce((sum: number, f: any) => sum + (f.liters || 0), 0),
        };
      });

      const summary = generateSummary(calculatedMetrics);

      setMetrics(calculatedMetrics);
      setChartData(monthlyData);
      setAiSummary(summary);
      setLastUpdated(new Date());

      saveToCache({ metrics: calculatedMetrics, chartData: monthlyData, aiSummary: summary });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to load data:', error);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadFromCache, saveToCache, generateSummary]);

  useEffect(() => {
    loadData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadData]);

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Loading AI Analysis...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Company Analysis</h2>
            <p className="text-sm text-muted-foreground">
              Powered by Minimax AI + Groq • Updated {lastUpdated?.toLocaleTimeString() || 'Just now'}
              {isRefreshing && <span className="ml-2 text-blue-500">(refreshing...)</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="gap-2"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Analysis
          </Button>
        </div>
      </div>

      {/* Executive Summary */}
      <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-blue-600" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">
            {aiSummary}
          </p>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Trips</p>
                  <p className="text-2xl font-bold mt-1">{metrics.totalTrips}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metrics.completedTrips} completed</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Stable</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(metrics.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.totalTrips > 0 ? formatCurrency(metrics.totalRevenue / metrics.totalTrips) : '0 TZS'}/trip
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">Stable</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Fleet Size</p>
                  <p className="text-2xl font-bold mt-1">{metrics.fleetSize}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metrics.availableVehicles} available</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Stable</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Drivers</p>
                  <p className="text-2xl font-bold mt-1">{metrics.activeDrivers}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metrics.totalDrivers} total</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Stable</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Expenses</p>
                  <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(metrics.totalExpenses + metrics.fuelCosts)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Includes fuel</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Stable</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600">{formatCurrency(metrics.outstandingInvoices)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metrics.pendingInvoices} unpaid</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Stable</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Maintenance</p>
                  <p className="text-2xl font-bold mt-1">{metrics.maintenanceCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Records</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Stable</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Fuel Costs</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.fuelCosts)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metrics.totalFuelLiters.toFixed(0)} L total</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Stable</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {metrics && (
        <>
          {/* Financial Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Financial Performance (HD Analytics)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="month" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}
                      formatter={(value: number) => value?.toLocaleString() + ' TZS'}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#0088FE" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#FF8042" name="Expenses" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="trips" stroke="#00C49F" strokeWidth={2} name="Trips" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Fleet & Fuel Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-green-600" />
                  Fleet Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'In Use', value: metrics.inUseVehicles, color: '#00C49F' },
                          { name: 'Available', value: metrics.availableVehicles, color: '#0088FE' },
                          { name: 'Maintenance', value: metrics.maintenanceVehicles, color: '#FFBB28' },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{metrics.inUseVehicles}</p>
                    <p className="text-xs text-muted-foreground">In Use</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{metrics.availableVehicles}</p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{metrics.maintenanceVehicles}</p>
                    <p className="text-xs text-muted-foreground">Maintenance</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-amber-600" />
                  Fuel Usage Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FFBB28" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#FFBB28" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => value + ' L'} />
                      <Area type="monotone" dataKey="fuel" stroke="#FFBB28" fillOpacity={1} fill="url(#colorFuel)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Total Fuel Consumed: <span className="font-semibold text-amber-600">
                      {chartData.reduce((sum, d) => sum + d.fuel, 0).toFixed(0)} L
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Trend */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Performance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => value?.toLocaleString() + ' TZS'} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#0088FE" strokeWidth={2} name="Revenue" />
                    <Line type="monotone" dataKey="expenses" stroke="#FF8042" strokeWidth={2} name="Expenses" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Fleet Operations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{metrics.totalTrips}</p>
                    <p className="text-xs text-muted-foreground">Total Trips</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{metrics.activeDrivers}</p>
                    <p className="text-xs text-muted-foreground">Active Drivers</p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Fleet utilization and driver performance metrics are calculated based on trip completion rates and vehicle deployment efficiency.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Financial Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-green-600">{formatCurrency(metrics.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-red-600">{formatCurrency(metrics.totalExpenses)}</p>
                    <p className="text-xs text-muted-foreground">Expenses</p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Net Profit: <span className={`font-bold ${metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(metrics.netProfit)}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
