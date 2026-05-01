'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, TrendingDown, 
  DollarSign, Truck, AlertTriangle, 
  BarChart3, Loader2, Send, Sparkles,
  RefreshCw, FileText, Brain, Fuel,
  Database, MessageSquare, Zap, Search,
  Calendar, Users, Package, CreditCard
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
}

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

interface DatabaseQuery {
  table: 'trips' | 'fleet_vehicles' | 'drivers' | 'expenses' | 'invoices' | 'fuel_records' | 'maintenance_requests' | 'vehicle_service_records' | 'vehicle_expenses' | 'vehicle_financial_summary';
  filters?: { column: string; operator: string; value: any }[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
}

interface VehicleFinancialData {
  vehicle_id: string;
  plate_number: string;
  vehicle_name: string;
  total_income: number;
  total_costs: number;
  net_profit: number;
  profit_margin_percent: number;
  trip_count: number;
  service_count: number;
  fuel_count: number;
  total_fuel_liters: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// AI Query Engine - Can query any table with filters
const queryDatabase = async (query: DatabaseQuery): Promise<any[]> => {
  let supabaseQuery = supabase.from(query.table).select('*');
  
  if (query.filters) {
    query.filters.forEach(filter => {
      if (filter.operator === 'eq') supabaseQuery = supabaseQuery.eq(filter.column, filter.value);
      if (filter.operator === 'gt') supabaseQuery = supabaseQuery.gt(filter.column, filter.value);
      if (filter.operator === 'lt') supabaseQuery = supabaseQuery.lt(filter.column, filter.value);
      if (filter.operator === 'gte') supabaseQuery = supabaseQuery.gte(filter.column, filter.value);
      if (filter.operator === 'lte') supabaseQuery = supabaseQuery.lte(filter.column, filter.value);
      if (filter.operator === 'like') supabaseQuery = supabaseQuery.like(filter.column, `%${filter.value}%`);
    });
  }
  
  if (query.orderBy) {
    supabaseQuery = supabaseQuery.order(query.orderBy.column, { ascending: query.orderBy.ascending });
  }
  
  if (query.limit) {
    supabaseQuery = supabaseQuery.limit(query.limit);
  }
  
  const { data, error } = await supabaseQuery;
  if (error) throw error;
  return data || [];
};

export function AIAnalysisDashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [quickView, setQuickView] = useState<string>('overview');
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    if (value === 0) return '0 TZS';
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Load all metrics
  const loadMetrics = useCallback(async () => {
    const [
      { data: trips },
      { data: vehicles },
      { data: drivers },
      { data: expenses },
      { data: invoices },
      { data: fuelRecords },
      { data: maintenance }
    ] = await Promise.all([
      supabase.from('trips').select('id, salesAmount, revenue, price, totalAmount, status, created_at, startDate, date, origin, destination'),
      supabase.from('fleet_vehicles').select('id, status, plateNumber, type'),
      supabase.from('drivers').select('id, status, full_name'),
      supabase.from('expenses').select('id, amount, total, category, created_at'),
      supabase.from('invoices').select('id, status, balance, total, amount, created_at, client_name'),
      supabase.from('fuel_records').select('id, cost, totalCost, amount, liters, quantity, created_at, vehicle_id'),
      supabase.from('maintenance_requests').select('id, status, vehicle_id, created_at'),
    ]);

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

    const calculatedMetrics: CompanyMetrics = {
      totalTrips: tripsData.length,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses - fuelCosts,
      fleetSize: vehiclesData.length,
      activeDrivers: driversData.filter((d: any) => d.status === 'active').length,
      outstandingInvoices,
      fuelCosts,
      maintenanceCount: maintenance?.length || 0,
      availableVehicles: vehiclesData.filter((v: any) => v.status === 'AVAILABLE').length,
      inUseVehicles: vehiclesData.filter((v: any) => v.status === 'IN_USE').length,
      maintenanceVehicles: vehiclesData.filter((v: any) => v.status === 'MAINTENANCE').length,
      totalDrivers: driversData.length,
      completedTrips: tripsData.filter((t: any) => t.status === 'COMPLETED').length,
      pendingTrips: tripsData.filter((t: any) => t.status === 'PENDING').length,
      totalFuelLiters,
      paidInvoices: invoicesData.filter((i: any) => i.status === 'paid').length,
      pendingInvoices: invoicesData.filter((i: any) => i.status !== 'paid').length,
    };

    setMetrics(calculatedMetrics);

    // Generate chart data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    const monthlyData = months.map((month, idx) => {
      const monthTrips = tripsData.filter((t: any) => {
        const d = new Date(t.created_at || t.startDate || t.date);
        return d.getFullYear() === currentYear && d.getMonth() === idx;
      });
      return {
        month,
        revenue: monthTrips.reduce((sum: number, t: any) => sum + (t.salesAmount || 0), 0),
        expenses: expensesData.filter((e: any) => new Date(e.created_at).getMonth() === idx).reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
        trips: monthTrips.length,
        fuel: fuelData.filter((f: any) => new Date(f.created_at).getMonth() === idx).reduce((sum: number, f: any) => sum + (f.liters || 0), 0),
      };
    });
    
