'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, TrendingUp, TrendingDown, DollarSign, Truck, Fuel, Wrench,
  ArrowUpRight, ArrowDownRight, Download, FileText, PieChart, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface FinancialData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  totalTrips: number;
  averageRevenuePerTrip: number;
  fuelCost: number;
  maintenanceCost: number;
  driverCost: number;
  otherExpenses: number;
  monthlyData: MonthlyFinancialData[];
  expenseBreakdown: ExpenseCategory[];
}

interface MonthlyFinancialData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  trips: number;
}

interface ExpenseCategory {
  name: string;
  value: number;
  color: string;
}

export function ProfessionalFinancialReport() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [data, setData] = useState<FinancialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const years = [2024, 2025, 2026];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    loadFinancialData();
  }, [selectedYear, selectedMonth]);

  const loadFinancialData = async () => {
    try {
      setIsLoading(true);

      const startDate = selectedMonth
        ? new Date(selectedYear, selectedMonth - 1, 1)
        : new Date(selectedYear, 0, 1);
      
      const endDate = selectedMonth
        ? new Date(selectedYear, selectedMonth, 0)
        : new Date(selectedYear, 11, 31);

      const [
        { data: trips },
        { data: expenses },
        { data: fuelRecords },
        { data: maintenanceRequests }
      ] = await Promise.all([
        supabase.from('trips').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('expenses').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('fuel_records').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('maintenance_requests').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
      ]);

      // Calculate monthly data
      const monthlyStats: MonthlyFinancialData[] = months.map((month, idx) => {
        const monthStart = new Date(selectedYear, idx, 1);
        const monthEnd = new Date(selectedYear, idx + 1, 0);

        const monthTrips = trips?.filter(t => {
          const date = new Date(t.created_at || t.startDate);
          return date >= monthStart && date <= monthEnd;
        }) || [];

        const monthExpenses = expenses?.filter(e => {
          const date = new Date(e.created_at || e.date);
          return date >= monthStart && date <= monthEnd;
        }) || [];

        const revenue = monthTrips.reduce((sum, t) => sum + (t.salesAmount || t.revenue || t.price || 0), 0);
        const expensesTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        return {
          month: month.substring(0, 3),
          revenue,
          expenses: expensesTotal,
          profit: revenue - expensesTotal,
          trips: monthTrips.length
        };
      });

      // Calculate totals
      const totalRevenue = trips?.reduce((sum, t) => sum + (t.salesAmount || t.revenue || t.price || 0), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const fuelCost = fuelRecords?.reduce((sum, f) => sum + (f.cost || 0), 0) || 0;
      const maintenanceCost = maintenanceRequests?.reduce((sum, m) => sum + (m.cost || 0), 0) || 0;
      const driverCost = expenses?.filter(e => e.category === 'driver' || e.category === 'allowance').reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const otherExpenses = totalExpenses - fuelCost - maintenanceCost - driverCost;

      const expenseBreakdown: ExpenseCategory[] = [
        { name: 'Fuel', value: fuelCost, color: '#3b82f6' },
        { name: 'Maintenance', value: maintenanceCost, color: '#f59e0b' },
        { name: 'Driver Costs', value: driverCost, color: '#10b981' },
        { name: 'Other', value: otherExpenses, color: '#8b5cf6' }
      ].filter(cat => cat.value > 0);

      setData({
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
        totalTrips: trips?.length || 0,
        averageRevenuePerTrip: trips?.length > 0 ? totalRevenue / trips.length : 0,
        fuelCost,
        maintenanceCost,
        driverCost,
        otherExpenses,
        monthlyData: monthlyStats,
        expenseBreakdown
      });
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Report</h1>
          <p className="text-muted-foreground">
            {selectedMonth ? months[selectedMonth - 1] : 'Annual'} {selectedYear} Financial Overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={selectedMonth?.toString() || 'all'} 
            onValueChange={(v) => setSelectedMonth(v === 'all' ? null : parseInt(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {months.map((month, idx) => (
                <SelectItem key={idx} value={(idx + 1).toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalTrips} trips completed
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</div>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(data.totalExpenses / data.totalTrips || 0)} per trip
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.netProfit)}
              </div>
              {data.netProfit >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.profitMargin.toFixed(1)}% profit margin
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Revenue/Trip</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{formatCurrency(data.averageRevenuePerTrip)}</div>
              <Truck className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per trip average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue vs Expenses Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Revenue vs Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Expense Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profit Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Profit Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" name="Net Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Expense Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Expense Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="h-5 w-5 text-blue-600" />
                <p className="font-medium">Fuel Costs</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.fuelCost)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalExpenses > 0 ? ((data.fuelCost / data.totalExpenses) * 100).toFixed(1) : 0}% of total
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-5 w-5 text-amber-600" />
                <p className="font-medium">Maintenance</p>
              </div>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(data.maintenanceCost)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalExpenses > 0 ? ((data.maintenanceCost / data.totalExpenses) * 100).toFixed(1) : 0}% of total
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <p className="font-medium">Driver Costs</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.driverCost)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalExpenses > 0 ? ((data.driverCost / data.totalExpenses) * 100).toFixed(1) : 0}% of total
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-purple-600" />
                <p className="font-medium">Other Expenses</p>
              </div>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(data.otherExpenses)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalExpenses > 0 ? ((data.otherExpenses / data.totalExpenses) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trip Volume */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Trip Volume & Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="trips" stroke="#8b5cf6" strokeWidth={2} name="Trips" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
