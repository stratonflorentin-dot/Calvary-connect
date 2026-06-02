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
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useRef, useEffect } from "react";
// AI generation is performed via server API at /api/ai/ask-company
import { motion, AnimatePresence } from "framer-motion";

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
  const completedTrips = trips.filter((t) => t.status === "completed");
  const totalRevenue = completedTrips.reduce(
    (sum, t) => sum + (Number(t.revenue || t.price) || 0),
    0,
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
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
      t.has_reefer ||
      t.cargo_type === "REEFER" ||
      t.cargo_type === "cold_chain",
  ).length;

  const costPerTrip =
    completedTrips.length > 0 ? totalExpenses / completedTrips.length : 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const recentReports = reports.slice(0, 6);

  // Chat State
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([
    { role: 'ai', text: "Welcome to Calvary Command Center AI. I have fully indexed our fleet logs, active transit pipelines, and financial reports. Ask me to run operational audits, summarize profitability, or outline logistics strategies." }
  ]);
  const [inputVal, setInputVal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-10 -mb-4 w-24 h-24 bg-blue-400/20 rounded-full blur-xl"></div>
        
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
      </div>

      {/* Main Console Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Metrics & Analytics */}
        <div className="lg:col-span-3 space-y-6">
          {/* AI Strategic Insights */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="size-5 text-indigo-500 animate-pulse" />
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
                    <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-600">
                      <Activity className="size-4" />
                    </div>
                    <p className="text-sm text-foreground leading-relaxed font-medium">{insight}</p>
                  </div>
                ))}
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
                              row.status === "available"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : row.status === "in_use"
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
        </div>

        {/* Right Column: Interactive AI Terminal Chat */}
        <div className="lg:col-span-2">
          <Card className="h-[580px] bg-card border-border shadow-md flex flex-col overflow-hidden rounded-2xl">
            <CardHeader className="border-b bg-muted/50 py-4 flex flex-row items-center gap-2">
              <Bot className="size-5 text-indigo-600" />
              <CardTitle className="text-sm font-semibold tracking-wide text-foreground uppercase">
                Interactive AI Agent Console
              </CardTitle>
            </CardHeader>

            {/* Messages feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
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
                      msg.role === 'user' ? "text-primary-foreground/80" : "text-indigo-600"
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
                  <Loader2 className="animate-spin size-4 text-indigo-600" />
                  <span className="text-xs font-medium">Analyzing ledger metrics...</span>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Console */}
            <form onSubmit={handleSend} className="p-3 border-t bg-muted/30 flex gap-2">
              <Input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Ask for cost analysis or business audit..."
                className="flex-1 bg-background border-border text-foreground h-11 focus-visible:ring-indigo-500 rounded-xl"
                disabled={aiLoading}
              />
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 w-11 shrink-0 p-0 rounded-xl transition-all shadow-md"
                disabled={aiLoading}
              >
                <Send className="size-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

export { AIAnalysisDashboard };
