"use client";
// Calvary Fleet Stats v2.1 - East Africa Logistics

import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import {
  Truck,
  MapPin,
  DollarSign,
  Users,
  Package,
  Thermometer,
  AlertTriangle,
  TrendingUp,
  Anchor,
  Navigation,
  CheckCircle2,
  Clock,
  Container,
  AlertCircle,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function StatCards() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { format } = useCurrency();
  const { t } = useLanguage();

  const [stats, setStats] = useState({
    // Fleet
    totalVehicles: 0,
    activeVehicles: 0,
    vehicleUtilization: 0,
    maintenanceAlerts: 0,
    // Financial
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    netProfit: 0,
    outstandingPayments: 0,
    // Operations
    shipmentsInTransit: 0,
    warehouseUtilization: 0,
    onTimeDeliveryRate: 0,
    customsClearanceTime: 0,
    // Cash Flow
    bankBalance: 0,
    receivables: 0,
    payables: 0,
    daysOfCash: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const currentMonth = new Date().toISOString().slice(0, 7);

        // FLEET METRICS
        const { data: vehicles } = await supabase
          .from("vehicles")
          .select("id, status");
        const activeVehicles =
          vehicles?.filter(
            (v) => v.status === "available" || v.status === "in_use",
          ).length || 0;
        const totalVehicles = vehicles?.length || 0;

        const { data: activeTrips } = await supabase
          .from("trips")
          .select("id")
          .in("status", ["in_transit", "loading"]);
        const vehicleUtilization =
          totalVehicles > 0
            ? (((activeTrips?.length || 0) / totalVehicles) * 100).toFixed(1)
            : 0;

        const { data: maintenanceRequests } = await supabase
          .from("maintenance_requests")
          .select("id")
          .eq("status", "PENDING");

        // FINANCIAL METRICS
        const { data: invoices } = await supabase
          .from("invoices")
          .select("total_amount")
          .gte("created_at", `${currentMonth}-01T00:00:00Z`);
        const monthlyRevenue =
          invoices?.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0) || 0;

        const { data: expenses } = await supabase
          .from("expenses")
          .select("amount")
          .gte("created_at", `${currentMonth}-01T00:00:00Z`);
        const monthlyExpenses =
          expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
        const netProfit = monthlyRevenue - monthlyExpenses;

        const { data: invData } = await supabase
          .from("invoices")
          .select("total_amount")
          .eq("status", "pending");
        const outstandingPayments = invData?.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0) || 0;

        // OPERATIONS METRICS
        const { data: transitTrips } = await supabase
          .from("trips")
          .select("id, status")
          .in("status", ["LOADED", "IN_TRANSIT"]);
        const shipmentsInTransit = transitTrips?.length || 0;

        const { data: deliveredTrips } = await supabase
          .from("trips")
          .select("created_at")
          .eq("status", "DELIVERED")
          .gte("created_at", `${currentMonth}-01T00:00:00Z`);
        const onTimeDeliveryRate = 0; // Simplified for now since start_time/end_time columns might not exist or differ

        // WAREHOUSE METRICS
        const { data: warehouseItems } = await supabase
          .from("spare_parts")
          .select("id, quantity");
        const warehouseUtilization =
          warehouseItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

        // CASH FLOW METRICS
        const { data: bankData } = await supabase.from("bank_accounts").select("current_balance");
        const bankBalance = bankData?.reduce((sum, b) => sum + (b.current_balance || 0), 0) || 0;
        
        const receivables = outstandingPayments;
        const payables = monthlyExpenses;
        const dailyExpense = monthlyExpenses / 30;
        const daysOfCash =
          dailyExpense > 0 ? (bankBalance / dailyExpense).toFixed(1) : 0;

        setStats({
          totalVehicles,
          activeVehicles,
          vehicleUtilization: parseFloat(vehicleUtilization as string),
          maintenanceAlerts: maintenanceRequests?.length || 0,
          monthlyRevenue,
          monthlyExpenses,
          netProfit,
          outstandingPayments,
          shipmentsInTransit,
          warehouseUtilization,
          onTimeDeliveryRate: parseFloat(onTimeDeliveryRate as string),
          customsClearanceTime: 0,
          bankBalance,
          receivables,
          payables,
          daysOfCash: parseFloat(daysOfCash as string),
        });
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const getStatItems = () => {
    const baseStats = [
      {
        title: "Total Fleet",
        value: stats.totalVehicles,
        icon: Truck,
        color: "text-[#0369A1]",
        bgColor: "bg-sky-50",
        trend: "stable",
      },
      {
        title: "Active Vehicles",
        value: stats.activeVehicles,
        icon: CheckCircle2,
        color: "text-green-600",
        bgColor: "bg-green-50",
        trend: "stable",
      },
      {
        title: "Fleet Utilization",
        value: `${stats.vehicleUtilization}%`,
        icon: TrendingUp,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        trend: stats.vehicleUtilization > 70 ? "up" : "down",
      },
      {
        title: "Maintenance Alerts",
        value: stats.maintenanceAlerts,
        icon: AlertTriangle,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        trend: stats.maintenanceAlerts > 0 ? "alert" : "stable",
      },
    ];

    const financialStats = [
      {
        title: "Monthly Revenue",
        value: format(stats.monthlyRevenue),
        icon: DollarSign,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        trend: "up",
      },
      {
        title: "Operating Expenses",
        value: format(stats.monthlyExpenses),
        icon: TrendingUp,
        color: "text-red-600",
        bgColor: "bg-red-50",
        trend: "stable",
      },
      {
        title: "Net Profit",
        value: format(stats.netProfit),
        icon: TrendingUp,
        color: stats.netProfit > 0 ? "text-green-600" : "text-red-600",
        bgColor: stats.netProfit > 0 ? "bg-green-50" : "bg-red-50",
        trend: stats.netProfit > 0 ? "up" : "down",
      },
      {
        title: "Outstanding Payments",
        value: format(stats.outstandingPayments),
        icon: AlertCircle,
        color: "text-amber-600",
        bgColor: "bg-amber-50",
        trend: "stable",
      },
    ];

    const operationalStats = [
      {
        title: "Shipments In Transit",
        value: stats.shipmentsInTransit,
        icon: Package,
        color: "text-indigo-600",
        bgColor: "bg-indigo-50",
        trend: "stable",
      },
      {
        title: "On-Time Delivery",
        value: `${stats.onTimeDeliveryRate}%`,
        icon: Clock,
        color: "text-cyan-600",
        bgColor: "bg-cyan-50",
        trend: stats.onTimeDeliveryRate > 90 ? "up" : "down",
      },
      {
        title: "Warehouse Items",
        value: stats.warehouseUtilization,
        icon: Container,
        color: "text-pink-600",
        bgColor: "bg-pink-50",
        trend: "stable",
      },
    ];

    const cashFlowStats = [
      {
        title: "Days of Cash",
        value: `${stats.daysOfCash}d`,
        icon: Clock,
        color: "text-teal-600",
        bgColor: "bg-teal-50",
        trend: stats.daysOfCash > 30 ? "up" : "alert",
      },
      {
        title: "Receivables",
        value: format(stats.receivables),
        icon: MapPin,
        color: "text-slate-600",
        bgColor: "bg-slate-50",
        trend: "stable",
      },
    ];

    if (role === "CEO" || role === "ADMIN") {
      return [
        ...baseStats,
        ...financialStats,
        ...operationalStats,
        ...cashFlowStats,
      ];
    } else if (role === "ACCOUNTANT") {
      return [...financialStats, ...cashFlowStats];
    } else if (role === "OPERATOR") {
      return [...baseStats, ...operationalStats];
    } else if (role === "MECHANIC") {
      return [baseStats[0], baseStats[3], financialStats[1]];
    } else if (role === "WAREHOUSE_STAFF") {
      return [
        baseStats[0],
        baseStats[1],
        baseStats[2],
        baseStats[3],
        operationalStats[2],
        {
          title: "Items in Storage",
          value: stats.warehouseUtilization,
          icon: Container,
          color: "text-pink-600",
          bgColor: "bg-pink-50",
          trend: "stable",
        },
      ];
    }
    return baseStats;
  };

  const statItems = getStatItems();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {statItems.map((stat, index) => (
        <div
          key={index}
          className={cn(
            "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all text-slate-900 dark:text-slate-50 flex flex-col justify-between h-full min-h-[110px]",
            stat.trend === "alert" && "border-orange-200 dark:border-orange-900 bg-orange-50/30 dark:bg-orange-950/20",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className={cn("p-2 rounded-lg shrink-0", stat.bgColor, stat.bgColor.includes("bg-") && `dark:${stat.bgColor.replace("100", "950/40").replace("50", "950/20")}`)}>
              <stat.icon className={cn("size-4 sm:size-5", stat.color, stat.color.includes("text-") && `dark:${stat.color.replace("600", "400").replace("700", "400")}`)} />
            </div>
            {stat.trend && (
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {stat.trend === "up" && "↑"}
                {stat.trend === "down" && "↓"}
                {stat.trend === "alert" && "⚠"}
              </div>
            )}
          </div>
          <div className="mt-2">
            <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 truncate tracking-tight">
              {stat.value}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider truncate mt-0.5">
              {stat.title}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