    setChartData(monthlyData);
  }, []);

  useEffect(() => {
    loadMetrics();
    // Welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m your AI Fleet Analyst. I have full access to your database and can answer questions about trips, revenue, vehicles, drivers, expenses, and more. Try asking me anything!',
      timestamp: new Date()
    }]);
  }, [loadMetrics]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // AI Response Generator with database queries
  const generateAIResponse = async (userMessage: string): Promise<string> => {
    const lowerMsg = userMessage.toLowerCase();
    
    // Query patterns
    if (lowerMsg.includes('top') && lowerMsg.includes('client')) {
      const invoices = await queryDatabase({ table: 'invoices', orderBy: { column: 'total', ascending: false }, limit: 5 });
      return `Top clients by revenue:\n${invoices.map((i: any, idx: number) => `${idx + 1}. ${i.client_name || 'Unknown'}: ${formatCurrency(i.total || 0)}`).join('\n')}`;
    }
    
    if (lowerMsg.includes('recent') && lowerMsg.includes('trip')) {
      const trips = await queryDatabase({ table: 'trips', orderBy: { column: 'created_at', ascending: false }, limit: 5 });
      return `Recent trips:\n${trips.map((t: any, idx: number) => `${idx + 1}. ${t.origin} → ${t.destination} (${formatCurrency(t.salesAmount || 0)})`).join('\n')}`;
    }
    
    if (lowerMsg.includes('vehicle') && (lowerMsg.includes('maintenance') || lowerMsg.includes('repair'))) {
      const maintenance = await queryDatabase({ table: 'maintenance_requests', filters: [{ column: 'status', operator: 'neq', value: 'completed' }] });
      return `Vehicles in maintenance: ${maintenance.length}\n${maintenance.map((m: any) => `• Vehicle ID: ${m.vehicle_id} - Status: ${m.status}`).join('\n')}`;
    }
    
    // Vehicle financial analysis - profit per vehicle
    if (lowerMsg.includes('vehicle') && (lowerMsg.includes('profit') || lowerMsg.includes('income') || lowerMsg.includes('revenue') || lowerMsg.includes('earning'))) {
      try {
        // Query vehicle financial summary view
        const vehicleFinancials = await queryDatabase({ 
          table: 'vehicle_financial_summary', 
          orderBy: { column: 'net_profit', ascending: false } 
        });
        
        if (vehicleFinancials && vehicleFinancials.length > 0) {
          const topVehicles = vehicleFinancials.slice(0, 5);
          return `🏆 Top Performing Vehicles by Profit:\n\n${topVehicles.map((v: VehicleFinancialData, idx: number) => 
            `${idx + 1}. ${v.vehicle_name} (${v.plate_number})\n   💰 Profit: ${formatCurrency(v.net_profit)} | Margin: ${v.profit_margin_percent.toFixed(1)}%\n   📊 Income: ${formatCurrency(v.total_income)} | Costs: ${formatCurrency(v.total_costs)}\n   🚛 Trips: ${v.trip_count} | Fuel: ${v.total_fuel_liters.toFixed(0)}L`
          ).join('\n\n')}\n\n📈 Total Fleet Profit: ${formatCurrency(vehicleFinancials.reduce((sum: number, v: VehicleFinancialData) => sum + v.net_profit, 0))}`;
        } else {
          // Fallback to calculating from individual tables
          const vehicles = await queryDatabase({ table: 'fleet_vehicles', limit: 10 });
          const trips = await queryDatabase({ table: 'trips' });
          const services = await queryDatabase({ table: 'vehicle_service_records' });
          const fuel = await queryDatabase({ table: 'fuel_records' });
          
          const vehicleStats = vehicles.map((v: any) => {
            const vTrips = trips.filter((t: any) => t.vehicle_id === v.id);
            const vServices = services.filter((s: any) => s.vehicle_id === v.id);
            const vFuel = fuel.filter((f: any) => f.vehicle_id === v.id);
            
            const income = vTrips.reduce((sum: number, t: any) => sum + (t.salesAmount || t.revenue || t.price || 0), 0);
            const serviceCost = vServices.reduce((sum: number, s: any) => sum + (s.total_cost || 0), 0);
            const fuelCost = vFuel.reduce((sum: number, f: any) => sum + (f.cost || f.total_cost || 0), 0);
            const profit = income - serviceCost - fuelCost;
            
            return {
              name: v.name || v.plateNumber || 'Unknown',
              plate: v.plateNumber || v.plate_number,
              income,
              costs: serviceCost + fuelCost,
              profit,
              trips: vTrips.length,
              margin: income > 0 ? ((profit / income) * 100).toFixed(1) : '0'
            };
          }).sort((a: any, b: any) => b.profit - a.profit);
          
          return `📊 Vehicle Financial Performance:\n\n${vehicleStats.slice(0, 5).map((v: any, idx: number) => 
            `${idx + 1}. ${v.name} (${v.plate})\n   💰 Profit: ${formatCurrency(v.profit)} (${v.margin}% margin)\n   💵 Income: ${formatCurrency(v.income)} | Costs: ${formatCurrency(v.costs)}\n   🚛 Trips: ${v.trips}`
          ).join('\n\n')}`;
        }
      } catch (error) {
        return 'I can analyze vehicle profitability. Please ensure the vehicle financial data is properly synced.';
      }
    }
    
    // Vehicle expenses breakdown
    if (lowerMsg.includes('vehicle') && lowerMsg.includes('expense')) {
      try {
        const expenses = await queryDatabase({ table: 'vehicle_expenses', orderBy: { column: 'expense_date', ascending: false }, limit: 10 });
        const fuel = await queryDatabase({ table: 'fuel_records', orderBy: { column: 'fuel_date', ascending: false }, limit: 10 });
        const services = await queryDatabase({ table: 'vehicle_service_records', orderBy: { column: 'service_date', ascending: false }, limit: 10 });
        
        const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
        const totalFuel = fuel.reduce((sum: number, f: any) => sum + (f.cost || f.total_cost || 0), 0);
        const totalService = services.reduce((sum: number, s: any) => sum + (s.total_cost || 0), 0);
        
        return `🚗 Vehicle Expense Breakdown:\n\n` +
          `🔧 Services: ${formatCurrency(totalService)} (${services.length} records)\n` +
          `⛽ Fuel: ${formatCurrency(totalFuel)} (${fuel.length} records)\n` +
          `📋 Other: ${formatCurrency(totalExpenses)} (${expenses.length} records)\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `💰 Total: ${formatCurrency(totalService + totalFuel + totalExpenses)}\n\n` +
          `Recent expenses:\n${expenses.slice(0, 3).map((e: any) => 
            `• ${e.category}: ${formatCurrency(e.amount)} - ${e.description || 'N/A'}`
          ).join('\n')}`;
      } catch (error) {
        return 'Vehicle expense data is being synced. Try again shortly.';
      }
    }
    
    if (lowerMsg.includes('fuel') && lowerMsg.includes('consumption')) {
      const fuel = await queryDatabase({ table: 'fuel_records', orderBy: { column: 'created_at', ascending: false }, limit: 10 });
      const totalLiters = fuel.reduce((sum: number, f: any) => sum + (f.liters || 0), 0);
      const totalCost = fuel.reduce((sum: number, f: any) => sum + (f.cost || 0), 0);
      return `Recent fuel consumption:\nTotal: ${totalLiters.toFixed(0)} liters\nCost: ${formatCurrency(totalCost)}\nAverage: ${fuel.length > 0 ? formatCurrency(totalCost / fuel.length) : '0 TZS'} per record`;
    }
    
    if (lowerMsg.includes('revenue') || lowerMsg.includes('money') || lowerMsg.includes('income')) {
      if (!metrics) return 'Loading metrics...';
      return `Revenue Analysis:\n• Total Revenue: ${formatCurrency(metrics.totalRevenue)}\n• From ${metrics.totalTrips} trips\n• Average per trip: ${formatCurrency(metrics.totalRevenue / Math.max(metrics.totalTrips, 1))}\n• Net Profit: ${formatCurrency(metrics.netProfit)}\n• Outstanding: ${formatCurrency(metrics.outstandingInvoices)}`;
    }
    
    if (lowerMsg.includes('fleet') || lowerMsg.includes('vehicle')) {
      if (!metrics) return 'Loading metrics...';
      return `Fleet Status:\n• Total Vehicles: ${metrics.fleetSize}\n• In Use: ${metrics.inUseVehicles}\n• Available: ${metrics.availableVehicles}\n• In Maintenance: ${metrics.maintenanceVehicles}\n• Fleet Utilization: ${metrics.fleetSize > 0 ? ((metrics.inUseVehicles / metrics.fleetSize) * 100).toFixed(1) : 0}%`;
    }
    
    if (lowerMsg.includes('driver')) {
      if (!metrics) return 'Loading metrics...';
      const drivers = await queryDatabase({ table: 'drivers' });
      return `Driver Statistics:\n• Total Drivers: ${metrics.totalDrivers}\n• Active: ${metrics.activeDrivers}\n• Completed Trips: ${metrics.completedTrips}\n• Pending Trips: ${metrics.pendingTrips}`;
    }
    
    if (lowerMsg.includes('expense') && !lowerMsg.includes('vehicle')) {
      if (!metrics) return 'Loading metrics...';
      const expenses = await queryDatabase({ table: 'vehicle_expenses', orderBy: { column: 'created_at', ascending: false }, limit: 5 });
      return `Recent Expenses:\n${expenses.map((e: any) => `• ${e.category || 'General'}: ${formatCurrency(e.amount || 0)}`).join('\n')}\n\nTotal Expenses: ${formatCurrency(metrics.totalExpenses + metrics.fuelCosts)}`;
    }
    
    if (lowerMsg.includes('help') || lowerMsg.includes('what can you do')) {
      return `I can analyze your fleet data and answer questions about:\n• Revenue and financial performance\n• Fleet status and vehicle utilization\n• Driver statistics\n• Recent trips and top clients\n• Fuel consumption\n• Maintenance status\n• Expense breakdown\n\nJust ask me anything!`;
    }
    
    // Default intelligent response
    if (!metrics) return 'Let me analyze your data...';
    
    const profitMargin = metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(1) : '0';
    return `Based on your current data:\n• You have ${metrics.totalTrips} trips with ${metrics.fleetSize} vehicles\n• Revenue: ${formatCurrency(metrics.totalRevenue)} with ${profitMargin}% profit margin\n• ${metrics.completedTrips} trips completed, ${metrics.pendingTrips} pending\n• Outstanding invoices: ${formatCurrency(metrics.outstandingInvoices)}\n\nIs there something specific you'd like me to analyze?`;
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);
    
    try {
      const response = await generateAIResponse(input);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while querying the database. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const quickQuestions = [
    { icon: DollarSign, label: 'Revenue Analysis', question: 'Show me revenue analysis' },
    { icon: Truck, label: 'Fleet Status', question: 'What is my fleet status?' },
    { icon: Users, label: 'Driver Stats', question: 'Show driver statistics' },
    { icon: Package, label: 'Recent Trips', question: 'Show recent trips' },
    { icon: CreditCard, label: 'Top Clients', question: 'Who are my top clients?' },
    { icon: Fuel, label: 'Fuel Usage', question: 'Show fuel consumption' },
  ];

  const MetricCard = ({ title, value, subtitle, trend }: { title: string; value: string; subtitle?: string; trend?: 'up' | 'down' | 'neutral' }) => (
    <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <Badge variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'} className="absolute top-2 right-2">
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Fleet Analyst</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              Connected to Database • Real-time Analysis
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={loadMetrics}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Data
        </Button>
      </div>

      {/* Quick Stats Overview */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <MetricCard title="Total Trips" value={metrics.totalTrips.toString()} subtitle={`${metrics.completedTrips} done`} />
          <MetricCard title="Revenue" value={formatCurrency(metrics.totalRevenue)} trend={metrics.netProfit > 0 ? 'up' : 'down'} />
          <MetricCard title="Fleet" value={metrics.fleetSize.toString()} subtitle={`${metrics.inUseVehicles} in use`} />
          <MetricCard title="Drivers" value={metrics.activeDrivers.toString()} subtitle={`${metrics.totalDrivers} total`} />
          <MetricCard title="Expenses" value={formatCurrency(metrics.totalExpenses + metrics.fuelCosts)} />
          <MetricCard title="Outstanding" value={formatCurrency(metrics.outstandingInvoices)} />
          <MetricCard title="Fuel" value={`${metrics.totalFuelLiters.toFixed(0)} L`} />
          <MetricCard title="Maintenance" value={metrics.maintenanceCount.toString()} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Interface */}
        <Card className="lg:col-span-2 flex flex-col h-[600px]">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Ask AI About Your Data
            </CardTitle>
          </CardHeader>
          
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line">{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-500'}`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-slate-600">Querying database...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Questions */}
          <div className="px-4 py-2 border-t bg-slate-50">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickQuestions.map((q) => (
                <Button
                  key={q.label}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 gap-1 text-xs"
                  onClick={() => {
                    setInput(q.question);
                    setTimeout(() => handleSend(), 100);
                  }}
                >
                  <q.icon className="h-3 w-3" />
                  {q.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything about your fleet data..."
                className="flex-1"
                disabled={isThinking}
              />
              <Button 
                onClick={handleSend} 
                disabled={isThinking || !input.trim()}
                className="gap-2"
              >
                {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </div>
        </Card>

        {/* Visual Dashboard */}
        <div className="space-y-4">
          {/* Quick View Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Visual Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {['overview', 'revenue', 'fleet', 'fuel'].map((view) => (
                <Button
                  key={view}
                  variant={quickView === view ? 'default' : 'ghost'}
                  size="sm"
                  className="w-full justify-start capitalize"
                  onClick={() => setQuickView(view)}
                >
                  {view === 'overview' && <BarChart3 className="h-4 w-4 mr-2" />}
                  {view === 'revenue' && <DollarSign className="h-4 w-4 mr-2" />}
                  {view === 'fleet' && <Truck className="h-4 w-4 mr-2" />}
                  {view === 'fuel' && <Fuel className="h-4 w-4 mr-2" />}
                  {view}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Dynamic Chart Based on Quick View */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {quickView === 'overview' && 'Revenue vs Expenses'}
                  {quickView === 'revenue' && 'Monthly Revenue Trend'}
                  {quickView === 'fleet' && 'Fleet Utilization'}
                  {quickView === 'fuel' && 'Fuel Consumption'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {quickView === 'overview' ? (
                      <ComposedChart data={chartData}>
                        <XAxis dataKey="month" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Bar dataKey="revenue" fill="#0088FE" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" fill="#FF8042" radius={[4, 4, 0, 0]} />
                      </ComposedChart>
                    ) : quickView === 'revenue' ? (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#0088FE" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Area type="monotone" dataKey="revenue" stroke="#0088FE" fill="url(#colorRevenue)" />
                      </AreaChart>
                    ) : quickView === 'fleet' ? (
                      <BarChart data={[{ name: 'In Use', value: metrics?.inUseVehicles || 0 }, { name: 'Available', value: metrics?.availableVehicles || 0 }, { name: 'Maintenance', value: metrics?.maintenanceVehicles || 0 }]}>
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Bar dataKey="value" fill="#00C49F" />
                      </BarChart>
                    ) : (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFBB28" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#FFBB28" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip formatter={(v) => `${v} L`} />
                        <Area type="monotone" dataKey="fuel" stroke="#FFBB28" fill="url(#colorFuel)" />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Suggestions */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {metrics && metrics.outstandingInvoices > 0 && (
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{formatCurrency(metrics.outstandingInvoices)} in unpaid invoices needs attention.</span>
                </div>
              )}
              {metrics && metrics.netProfit < 0 && (
                <div className="flex items-start gap-2 text-red-700">
                  <TrendingDown className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Operating at a loss. Review expense categories.</span>
                </div>
              )}
              {metrics && metrics.fleetSize > 0 && (metrics.inUseVehicles / metrics.fleetSize) < 0.5 && (
                <div className="flex items-start gap-2 text-blue-700">
                  <Truck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Fleet utilization below 50%. Consider marketing to increase trips.</span>
                </div>
              )}
              {metrics && metrics.totalTrips > 0 && metrics.completedTrips / metrics.totalTrips > 0.8 && (
                <div className="flex items-start gap-2 text-green-700">
                  <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Great completion rate! {(metrics.completedTrips / metrics.totalTrips * 100).toFixed(0)}% of trips completed.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
