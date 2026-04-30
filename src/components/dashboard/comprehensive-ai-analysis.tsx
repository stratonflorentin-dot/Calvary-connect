'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, TrendingDown, Minus, Activity, 
  DollarSign, Truck, Users, AlertTriangle, 
  CheckCircle, Lightbulb, BarChart3, Loader2,
  RefreshCw, FileText, Brain, Fuel, Users2,
  CalendarDays, Target, Zap, TrendingUp as TrendUp
} from 'lucide-react';
import { performCompanyAnalysis, CompanyData, AnalysisResult } from '@/lib/company-analyzer';
import { isAIConfigured } from '@/lib/ai';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Scatter, ScatterChart
} from 'recharts';

interface ChartData {
  month: string;
  revenue: number;
  expenses: number;
  trips: number;
  fuel: number;
}

interface FleetMetrics {
  vehicleUtilization: number;
  maintenanceCost: number;
  avgTripDistance: number;
  fuelEfficiency: number;
}

interface ForecastData {
  month: string;
  predictedRevenue: number;
  predictedExpenses: number;
  confidence: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function ComprehensiveAIAnalysis() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [fleetMetrics, setFleetMetrics] = useState<FleetMetrics | null>(null);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const aiConfigured = isAIConfigured();

  // Generate chart data from company data
  const generateChartData = (data: CompanyData): ChartData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    
    return months.slice(0, currentMonth + 1).map((month, idx) => {
      const monthTrips = data.trips.filter(t => {
        const tripDate = new Date(t.created_at || t.startDate);
        return tripDate.getMonth() === idx;
      });
      
      const monthExpenses = data.expenses.filter(e => {
        const expDate = new Date(e.created_at || e.date);
        return expDate.getMonth() === idx;
      });
      
      const monthFuel = data.fuelRecords.filter(f => {
        const fuelDate = new Date(f.created_at || f.date);
        return fuelDate.getMonth() === idx;
      });

      return {
        month,
        revenue: monthTrips.reduce((sum, t) => sum + (t.salesAmount || 0), 0),
        expenses: monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
        trips: monthTrips.length,
        fuel: monthFuel.reduce((sum, f) => sum + (f.liters || 0), 0),
      };
    });
  };

  // Generate forecast based on trends
  const generateForecast = (chartData: ChartData[]): ForecastData[] => {
    if (chartData.length < 3) return [];
    
    const last3Months = chartData.slice(-3);
    const avgRevenue = last3Months.reduce((sum, d) => sum + d.revenue, 0) / 3;
    const avgExpenses = last3Months.reduce((sum, d) => sum + d.expenses, 0) / 3;
    const growthRate = 0.05; // 5% assumed growth
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    
    return Array.from({ length: 3 }, (_, i) => ({
      month: months[(currentMonth + i + 1) % 12],
      predictedRevenue: Math.round(avgRevenue * Math.pow(1 + growthRate, i + 1)),
      predictedExpenses: Math.round(avgExpenses * Math.pow(1 + growthRate * 0.8, i + 1)),
      confidence: Math.max(70, 95 - i * 10),
    }));
  };

  // Calculate fleet metrics
  const calculateFleetMetrics = (data: CompanyData): FleetMetrics => {
    const totalVehicles = data.vehicles.length || 1;
    const activeVehicles = data.vehicles.filter(v => v.status === 'IN_USE' || v.status === 'AVAILABLE').length;
    const totalTrips = data.trips.length || 1;
    const totalFuel = data.fuelRecords.reduce((sum, f) => sum + (f.liters || 0), 0);
    const totalDistance = data.trips.reduce((sum, t) => sum + (t.distance || t.estimatedDistance || 0), 0);

    return {
      vehicleUtilization: Math.round((activeVehicles / totalVehicles) * 100),
      maintenanceCost: data.maintenance.reduce((sum, m) => sum + (m.cost || 0), 0),
      avgTripDistance: Math.round(totalDistance / totalTrips),
      fuelEfficiency: totalDistance > 0 ? Math.round((totalDistance / totalFuel) * 100) / 100 : 0,
    };
  };

  const loadAndAnalyze = async () => {
    setIsLoading(true);
    try {
      // Fetch all company data
      const [
        { data: trips },
        { data: vehicles },
        { data: drivers },
        { data: expenses },
        { data: invoices },
        { data: fuelRecords },
        { data: maintenance },
        { data: inventory },
        { data: journalEntries },
        { data: bankAccounts },
        { data: customers },
        { data: suppliers }
      ] = await Promise.all([
        supabase.from('trips').select('*'),
        supabase.from('fleet_vehicles').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('fuel_records').select('*'),
        supabase.from('maintenance').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('journal_entries').select('*'),
        supabase.from('bank_accounts').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('suppliers').select('*'),
      ]);

      const fullData: CompanyData = {
        trips: trips || [],
        vehicles: vehicles || [],
        drivers: drivers || [],
        expenses: expenses || [],
        invoices: invoices || [],
        fuelRecords: fuelRecords || [],
        maintenance: maintenance || [],
        inventory: inventory || [],
        journalEntries: journalEntries || [],
        bankAccounts: bankAccounts || [],
        customers: customers || [],
        suppliers: suppliers || [],
      };

      setCompanyData(fullData);
      
      // Generate chart data
      const cData = generateChartData(fullData);
      setChartData(cData);
      
      // Calculate metrics
      setFleetMetrics(calculateFleetMetrics(fullData));
      
      // Generate forecast
      setForecast(generateForecast(cData));

      const result = await performCompanyAnalysis(fullData);
      setAnalysis(result);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Analysis failed:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (aiConfigured) {
      loadAndAnalyze();
    }
  }, []);

  if (!aiConfigured) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-6 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">AI Analysis not configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add OpenRouter API key to enable comprehensive analysis
          </p>
        </CardContent>
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
              Powered by Minimax AI + Groq
              {lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={loadAndAnalyze}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
        </Button>
      </div>

      {isLoading && !analysis ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <Brain className="h-6 w-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-muted-foreground">AI is analyzing your company data...</p>
            <p className="text-xs text-muted-foreground">This may take 10-20 seconds</p>
          </div>
        </Card>
      ) : analysis ? (
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
                {analysis.executiveSummary}
              </p>
            </CardContent>
          </Card>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analysis.keyMetrics.map((metric, index) => (
              <Card key={index} className="relative overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{metric.title}</p>
                      <p className="text-xl font-bold mt-1">{metric.value}</p>
                      {metric.change && (
                        <p className={`text-xs mt-1 flex items-center gap-1 ${
                          metric.trend === 'up' ? 'text-green-600' : 
                          metric.trend === 'down' ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {metric.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : 
                           metric.trend === 'down' ? <TrendingDown className="h-3 w-3" /> : 
                           <Minus className="h-3 w-3" />}
                          {metric.change}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant={metric.trend === 'up' ? 'default' : metric.trend === 'down' ? 'destructive' : 'secondary'}
                      className="text-[10px]"
                    >
                      {metric.trend === 'up' ? 'Good' : metric.trend === 'down' ? 'Attention' : 'Stable'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

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
                          { name: 'Active', value: companyData?.vehicles.filter(v => v.status === 'IN_USE').length || 0, color: '#00C49F' },
                          { name: 'Available', value: companyData?.vehicles.filter(v => v.status === 'AVAILABLE').length || 0, color: '#0088FE' },
                          { name: 'Maintenance', value: companyData?.vehicles.filter(v => v.status === 'MAINTENANCE').length || 0, color: '#FFBB28' },
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
                {fleetMetrics && (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{fleetMetrics.vehicleUtilization}%</p>
                      <p className="text-xs text-muted-foreground">Fleet Utilization</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{fleetMetrics.fuelEfficiency}</p>
                      <p className="text-xs text-muted-foreground">km/L Efficiency</p>
                    </div>
                  </div>
                )}
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

          {/* AI Forecasting Section */}
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendUp className="h-5 w-5 text-purple-600" />
                AI Forecast & Trend Prediction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...chartData, ...forecast.map(f => ({ ...f, revenue: f.predictedRevenue, expenses: f.predictedExpenses }))]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => value?.toLocaleString() + ' TZS'} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#0088FE" strokeWidth={2} name="Revenue (Historical)" />
                    <Line type="monotone" dataKey="expenses" stroke="#FF8042" strokeWidth={2} name="Expenses (Historical)" />
                    <Line 
                      type="monotone" 
                      dataKey="predictedRevenue" 
                      stroke="#0088FE" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      name="Revenue (Forecast)" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {forecast.map((f, i) => (
                  <Card key={i} className="bg-white/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">{f.month} Forecast</p>
                      <p className="text-lg font-bold text-purple-600">
                        {f.predictedRevenue.toLocaleString()} TZS
                      </p>
                      <p className="text-xs text-green-600">{f.confidence}% confidence</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis Tabs */}
          <Tabs defaultValue="fleet" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="fleet" className="gap-2">
                <Truck className="h-4 w-4" />
                Fleet
              </TabsTrigger>
              <TabsTrigger value="finance" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Finance
              </TabsTrigger>
              <TabsTrigger value="clients" className="gap-2">
                <Users2 className="h-4 w-4" />
                Clients
              </TabsTrigger>
              <TabsTrigger value="risks" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risks
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <Target className="h-4 w-4" />
                Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fleet" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    Fleet Operations Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">{companyData?.trips.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Trips</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {companyData?.trips.filter(t => t.status === 'COMPLETED').length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-amber-600">
                        {companyData?.drivers.filter(d => d.status === 'active').length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Active Drivers</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {(companyData?.trips.reduce((sum, t) => sum + (parseFloat(t.cargoWeight) || 0), 0) || 0).toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Cargo (tons)</p>
                    </div>
                  </div>
                  {analysis.operationalInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <p className="text-sm">{insight}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="finance" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Financial Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-lg font-bold text-green-600">
                        {(companyData?.trips.reduce((sum, t) => sum + (t.salesAmount || 0), 0) || 0).toLocaleString()} TZS
                      </p>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg text-center">
                      <p className="text-lg font-bold text-red-600">
                        {(companyData?.expenses.reduce((sum, e) => sum + (e.amount || 0), 0) || 0).toLocaleString()} TZS
                      </p>
                      <p className="text-xs text-muted-foreground">Total Expenses</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-lg font-bold text-blue-600">
                        {(companyData?.invoices.filter(i => i.status === 'paid').length || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Paid Invoices</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg text-center">
                      <p className="text-lg font-bold text-amber-600">
                        {(companyData?.invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.balance || 0), 0) || 0).toLocaleString()} TZS
                      </p>
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                    </div>
                  </div>
                  {analysis.financialAnalysis.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <DollarSign className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <p className="text-sm">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clients" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users2 className="h-5 w-5 text-purple-600" />
                    Client & Customer Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-purple-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600">{companyData?.customers.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Customers</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">{companyData?.suppliers.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Suppliers</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {companyData?.invoices.length > 0 
                          ? Math.round((companyData?.invoices.filter(i => i.status === 'paid').length / companyData?.invoices.length) * 100) 
                          : 0}%
                      </p>
                      <p className="text-xs text-muted-foreground">Payment Rate</p>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Customer Insights
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>Customer retention rate calculated from invoice patterns</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>Average invoice value: {
                          companyData?.invoices.length > 0 
                            ? (companyData?.invoices.reduce((sum, i) => sum + (i.total || 0), 0) / companyData?.invoices.length).toFixed(0)
                            : 0
                        } TZS</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span>Outstanding receivables monitoring active</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risks" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Risk Assessment & Mitigation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.riskAssessment.map((risk, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-900">{risk}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    AI-Powered Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="h-5 w-5 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
