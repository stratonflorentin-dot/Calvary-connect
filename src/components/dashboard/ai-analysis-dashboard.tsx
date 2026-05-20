"use client";

import {
  DashboardLayout,
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
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useRef, useEffect } from "react";
import { askCompanyAI } from "@/ai/flows/company-chat";
import { motion, AnimatePresence } from "framer-motion";

export default function AIAnalysisDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();

  // Data hooks
  const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
  const { trips, loading: tripsLoading } = useTrips();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { reports, loading: reportsLoading } = useMonthlyReports();
  const { users: drivers, loading: driversLoading } = useUsers({
    role: "DRIVER",
  });

  const loading =
    vehiclesLoading ||
    tripsLoading ||
    expensesLoading ||
    reportsLoading ||
    driversLoading;

  // Calculate metrics based on actual database data
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

  const availableVehicles = vehicles.filter(
    (v) => v.status === "available",
  ).length;
  const inUseVehicles = vehicles.filter((v) => v.status === "in_use").length;
  const maintenanceVehicles = vehicles.filter(
    (v) => v.status === "maintenance",
  ).length;
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

      // Call Genkit server action with real context
      const answer = await askCompanyAI(userMsg, history, {
        fleetSize: vehicles.length,
        activeTrips: activeTrips.length,
        revenue: format(totalRevenue),
        expenses: format(totalExpenses),
        profit: format(netProfit),
        utilization: `${fleetUtilization.toFixed(1)}%`,
        crossBorder: crossBorderTrips,
        coldChain: coldChainTrips,
      });

      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `Failed to compile analysis: ${err.message || 'Server timeout'}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  // AI Insights memo
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin size-10 text-blue-500 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Booting AI Operations Command...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* Dynamic Matrix-style Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />

      {/* Decorative Neon Flares */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <DashboardLayout
        title="AI Operations Dashboard"
        description="Autonomous operations auditing & predictive metrics"
        role={role || "CEO"}
        hideSidebar={false}
      >
        <div className="space-y-6 relative z-10 px-2">
          {/* Top Banner */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-md shadow-xl">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 px-3 py-1 font-bold text-xs uppercase tracking-widest">
                  Active Intelligence Mode
                </Badge>
                <div className="size-2 bg-green-500 rounded-full animate-ping" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                Command Terminal
              </h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-900"
                onClick={() => setMessages([
                  { role: 'ai', text: "Terminal reset. AI agent stands ready to analyze corporate data." }
                ])}
              >
                Clear Terminal
              </Button>
            </div>
          </div>

          {/* Glowing Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <StatCard
              title="Total Fleet"
              value={vehicles.length}
              icon={Truck}
              color="text-blue-400"
              bgColor="bg-blue-950/40 border border-blue-900/30"
            />
            <StatCard
              title="Active Trips"
              value={activeTrips.length}
              icon={Navigation}
              color="text-green-400"
              bgColor="bg-green-950/40 border border-green-900/30"
            />
            <StatCard
              title="Monthly Revenue"
              value={format(totalRevenue)}
              icon={DollarSign}
              color="text-emerald-400"
              bgColor="bg-emerald-950/40 border border-emerald-900/30"
            />
            <StatCard
              title="Fleet Utilization"
              value={`${fleetUtilization.toFixed(1)}%`}
              icon={TrendingUp}
              color={fleetUtilization > 60 ? "text-green-400" : "text-amber-400"}
              bgColor="bg-slate-900/40 border border-slate-800"
            />
            <StatCard
              title="Cross-Border"
              value={crossBorderTrips}
              icon={Globe}
              color="text-indigo-400"
              bgColor="bg-indigo-950/40 border border-indigo-900/30"
            />
            <StatCard
              title="Cold Chain"
              value={coldChainTrips}
              icon={Thermometer}
              color="text-cyan-400"
              bgColor="bg-cyan-950/40 border border-cyan-900/30"
            />
            <StatCard
              title="Cost Per Trip"
              value={format(costPerTrip)}
              icon={Calculator}
              color="text-orange-400"
              bgColor="bg-orange-950/40 border border-orange-900/30"
            />
            <StatCard
              title="Net Profit"
              value={format(netProfit)}
              icon={DollarSign}
              color={netProfit >= 0 ? "text-green-400" : "text-red-400"}
              bgColor="bg-slate-900/40 border border-slate-800"
            />
          </div>

          {/* Main Console Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column: Metrics & Analytics */}
            <div className="lg:col-span-3 space-y-6">
              {/* AI Strategic Insights */}
              <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur-md shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-md font-semibold text-slate-200 flex items-center gap-2">
                    <Sparkles className="size-5 text-blue-400 animate-pulse" />
                    Strategic Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aiInsights.map((insight, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/60 transition-all duration-300"
                      >
                        <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Activity className="size-4" />
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Data Tabs */}
              <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur-md shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-md font-semibold text-slate-200 flex items-center gap-2">
                    <Terminal className="size-5 text-purple-400" />
                    Database Roster Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="fleet" className="w-full">
                    <TabsList className="bg-slate-950 border border-slate-800/80 p-1 rounded-xl">
                      <TabsTrigger value="fleet" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white">Active Fleet</TabsTrigger>
                      <TabsTrigger value="accounting" className="text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white">Ledger Reports</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fleet" className="mt-4">
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
                                  "font-bold uppercase tracking-wider text-[9px] px-2 py-0.5 border",
                                  row.status === "available"
                                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                                    : row.status === "in_use"
                                      ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                      : "bg-red-500/10 border-red-500/20 text-red-400"
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
                    <TabsContent value="accounting" className="mt-4">
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
                              <span className="text-emerald-400 font-medium">
                                {format(Number(row.total_revenue || 0))}
                              </span>
                            ),
                          },
                          {
                            key: "total_expenses",
                            label: "Expenses",
                            render: (row) => (
                              <span className="text-rose-400 font-medium">
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

            {/* Right Column: Immersive AI Terminal Chat */}
            <div className="lg:col-span-2">
              <Card className="h-[580px] bg-slate-950/80 border-slate-800/80 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden rounded-2xl relative border">
                {/* Glowing boundary */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

                <CardHeader className="border-b border-slate-900 bg-slate-900/30 py-4 flex flex-row items-center gap-2">
                  <div className="size-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <CardTitle className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
                    Interactive AI Agent Console
                  </CardTitle>
                </CardHeader>

                {/* Messages feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "max-w-[85%] rounded-2xl p-3.5 leading-relaxed border",
                          msg.role === 'user'
                            ? "ml-auto bg-blue-900/20 border-blue-800/30 text-blue-200"
                            : "mr-auto bg-slate-900/60 border-slate-800/80 text-slate-300"
                        )}
                      >
                        <span className="font-bold block text-[10px] uppercase mb-1 tracking-wider text-slate-400">
                          {msg.role === 'user' ? 'Board Member / CEO' : 'Calvary AI Analyst'}
                        </span>
                        <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {aiLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mr-auto bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex items-center gap-2 text-slate-400 font-mono"
                    >
                      <Loader2 className="animate-spin size-4 text-blue-500" />
                      <span>Analyzing ledger metrics...</span>
                    </motion.div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Console */}
                <form onSubmit={handleSend} className="p-3 border-t border-slate-900 bg-slate-950 flex gap-2">
                  <Input
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="Ask for cost analysis or business audit..."
                    className="flex-1 bg-slate-900/60 border-slate-800 text-slate-200 text-xs font-mono h-10 focus-visible:ring-blue-500"
                    disabled={aiLoading}
                  />
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-10 w-10 shrink-0 p-0 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    disabled={aiLoading}
                  >
                    <Send className="size-4" />
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </div>
  );
}

export { AIAnalysisDashboard };
