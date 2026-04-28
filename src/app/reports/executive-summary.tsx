"use client";

import { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  Users, 
  Truck,
  FileText,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  Fuel
} from 'lucide-react';
import { DateRange } from 'react-day-picker';

interface ExecutiveSummaryData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  outstandingInvoices: number;
  totalTrips: number;
  totalCustomers: number;
  fuelCosts: number;
  maintenanceCosts: number;
  revenueTrend: number;
  expenseTrend: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface TopCustomer {
  name: string;
  revenue: number;
  trips: number;
}

interface TopExpense {
  category: string;
  amount: number;
  percentage: number;
}

export default function ExecutiveSummaryPage() {
  const { format: formatCurrency } = useCurrency();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExecutiveSummaryData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    loadExecutiveSummaryData();
  }, [dateRange]);

  const loadExecutiveSummaryData = async () => {
    setLoading(true);
    try {
      const fromDate = dateRange?.from?.toISOString() || new Date(new Date().getFullYear(), 0, 1).toISOString();
      const toDate = dateRange?.to?.toISOString() || new Date().toISOString();

      // Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      // Fetch expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate);

      // Fetch trips
      const { data: trips } = await supabase
        .from('trips')
        .select('*')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      // Fetch customers
      const { data: customers } = await supabase
        .from('clients')
        .select('*');

      // Calculate totals
      const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
      const outstandingInvoices = invoices?.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const fuelCosts = expenses?.filter(exp => exp.category?.toLowerCase().includes('fuel')).reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
      const maintenanceCosts = expenses?.filter(exp => exp.category?.toLowerCase().includes('maintenance')).reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      // Calculate trends (compare to previous period)
      const prevFromDate = new Date(fromDate);
      prevFromDate.setMonth(prevFromDate.getMonth() - 1);
      const prevToDate = new Date(toDate);
      prevToDate.setMonth(prevToDate.getMonth() - 1);

      const { data: prevInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .gte('created_at', prevFromDate.toISOString())
        .lte('created_at', prevToDate.toISOString());

      const { data: prevExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', prevFromDate.toISOString())
        .lte('date', prevToDate.toISOString());

      const prevRevenue = prevInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const prevExpensesTotal = prevExpenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      const revenueTrend = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      const expenseTrend = prevExpensesTotal > 0 ? ((totalExpenses - prevExpensesTotal) / prevExpensesTotal) * 100 : 0;

      setData({
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        outstandingInvoices,
        totalTrips: trips?.length || 0,
        totalCustomers: customers?.length || 0,
        fuelCosts,
        maintenanceCosts,
        revenueTrend,
        expenseTrend
      });

      // Generate monthly data for charts
      const months: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date();
        monthDate.setMonth(monthDate.getMonth() - i);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        
        const monthInvoices = invoices?.filter(inv => {
          const invDate = new Date(inv.created_at);
          return invDate >= monthStart && invDate <= monthEnd;
        }) || [];
        
        const monthExpenses = expenses?.filter(exp => {
          const expDate = new Date(exp.date);
          return expDate >= monthStart && expDate <= monthEnd;
        }) || [];

        const revenue = monthInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
        const expensesAmt = monthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

        months.push({
          month: format(monthDate, 'MMM yyyy'),
          revenue,
          expenses: expensesAmt,
          profit: revenue - expensesAmt
        });
      }
      setMonthlyData(months);

      // Top customers by revenue
      const customerRevenue: Record<string, { name: string; revenue: number; trips: number }> = {};
      trips?.forEach(trip => {
        if (trip.client) {
          if (!customerRevenue[trip.client]) {
            customerRevenue[trip.client] = { name: trip.client, revenue: 0, trips: 0 };
          }
          customerRevenue[trip.client].revenue += trip.salesAmount || 0;
          customerRevenue[trip.client].trips += 1;
        }
      });
      
      const sortedCustomers = Object.values(customerRevenue)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setTopCustomers(sortedCustomers);

      // Top expenses by category
      const categoryExpenses: Record<string, number> = {};
      expenses?.forEach(exp => {
        const category = exp.category || 'Other';
        categoryExpenses[category] = (categoryExpenses[category] || 0) + (exp.amount || 0);
      });
      
      const totalExp = Object.values(categoryExpenses).reduce((a, b) => a + b, 0);
      const sortedExpenses = Object.entries(categoryExpenses)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalExp > 0 ? (amount / totalExp) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
      setTopExpenses(sortedExpenses);

    } catch (error) {
      console.error('Error loading executive summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Generate CSV export
    const csvContent = [
      ['Metric', 'Value'],
      ['Total Revenue', data?.totalRevenue || 0],
      ['Total Expenses', data?.totalExpenses || 0],
      ['Net Profit', data?.netProfit || 0],
      ['Outstanding Invoices', data?.outstandingInvoices || 0],
      ['Total Trips', data?.totalTrips || 0],
      ['Total Customers', data?.totalCustomers || 0]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executive-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Executive Summary</h1>
              <p className="text-muted-foreground">Financial overview and key performance indicators</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <DatePickerWithRange 
                date={dateRange} 
                onDateChange={setDateRange}
              />
              <Button onClick={handleExport} variant="outline" className="gap-2">
                <Download className="size-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                <div className="p-2 bg-emerald-100 rounded-full">
                  <TrendingUp className="size-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data?.totalRevenue || 0)}</div>
                <div className="flex items-center gap-1 text-xs">
                  {data?.revenueTrend && data.revenueTrend > 0 ? (
                    <>
                      <ArrowUpRight className="size-3 text-emerald-600" />
                      <span className="text-emerald-600">+{data.revenueTrend.toFixed(1)}%</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="size-3 text-red-600" />
                      <span className="text-red-600">{data?.revenueTrend?.toFixed(1)}%</span>
                    </>
                  )}
                  <span className="text-muted-foreground ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                <div className="p-2 bg-red-100 rounded-full">
                  <TrendingDown className="size-4 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data?.totalExpenses || 0)}</div>
                <div className="flex items-center gap-1 text-xs">
                  {data?.expenseTrend && data.expenseTrend > 0 ? (
                    <>
                      <ArrowUpRight className="size-3 text-red-600" />
                      <span className="text-red-600">+{data.expenseTrend.toFixed(1)}%</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="size-3 text-emerald-600" />
                      <span className="text-emerald-600">{data?.expenseTrend?.toFixed(1)}%</span>
                    </>
                  )}
                  <span className="text-muted-foreground ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Wallet className="size-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${(data?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(data?.netProfit || 0)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data?.totalRevenue > 0 ? ((data?.netProfit || 0) / data.totalRevenue * 100).toFixed(1) : 0}% margin
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
                <div className="p-2 bg-orange-100 rounded-full">
                  <Receipt className="size-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(data?.outstandingInvoices || 0)}</div>
                <div className="text-xs text-muted-foreground">Pending invoices</div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Trips</CardTitle>
                <Truck className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{data?.totalTrips || 0}</div>
                <div className="text-xs text-muted-foreground">Completed trips</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{data?.totalCustomers || 0}</div>
                <div className="text-xs text-muted-foreground">Active clients</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fuel Costs</CardTitle>
                <Fuel className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(data?.fuelCosts || 0)}</div>
                <div className="text-xs text-muted-foreground">
                  {data?.totalExpenses > 0 ? ((data?.fuelCosts || 0) / data.totalExpenses * 100).toFixed(1) : 0}% of expenses
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
                <FileText className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(data?.maintenanceCosts || 0)}</div>
                <div className="text-xs text-muted-foreground">
                  {data?.totalExpenses > 0 ? ((data?.maintenanceCosts || 0) / data.totalExpenses * 100).toFixed(1) : 0}% of expenses
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue vs Expenses Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                        tickFormatter={(value) => `TZS ${(value / 1000000).toFixed(1)}M`}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        name="Revenue" 
                        stroke="#10b981" 
                        fill="#10b981" 
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="expenses" 
                        name="Expenses" 
                        stroke="#ef4444" 
                        fill="#ef4444" 
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="profit" 
                        name="Profit" 
                        stroke="#3b82f6" 
                        fill="#3b82f6" 
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Customers by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Trips</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.length > 0 ? (
                      topCustomers.map((customer, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(customer.revenue)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{customer.trips}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No customer data available for this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top Expenses */}
            <Card>
              <CardHeader>
                <CardTitle>Top Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topExpenses.length > 0 ? (
                      topExpenses.map((expense, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{expense.category}</TableCell>
                          <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={index === 0 ? "destructive" : "outline"}>
                              {expense.percentage.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No expense data available for this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
