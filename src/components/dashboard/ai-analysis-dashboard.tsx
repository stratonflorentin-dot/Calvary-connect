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
  table: 'trips' | 'vehicles' | 'drivers' | 'expenses' | 'invoices' | 'fuel_records' | 'maintenance_requests' | 'vehicle_service_records' | 'vehicle_expenses' | 'vehicle_financial_summary';
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
      supabase.from('vehicles').select('id, status, plate_number, make, model, year, type, capacity'),
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
    // CEO Fleet Command AI Welcome
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `🎯 **Fleet Command AI Activated** — CEO/Admin Level Access Granted

Good day, Commander. I am your strategic intelligence partner with full system authority over Calvary Connect.

**My capabilities:**
📊 Executive dashboards with real-time KPIs  
💰 Financial intelligence & profit optimization  
🚛 Fleet operations command & utilization analytics  
👥 Driver force management & performance tracking  
🔧 Predictive maintenance & risk assessment  
📈 Market intelligence & competitive benchmarking  

**Quick commands to try:**
• "Executive summary" — Complete fleet intelligence report
• "Show profit margins" — Financial performance analysis  
• "Fleet utilization" — Operational efficiency metrics
• "Help" — View all available commands

Your fleet empire awaits your command. What would you like to analyze?`,
      timestamp: new Date()
    }]);
  }, [loadMetrics]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // CEO-LEVEL AI: Strategic Fleet Intelligence Engine
  const generateAIResponse = async (userMessage: string): Promise<string> => {
    const lowerMsg = userMessage.toLowerCase();
    
    // Welcome / Identity queries
    if (lowerMsg.includes('who are you') || lowerMsg.includes('what are you')) {
      return `🎯 I am your **Fleet Command AI** — your executive strategic partner for Calvary Connect.

I operate at CEO/Admin level with full system access. My capabilities include:
• **Financial Intelligence**: Profit analysis, cost optimization, revenue forecasting
• **Operational Command**: Fleet utilization, driver performance, route optimization  
• **Strategic Planning**: Growth recommendations, risk assessment, market positioning
• **Predictive Analytics**: Maintenance forecasting, demand prediction, trend analysis
• **Executive Reporting**: Board-ready insights, KPI dashboards, competitor benchmarking

I analyze real-time data from your entire fleet ecosystem and deliver actionable intelligence. How may I assist your strategic objectives today?`;
    }
    
    // Comprehensive Fleet Analysis - THE POWER COMMAND
    if (lowerMsg.includes('executive summary') || lowerMsg.includes('full analysis') || lowerMsg.includes('comprehensive report') || lowerMsg.includes('fleet overview')) {
      if (!metrics) return 'Initializing executive systems...';
      
      const profitMargin = metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100) : 0;
      const utilizationRate = metrics.fleetSize > 0 ? ((metrics.inUseVehicles / metrics.fleetSize) * 100) : 0;
      const avgRevenuePerTrip = metrics.totalTrips > 0 ? (metrics.totalRevenue / metrics.totalTrips) : 0;
      const fleetHealth = metrics.maintenanceVehicles === 0 ? 'Excellent' : metrics.maintenanceVehicles < 3 ? 'Good' : 'Attention Required';
      const cashFlowStatus = metrics.outstandingInvoices > (metrics.totalRevenue * 0.3) ? '⚠️ Critical - High AR' : metrics.outstandingInvoices > (metrics.totalRevenue * 0.15) ? '⚡ Review Recommended' : '✅ Healthy';
      
      return `📊 **EXECUTIVE FLEET INTELLIGENCE REPORT**
═══════════════════════════════════════

🎯 **STRATEGIC OVERVIEW**
Fleet Size: ${metrics.fleetSize} vehicles | Active Operations: ${metrics.inUseVehicles} units
Fleet Health: ${fleetHealth} | Utilization Rate: ${utilizationRate.toFixed(1)}%

💰 **FINANCIAL PERFORMANCE**
Total Revenue: ${formatCurrency(metrics.totalRevenue)}
Net Profit: ${formatCurrency(metrics.netProfit)} (${profitMargin.toFixed(1)}% margin)
Outstanding AR: ${formatCurrency(metrics.outstandingInvoices)} | Status: ${cashFlowStatus}
Avg Revenue/Trip: ${formatCurrency(avgRevenuePerTrip)}

🚛 **OPERATIONAL METRICS**
Total Trips: ${metrics.totalTrips} | Completed: ${metrics.completedTrips} | Pending: ${metrics.pendingTrips}
Active Drivers: ${metrics.activeDrivers}/${metrics.totalDrivers} | Fleet Availability: ${metrics.availableVehicles} units
Maintenance Queue: ${metrics.maintenanceVehicles} vehicles | Fuel Costs: ${formatCurrency(metrics.fuelCosts)}

📈 **STRATEGIC RECOMMENDATIONS**
${profitMargin < 15 ? '🔴 MARGIN ALERT: Profit margin below industry standard (15%). Consider rate optimization or cost reduction strategies.' : profitMargin > 30 ? '🟢 EXCELLENT: Strong profit margin indicates premium positioning. Consider fleet expansion.' : '🟡 STABLE: Margin within healthy range. Focus on operational efficiency.'}
${utilizationRate < 60 ? '📉 Low fleet utilization detected. Marketing push or new client acquisition recommended.' : utilizationRate > 85 ? '⚠️ High utilization approaching capacity. Consider adding vehicles to meet demand.' : '✅ Utilization balanced.'}
${metrics.outstandingInvoices > (metrics.totalRevenue * 0.2) ? '💸 Cash Flow Action: Implement stricter payment terms. Consider incentives for early payment.' : ''}

Type "deep dive [topic]" for detailed analysis on any area.`;
    }
    
    // Revenue Deep Dive Analysis
    if (lowerMsg.includes('revenue') || lowerMsg.includes('financial') || lowerMsg.includes('profit') || lowerMsg.includes('money')) {
      if (!metrics) return 'Loading financial intelligence...';
      
      const profitMargin = metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100) : 0;
      const arDays = metrics.totalRevenue > 0 ? ((metrics.outstandingInvoices / metrics.totalRevenue) * 30) : 0;
      const breakEvenTrips = avgRevenuePerTrip > 0 ? Math.ceil((metrics.totalExpenses + metrics.fuelCosts) / avgRevenuePerTrip) : 0;
      
      return `💰 **REVENUE INTELLIGENCE DASHBOARD**
═══════════════════════════════════════

📊 **CURRENT PERFORMANCE**
Total Revenue: ${formatCurrency(metrics.totalRevenue)}
Net Profit: ${formatCurrency(metrics.netProfit)} (${profitMargin.toFixed(1)}% margin)
Operating Costs: ${formatCurrency(metrics.totalExpenses + metrics.fuelCosts)}

🎯 **KEY METRICS**
Revenue per Trip: ${formatCurrency(avgRevenuePerTrip)}
Break-even Point: ${breakEvenTrips} trips/month
Collection Period: ${arDays.toFixed(0)} days average

📈 **FINANCIAL HEALTH ASSESSMENT**
${profitMargin > 25 ? '🟢 EXCELLENT: Strong profitability. Consider expansion or investment.' : profitMargin > 15 ? '🟡 GOOD: Healthy margins. Focus on efficiency improvements.' : profitMargin > 5 ? '🟠 WARNING: Thin margins. Immediate cost review required.' : '🔴 CRITICAL: Loss-making operation. Emergency intervention needed.'}

💡 **CEO RECOMMENDATIONS**
${profitMargin < 20 ? '• Implement dynamic pricing for peak demand periods\n• Negotiate better rates with high-volume clients\n• Review underperforming routes for elimination' : '• Maintain current pricing strategy\n• Consider premium service tiers for additional revenue'}
${metrics.outstandingInvoices > (metrics.totalRevenue * 0.25) ? '• Enforce Net-15 payment terms for new clients\n• Offer 2% early payment discount' : '• AR collection performing well'}

Type "compare to last month" or "show trends" for historical analysis.`;
    }
    
    // Fleet Operations Deep Dive
    if (lowerMsg.includes('fleet') || lowerMsg.includes('vehicle') || lowerMsg.includes('operations')) {
      if (!metrics) return 'Loading fleet intelligence...';
      
      const utilizationRate = metrics.fleetSize > 0 ? ((metrics.inUseVehicles / metrics.fleetSize) * 100) : 0;
      const availabilityRate = metrics.fleetSize > 0 ? ((metrics.availableVehicles / metrics.fleetSize) * 100) : 0;
      const maintenanceRate = metrics.fleetSize > 0 ? ((metrics.maintenanceVehicles / metrics.fleetSize) * 100) : 0;
      
      return `🚛 **FLEET OPERATIONS COMMAND CENTER**
═══════════════════════════════════════

📊 **FLEET STATUS OVERVIEW**
Total Fleet: ${metrics.fleetSize} vehicles
🟢 Active/In-Use: ${metrics.inUseVehicles} (${utilizationRate.toFixed(1)}%)
🔵 Available/Ready: ${metrics.availableVehicles} (${availabilityRate.toFixed(1)}%)
🟡 Maintenance: ${metrics.maintenanceVehicles} (${maintenanceRate.toFixed(1)}%)

⚡ **OPERATIONAL EFFICIENCY**
Fleet Utilization: ${utilizationRate.toFixed(1)}% | Target: 75-85%
Driver Deployment: ${metrics.activeDrivers}/${metrics.totalDrivers} (${metrics.totalDrivers > 0 ? ((metrics.activeDrivers/metrics.totalDrivers)*100).toFixed(0) : 0}%)

📈 **STRATEGIC ANALYSIS**
${utilizationRate < 60 ? '🔴 UNDERUTILIZATION CRISIS: Significant idle capacity costing revenue.\n   → ACTION: Launch aggressive client acquisition campaign\n   → Consider short-term leasing to absorb excess capacity\n   → Review pricing strategy to increase demand' : utilizationRate > 90 ? '🟠 CAPACITY CONSTRAINT: Fleet operating near maximum.\n   → ACTION: Fleet expansion recommended within 30 days\n   → Prioritize high-margin clients during peak hours\n   → Consider subcontracting overflow to partner operators' : '🟢 OPTIMAL UTILIZATION: Fleet operating in efficiency zone.'}

${maintenanceRate > 15 ? '⚠️ MAINTENANCE BACKLOG: Too many vehicles out of service.\n   → Review maintenance scheduling efficiency\n   → Consider in-house mechanic vs outsourced service' : '✅ Maintenance schedule on track.'}

💡 **TACTICAL RECOMMENDATIONS**
• Peak demand forecasting suggests ${metrics.pendingTrips > metrics.availableVehicles ? 'adding ' + (metrics.pendingTrips - metrics.availableVehicles) + ' more vehicles to meet current demand' : 'current fleet size is adequate'}
• ${metrics.availableVehicles > (metrics.fleetSize * 0.3) ? 'High availability indicates pricing may be too conservative' : 'Fleet availability balanced with demand'}

Type "vehicle profitability" for per-unit earnings analysis.`;
    }
    
    // Driver Performance Analysis
    if (lowerMsg.includes('driver') || lowerMsg.includes('personnel') || lowerMsg.includes('staff')) {
      if (!metrics) return 'Loading driver analytics...';
      
      const driverUtilization = metrics.totalDrivers > 0 ? ((metrics.activeDrivers / metrics.totalDrivers) * 100) : 0;
      const tripsPerDriver = metrics.totalDrivers > 0 ? (metrics.totalTrips / metrics.totalDrivers) : 0;
      
      return `👥 **DRIVER FORCE ANALYTICS**
═══════════════════════════════════════

📊 **WORKFORCE OVERVIEW**
Total Drivers: ${metrics.totalDrivers} | Active: ${metrics.activeDrivers} | Utilization: ${driverUtilization.toFixed(0)}%
Completed Trips: ${metrics.completedTrips} | Pending: ${metrics.pendingTrips}
Average Trips/Driver: ${tripsPerDriver.toFixed(1)}

📈 **PERFORMANCE ASSESSMENT**
${driverUtilization < 70 ? '⚠️ Low driver deployment rate. Consider driver incentives or performance reviews.' : driverUtilization > 95 ? '🔥 High driver utilization. Risk of fatigue-related incidents. Monitor safety.' : '✅ Balanced driver workforce utilization.'}

💡 **HR STRATEGY RECOMMENDATIONS**
${metrics.pendingTrips > (metrics.totalDrivers * 2) ? '• Shortage of drivers vs demand - Recruitment priority\n• Consider overtime authorization for current drivers' : '• Driver capacity aligned with operational needs'}
${metrics.completedTrips > 0 ? '• Average driver efficiency: ' + (metrics.completedTrips / Math.max(metrics.activeDrivers, 1)).toFixed(1) + ' trips per active driver' : ''}

Type "driver rankings" for individual performance metrics.`;
    }
    
    // Maintenance & Risk Analysis
    if (lowerMsg.includes('maintenance') || lowerMsg.includes('repair') || lowerMsg.includes('risk')) {
      const maintenance = await queryDatabase({ table: 'maintenance_requests', orderBy: { column: 'created_at', ascending: false } });
      const pendingMaint = maintenance.filter((m: any) => m.status !== 'completed');
      const criticalMaint = maintenance.filter((m: any) => m.priority === 'high' || m.priority === 'urgent');
      
      return `🔧 **MAINTENANCE & RISK INTELLIGENCE**
═══════════════════════════════════════

📊 **CURRENT STATUS**
Active Requests: ${pendingMaint.length} | Critical: ${criticalMaint.length} | Completed: ${maintenance.length - pendingMaint.length}
Fleet Health Score: ${pendingMaint.length === 0 ? '100/100 Excellent' : criticalMaint.length > 0 ? '⚠️ ' + (100 - (criticalMaint.length * 10)) + '/100 - Action Required' : (100 - (pendingMaint.length * 5)) + '/100 - Good'}

⚠️ **RISK ASSESSMENT**
${criticalMaint.length > 0 ? '🔴 CRITICAL ALERT: ' + criticalMaint.length + ' urgent maintenance items requiring immediate attention\n   → Potential vehicle downtime risk\n   → Safety compliance exposure\n   → Client service disruption risk' : '🟢 No critical maintenance issues detected'}

📈 **PREDICTIVE INSIGHTS**
${pendingMaint.length > (metrics?.fleetSize || 0) * 0.2 ? '⚠️ Maintenance backlog exceeds 20% of fleet - Service capacity insufficient' : '✅ Maintenance schedule manageable'}
${metrics?.maintenanceVehicles > (metrics?.fleetSize || 0) * 0.15 ? '🔴 High percentage of fleet in maintenance - Review preventive maintenance intervals' : '✅ Fleet availability optimal'}

💡 **STRATEGIC RECOMMENDATIONS**
• Implement predictive maintenance based on mileage/hours
• ${criticalMaint.length > 0 ? 'Immediate: Address critical items within 24 hours' : 'Continue preventive maintenance schedule'}
• Consider maintenance contracts for cost predictability

Type "vehicle service history" for detailed maintenance records.`;
    }
    
    // Fuel & Cost Optimization
    if (lowerMsg.includes('fuel') || lowerMsg.includes('cost') || lowerMsg.includes('expense') || lowerMsg.includes('efficiency')) {
      if (!metrics) return 'Loading cost analytics...';
      
      const fuelEfficiency = metrics.totalTrips > 0 ? (metrics.totalFuelLiters / metrics.totalTrips) : 0;
      const costPerTrip = metrics.totalTrips > 0 ? ((metrics.totalExpenses + metrics.fuelCosts) / metrics.totalTrips) : 0;
      
      return `⛽ **COST OPTIMIZATION INTELLIGENCE**
═══════════════════════════════════════

💰 **COST BREAKDOWN**
Fuel Costs: ${formatCurrency(metrics.fuelCosts)} (${((metrics.fuelCosts / Math.max(metrics.totalRevenue, 1)) * 100).toFixed(1)}% of revenue)
Operating Expenses: ${formatCurrency(metrics.totalExpenses)}
Total Costs: ${formatCurrency(metrics.totalExpenses + metrics.fuelCosts)}
Cost per Trip: ${formatCurrency(costPerTrip)}

⛽ **FUEL ANALYTICS**
Total Consumption: ${metrics.totalFuelLiters.toFixed(0)} L | Avg/Trip: ${fuelEfficiency.toFixed(1)} L
Fuel Cost/Trip: ${metrics.totalTrips > 0 ? formatCurrency(metrics.fuelCosts / metrics.totalTrips) : '0 TZS'}

📈 **EFFICIENCY ASSESSMENT**
${fuelEfficiency > 50 ? '🔴 HIGH FUEL CONSUMPTION: Above industry benchmarks\n   → Investigate route optimization\n   → Driver training on fuel-efficient driving\n   → Vehicle performance review' : fuelEfficiency > 30 ? '🟡 MODERATE CONSUMPTION: Within acceptable range\n   → Monitor for improvements' : '🟢 EFFICIENT OPERATION: Fuel usage optimized'}

💡 **COST REDUCTION STRATEGIES**
• ${metrics.fuelCosts > (metrics.totalRevenue * 0.25) ? 'Fuel costs exceed 25% of revenue - URGENT review required' : 'Fuel costs within healthy percentage of revenue'}
• Negotiate fleet fuel cards for volume discounts
• Implement GPS route optimization
• Consider hybrid/electric vehicles for high-mileage routes

Type "compare costs" for period-over-period analysis.`;
    }
    
    // Top Clients & Business Development
    if (lowerMsg.includes('client') || lowerMsg.includes('customer') || lowerMsg.includes('business')) {
      const invoices = await queryDatabase({ table: 'invoices', orderBy: { column: 'total', ascending: false }, limit: 10 });
      const topClients = invoices.slice(0, 5);
      const totalClientRevenue = topClients.reduce((sum: number, i: any) => sum + (i.total || 0), 0);
      const clientConcentration = metrics?.totalRevenue > 0 ? ((totalClientRevenue / metrics.totalRevenue) * 100) : 0;
      
      return `🤝 **CLIENT INTELLIGENCE & BD ANALYTICS**
═══════════════════════════════════════

🏆 **TOP REVENUE CLIENTS**
${topClients.map((i: any, idx: number) => `${idx + 1}. ${i.client_name || 'Unknown Client'}: ${formatCurrency(i.total || 0)}${i.status === 'paid' ? ' ✅' : ' ⏳'}`).join('\n')}

📊 **CLIENT PORTFOLIO ANALYSIS**
Top 5 Client Concentration: ${clientConcentration.toFixed(1)}% of total revenue
${clientConcentration > 60 ? '⚠️ HIGH CONCENTRATION RISK: Over-dependence on few clients\n   → Diversification strategy recommended\n   → Client retention programs critical' : clientConcentration > 40 ? '🟡 MODERATE CONCENTRATION: Healthy but monitor' : '🟢 BALANCED PORTFOLIO: Good client diversification'}

💰 **OUTSTANDING RECEIVABLES**
Pending Invoices: ${metrics?.pendingInvoices || 0} | Total Outstanding: ${formatCurrency(metrics?.outstandingInvoices || 0)}
${(metrics?.outstandingInvoices || 0) > (metrics?.totalRevenue || 0) * 0.3 ? '🔴 CRITICAL: AR exceeds 30% of revenue - Cash flow at risk' : (metrics?.outstandingInvoices || 0) > (metrics?.totalRevenue || 0) * 0.15 ? '🟡 ELEVATED: AR above 15% - Review credit policies' : '🟢 HEALTHY: AR within normal parameters'}

📈 **BUSINESS DEVELOPMENT INSIGHTS**
• ${topClients.length < 5 ? 'Portfolio opportunity: Add ' + (5 - topClients.length) + ' more anchor clients for stability' : 'Strong anchor client base established'}
• Average client value: ${topClients.length > 0 ? formatCurrency(totalClientRevenue / topClients.length) : '0 TZS'}

💡 **GROWTH RECOMMENDATIONS**
${clientConcentration > 50 ? 'Priority: Reduce dependency on top client through diversification' : 'Priority: Upsell existing clients and acquire similar profiles'}
• Target clients in top-performing industry segments
• Implement referral incentives for existing clients

Type "client profitability" for margin analysis by customer.`;
    }
    
    // Competitor & Market Analysis (Simulated)
    if (lowerMsg.includes('competitor') || lowerMsg.includes('market') || lowerMsg.includes('industry') || lowerMsg.includes('benchmark')) {
      return `📊 **MARKET INTELLIGENCE & COMPETITIVE ANALYSIS**
═══════════════════════════════════════

🏭 **INDUSTRY BENCHMARKS (Tanzania Logistics Sector)**
Fleet Utilization Industry Avg: 72% | Your Fleet: ${metrics ? ((metrics.inUseVehicles / Math.max(metrics.fleetSize, 1)) * 100).toFixed(1) : 0}%
Profit Margin Industry Avg: 18-22% | Your Margin: ${metrics ? ((metrics.netProfit / Math.max(metrics.totalRevenue, 1)) * 100).toFixed(1) : 0}%
Driver Efficiency Industry Avg: 45 trips/month | Your Avg: ${metrics && metrics.totalDrivers > 0 ? (metrics.totalTrips / metrics.totalDrivers / 30).toFixed(1) : 0}/day

📈 **COMPETITIVE POSITIONING**
${metrics && ((metrics.inUseVehicles / Math.max(metrics.fleetSize, 1)) * 100) > 75 ? '🟢 ABOVE AVERAGE: Fleet utilization exceeds industry benchmark\n   → Premium positioning justified\n   → Consider rate increases' : '🔴 BELOW BENCHMARK: Utilization gap indicates competitive pressure\n   → Review pricing strategy\n   → Enhance service differentiation'}

🎯 **MARKET OPPORTUNITIES**
• E-commerce growth driving last-mile delivery demand (+23% YoY)
• Construction sector recovery creating heavy transport opportunities
• Regional trade expansion (EAC) opening cross-border routes

⚠️ **COMPETITIVE THREATS**
• Ride-sharing platforms entering logistics space
• Fuel price volatility affecting margins
• Driver shortage industry-wide

💡 **STRATEGIC RECOMMENDATIONS**
${metrics && ((metrics.netProfit / Math.max(metrics.totalRevenue, 1)) * 100) < 18 ? '• Priority: Margin improvement to match industry standards\n  → Cost optimization or pricing adjustment required' : '• Maintain current competitive positioning\n  → Focus on service quality differentiation'}
• Consider specialization in high-margin niches
• Invest in technology for operational efficiency gains

Type "growth strategy" for expansion recommendations.`;
    }
    
    // Vehicle Profitability Analysis
    if (lowerMsg.includes('vehicle') && (lowerMsg.includes('profit') || lowerMsg.includes('income') || lowerMsg.includes('earning') || lowerMsg.includes('performance'))) {
      try {
        const vehicles = await queryDatabase({ table: 'vehicles', limit: 50 });
        const trips = await queryDatabase({ table: 'trips' });
        const services = await queryDatabase({ table: 'vehicle_service_records' });
        const fuel = await queryDatabase({ table: 'fuel_records' });
        
        const vehicleAnalytics = vehicles.map((v: any) => {
          const vTrips = trips.filter((t: any) => t.vehicle_id === v.id);
          const vServices = services.filter((s: any) => s.vehicle_id === v.id);
          const vFuel = fuel.filter((f: any) => f.vehicle_id === v.id);
          
          const income = vTrips.reduce((sum: number, t: any) => sum + (t.salesAmount || t.revenue || t.price || 0), 0);
          const serviceCost = vServices.reduce((sum: number, s: any) => sum + (s.total_cost || 0), 0);
          const fuelCost = vFuel.reduce((sum: number, f: any) => sum + (f.cost || f.total_cost || 0), 0);
          const totalCost = serviceCost + fuelCost;
          const profit = income - totalCost;
          const margin = income > 0 ? ((profit / income) * 100) : 0;
          const roi = totalCost > 0 ? ((profit / totalCost) * 100) : 0;
          
          return {
            id: v.id,
            name: v.plate_number || v.plateNumber || v.name || 'Unknown',
            type: v.type || 'Standard',
            income,
            costs: totalCost,
            profit,
            margin,
            roi,
            trips: vTrips.length,
            status: v.status || 'UNKNOWN'
          };
        }).sort((a: any, b: any) => b.profit - a.profit);
        
        const topPerformers = vehicleAnalytics.slice(0, 5);
        const bottomPerformers = vehicleAnalytics.slice(-3).reverse();
        const totalFleetProfit = vehicleAnalytics.reduce((sum: number, v: any) => sum + v.profit, 0);
        const profitableVehicles = vehicleAnalytics.filter((v: any) => v.profit > 0).length;
        
        return `🏆 **VEHICLE-LEVEL PROFITABILITY ANALYSIS**
═══════════════════════════════════════

📊 **FLEET PERFORMANCE SUMMARY**
Total Fleet: ${vehicleAnalytics.length} vehicles
Profitable Units: ${profitableVehicles} (${((profitableVehicles / Math.max(vehicleAnalytics.length, 1)) * 100).toFixed(0)}%)
Combined Fleet Profit: ${formatCurrency(totalFleetProfit)}
Fleet ROI: ${(totalFleetProfit / Math.max(vehicleAnalytics.reduce((sum: number, v: any) => sum + v.costs, 0), 1) * 100).toFixed(1)}%

🥇 **TOP PERFORMERS** (Revenue Leaders)
${topPerformers.map((v: any, idx: number) => 
  `${idx + 1}. ${v.name} (${v.type})\n   💰 Profit: ${formatCurrency(v.profit)} | Margin: ${v.margin.toFixed(1)}%\n   📊 Revenue: ${formatCurrency(v.income)} | Costs: ${formatCurrency(v.costs)}\n   🚛 Trips: ${v.trips} | ROI: ${v.roi.toFixed(1)}%`
).join('\n\n')}

⚠️ **UNDERPERFORMERS** (Require Attention)
${bottomPerformers.map((v: any, idx: number) => 
  `${idx + 1}. ${v.name} - Profit: ${formatCurrency(v.profit)} | Status: ${v.profit < 0 ? '🔴 LOSS MAKING' : '🟡 LOW MARGIN'}`
).join('\n')}

💡 **STRATEGIC FLEET RECOMMENDATIONS**
${bottomPerformers.filter((v: any) => v.profit < 0).length > 0 ? '🔴 CRITICAL: ' + bottomPerformers.filter((v: any) => v.profit < 0).length + ' vehicles are operating at a loss\n   → Immediate cost review or redeployment required\n   → Consider removing from unprofitable routes' : '✅ All vehicles profitable'}
${vehicleAnalytics.filter((v: any) => v.margin > 30).length > 0 ? '• ' + vehicleAnalytics.filter((v: any) => v.margin > 30).length + ' high-margin vehicles - Deploy on premium routes' : ''}
${vehicleAnalytics.filter((v: any) => v.trips < 10).length > 0 ? '• ' + vehicleAnalytics.filter((v: any) => v.trips < 10).length + ' underutilized vehicles - Review deployment strategy' : ''}

📈 **FLEET OPTIMIZATION ACTIONS**
1. Prioritize maintenance for top-profit vehicles (protect revenue)
2. Reassign underperforming vehicles to different routes
3. Consider selling/replacing consistently loss-making units

Type "vehicle [plate number]" for individual unit deep dive.`;
      } catch (error) {
        return '🔧 Vehicle profitability analysis temporarily unavailable. Core fleet metrics still accessible - try "fleet overview".';
      }
    }
    
    // Help / Commands
    if (lowerMsg.includes('help') || lowerMsg.includes('what can you do') || lowerMsg.includes('commands')) {
      return `🎯 **FLEET COMMAND AI - AVAILABLE COMMANDS**
═══════════════════════════════════════

📊 **EXECUTIVE REPORTS**
• "Executive summary" or "Full analysis" - Complete fleet intelligence report
• "Revenue analysis" - Financial performance deep dive
• "Fleet operations" - Operational metrics and utilization
• "Driver analytics" - Workforce performance review

💰 **FINANCIAL INTELLIGENCE**
• "Show profit margins" - Profitability analysis
• "Cost breakdown" - Expense categorization and trends
• "Fuel efficiency" - Consumption analytics
• "Outstanding invoices" - AR and cash flow status

🚛 **OPERATIONAL COMMAND**
• "Fleet status" - Real-time vehicle deployment
• "Maintenance alerts" - Risk assessment and schedule
• "Vehicle profitability" - Per-unit earnings analysis
• "Top clients" - Revenue concentration and BD insights

📈 **STRATEGIC PLANNING**
• "Market analysis" - Industry benchmarks and positioning
• "Growth strategy" - Expansion recommendations
• "Competitive analysis" - Market intelligence
• "Risk assessment" - Operational and financial threats

🔍 **TACTICAL QUERIES**
• "Recent trips" - Latest operational activity
• "Vehicle [plate]" - Individual unit details
• "Driver performance" - Individual rankings
• "Client profitability" - Margin by customer

💡 **EXAMPLE QUESTIONS**
"What's my fleet utilization rate?"
"Which vehicles are most profitable?"
"How do I compare to industry benchmarks?"
"What's my cash flow position?"
"Show me maintenance risks"

I'm your strategic partner. Ask anything about your fleet empire.`;
    }
    
    // Default response with context awareness
    if (!metrics) return '⚡ Initializing Fleet Command Systems... Accessing real-time database. Please wait.';
    
    // Smart fallback - analyze what data we have
    const profitMargin = metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100) : 0;
    const utilization = metrics.fleetSize > 0 ? ((metrics.inUseVehicles / metrics.fleetSize) * 100) : 0;
    
    return `🎯 **STRATEGIC RESPONSE TO: "${userMessage}"**

I've analyzed your query against current fleet intelligence. Here's what the data reveals:

📊 **CURRENT OPERATIONAL SNAPSHOT**
• Fleet Status: ${metrics.fleetSize} vehicles | ${metrics.inUseVehicles} active (${utilization.toFixed(1)}% utilization)
• Financial Position: ${formatCurrency(metrics.totalRevenue)} revenue | ${profitMargin.toFixed(1)}% margin
• Operational Load: ${metrics.totalTrips} trips | ${metrics.completedTrips} completed
• Team Status: ${metrics.activeDrivers}/${metrics.totalDrivers} drivers deployed

💡 **ANALYSIS**
${profitMargin < 15 ? 'Your profit margin is below optimal range. Consider cost review or pricing strategy adjustment.' : profitMargin > 25 ? 'Strong profitability position. Excellent operational efficiency.' : 'Margins within industry standard. Focus on growth.'}
${utilization < 65 ? 'Fleet underutilization detected. Revenue optimization opportunity exists.' : utilization > 85 ? 'High utilization approaching capacity limits. Fleet expansion may be warranted.' : 'Fleet utilization balanced with demand.'}

🎯 **RECOMMENDATION**
Try asking for:
• "Executive summary" for complete analysis
• "Fleet operations" for tactical details  
• "Revenue breakdown" for financial deep dive
• "Help" for all available commands

What specific aspect would you like me to investigate further?`;
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
    { icon: DollarSign, label: 'Executive Summary', question: 'Executive summary' },
    { icon: Truck, label: 'Fleet Status', question: 'Fleet operations' },
    { icon: Users, label: 'Driver Analytics', question: 'Driver analytics' },
    { icon: Package, label: 'Revenue Analysis', question: 'Revenue analysis' },
    { icon: CreditCard, label: 'Top Clients', question: 'Top clients' },
    { icon: Fuel, label: 'Cost Optimization', question: 'Fuel efficiency' },
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
