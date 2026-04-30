'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { 
  Truck, DollarSign, Users, Fuel, AlertTriangle, 
  TrendingUp, TrendingDown, Package, Calendar,
  Clock, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface DashboardMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalTrips: number;
  completedTrips: number;
  activeTrips: number;
  totalVehicles: number;
  availableVehicles: number;
  inUseVehicles: number;
  maintenanceVehicles: number;
  totalDrivers: number;
  activeDrivers: number;
  totalFuelCost: number;
  totalFuelLiters: number;
  pendingInvoices: number;
  paidInvoices: number;
  outstandingAmount: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  trips: number;
  profit: number;
}

export function ProfessionalCEODashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [
        { data: trips },
        { data: vehicles },
        { data: drivers },
        { data: expenses },
        { data: invoices },
        { data: fuelRecords }
      ] = await Promise.all([
        supabase.from('trips').select('*'),
        supabase.from('fleet_vehicles').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('fuel_records').select('*'),
      ]);

      const currentYear = new Date().getFullYear();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Calculate monthly data
      const monthlyStats: MonthlyData[] = months.map((month, idx) => {
        const monthTrips = trips?.filter(t => {
          const date = new Date(t.created_at || t.startDate);
          return date.getFullYear() === currentYear && date.getMonth() === idx;
        }) || [];
        
        const monthExpenses = expenses?.filter(e => {
          const date = new Date(e.created_at || e.date);
          return date.getFullYear() === currentYear && date.getMonth() === idx;
        }) || [];

        const monthInvoices = invoices?.filter(i => {
          const date = new Date(i.created_at || i.date);
          return date.getFullYear() === currentYear && date.getMonth() === idx;
        }) || [];

        const revenue = monthInvoices.reduce((sum, i) => sum + (i.total || i.amount || 0), 0);
        const expensesTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const tripRevenue = monthTrips.reduce((sum, t) => sum + (t.salesAmount || t.revenue || 0), 0);

        return {
          month,
          revenue: revenue + tripRevenue,
          expenses: expensesTotal,
          trips: monthTrips.length,
          profit: (revenue + tripRevenue) - expensesTotal
        };
      });

      setMonthlyData(monthlyStats);

      // Calculate overall metrics
      const totalRevenue = trips?.reduce((sum, t) => sum + (t.salesAmount || t.revenue || 0), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const totalFuelCost = fuelRecords?.reduce((sum, f) => sum + (f.cost || 0), 0) || 0;
      const totalFuelLiters = fuelRecords?.reduce((sum, f) => sum + (f.liters || 0), 0) || 0;
      const outstandingAmount = invoices?.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.balance || i.total || 0), 0) || 0;

      setMetrics({
        totalRevenue,
        totalExpenses: totalExpenses + totalFuelCost,
        netProfit: totalRevenue - (totalExpenses + totalFuelCost),
        totalTrips: trips?.length || 0,
        completedTrips: trips?.filter(t => t.status === 'COMPLETED').length || 0,
        activeTrips: trips?.filter(t => t.status === 'ACTIVE' || t.status === 'IN_PROGRESS').length || 0,
        totalVehicles: vehicles?.length || 0,
        availableVehicles: vehicles?.filter(v => v.status === 'AVAILABLE').length || 0,
        inUseVehicles: vehicles?.filter(v => v.status === 'IN_USE').length || 0,
        maintenanceVehicles: vehicles?.filter(v => v.status === 'MAINTENANCE').length || 0,
        totalDrivers: drivers?.length || 0,
        activeDrivers: drivers?.filter(d => d.status === 'active').length || 0,
        totalFuelCost,
        totalFuelLiters,
        pendingInvoices: invoices?.filter(i => i.status !== 'paid').length || 0,
        paidInvoices: invoices?.filter(i => i.status === 'paid').length || 0,
        outstandingAmount
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-32 animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-TZ').format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground">Real-time fleet operations overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Year to date</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className={`text-2xl font-bold ${metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.netProfit)}
              </div>
              {metrics.netProfit >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.netProfit >= 0 ? 'Profitable' : 'Loss'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Trips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatNumber(metrics.totalTrips)}</div>
              <Truck className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.completedTrips} completed
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatCurrency(metrics.outstandingAmount)}</div>
              <DollarSign className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.pendingInvoices} pending invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Profit Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Expenses (Monthly)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trip Volume by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="trips" fill="#8b5cf6" name="Trips" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet & Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fleet Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Available', value: metrics.availableVehicles },
                      { name: 'In Use', value: metrics.inUseVehicles },
                      { name: 'Maintenance', value: metrics.maintenanceVehicles },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div>
                <p className="text-lg font-bold text-green-600">{metrics.availableVehicles}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600">{metrics.inUseVehicles}</p>
                <p className="text-xs text-muted-foreground">In Use</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{metrics.maintenanceVehicles}</p>
                <p className="text-xs text-muted-foreground">Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operations Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Vehicles</p>
                  <p className="text-xs text-muted-foreground">Fleet size</p>
                </div>
              </div>
              <p className="text-xl font-bold">{metrics.totalVehicles}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Active Drivers</p>
                  <p className="text-xs text-muted-foreground">Available for work</p>
                </div>
              </div>
              <p className="text-xl font-bold">{metrics.activeDrivers}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Active Trips</p>
                  <p className="text-xs text-muted-foreground">Currently in progress</p>
                </div>
              </div>
              <p className="text-xl font-bold">{metrics.activeTrips}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Fuel className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium">Fuel Cost</p>
                  <p className="text-xs text-muted-foreground">Total spent</p>
                </div>
              </div>
              <p className="text-xl font-bold">{formatCurrency(metrics.totalFuelCost)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Paid Invoices</p>
                  <p className="text-xs text-muted-foreground">Collected payments</p>
                </div>
              </div>
              <p className="text-xl font-bold">{metrics.paidInvoices}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Pending Invoices</p>
                  <p className="text-xs text-muted-foreground">Awaiting payment</p>
                </div>
              </div>
              <p className="text-xl font-bold">{metrics.pendingInvoices}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Outstanding</p>
                  <p className="text-xs text-muted-foreground">Receivables</p>
                </div>
              </div>
              <p className="text-xl font-bold">{formatCurrency(metrics.outstandingAmount)}</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Total Expenses</p>
                  <p className="text-xs text-muted-foreground">Operating costs</p>
                </div>
              </div>
              <p className="text-xl font-bold">{formatCurrency(metrics.totalExpenses)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profit Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Profit Trend (Monthly)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Net Profit"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
