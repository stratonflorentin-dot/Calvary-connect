"use client";

import {
  StatCard,
  DataTable,
} from "@/components/dashboard/shared/dashboard-layout";
import { useFleetVehicles } from "@/hooks/data/use-fleet-vehicles";
import { useTrips } from "@/hooks/data/use-trips";
import { useExpenses } from "@/hooks/data/use-expenses";
import { useMonthlyReports } from "@/hooks/data/use-monthly-reports";
import { useUsers } from "@/hooks/data/use-users";
import { useRole } from "@/hooks/use-role";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Truck,
  Navigation,
  DollarSign,
  TrendingUp,
  Globe,
  Thermometer,
  Calculator,
  Send,
  Loader2,
  Terminal,
  Activity,
  Bot,
  BarChart2,
  RefreshCw,
  Wrench,
  Fuel,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Gauge,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useRef, useEffect } from "react";
import { getFleetContext, computeBusinessMetrics } from "@/lib/ai-database-context";
// AI generation is performed via server API at /api/ai/ask-company
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import { askCompanyAI } from '@/ai/flows/company-chat';
import { vehicleStatusBucket } from '@/lib/fleet/vehicle-status';

export default function AIAnalysisDashboard() {
  const { format } = useCurrency();

  // Data hooks
  const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
  const { trips, loading: tripsLoading } = useTrips();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { reports, loading: reportsLoading } = useMonthlyReports();
  const { loading: driversLoading } = useUsers({ role: "DRIVER" });

  const loading =
    vehiclesLoading ||
    tripsLoading ||
    expensesLoading ||
    reportsLoading ||
    driversLoading;

  // Calculate metrics
  const activeTrips = trips.filter((t) =>
    ["in_transit", "loading", "pending"].includes(t.status),
  );
  // Real terminal status is 'delivered' (no trip is ever 'completed'), and
  // revenue/price are dead legacy columns (always 0) — total_amount/
  // sales_amount are the real figures. Scoped to TZS trips for this single
  // blended number, same as every other single-number tile fixed this
  // session; businessMetrics below carries the full per-currency picture.
  const completedTrips = trips.filter((t) => t.status === "delivered");
  const totalRevenue = completedTrips
    .filter((t: any) => (t.currency || "TZS") === "TZS")
    .reduce((sum, t: any) => sum + (Number(t.total_amount ?? t.sales_amount) || 0), 0);
  const totalExpenses = expenses
    .filter((e: any) => (e.currency || "TZS") === "TZS")
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const inUseVehicles = vehicles.filter((v) => v.status === "in_use").length;
  const fleetUtilization =
    vehicles.length > 0 ? (inUseVehicles / vehicles.length) * 100 : 0;

  const crossBorderTrips = activeTrips.filter((trip) => {
    const dest = (trip.destination || "").toLowerCase();
    return (
      dest.includes("border") ||
      dest.includes("dr congo") ||
      dest.includes("kenya") ||
      dest.includes("zambia") ||
      dest.includes("burundi") ||
      dest.includes("rwanda") ||
      dest.includes("uganda")
    );
  }).length;

  const coldChainTrips = activeTrips.filter(
    (t) =>
      (t as any).has_reefer ||
      t.cargo_type === "REEFER" ||
      t.cargo_type === "cold_chain",
  ).length;

  const costPerTrip =
    completedTrips.length > 0 ? totalExpenses / completedTrips.length : 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const recentReports = reports.slice(0, 6);

  // Chat State
  const WELCOME_MESSAGE = { role: 'ai' as const, text: "Welcome to Calvary Command Center AI. I have fully indexed our fleet logs, active transit pipelines, and financial reports. Ask me to run operational audits, summarize profitability, or outline logistics strategies." };
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([WELCOME_MESSAGE]);
  const [inputVal, setInputVal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [dbContext, setDbContext] = useState<any | null>(null);
  const [businessMetrics, setBusinessMetrics] = useState<any | null>(null);
  // Forecast sliders
  const [monthlyTrips, setMonthlyTrips] = useState<number>(Number((businessMetrics?.deliveredTripsCount) || 38));
  const [avgRate, setAvgRate] = useState<number>(4800);
  const [costRatio, setCostRatio] = useState<number>(67);
  const [growthRate, setGrowthRate] = useState<number>(2);
  const [horizon, setHorizon] = useState<number>(3);
  const [forecastView, setForecastView] = useState<'revenue' | 'profit' | 'trips'>('revenue');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || aiLoading) return;

    const userMsg = inputVal.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputVal("");
    setAiLoading(true);

    try {
      const history = messages.slice(1).map((m) => ({
        role: m.role === "ai" ? "model" as const : "user" as const,
        text: m.text,
      }));

      const resp = await fetch('/api/ai/ask-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history,
          liveMetrics: {
            fleetSize: vehicles.length,
            activeTrips: activeTrips.length,
            revenue: format(totalRevenue),
            expenses: format(totalExpenses),
            profit: format(netProfit),
            utilization: `${fleetUtilization.toFixed(1)}%`,
            crossBorder: crossBorderTrips,
            coldChain: coldChainTrips,
          },
          dbContext,
        }),
      });

      const data = await resp.json();
      const answer = data?.text || data?.error || 'No response from AI.';

      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `Failed to compile analysis: ${err.message || 'Server timeout'}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleClearChat = () => {
    if (aiLoading) return;
    if (!window.confirm("Clear this conversation? This can't be undone.")) return;
    setMessages([WELCOME_MESSAGE]);
  };

  const handleChip = async (preset: string) => {
    if (aiLoading) return;
    const userMsg = preset;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiLoading(true);
    try {
      const history = messages.slice(1).map((m) => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.text }));
      const liveMetricsPayload = {
        fleetSize: vehicles.length,
        activeTrips: activeTrips.length,
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: netProfit,
        utilization: fleetUtilization,
      };
      const promptContext = `Scenario: trips=${monthlyTrips}, avgRate=${avgRate}, costRatio=${costRatio}, growth=${growthRate}, horizon=${horizon}`;
      const msg = `${userMsg}\n\n${promptContext}`;
      const answer = await askCompanyAI(msg, history, liveMetricsPayload, dbContext);
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `AI error: ${err.message || err}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const generateActionPlan = async () => {
    const issues = [];
    if ((businessMetrics?.expiringContracts || 0) > 0) issues.push('expiring contracts');
    if ((businessMetrics?.overdueMaintenanceCount || 0) > 0) issues.push('overdue maintenance');
    if ((businessMetrics?.activeTripsCount || 0) > 0 && (businessMetrics?.activeTripsCount || 0) > 50) issues.push('high active trips load');
    const userMsg = `Generate a prioritized action plan for: ${issues.join(', ') || 'general operations'}; include owners, deadlines (days), and estimated cost savings.`;
    await handleChip(userMsg);
  };

  const [predictiveMaintenanceResult, setPredictiveMaintenanceResult] = useState<any | null>(null);
  const [fuelPredictionResult, setFuelPredictionResult] = useState<any | null>(null);
  const [ceoInsightsResult, setCeoInsightsResult] = useState<any | null>(null);
  const [apiLoading, setApiLoading] = useState({
    predictiveMaintenance: false,
    fuelPrediction: false,
    ceoInsights: false,
  });

  // Picker state — these tools analyze a REAL vehicle/trip the user chooses,
  // not always vehicles[0]/trips[0] regardless of fleet composition.
  const [maintenanceVehicleId, setMaintenanceVehicleId] = useState<string>("");
  const [maintenanceDaysAhead, setMaintenanceDaysAhead] = useState<number>(30);
  const [fuelVehicleId, setFuelVehicleId] = useState<string>("");
  const [fuelTripId, setFuelTripId] = useState<string>("");
  const [fuelOrigin, setFuelOrigin] = useState<string>("");
  const [fuelDestination, setFuelDestination] = useState<string>("");
  const [fuelDistanceKm, setFuelDistanceKm] = useState<number>(0);
  const [fuelLoadTons, setFuelLoadTons] = useState<number>(8);
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<number>(3200);
  const [fuelTerrain, setFuelTerrain] = useState<'flat' | 'hilly' | 'mountainous' | 'mixed'>('mixed');

  useEffect(() => {
    if (!maintenanceVehicleId && vehicles.length > 0) setMaintenanceVehicleId(vehicles[0].id);
    if (!fuelVehicleId && vehicles.length > 0) setFuelVehicleId(vehicles[0].id);
  }, [vehicles, maintenanceVehicleId, fuelVehicleId]);

  const applyTripToFuelForm = (tripId: string) => {
    setFuelTripId(tripId);
    const trip = trips.find((t: any) => t.id === tripId) as any;
    if (!trip) return;
    setFuelOrigin(trip.origin || "");
    setFuelDestination(trip.destination || "");
    setFuelDistanceKm(Number(trip.distance_km || trip.estimated_distance || 0));
    if (trip.vehicle_id || trip.truck_id) setFuelVehicleId(trip.vehicle_id || trip.truck_id);
  };

  const buildPredictiveMaintenancePayload = () => {
    const vehicle = (vehicles.find((v: any) => v.id === maintenanceVehicleId) || {}) as any;
    const currentOdometerKm = Number(vehicle?.mileage || vehicle?.odometer_km || 0);
    const serviceInterval = Number(vehicle?.service_interval_km || 10000);
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const vehicleMaintenance = (dbContext?.maintenance || []).filter((m: any) => m.vehicle_id === maintenanceVehicleId);
    const recentMaintenanceCount = vehicleMaintenance.filter((m: any) => new Date(m.date || m.created_at).getTime() >= ninetyDaysAgo).length;
    const openIssuesCount = vehicleMaintenance.filter((m: any) => ['pending', 'open', 'in_progress'].includes(m.status)).length;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const vehicleTrips = trips.filter((t: any) => (t.vehicle_id === maintenanceVehicleId || t.truck_id === maintenanceVehicleId) && new Date(t.created_at).getTime() >= thirtyDaysAgo);
    const kmLast30Days = vehicleTrips.reduce((s: number, t: any) => s + (Number(t.distance_km || t.actual_distance || t.estimated_distance) || 0), 0);
    const averageDailyKm = kmLast30Days > 0 ? Math.round(kmLast30Days / 30) : 300;

    const healthScore = Number(vehicle?.health_score ?? 70);
    const currentCondition = healthScore >= 80 ? 'Good' : healthScore >= 50 ? 'Fair' : 'Poor';

    return {
      truckId: vehicle?.id || maintenanceVehicleId,
      truckName: vehicle?.plate_number || vehicle?.model || 'Fleet Truck',
      currentOdometerKm,
      lastServiceOdometerKm: Math.max(0, currentOdometerKm - serviceInterval),
      lastServiceDate: vehicle?.last_service_date || new Date(ninetyDaysAgo).toISOString().split('T')[0],
      fuelType: vehicle?.fuel_type || 'Diesel',
      recentMaintenanceCount,
      averageDailyKm,
      currentCondition,
      openIssuesCount,
      daysAhead: maintenanceDaysAhead,
    };
  };

  const fleetAvgFuelEfficiency = useMemo(() => {
    const totalLiters = (dbContext?.fuelLogs || []).reduce((s: number, f: any) => s + (Number(f.litres) || 0), 0);
    const totalKm = trips.reduce((s: number, t: any) => s + (Number(t.distance_km || t.actual_distance) || 0), 0);
    return totalLiters > 0 && totalKm > 0 ? totalKm / totalLiters : 3.5;
  }, [dbContext, trips]);

  const buildFuelPredictionPayload = () => {
    const vehicle = (vehicles.find((v: any) => v.id === fuelVehicleId) || {}) as any;
    return {
      tripId: fuelTripId || undefined,
      origin: fuelOrigin || 'Origin',
      destination: fuelDestination || 'Destination',
      distanceKm: Number(fuelDistanceKm) || 1,
      vehicleType: `${vehicle?.make || 'Heavy Truck'} ${vehicle?.model || ''}`.trim(),
      vehicleFuelType: vehicle?.fuel_type || 'Diesel',
      avgFuelEfficiencyKmPerLiter: Number(fleetAvgFuelEfficiency.toFixed(2)),
      loadWeightTons: Number(fuelLoadTons) || 0,
      driverBehaviourScore: 75,
      currentFuelPricePerLiter: Number(fuelPricePerLiter) || 1,
      terrainType: fuelTerrain,
      weatherCondition: 'clear' as const,
    };
  };

  const getCeoInsightsPayload = () => {
    const available = vehicles.filter((v) => vehicleStatusBucket(v.status) === 'available').length;
    const inUse = vehicles.filter((v) => vehicleStatusBucket(v.status) === 'in_use').length;
    const maintenance = vehicles.filter((v) => vehicleStatusBucket(v.status) === 'maintenance').length;

    // This flow's schema expects single numbers, so the TZS figure leads
    // here (same "primary currency" scoping used elsewhere) — businessMetrics
    // itself now carries the full per-currency breakdown for the general chat.
    const revenueThisMonthTzs = Number(businessMetrics?.revenueThisMonthByCurrency?.TZS || 0);
    const expensesThisMonthTzs = Number(businessMetrics?.expensesThisMonthByCurrency?.TZS || 0);

    return {
      activeTripsCount: activeTrips.length,
      fleetBreakdown: { available, inUse, maintenance },
      revenueThisMonth: revenueThisMonthTzs,
      expensesThisMonth: expensesThisMonthTzs,
      netProfit: revenueThisMonthTzs - expensesThisMonthTzs,
      fuelConsumptionLiters: Number(businessMetrics?.fuelLitersThisMonth || 0),
      pendingMaintenanceCount: Number(businessMetrics?.pendingMaintenanceCount || 0),
      lowStockCount: Number(businessMetrics?.lowStockCount || 0),
      onlineDriverCount: Number(businessMetrics?.onlineDriverCount || 0),
      completedDeliveriesThisMonth: Number(businessMetrics?.deliveredTripsThisMonthCount || 0),
    };
  };

  const callAiRoute = async (
    endpoint: string,
    payload: any,
    setResult: (value: any) => void,
    loadingKey: 'predictiveMaintenance' | 'fuelPrediction' | 'ceoInsights',
  ) => {
    setApiLoading((prev) => ({ ...prev, [loadingKey]: true }));
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'AI request failed');
      }
      setResult(data.result || data);
    } catch (error: any) {
      setResult({ error: error?.message || 'Request failed' });
    } finally {
      setApiLoading((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const runPredictiveMaintenance = async () => {
    const payload = buildPredictiveMaintenancePayload();
    await callAiRoute('/api/ai/predictive-maintenance', payload, setPredictiveMaintenanceResult, 'predictiveMaintenance');
  };

  const runFuelPrediction = async () => {
    const payload = buildFuelPredictionPayload();
    await callAiRoute('/api/ai/fuel-prediction', payload, setFuelPredictionResult, 'fuelPrediction');
  };

  const runCeoInsights = async () => {
    const payload = getCeoInsightsPayload();
    await callAiRoute('/api/ai/ceo-insights', payload, setCeoInsightsResult, 'ceoInsights');
  };

  // Load DB context and compute metrics on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ctx = await getFleetContext();
        if (!mounted) return;
        setDbContext(ctx);
        setBusinessMetrics(computeBusinessMetrics(ctx));
      } catch (err) {
        // ignore — non-fatal
      }
    })();
    return () => { mounted = false; };
  }, []);

  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    if (fleetUtilization < 50 && vehicles.length > 0) {
      insights.push(`Fleet utilization is suboptimal at ${fleetUtilization.toFixed(1)}%. Recommend consolidating route loads.`);
    }
    if (netProfit < 0) {
      insights.push(`Negative margins detected. Analyze cargo rates vs. driver allowances.`);
    }
    if (profitMargin > 20) {
      insights.push(`High yield corridor activity: profit margin is ${profitMargin.toFixed(1)}%. Consider scaling fleet allocation.`);
    }
    if (insights.length === 0) {
      insights.push("Operations are well-optimized. Fleet utilization and cost efficiency are trending normal.");
    }
    return insights;
  }, [fleetUtilization, vehicles.length, netProfit, profitMargin]);

  // Compute forecast series using sliders and a simple compound growth model
  const computeForecastSeries = () => {
    const months = horizon;
    const series: any[] = [];
    let baseTrips = monthlyTrips;
    const avg = avgRate;
    for (let i = 1; i <= months; i++) {
      const monthFactor = Math.pow(1 + growthRate / 100, i - 1);
      const trips = Math.round(baseTrips * monthFactor);
      const revenue = trips * avg;
      const cost = revenue * (costRatio / 100);
      const profit = revenue - cost;
      const confBase = 0.08 + 0.05 * (i - 1);
      series.push({
        month: `M${i}`,
        revenue,
        profit,
        trips,
        low: revenue * (1 - confBase),
        high: revenue * (1 + confBase),
      });
    }
    return series;
  };
  const forecastSeries = computeForecastSeries();

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin size-8 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Booting AI Operations Command...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary via-[#0089c2] to-[#002d5c] text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-10 -mb-4 w-24 h-24 bg-primary/20 rounded-full blur-xl"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white px-3 py-1 font-bold text-xs uppercase tracking-widest backdrop-blur-sm">
              Active Intelligence Mode
            </Badge>
            <div className="size-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Command Terminal
          </h2>
        </div>
        <div className="relative z-10">
          <Button
            variant="outline"
            className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm transition-all"
            onClick={() => setMessages([
              { role: 'ai', text: "Terminal reset. AI agent stands ready to analyze corporate data." }
            ])}
          >
            <RefreshCw className="mr-2 size-4" /> Clear Terminal
          </Button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <StatCard
          title="Total Fleet"
          value={vehicles.length}
          icon={Truck}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <StatCard
          title="Active Trips"
          value={activeTrips.length}
          icon={Navigation}
          color="text-emerald-600"
          bgColor="bg-emerald-100"
        />
        <StatCard
          title="Monthly Revenue"
          value={format(totalRevenue)}
          icon={DollarSign}
          color="text-emerald-600"
          bgColor="bg-emerald-100"
        />
        <StatCard
          title="Fleet Utilization"
          value={`${fleetUtilization.toFixed(1)}%`}
          icon={TrendingUp}
          color={fleetUtilization > 60 ? "text-emerald-600" : "text-amber-600"}
          bgColor={fleetUtilization > 60 ? "bg-emerald-100" : "bg-amber-100"}
        />
        <StatCard
          title="Cross-Border"
          value={crossBorderTrips}
          icon={Globe}
          color="text-indigo-600"
          bgColor="bg-indigo-100"
        />
        <StatCard
          title="Cold Chain"
          value={coldChainTrips}
          icon={Thermometer}
          color="text-cyan-600"
          bgColor="bg-cyan-100"
        />
        <StatCard
          title="Cost Per Trip"
          value={format(costPerTrip)}
          icon={Calculator}
          color="text-orange-600"
          bgColor="bg-orange-100"
        />
        <StatCard
          title="Net Profit"
          value={format(netProfit)}
          icon={DollarSign}
          color={netProfit >= 0 ? "text-emerald-600" : "text-red-600"}
          bgColor={netProfit >= 0 ? "bg-emerald-100" : "bg-red-100"}
        />
        <StatCard
          title="Fuel Spend"
          value={format(businessMetrics?.totalFuelCost || 0)}
          icon={Thermometer}
          color="text-rose-600"
          bgColor="bg-rose-100"
        />
        <StatCard
          title="Maintenance Cost"
          value={format(businessMetrics?.totalMaintenanceCost || 0)}
          icon={Activity}
          color="text-orange-600"
          bgColor="bg-orange-100"
        />
        <StatCard
          title="Active Contracts"
          value={businessMetrics?.activeContracts ?? 0}
          icon={Globe}
          color="text-indigo-600"
          bgColor="bg-indigo-100"
        />
        <StatCard
          title="Expiring Contracts"
          value={businessMetrics?.expiringContracts ?? 0}
          icon={Thermometer}
          color="text-amber-600"
          bgColor="bg-amber-100"
        />
      </div>

      {/* Main Console Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Metrics & Analytics */}
        <div className="lg:col-span-3 space-y-6">
          {/* AI Strategic Insights */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="size-5 text-primary animate-pulse" />
                Strategic Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {aiInsights.map((insight, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border hover:bg-muted/80 transition-all duration-300"
                  >
                    <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                      <Activity className="size-4" />
                    </div>
                    <p className="text-sm text-foreground leading-relaxed font-medium">{insight}</p>
                  </div>
                ))}

                {/* Forecast controls */}
                <div className="p-4 bg-muted/30 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Forecast Engine</h3>
                    <div className="flex items-center gap-2">
                      <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="text-xs px-2 py-1 rounded bg-background border-border">
                        <option value={3}>3 months</option>
                        <option value={6}>6 months</option>
                        <option value={12}>12 months</option>
                      </select>
                      <div className="text-xs text-muted-foreground">View:</div>
                      <select value={forecastView} onChange={(e) => setForecastView(e.target.value as any)} className="text-xs px-2 py-1 rounded bg-background border-border">
                        <option value="revenue">Revenue</option>
                        <option value="profit">Profit</option>
                        <option value="trips">Trips</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-xs">Monthly trips: <strong>{monthlyTrips}</strong></label>
                    <input type="range" min={1} max={200} value={monthlyTrips} onChange={(e) => setMonthlyTrips(Number(e.target.value))} />

                    <label className="text-xs">Average rate per trip (USD): <strong>{avgRate}</strong></label>
                    <input type="range" min={500} max={10000} step={100} value={avgRate} onChange={(e) => setAvgRate(Number(e.target.value))} />

                    <label className="text-xs">Cost ratio (% of revenue): <strong>{costRatio}%</strong></label>
                    <input type="range" min={10} max={100} value={costRatio} onChange={(e) => setCostRatio(Number(e.target.value))} />

                    <label className="text-xs">Monthly growth rate (%): <strong>{growthRate}%</strong></label>
                    <input type="range" min={-10} max={20} value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value))} />
                  </div>

                  <div className="mt-4 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecastSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(v: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)} />
                        <Area type="monotone" dataKey="low" stroke="transparent" fillOpacity={0.05} fill="#60a5fa" />
                        <Area type="monotone" dataKey="high" stroke="transparent" fillOpacity={0.08} fill="#60a5fa" />
                        {forecastView === 'revenue' && <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} />}
                        {forecastView === 'profit' && <Line type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} />}
                        {forecastView === 'trips' && <Line type="monotone" dataKey="trips" stroke="#f97316" strokeWidth={2} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Predictive Maintenance */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wrench className="size-5 text-slate-500" />
                Predictive Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Vehicle</Label>
                  <Select value={maintenanceVehicleId} onValueChange={setMaintenanceVehicleId}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.plate_number || v.model || v.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-28">
                  <Label className="text-xs">Days ahead</Label>
                  <Input type="number" min={7} max={180} value={maintenanceDaysAhead} onChange={(e) => setMaintenanceDaysAhead(Number(e.target.value) || 30)} />
                </div>
                <Button onClick={runPredictiveMaintenance} disabled={apiLoading.predictiveMaintenance || !maintenanceVehicleId}>
                  {apiLoading.predictiveMaintenance ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                  {apiLoading.predictiveMaintenance ? 'Analyzing…' : 'Run Prediction'}
                </Button>
              </div>

              {predictiveMaintenanceResult && (
                predictiveMaintenanceResult.error ? (
                  <p className="text-sm text-destructive">{predictiveMaintenanceResult.error}</p>
                ) : (
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Badge className={cn(
                        "font-bold uppercase tracking-wider",
                        predictiveMaintenanceResult.riskLevel === 'CRITICAL' ? "bg-red-100 text-red-700" :
                        predictiveMaintenanceResult.riskLevel === 'HIGH' ? "bg-orange-100 text-orange-700" :
                        predictiveMaintenanceResult.riskLevel === 'MEDIUM' ? "bg-amber-100 text-amber-700" :
                        "bg-emerald-100 text-emerald-700"
                      )}>
                        {predictiveMaintenanceResult.riskLevel} risk
                      </Badge>
                      <span className="text-xs text-muted-foreground">Recommended service: <strong className="text-foreground">{predictiveMaintenanceResult.recommendedServiceDate}</strong></span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Failure probability</span>
                        <span className="font-bold">{Math.round((predictiveMaintenanceResult.failureProbability || 0) * 100)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.round((predictiveMaintenanceResult.failureProbability || 0) * 100)}%` }} />
                      </div>
                    </div>
                    <p className="text-sm text-foreground">{predictiveMaintenanceResult.reasoning}</p>
                    {predictiveMaintenanceResult.predictedIssues?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Predicted issues</p>
                        <ul className="text-sm space-y-1">
                          {predictiveMaintenanceResult.predictedIssues.map((issue: string, i: number) => (
                            <li key={i} className="flex items-start gap-2"><AlertTriangle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {predictiveMaintenanceResult.preventiveActions?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Preventive actions</p>
                        <ul className="text-sm space-y-1">
                          {predictiveMaintenanceResult.preventiveActions.map((action: string, i: number) => (
                            <li key={i} className="flex items-start gap-2"><CheckCircle2 className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border">Estimated repair cost: <strong className="text-foreground">{format(predictiveMaintenanceResult.estimatedRepairCostUSD || 0)}</strong></p>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Fuel Consumption Prediction */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Fuel className="size-5 text-slate-500" />
                Fuel Consumption Prediction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Vehicle</Label>
                  <Select value={fuelVehicleId} onValueChange={setFuelVehicleId}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.plate_number || v.model || v.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prefill from a recent trip (optional)</Label>
                  <Select value={fuelTripId} onValueChange={applyTripToFuelForm}>
                    <SelectTrigger><SelectValue placeholder="Select trip" /></SelectTrigger>
                    <SelectContent>
                      {trips.slice(0, 30).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.origin} → {t.destination}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Origin</Label>
                  <Input value={fuelOrigin} onChange={(e) => setFuelOrigin(e.target.value)} placeholder="Dar es Salaam" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Destination</Label>
                  <Input value={fuelDestination} onChange={(e) => setFuelDestination(e.target.value)} placeholder="Mwanza" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Distance (km)</Label>
                  <Input type="number" value={fuelDistanceKm} onChange={(e) => setFuelDistanceKm(Number(e.target.value) || 0)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Load (tons)</Label>
                  <Input type="number" value={fuelLoadTons} onChange={(e) => setFuelLoadTons(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fuel price (TZS/L)</Label>
                  <Input type="number" value={fuelPricePerLiter} onChange={(e) => setFuelPricePerLiter(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Terrain</Label>
                  <Select value={fuelTerrain} onValueChange={(v) => setFuelTerrain(v as typeof fuelTerrain)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="hilly">Hilly</SelectItem>
                      <SelectItem value="mountainous">Mountainous</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={runFuelPrediction} disabled={apiLoading.fuelPrediction || !fuelVehicleId || !fuelOrigin || !fuelDestination || !fuelDistanceKm}>
                {apiLoading.fuelPrediction ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                {apiLoading.fuelPrediction ? 'Predicting…' : 'Predict Fuel Consumption'}
              </Button>

              {fuelPredictionResult && (
                fuelPredictionResult.error ? (
                  <p className="text-sm text-destructive">{fuelPredictionResult.error}</p>
                ) : (
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Badge className={cn(
                        "font-bold uppercase tracking-wider",
                        fuelPredictionResult.efficiencyRating === 'EXCELLENT' ? "bg-emerald-100 text-emerald-700" :
                        fuelPredictionResult.efficiencyRating === 'GOOD' ? "bg-sky-100 text-sky-700" :
                        fuelPredictionResult.efficiencyRating === 'AVERAGE' ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {fuelPredictionResult.efficiencyRating} efficiency
                      </Badge>
                      <Badge variant="outline" className="text-xs">{fuelPredictionResult.confidenceLevel} confidence</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold text-foreground">{Number(fuelPredictionResult.estimatedFuelLiters || 0).toFixed(1)} L</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Fuel needed</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">TZS {Number(fuelPredictionResult.estimatedFuelCost || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Est. cost</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{Number(fuelPredictionResult.carbonEmissionKg || 0).toFixed(0)} kg</p>
                        <p className="text-[10px] text-muted-foreground uppercase">CO₂</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{fuelPredictionResult.comparisonToFleetAverage}</p>
                    {fuelPredictionResult.optimisationTips?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Optimisation tips</p>
                        <ul className="text-sm space-y-1">
                          {fuelPredictionResult.optimisationTips.map((tip: string, i: number) => (
                            <li key={i} className="flex items-start gap-2"><Lightbulb className="size-3.5 text-amber-600 mt-0.5 shrink-0" />{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* CEO Insights */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Gauge className="size-5 text-slate-500" />
                Executive Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A snapshot analysis of this month's live fleet, revenue, and maintenance data.
              </p>
              <Button onClick={runCeoInsights} disabled={apiLoading.ceoInsights}>
                {apiLoading.ceoInsights ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                {apiLoading.ceoInsights ? 'Generating…' : 'Generate Insights'}
              </Button>

              {ceoInsightsResult && (
                ceoInsightsResult.error ? (
                  <p className="text-sm text-destructive">{ceoInsightsResult.error}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-bold uppercase text-emerald-700 mb-2 flex items-center gap-1"><TrendingUp className="size-3.5" /> Highlights</p>
                      <ul className="text-xs space-y-1.5 text-emerald-900">
                        {(ceoInsightsResult.keyHighlights || []).map((h: string, i: number) => <li key={i}>• {h}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-bold uppercase text-amber-700 mb-2 flex items-center gap-1"><AlertTriangle className="size-3.5" /> Concerns</p>
                      <ul className="text-xs space-y-1.5 text-amber-900">
                        {(ceoInsightsResult.areasOfConcern || []).map((c: string, i: number) => <li key={i}>• {c}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-xs font-bold uppercase text-sky-700 mb-2 flex items-center gap-1"><Lightbulb className="size-3.5" /> Recommendations</p>
                      <ul className="text-xs space-y-1.5 text-sky-900">
                        {(ceoInsightsResult.actionableRecommendations || []).map((r: string, i: number) => <li key={i}>• {r}</li>)}
                      </ul>
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calculator className="size-5 text-slate-500" />
                Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const fuel = businessMetrics?.totalFuelCost || 0;
                  const maintenance = businessMetrics?.totalMaintenanceCost || 0;
                  const driverPay = expenses.filter((e: any) => ['driver_pay', 'driver_allowance', 'driver_salary'].includes((e.category || '').toLowerCase())).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
                  const admin = expenses.filter((e: any) => ['admin', 'office', 'salaries', 'overhead'].includes((e.category || '').toLowerCase())).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
                  const total = Number(totalExpenses) || 0;
                  const known = fuel + maintenance + driverPay + admin;
                  const other = Math.max(0, total - known);
                  return (
                    <div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm">Fuel</div>
                        <div className="text-sm font-semibold">{format(fuel)}</div>

                        <div className="text-sm">Driver pay</div>
                        <div className="text-sm font-semibold">{format(driverPay)}</div>

                        <div className="text-sm">Maintenance</div>
                        <div className="text-sm font-semibold">{format(maintenance)}</div>

                        <div className="text-sm">Admin & Overhead</div>
                        <div className="text-sm font-semibold">{format(admin)}</div>

                        <div className="text-sm">Other</div>
                        <div className="text-sm font-semibold">{format(other)}</div>

                        <div className="text-sm">Total Expenses</div>
                        <div className="text-sm font-bold">{format(total)}</div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <Button size="sm" onClick={async () => {
                          if (aiLoading) return;
                          setAiLoading(true);
                          try {
                            const history = messages.slice(1).map((m) => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.text }));
                            const scenario = `Scenario: monthlyTrips=${monthlyTrips}, avgRate=${avgRate}, costRatio=${costRatio}, growth=${growthRate}`;
                            const prompt = `Analyze cost breakdown and propose the top 3 cost-reduction actions with estimated savings (short, <=120 words). Use metrics: ${JSON.stringify(businessMetrics || {})} and scenario: ${scenario}`;
                            const answer = await askCompanyAI(prompt, history, {
                              fleetSize: vehicles.length,
                              activeTrips: activeTrips.length,
                              revenue: totalRevenue,
                              expenses: totalExpenses,
                              profit: netProfit,
                              utilization: `${fleetUtilization.toFixed(1)}%`,
                            });
                            setMessages(prev => [...prev, { role: 'ai', text: answer }]);
                          } catch (err: any) {
                            setMessages(prev => [...prev, { role: 'ai', text: `AI error: ${err?.message || err}` }]);
                          } finally {
                            setAiLoading(false);
                          }
                        }}>Analyze cost reduction</Button>
                        <Button size="sm" variant="outline" onClick={() => setMessages(prev => [...prev, { role: 'user', text: 'Show cost breakdown' }])}>Copy to chat</Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Contract Health */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="size-5 text-slate-500" />
                Contract Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(dbContext?.contracts || []).filter((c: any) => c.end_date).slice(0, 6).map((c: any) => {
                  const days = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
                  const color = days <= 7 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                      <div className="flex flex-col">
                        <div className="font-semibold">{c.contract_number}</div>
                        <div className="text-xs text-muted-foreground">{c.customers?.company_name || 'Unknown'}</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${color}`}>{days}d</div>
                    </div>
                  );
                })}
                {!(dbContext?.contracts || []).length && <div className="text-xs text-muted-foreground">No contracts found.</div>}
              </div>
            </CardContent>
          </Card>

          {/* Data Tabs */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Terminal className="size-5 text-slate-500" />
                Database Roster Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="fleet" className="w-full">
                <TabsList className="bg-muted p-1 rounded-xl mb-4">
                  <TabsTrigger value="fleet" className="text-xs">Active Fleet</TabsTrigger>
                  <TabsTrigger value="contracts" className="text-xs">Contracts</TabsTrigger>
                  <TabsTrigger value="accounting" className="text-xs">Ledger Reports</TabsTrigger>
                </TabsList>
                <TabsContent value="fleet" className="mt-0">
                  <DataTable
                    columns={[
                      { key: "plate_number", label: "Plate" },
                      { key: "make", label: "Make" },
                      { key: "model", label: "Model" },
                      {
                        key: "status",
                        label: "Status",
                        render: (row) => (
                          <Badge
                            className={cn(
                              "font-bold uppercase tracking-wider text-[10px] px-2 py-0.5",
                              vehicleStatusBucket(row.status) === "available"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : vehicleStatusBucket(row.status) === "in_use"
                                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                            )}
                          >
                            {row.status}
                          </Badge>
                        ),
                      },
                    ]}
                    data={vehicles.slice(0, 5)}
                  />
                </TabsContent>
                <TabsContent value="contracts" className="mt-0">
                  <DataTable
                    columns={[
                      { key: "contract_number", label: "Contract #" },
                      { key: "customer", label: "Customer", render: (row) => row.customers?.company_name || "—" },
                      { key: "status", label: "Status" },
                      { key: "end_date", label: "Expires", render: (row) => row.end_date ? new Date(row.end_date).toLocaleDateString() : '-' }
                    ]}
                    data={(dbContext?.contracts || []).slice(0, 20)}
                  />
                </TabsContent>
                <TabsContent value="accounting" className="mt-0">
                  <DataTable
                    columns={[
                      {
                        key: "month",
                        label: "Period",
                        render: (row) =>
                          new Date(row.month).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          }),
                      },
                      {
                        key: "total_revenue",
                        label: "Revenue",
                        render: (row) => (
                          <span className="text-emerald-600 font-semibold">
                            {format(Number(row.total_revenue || 0))}
                          </span>
                        ),
                      },
                      {
                        key: "total_expenses",
                        label: "Expenses",
                        render: (row) => (
                          <span className="text-rose-600 font-semibold">
                            -{format(Number(row.total_expenses || 0))}
                          </span>
                        ),
                      },
                    ]}
                    data={recentReports}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Route Performance */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart2 className="size-5 text-slate-500" />
                Route Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(function () {
                    const byDest: Record<string, number> = {};
                    (dbContext?.trips || []).forEach((t: any) => {
                      const d = t.destination || 'Unknown';
                      const rev = Number(t.revenue || t.price || 0) || 0;
                      byDest[d] = (byDest[d] || 0) + rev;
                    });
                    return Object.entries(byDest).map(([destination, revenue]) => ({ destination, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="destination" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip formatter={(v: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)} />
                    <Bar dataKey="revenue" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Interactive AI Terminal Chat */}
        <div className="lg:col-span-2">
          <Card className="h-[580px] bg-card border-border shadow-md flex flex-col overflow-hidden rounded-2xl">
            <CardHeader className="border-b bg-muted/50 py-4 flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot className="size-5 text-primary" />
                <CardTitle className="text-sm font-semibold tracking-wide text-foreground uppercase">
                  Interactive AI Agent Console
                </CardTitle>
              </div>
              {messages.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={handleClearChat}
                  disabled={aiLoading}
                >
                  <Trash2 className="size-3.5" />
                  Clear
                </Button>
              )}
            </CardHeader>

            {/* Messages feed */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm">
              <AnimatePresence initial={false}>
                {messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "max-w-[90%] rounded-2xl p-4 leading-relaxed shadow-sm",
                      msg.role === 'user'
                        ? "ml-auto bg-primary text-primary-foreground rounded-tr-sm"
                        : "mr-auto bg-muted/80 text-foreground border border-border rounded-tl-sm"
                    )}
                  >
                    <span className={cn(
                      "font-bold block text-[10px] uppercase mb-1.5 tracking-wider",
                      msg.role === 'user' ? "text-primary-foreground/80" : "text-primary"
                    )}>
                      {msg.role === 'user' ? 'Board Member / CEO' : 'Calvary AI Analyst'}
                    </span>
                    <div className="whitespace-pre-line text-[13px]">{msg.text}</div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {aiLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mr-auto bg-muted/50 border border-border rounded-2xl p-4 flex items-center gap-3 text-muted-foreground"
                >
                  <Loader2 className="animate-spin size-4 text-primary" />
                  <span className="text-xs font-medium">Analyzing ledger metrics...</span>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Console */}
            <div className="p-3 border-t bg-muted/30">
              <div className="flex flex-wrap gap-2 mb-3">
                <Button size="sm" onClick={() => handleChip('Please provide a concise 3-month forecast and recommendation.')}>3-month forecast</Button>
                <Button size="sm" onClick={() => handleChip('List expiring contracts within 30 days and recommended next steps.')}>Expiring contracts</Button>
                <Button size="sm" onClick={() => handleChip('Run a maintenance risk audit: overdue services and recommended actions.')}>Maintenance audit</Button>
                <Button size="sm" onClick={() => handleChip('Provide a short cost reduction plan focusing on fuel and driver allowances.')}>Cost reduction</Button>
                <Button size="sm" onClick={() => handleChip('Prioritize routes by profitability and suggest reallocation.')}>Route prioritization</Button>
                <Button size="sm" variant="outline" onClick={generateActionPlan}>Generate action plan</Button>
              </div>
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Ask for cost analysis or business audit..."
                  className="flex-1 bg-background border-border text-foreground h-11 focus-visible:ring-primary rounded-xl"
                  disabled={aiLoading}
                />
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 w-11 shrink-0 p-0 rounded-xl transition-all shadow-md"
                  disabled={aiLoading}
                >
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export { AIAnalysisDashboard };
