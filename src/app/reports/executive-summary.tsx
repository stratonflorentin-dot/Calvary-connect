"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { format } from 'date-fns';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

// Per-currency money maps — never blend raw amounts across currencies.
// e.g. { TZS: 4_500_000, USD: 1_200 }. Populated dynamically from whatever
// currencies actually appear on the underlying invoices/expenses.
type MoneyByCurrency = Record<string, number>;

interface ExecutiveSummaryData {
  totalRevenue: MoneyByCurrency;
  totalExpenses: MoneyByCurrency;
  netProfit: MoneyByCurrency;
  outstandingInvoices: MoneyByCurrency;
  totalTrips: number;
  totalCustomers: number;
  fuelCosts: MoneyByCurrency;
  maintenanceCosts: MoneyByCurrency;
  revenueTrend: number;
  expenseTrend: number;
}

const PRIMARY_CURRENCY = "TZS";

function normCurrency(c: string | null | undefined): string {
  return (c || PRIMARY_CURRENCY).toUpperCase();
}

function addTo(map: MoneyByCurrency, currency: string, amount: number) {
  map[currency] = (map[currency] || 0) + amount;
}

/** Every currency present in a map other than the primary one, non-zero, sorted for stable rendering. */
function secondaryCurrencies(map: MoneyByCurrency): string[] {
  return Object.keys(map)
    .filter((c) => c !== PRIMARY_CURRENCY && Math.abs(map[c]) > 0.001)
    .sort();
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

      // Calculate totals — grouped per currency, never blended. A TZS
      // invoice and a USD invoice are different money; summing their raw
      // amounts together produces a number that means nothing.
      const totalRevenue: MoneyByCurrency = {};
      const outstandingInvoices: MoneyByCurrency = {};
      invoices?.forEach((inv) => {
        const cur = normCurrency(inv.currency);
        addTo(totalRevenue, cur, inv.total_amount || 0);
        if (inv.status !== 'paid') addTo(outstandingInvoices, cur, inv.total_amount || 0);
      });

      const totalExpenses: MoneyByCurrency = {};
      const fuelCosts: MoneyByCurrency = {};
      const maintenanceCosts: MoneyByCurrency = {};
      expenses?.forEach((exp) => {
        const cur = normCurrency(exp.currency);
        addTo(totalExpenses, cur, exp.amount || 0);
        const category = exp.category?.toLowerCase() || '';
        if (category.includes('fuel')) addTo(fuelCosts, cur, exp.amount || 0);
        if (category.includes('maintenance')) addTo(maintenanceCosts, cur, exp.amount || 0);
      });

      const netProfit: MoneyByCurrency = {};
      for (const cur of new Set([...Object.keys(totalRevenue), ...Object.keys(totalExpenses)])) {
        netProfit[cur] = (totalRevenue[cur] || 0) - (totalExpenses[cur] || 0);
      }

      // Calculate trends (compare to previous period) — tracked in the
      // primary currency only; the KPI cards below show the full per-currency
      // breakdown, this trend arrow just describes the headline number.
      const prevFromDate = new Date(fromDate);
      prevFromDate.setMonth(prevFromDate.getMonth() - 1);
      const prevToDate = new Date(toDate);
      prevToDate.setMonth(prevToDate.getMonth() - 1);

      const { data: prevInvoices } = await supabase
        .from('invoices')
        .select('total_amount, currency')
        .gte('created_at', prevFromDate.toISOString())
        .lte('created_at', prevToDate.toISOString());

      const { data: prevExpenses } = await supabase
        .from('expenses')
        .select('amount, currency')
        .gte('date', prevFromDate.toISOString())
        .lte('date', prevToDate.toISOString());

      const prevRevenuePrimary = prevInvoices
        ?.filter((inv) => normCurrency(inv.currency) === PRIMARY_CURRENCY)
        .reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
      const prevExpensesPrimary = prevExpenses
        ?.filter((exp) => normCurrency(exp.currency) === PRIMARY_CURRENCY)
        .reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      const revenuePrimary = totalRevenue[PRIMARY_CURRENCY] || 0;
      const expensesPrimary = totalExpenses[PRIMARY_CURRENCY] || 0;
      const revenueTrend = prevRevenuePrimary > 0 ? ((revenuePrimary - prevRevenuePrimary) / prevRevenuePrimary) * 100 : 0;
      const expenseTrend = prevExpensesPrimary > 0 ? ((expensesPrimary - prevExpensesPrimary) / prevExpensesPrimary) * 100 : 0;

      setData({
        totalRevenue,
        totalExpenses,
        netProfit,
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

        // Trend chart is single-currency (primary/TZS) by design — plotting
        // TZS and USD amounts on the same line would be as meaningless as
        // summing them. See the Financial tab for full multi-currency detail.
        const monthInvoices = invoices?.filter(inv => {
          const invDate = new Date(inv.created_at);
          return invDate >= monthStart && invDate <= monthEnd && normCurrency(inv.currency) === PRIMARY_CURRENCY;
        }) || [];

        const monthExpenses = expenses?.filter(exp => {
          const expDate = new Date(exp.date);
          return expDate >= monthStart && expDate <= monthEnd && normCurrency(exp.currency) === PRIMARY_CURRENCY;
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

      // Top expenses by category — primary-currency only, same reasoning as
      // the trend chart: a category total mixing TZS and USD would be fiction.
      const categoryExpenses: Record<string, number> = {};
      expenses?.filter(exp => normCurrency(exp.currency) === PRIMARY_CURRENCY).forEach(exp => {
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
    // Generate CSV export — one row per currency actually present, so a
    // TZS and a USD figure never collapse into one meaningless cell.
    const moneyRows = (label: string, map: MoneyByCurrency | undefined) =>
      Object.entries(map || {}).map(([cur, amt]) => [`${label} (${cur})`, amt]);

    const csvContent = [
      ['Metric', 'Value'],
      ...moneyRows('Total Revenue', data?.totalRevenue),
      ...moneyRows('Total Expenses', data?.totalExpenses),
      ...moneyRows('Net Profit', data?.netProfit),
      ...moneyRows('Outstanding Invoices', data?.outstandingInvoices),
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

  // Renders the primary-currency figure big, plus a small line per other
  // currency actually present — instead of picking one and hiding the rest.
  const Money = ({ map, className }: { map: MoneyByCurrency | undefined; className?: string }) => {
    const primary = map?.[PRIMARY_CURRENCY] || 0;
    const others = map ? secondaryCurrencies(map) : [];
    return (
      <div>
        <div className={className}>{formatCurrency(primary, PRIMARY_CURRENCY)}</div>
        {others.map((cur) => (
          <div key={cur} className="text-xs font-semibold text-muted-foreground mt-0.5">
            + {formatCurrency(map![cur], cur)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
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
          <Button onClick={handleExport} variant="outline" className="gap-2 h-11">
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="p-2 bg-success/10 rounded-full">
              <TrendingUp className="size-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <Money map={data?.totalRevenue} className="text-2xl font-bold text-foreground" />
            <div className="flex items-center gap-1 text-xs mt-1">
              {data?.revenueTrend && data.revenueTrend > 0 ? (
                <>
                  <ArrowUpRight className="size-3 text-success" />
                  <span className="text-success">+{data.revenueTrend.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="size-3 text-destructive" />
                  <span className="text-destructive">{data?.revenueTrend?.toFixed(1)}%</span>
                </>
              )}
              <span className="text-muted-foreground ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <div className="p-2 bg-destructive/10 rounded-full">
              <TrendingDown className="size-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <Money map={data?.totalExpenses} className="text-2xl font-bold text-foreground" />
            <div className="flex items-center gap-1 text-xs mt-1">
              {data?.expenseTrend && data.expenseTrend > 0 ? (
                <>
                  <ArrowUpRight className="size-3 text-destructive" />
                  <span className="text-destructive">+{data.expenseTrend.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="size-3 text-success" />
                  <span className="text-success">{data?.expenseTrend?.toFixed(1)}%</span>
                </>
              )}
              <span className="text-muted-foreground ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <Wallet className="size-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <Money
              map={data?.netProfit}
              className={cn("text-2xl font-bold", (data?.netProfit?.[PRIMARY_CURRENCY] || 0) >= 0 ? "text-success" : "text-destructive")}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {(data?.totalRevenue?.[PRIMARY_CURRENCY] ?? 0) > 0
                ? ((data!.netProfit[PRIMARY_CURRENCY] || 0) / data!.totalRevenue[PRIMARY_CURRENCY] * 100).toFixed(1)
                : 0}% margin ({PRIMARY_CURRENCY})
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <div className="p-2 bg-warning/10 rounded-full">
              <Receipt className="size-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <Money map={data?.outstandingInvoices} className="text-2xl font-bold text-warning" />
            <div className="text-xs text-muted-foreground mt-1">Pending invoices</div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Trips</CardTitle>
            <Truck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">{data?.totalTrips || 0}</div>
            <div className="text-xs text-muted-foreground">Completed trips</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">{data?.totalCustomers || 0}</div>
            <div className="text-xs text-muted-foreground">Active clients</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fuel Costs</CardTitle>
            <Fuel className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Money map={data?.fuelCosts} className="text-xl font-bold text-foreground" />
            <div className="text-xs text-muted-foreground mt-1">
              {(data?.totalExpenses?.[PRIMARY_CURRENCY] ?? 0) > 0
                ? ((data?.fuelCosts?.[PRIMARY_CURRENCY] || 0) / data!.totalExpenses[PRIMARY_CURRENCY] * 100).toFixed(1)
                : 0}% of {PRIMARY_CURRENCY} expenses
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Money map={data?.maintenanceCosts} className="text-xl font-bold text-foreground" />
            <div className="text-xs text-muted-foreground mt-1">
              {(data?.totalExpenses?.[PRIMARY_CURRENCY] ?? 0) > 0
                ? ((data?.maintenanceCosts?.[PRIMARY_CURRENCY] || 0) / data!.totalExpenses[PRIMARY_CURRENCY] * 100).toFixed(1)
                : 0}% of {PRIMARY_CURRENCY} expenses
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Chart */}
        <Card className="lg:col-span-2 border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-foreground">Revenue vs Expenses Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `TZS ${(value / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
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
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-foreground">Top Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Customer</TableHead>
                  <TableHead className="text-right text-foreground">Revenue</TableHead>
                  <TableHead className="text-right text-foreground">Trips</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.length > 0 ? (
                  topCustomers.map((customer, index) => (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{customer.name}</TableCell>
                      <TableCell className="text-right text-foreground">{formatCurrency(customer.revenue)}</TableCell>
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
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-foreground">Top Expense Categories</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Category</TableHead>
                  <TableHead className="text-right text-foreground">Amount</TableHead>
                  <TableHead className="text-right text-foreground">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topExpenses.length > 0 ? (
                  topExpenses.map((expense, index) => (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{expense.category}</TableCell>
                      <TableCell className="text-right text-foreground">{formatCurrency(expense.amount)}</TableCell>
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
