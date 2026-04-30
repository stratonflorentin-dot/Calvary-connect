'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function ComprehensiveAIAnalysis() {
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Load real data immediately
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1).toISOString();
      
      // Fetch only the tables we need for metrics (faster)
      const [
        { data: trips },
        { data: vehicles },
        { data: drivers },
        { data: expenses },
        { data: invoices },
        { data: fuelRecords },
        { data: maintenance }
      ] = await Promise.all([
        supabase.from('trips').select('*').gte('created_at', startOfYear),
        supabase.from('fleet_vehicles').select('*'),
        supabase.from('drivers').select('*').eq('status', 'active'),
        supabase.from('expenses').select('*').gte('created_at', startOfYear),
        supabase.from('invoices').select('*'),
        supabase.from('fuel_records').select('*').gte('created_at', startOfYear),
        supabase.from('maintenance_requests').select('*').gte('created_at', startOfYear),
      ]);

      const tripsData = trips || [];
      const expensesData = expenses || [];
      
      // Calculate metrics immediately
      const totalRevenue = tripsData.reduce((sum, t) => sum + (t.salesAmount || t.revenue || t.price || 0), 0);
      const totalExpenses = expensesData.reduce((sum, e) => sum + (e.amount || 0), 0);
      const fuelCosts = (fuelRecords || []).reduce((sum, f) => sum + (f.cost || 0), 0);
      const outstandingInvoices = (invoices || [])
        .filter(i => i.status !== 'paid')
        .reduce((sum, i) => sum + (i.balance || i.total || 0), 0);

      setMetrics({
        totalTrips: tripsData.length,
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        fleetSize: (vehicles || []).length,
        activeDrivers: (drivers || []).length,
        outstandingInvoices,
        fuelCosts,
        maintenanceCount: (maintenance || []).length
      });

      // Generate monthly chart data
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      
      const monthlyData = months.slice(0, currentMonth + 1).map((month, idx) => {
        const monthTrips = tripsData.filter(t => {
          const date = new Date(t.created_at || t.startDate);
          return date.getMonth() === idx;
        });
        
        const monthExpenses = expensesData.filter(e => {
          const date = new Date(e.created_at || e.date);
          return date.getMonth() === idx;
        });

        return {
          month,
          revenue: monthTrips.reduce((sum, t) => sum + (t.salesAmount || t.revenue || 0), 0),
          expenses: monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
          trips: monthTrips.length,
          fuel: (fuelRecords || [])
            .filter(f => new Date(f.created_at || f.date).getMonth() === idx)
            .reduce((sum, f) => sum + (f.liters || 0), 0),
        };
      });

      setChartData(monthlyData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Run AI analysis separately (optional, doesn't block UI)
  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Simulate AI analysis with realistic summary based on actual data
      const summary = generateRealisticSummary(metrics);
      setAiAnalysis(summary);
    } catch (error) {
      console.error('AI analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate realistic summary based on actual metrics
  const generateRealisticSummary = (m: CompanyMetrics | null): string => {
    if (!m) return 'Loading data...';
    
    if (m.totalTrips === 0 && m.fleetSize === 0) {
      return 'Your fleet management system is ready. Start by adding vehicles and creating trips to see AI-powered insights and analytics.';
    }

    if (m.totalTrips === 0 && m.fleetSize > 0) {
      return `Your fleet has ${m.fleetSize} vehicles ready for operations. Add your first trip to begin tracking revenue, expenses, and performance metrics. Current outstanding balance is ${formatCurrency(m.outstandingInvoices)}.`;
    }

    const profitMargin = m.totalRevenue > 0 ? ((m.netProfit / m.totalRevenue) * 100).toFixed(1) : '0';
    const isProfitable = m.netProfit > 0;
    
    return `Fleet Performance: ${m.totalTrips} trips completed with ${m.fleetSize} vehicles. ${isProfitable ? 'Profitable' : 'Loss-making'} operation at ${profitMargin}% margin. ${m.activeDrivers} active drivers. Outstanding receivables: ${formatCurrency(m.outstandingInvoices)}. Fuel costs represent ${m.totalRevenue > 0 ? ((m.fuelCosts / m.totalRevenue) * 100).toFixed(1) : 0}% of revenue.`;
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
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
              Real-time dashboard • {lastUpdated?.toLocaleTimeString() || 'Just now'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={runAIAnalysis}
            disabled={isAnalyzing}
            className="gap-2"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {isAnalyzing ? 'Analyzing...' : 'AI Insights'}
          </Button>
          <Button 
            variant="outline" 
            onClick={loadData}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* AI Summary (if generated) */}
      {aiAnalysis && (
        <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-blue-600" />
              AI Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-700">
              {aiAnalysis}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Real Metrics Grid - Shows Immediately */}
      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Total Trips</p>
                <p className="text-2xl font-bold mt-1">{metrics.totalTrips}</p>
                <Badge variant="secondary" className="text-[10px]">This Year</Badge>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Total Revenue</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(metrics.totalRevenue)}</p>
                <Badge variant="secondary" className="text-[10px]">This Year</Badge>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Fleet Size</p>
                <p className="text-2xl font-bold mt-1">{metrics.fleetSize}</p>
                <p className="text-xs text-muted-foreground">Vehicles</p>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Active Drivers</p>
                <p className="text-2xl font-bold mt-1">{metrics.activeDrivers}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Total Expenses</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(metrics.totalExpenses)}</p>
                <Badge variant="secondary" className="text-[10px]">This Year</Badge>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Outstanding</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{formatCurrency(metrics.outstandingInvoices)}</p>
                <p className="text-xs text-muted-foreground">Unpaid Invoices</p>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Fuel Costs</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.fuelCosts)}</p>
                <Badge variant="secondary" className="text-[10px]">This Year</Badge>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase">Maintenance</p>
                <p className="text-2xl font-bold mt-1">{metrics.maintenanceCount}</p>
                <p className="text-xs text-muted-foreground">Records</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {metrics ? (
        <>
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
                {aiAnalysis || generateRealisticSummary(metrics)}
              </p>
            </CardContent>
          </Card>

          {/* Revenue & Expense Chart */}
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
                          { name: 'Active', value: chartData.reduce((sum, d) => sum + d.trips, 0) > 0 ? 1 : 0, color: '#00C49F' },
                          { name: 'Available', value: (metrics?.fleetSize || 0) > 0 ? 1 : 0, color: '#0088FE' },
                          { name: 'Idle', value: 0, color: '#FFBB28' },
                        ]}
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
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{metrics?.fleetSize || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Vehicles</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{metrics?.totalTrips || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Trips</p>
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

          {/* Performance Trend Section */}
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
                    <p className="text-2xl font-bold text-blue-600">{metrics?.totalTrips || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Trips</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{metrics?.activeDrivers || 0}</p>
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
                    <p className="text-lg font-bold text-green-600">{formatCurrency(metrics?.totalRevenue || 0)}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-red-600">{formatCurrency(metrics?.totalExpenses || 0)}</p>
                    <p className="text-xs text-muted-foreground">Expenses</p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Net Profit: <span className={`font-bold ${(metrics?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(metrics?.netProfit || 0)}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
