"use client";

import { useState, useEffect } from "react";
import {
  Users, Shield, History, AlertTriangle, Settings, Database,
  UserPlus, Key, Plus, Trash2, Edit, Truck, Navigation,
  DollarSign, Package, Wrench, BarChart2, Globe, Zap,
  CheckCircle2, Clock, AlertCircle, TrendingUp, Route,
  Map, Activity, Lock, Server, ChevronRight, RefreshCw,
  Bell, Command, MessageSquare
} from "lucide-react";
import { StatCards } from "./stat-cards";
import { DashboardLayout, ActivityFeed, AlertPanel } from "./shared/dashboard-layout";
import { AIAnalysisDashboard } from "./ai-analysis-dashboard";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { useRole } from "@/hooks/use-role";
import { useFleetVehicles } from "@/hooks/data/use-fleet-vehicles";
import { useTrips } from "@/hooks/data/use-trips";
import { useInvoices } from "@/hooks/data/use-invoices";
import { useUsers } from "@/hooks/data/use-users";
import { AuditService } from "@/services/audit-service";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ─── Module Health Card ───────────────────────────────────────────────────────
function ModuleCard({
  icon: Icon, label, count, sub, status, href, color,
}: {
  icon: React.ElementType; label: string; count: string | number; sub: string;
  status: "healthy" | "warning" | "critical"; href: string; color: string;
}) {
  const statusStyle = { healthy: "bg-green-500", warning: "bg-amber-500 animate-pulse", critical: "bg-red-500 animate-pulse" };
  return (
    <Link href={href}>
      <div className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative overflow-hidden">
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${color}`} />
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${color} bg-opacity-10`}>
            <Icon className={`w-4.5 h-4.5 ${color.replace("bg-", "text-")}`} />
          </div>
          <span className={`w-2 h-2 rounded-full ${statusStyle[status]} mt-1`} title={status} />
        </div>
        <p className="text-2xl font-black text-slate-800">{count}</p>
        <p className="text-xs font-bold text-slate-600 mt-0.5">{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
        <ChevronRight className="absolute bottom-4 right-4 w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 transition-colors" />
      </div>
    </Link>
  );
}

