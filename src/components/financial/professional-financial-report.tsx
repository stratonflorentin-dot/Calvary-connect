'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, TrendingUp, TrendingDown, DollarSign, Truck, Fuel, Wrench,
  ArrowUpRight, ArrowDownRight, Download, FileText, PieChart as PieChartIcon, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444ff', '#8b5cf6', '#06b6d4'];

interface FinancialData {
  currency: string;
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
  tripPerformance: TripPerformance[];
}

interface TripPerformance {
  tripNumber: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  margin: number;
  fuelCost: number;
  allowanceCost: number;
  otherCost: number;
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

interface CurrencyReport {
  [key: string]: FinancialData;
}

export function ProfessionalFinancialReport() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('TZS');
  const [reportData, setReportData] = useState<CurrencyReport | null>(null);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(['TZS']);
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
        { data: invoices },
        { data: maintenanceRequests },
        { data: fuelTracking },
        { data: allowances },
        { data: exchangeRates }
      ] = await Promise.all([
        supabase.from('trips').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('expenses').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('invoices').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('maintenance_requests').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('fuel_tracking').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('driver_allowances').select('*').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()),
        supabase.from('currency_exchange_rates').select('*').order('effective_date', { ascending: false }),
      ]);

      // Identify all unique currencies across all financial records
      const currencies = Array.from(new Set([
        ...(invoices?.map(i => i.currency) || []),
        ...(expenses?.map(e => e.currency) || []),
        ...(fuelTracking?.map(f => f.currency) || []),
        ...(allowances?.map(a => a.currency) || []),
        ...(maintenanceRequests?.map(m => m.currency) || []),
        'TZS' // Ensure base currency is always present
      ].filter(Boolean)));

      setAvailableCurrencies(['CONSOLIDATED', ...currencies]);

      const newReportData: CurrencyReport = {};

      // Helper for conversion (only for consolidated view)
      const convertToBase = (amount: number, fromCurrency: string) => {
        if (fromCurrency === 'TZS') return amount;
        const rateEntry = exchangeRates?.find(r => r.from_currency === fromCurrency && r.to_currency === 'TZS');
        return amount * (rateEntry?.rate || 1);
      };

      // 1. Calculate Individual Currency Reports (Isolated)
      currencies.forEach(curr => {
        const currInvoices = invoices?.filter(i => i.currency === curr) || [];
        const currExpenses = expenses?.filter(e => e.currency === curr) || [];
        const currFuel = fuelTracking?.filter(f => f.currency === curr) || [];
        const currAllowances = allowances?.filter(a => a.currency === curr) || [];
        const currMaintenance = maintenanceRequests?.filter(m => m.currency === curr) || [];
        
        const monthlyStats: MonthlyFinancialData[] = months.map((month, idx) => {
          const monthStart = new Date(selectedYear, idx, 1);
          const monthEnd = new Date(selectedYear, idx + 1, 0);
          const monthTrips = trips?.filter(t => {
            const date = new Date(t.created_at);
            return date >= monthStart && date <= monthEnd;
          }) || [];
          const monthInvoices = currInvoices.filter(i => {
            const date = new Date(i.created_at);
            return date >= monthStart && date <= monthEnd;
          });
          const monthExpenses = currExpenses.filter(e => {
            const date = new Date(e.created_at);
            return date >= monthStart && date <= monthEnd;
          });
          const monthFuel = currFuel.filter(f => {
            const date = new Date(f.created_at);
            return date >= monthStart && date <= monthEnd;
          });
          const monthAllowances = currAllowances.filter(a => {
            const date = new Date(a.created_at);
            return date >= monthStart && date <= monthEnd;
          });
          const monthMaintenance = currMaintenance.filter(m => {
            const date = new Date(m.created_at);
            return date >= monthStart && date <= monthEnd;
          });

          const revenue = monthInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
          const expensesTotal = 
            monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0) + 
            monthFuel.reduce((sum, f) => sum + Number(f.cost || 0), 0) + 
            monthAllowances.reduce((sum, a) => sum + Number(a.amount || 0), 0) +
            monthMaintenance.reduce((sum, m) => sum + Number(m.actual_cost || 0), 0);

          return {
            month: month.substring(0, 3),
            revenue,
            expenses: expensesTotal,
            profit: revenue - expensesTotal,
            trips: monthTrips.length
          };
        });

        const totalRevenue = currInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
        const fuelCost = currFuel.reduce((sum, f) => sum + Number(f.cost || 0), 0);
        const allowanceCost = currAllowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
        const maintenanceCost = currMaintenance.reduce((sum, m) => sum + Number(m.actual_cost || 0), 0);
        const otherExpenses = currExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const totalExpenses = fuelCost + allowanceCost + maintenanceCost + otherExpenses;

        // Calculate Trip-by-Trip Performance (Requirement 2)
        const tripPerformance: TripPerformance[] = trips?.map(trip => {
          const tripInvoices = currInvoices.filter(i => i.trip_id === trip.id);
          const tripFuel = currFuel.filter(f => f.trip_id === trip.id);
          const tripAllowances = currAllowances.filter(a => a.trip_id === trip.id);
          const tripExpenses = currExpenses.filter(e => e.trip_id === trip.id);
          const tripMaintenance = currMaintenance.filter(m => m.trip_id === trip.id);

          const tripRevenue = tripInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
          const tripFuelCost = tripFuel.reduce((sum, f) => sum + Number(f.cost || 0), 0);
          const tripAllowanceCost = tripAllowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
          const tripOtherCost = 
            tripExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0) + 
            tripMaintenance.reduce((sum, m) => sum + Number(m.actual_cost || 0), 0);
          
          const tripTotalExpenses = tripFuelCost + tripAllowanceCost + tripOtherCost;

          return {
            tripNumber: trip.trip_number || 'N/A',
            revenue: tripRevenue,
            expenses: tripTotalExpenses,
            netProfit: tripRevenue - tripTotalExpenses,
            margin: tripRevenue > 0 ? ((tripRevenue - tripTotalExpenses) / tripRevenue) * 100 : 0,
            fuelCost: tripFuelCost,
            allowanceCost: tripAllowanceCost,
            otherCost: tripOtherCost
          };
        }).filter(tp => tp.revenue > 0 || tp.expenses > 0) || [];

        newReportData[curr] = {
          currency: curr,
          totalRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses,
          profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
          totalTrips: trips?.length || 0,
          averageRevenuePerTrip: trips && trips.length > 0 ? totalRevenue / trips.length : 0,
          fuelCost,
          maintenanceCost,
          driverCost: allowanceCost,
          otherExpenses,
          monthlyData: monthlyStats,
          expenseBreakdown: [
            { name: 'Fuel', value: fuelCost, color: '#3b82f6' },
            { name: 'Maintenance', value: maintenanceCost, color: '#f59e0b' },
            { name: 'Allowances', value: allowanceCost, color: '#10b981' },
            { name: 'Other Expenses', value: otherExpenses, color: '#8b5cf6' }
          ].filter(cat => cat.value > 0),
          tripPerformance: tripPerformance.sort((a, b) => b.netProfit - a.netProfit)
        };
      });

      // 2. Calculate Consolidated Report (Base: TZS)
      const consolidatedMonthlyData: MonthlyFinancialData[] = months.map((month, idx) => {
        const stats = currencies.map(curr => newReportData[curr].monthlyData[idx]);
        const revenue = currencies.reduce((sum, curr) => sum + convertToBase(newReportData[curr].monthlyData[idx].revenue, curr), 0);
        const expenses = currencies.reduce((sum, curr) => sum + convertToBase(newReportData[curr].monthlyData[idx].expenses, curr), 0);
        return {
          month: month.substring(0, 3),
          revenue,
          expenses,
          profit: revenue - expenses,
          trips: stats[0]?.trips || 0
        };
      });

      const totalRevenue = currencies.reduce((sum, curr) => sum + convertToBase(newReportData[curr].totalRevenue, curr), 0);
      const fuelCost = currencies.reduce((sum, curr) => sum + convertToBase(newReportData[curr].fuelCost, curr), 0);
      const maintenanceCost = currencies.reduce((sum, curr) => sum + convertToBase(newReportData[curr].maintenanceCost, curr), 0);
      const driverCost = currencies.reduce((sum, curr) => sum + convertToBase(newReportData[curr].driverCost, curr), 0);
      const otherExpenses = currencies.reduce((sum, curr) => sum + convertToBase(newReportData[curr].otherExpenses, curr), 0);
      const totalExpenses = fuelCost + maintenanceCost + driverCost + otherExpenses;

      // Consolidated Trip Performance
      const consolidatedTripPerformance: TripPerformance[] = [];
      const allTripNumbers = Array.from(new Set(currencies.flatMap(curr => newReportData[curr].tripPerformance.map(tp => tp.tripNumber))));
      
      allTripNumbers.forEach(tripNum => {
        let tripRevenue = 0;
        let tripExpenses = 0;
        let tripFuel = 0;
        let tripAllowance = 0;
        let tripOther = 0;

        currencies.forEach(curr => {
          const tp = newReportData[curr].tripPerformance.find(p => p.tripNumber === tripNum);
          if (tp) {
            tripRevenue += convertToBase(tp.revenue, curr);
            tripExpenses += convertToBase(tp.expenses, curr);
            tripFuel += convertToBase(tp.fuelCost, curr);
            tripAllowance += convertToBase(tp.allowanceCost, curr);
            tripOther += convertToBase(tp.otherCost, curr);
          }
        });

        consolidatedTripPerformance.push({
          tripNumber: tripNum,
          revenue: tripRevenue,
          expenses: tripExpenses,
          netProfit: tripRevenue - tripExpenses,
          margin: tripRevenue > 0 ? ((tripRevenue - tripExpenses) / tripRevenue) * 100 : 0,
          fuelCost: tripFuel,
          allowanceCost: tripAllowance,
          otherCost: tripOther
        });
      });

      newReportData['CONSOLIDATED'] = {
        currency: 'TZS',
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
        totalTrips: trips?.length || 0,
        averageRevenuePerTrip: trips && trips.length > 0 ? totalRevenue / trips.length : 0,
        fuelCost,
        maintenanceCost,
        driverCost,
        otherExpenses,
        monthlyData: consolidatedMonthlyData,
        expenseBreakdown: [
          { name: 'Fuel', value: fuelCost, color: '#3b82f6' },
          { name: 'Maintenance', value: maintenanceCost, color: '#f59e0b' },
          { name: 'Allowances', value: driverCost, color: '#10b981' },
          { name: 'Other Expenses', value: otherExpenses, color: '#8b5cf6' }
        ].filter(cat => cat.value > 0),
        tripPerformance: consolidatedTripPerformance.sort((a, b) => b.netProfit - a.netProfit)
      };

      setReportData(newReportData);
      if (!['CONSOLIDATED', ...currencies].includes(selectedCurrency)) {
        setSelectedCurrency('CONSOLIDATED');
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number, currency: string = selectedCurrency) => {
    const formattedCurrency = currency === 'CONSOLIDATED' ? 'TZS' : currency;
    try {
      return new Intl.NumberFormat('en-TZ', {
        style: 'currency',
        currency: formattedCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    } catch (e) {
      // Fallback in case of any other unexpected invalid currency code
      return `${formattedCurrency} ${value.toLocaleString()}`;
    }
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

  if (!reportData || !reportData[selectedCurrency]) return null;
  const data = reportData[selectedCurrency];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Report</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <p>
              {selectedMonth ? months[selectedMonth - 1] : 'Annual'} {selectedYear} Financial Overview
            </p>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase">
              {selectedCurrency}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger className="w-[100px] border-blue-200 bg-blue-50/50">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {availableCurrencies.map(curr => (
                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Total Revenue
              <span className="text-[10px] bg-blue-50 px-1 rounded">{selectedCurrency}</span>
            </CardTitle>
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

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Total Expenses
              <span className="text-[10px] bg-red-50 px-1 rounded">{selectedCurrency}</span>
            </CardTitle>
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

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Net Profit
              <span className="text-[10px] bg-green-50 px-1 rounded">{selectedCurrency}</span>
            </CardTitle>
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

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Avg Revenue/Trip
              <span className="text-[10px] bg-purple-50 px-1 rounded">{selectedCurrency}</span>
            </CardTitle>
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

      {/* Currency Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center gap-2">
        <PieChartIcon className="h-4 w-4" />
        Note: This report is isolated to <strong>{selectedCurrency}</strong> transactions. Cross-currency data is excluded to maintain ledger integrity.
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
              <PieChartIcon className="h-5 w-5" />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Performing Trips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.tripPerformance.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="tripNumber" type="category" width={100} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="netProfit" fill="#10b981" name="Net Profit" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fleet Operational Income Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">Trip Number</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Fuel</th>
                  <th className="px-4 py-3 text-right">Allowances</th>
                  <th className="px-4 py-3 text-right">Other</th>
                  <th className="px-4 py-3 text-right">Total Expenses</th>
                  <th className="px-4 py-3 text-right">Net Profit</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.tripPerformance.length > 0 ? (
                  data.tripPerformance.map((trip, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{trip.tripNumber}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(trip.revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{formatCurrency(trip.fuelCost)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{formatCurrency(trip.allowanceCost)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{formatCurrency(trip.otherCost)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(trip.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${trip.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(trip.netProfit)}
                      </td>
                      <td className={`px-4 py-3 text-right ${trip.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trip.margin.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No trip-specific financial data found for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