// ─── Quick Action Button ─────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, href, variant = "default" }: {
  icon: React.ElementType; label: string; href: string; variant?: "default" | "primary" | "danger";
}) {
  const styles = {
    default: "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200",
    primary: "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-200/50 hover:from-sky-400 hover:to-indigo-500",
    danger: "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200",
  };
  return (
    <Link href={href}>
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all text-xs font-bold ${styles[variant]}`}>
        <Icon className="w-4 h-4" /> {label}
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { format } = useCurrency();
  const { vehicles, loading: vLoading } = useFleetVehicles();
  const { trips, loading: tLoading } = useTrips();
  const { users: allUsers, loading: uLoading } = useUsers();
  const { invoices, loading: iLoading } = useInvoices();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadData = async () => {
    try {
      setLoading(true);
      const logs = await AuditService.getLogs({ limit: 12 });
      setActivities(logs.map(log => ({
        id: log.id,
        title: log.change_summary || "System Update",
        description: `${log.user_name} · ${log.action} on ${log.table_name}`,
        time: new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        icon: log.action === "CREATE" ? UserPlus : log.action === "DELETE" ? Trash2 : Edit,
        color: log.action === "CREATE" ? "bg-emerald-500" : log.action === "DELETE" ? "bg-red-500" : "bg-blue-500",
      })));

      const overdueInvoices = invoices.filter(i =>
        String(i.status).toLowerCase() !== "paid" && new Date(i.due_date) < new Date()
      );
      const { data: criticalMaint } = await supabase
        .from("maintenance_requests")
        .select("id, vehicle_id, description")
        .eq("priority", "critical")
        .neq("status", "completed")
        .limit(3);

      setAlerts([
        ...overdueInvoices.slice(0, 2).map(i => ({
          id: i.id, title: "Overdue Invoice",
          description: `Invoice ${i.invoice_number} — follow up with ${i.customer_name}.`,
          severity: "critical" as const, time: "Finance",
        })),
        ...(criticalMaint || []).map((m: any) => ({
          id: m.id, title: "Critical Maintenance",
          description: `Vehicle ${m.vehicle_id}: ${m.description}`,
          severity: "warning" as const, time: "Fleet",
        })),
      ]);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Admin dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [invoices]);

  // Derived metrics
  const activeTrips = trips.filter(t => ["in_transit", "loading"].includes(t.status));
  const availableVehicles = vehicles.filter(v => v.status === "available").length;
  const inUseVehicles = vehicles.filter(v => v.status === "in_use").length;
  const pendingInvoices = invoices.filter(i => ["pending", "draft"].includes((i.status || "").toLowerCase()));

  const MODULES = [
    { icon: Truck, label: "Fleet Vehicles", count: vehicles.length, sub: `${availableVehicles} available · ${inUseVehicles} in use`, status: availableVehicles > 0 ? "healthy" : "warning", href: "/fleet", color: "bg-sky-500" },
    { icon: Navigation, label: "Active Trips", count: activeTrips.length, sub: `${trips.filter(t => t.status === "completed").length} completed all-time`, status: activeTrips.length > 0 ? "healthy" : "healthy", href: "/trips", color: "bg-indigo-500" },
    { icon: Users, label: "System Users", count: allUsers.length, sub: `${allUsers.filter(u => u.role === "DRIVER").length} drivers registered`, status: "healthy", href: "/users", color: "bg-violet-500" },
    { icon: DollarSign, label: "Pending Invoices", count: pendingInvoices.length, sub: `${invoices.filter(i => i.status === "paid").length} paid invoices`, status: pendingInvoices.length > 5 ? "warning" : "healthy", href: "/finance", color: "bg-amber-500" },
    { icon: Wrench, label: "Maintenance", count: "—", sub: "View open service requests", status: "healthy", href: "/maintenance", color: "bg-rose-500" },
    { icon: Package, label: "Inventory", count: "—", sub: "Parts & stock management", status: "healthy", href: "/inventory", color: "bg-emerald-500" },
    { icon: BarChart2, label: "Reports", count: "—", sub: "Monthly financial reports", status: "healthy", href: "/reports", color: "bg-teal-500" },
    { icon: Map, label: "Live Map", count: `${inUseVehicles}`, sub: "Vehicles currently on road", status: inUseVehicles > 0 ? "healthy" : "healthy", href: "/map", color: "bg-cyan-500" },
  ] as const;

  const ROLE_COUNTS = ["ADMIN", "CEO", "ACCOUNTANT", "OPERATOR", "DRIVER", "MECHANIC"].map(r => ({
    role: r,
    count: allUsers.filter(u => u.role === r).length,
  }));

  return (
    <DashboardLayout title="Admin Command Center" description="System-wide operations oversight" role="ADMIN">
      <div className="space-y-6">
        {/* Alert strip */}
        <AlertPanel alerts={alerts} />

        {/* ── Top command bar ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl px-6 py-5 shadow-xl shadow-slate-900/20">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Command className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-tight">System Command Center</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Last refreshed: {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <QuickAction icon={Route} label="Dispatch Board" href="/dispatch" variant="primary" />
            <QuickAction icon={Map} label="Live Map" href="/map" />
            <QuickAction icon={UserPlus} label="Add User" href="/users" />
            <button onClick={loadData} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <StatCards />

        {/* ── Module Health Grid ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Module Overview
            </h3>
            <div className="flex items-center gap-3 text-[10px]">
              {[["healthy", "bg-green-500", "Healthy"], ["warning", "bg-amber-500", "Needs attention"], ["critical", "bg-red-500", "Critical"]].map(([k, c, l]) => (
                <span key={k} className="flex items-center gap-1 text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${c}`} />{l}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MODULES.map((m) => (
              <ModuleCard key={m.label} {...m} status={m.status as any} color={m.color} />
            ))}
          </div>
        </div>

        {/* ── Main content row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Users & RBAC */}
          <div className="lg:col-span-2 space-y-5">
            {/* User roles */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" /> User Roles & Access Control
                </h3>
                <Link href="/users" className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {ROLE_COUNTS.map(({ role, count }) => (
                  <div key={role} className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
                    <p className="text-xl font-black text-slate-700">{count}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{role}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* System health */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-500" /> System Health
              </h3>
              <div className="space-y-3">
                {[
                  { icon: CheckCircle2, label: "Audit Trail", sub: "Full change log active", status: "Optimal", color: "green" },
                  { icon: Lock, label: "RBAC Policies", sub: "All role permissions enforced", status: "Secure", color: "blue" },
                  { icon: Database, label: "Database Sync", sub: "Supabase real-time connected", status: "Live", color: "emerald" },
                  { icon: Globe, label: "API Services", sub: "All endpoints responding", status: "Online", color: "sky" },
                ].map(({ icon: Icon, label, sub, status, color }) => (
                  <div key={label} className={`flex items-center justify-between p-3 rounded-xl bg-${color}-50/50 border border-${color}-100/50 hover:bg-${color}-50 transition-colors`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${color}-50 rounded-lg`}>
                        <Icon className={`w-4 h-4 text-${color}-600`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{label}</p>
                        <p className="text-xs text-slate-400">{sub}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full bg-${color}-100 text-${color}-700 uppercase`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Activity + Quick actions */}
          <div className="space-y-5">
            {/* Audit activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" /> Live Audit Trail
                {loading && <RefreshCw className="w-3 h-3 text-slate-300 animate-spin ml-auto" />}
              </h3>
              <ActivityFeed activities={activities} />
            </div>

            {/* Dark quick action panel */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 shadow-xl text-white">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Quick Actions
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">Jump to key operations</p>
              <div className="space-y-2">
                {[
                  { href: "/dispatch", label: "Open Dispatch Board", icon: Navigation },
                  { href: "/chat", label: "Internal Chat", icon: MessageSquare },
                  { href: "/route-optimizer", label: "Plan a Route", icon: Route },
                  { href: "/track", label: "Customer Tracking", icon: Globe },
                  { href: "/audit", label: "Full Audit Log", icon: History },
                ].map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href}>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors group">
                      <Icon className="w-4 h-4 text-slate-400 group-hover:text-sky-400 transition-colors" />
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 ml-auto transition-all group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights section */}
        <div>
          <AIAnalysisDashboard />
        </div>
      </div>
    </DashboardLayout>
  );
}
