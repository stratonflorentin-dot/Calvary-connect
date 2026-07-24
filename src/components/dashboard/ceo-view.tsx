"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/hooks/use-currency";
import { StatCard, SectionCard, EmptyState, RefreshControl } from "@/components/shell";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  DollarSign,
  Flame,
  Navigation,
  Package,
  Receipt,
  Shield,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { REPORTING_CURRENCY, normalizeCurrency } from "@/lib/finance/multi-currency";
import { isOverdue } from "@/lib/workflow/approvals";
import { hydrateTrips } from "@/lib/trips/hydrate";

/**
 * Executive dashboard.
 *
 * A single scroll for the CEO / Admin: cash position, revenue trajectory,
 * fleet utilization, overdue receivables, active shipments, and the
 * approvals queue. Every number links through to its owning module.
 */
export function CeoView() {
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [b, i, e, t, m, v, f] = await Promise.all([
      supabase.from("bank_accounts").select("*"),
      supabase.from("invoices").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("trips").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("maintenance_records").select("*").in("status", ["requested", "scheduled", "in_progress"]),
      supabase.from("vehicles").select("*"),
      supabase.from("fuel_requests").select("*").eq("status", "pending"),
    ]);
    setBanks(b.data ?? []);
    setInvoices(i.data ?? []);
    setExpenses(e.data ?? []);
    setTrips(await hydrateTrips(t.data ?? []));
    setMaintenance(m.data ?? []);
    setVehicles(v.data ?? []);
    setFuel(f.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    // Reporting-currency-only totals to avoid mixing currencies
    const cash = banks
      .filter((a) => normalizeCurrency(a.currency) === REPORTING_CURRENCY)
      .reduce((s, a) => s + Number(a.current_balance || 0), 0);

    // Company also holds USD — surface it alongside TZS, never summed together
    const cashUsd = banks
      .filter((a) => normalizeCurrency(a.currency) === "USD")
      .reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const revenueMtdUsd = invoices
      .filter((i) => (i.type ?? "receivable") === "receivable" && i.status === "paid" && i.paid_at && new Date(i.paid_at).getTime() >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() && normalizeCurrency(i.currency) === "USD")
      .reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);

    const ar = invoices
      .filter((i) => (i.type ?? "receivable") === "receivable" && i.status !== "paid" && normalizeCurrency(i.currency) === REPORTING_CURRENCY)
      .reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0), 0);

    const ap = invoices
      .filter((i) => i.type === "payable" && i.status !== "paid" && normalizeCurrency(i.currency) === REPORTING_CURRENCY)
      .reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const revenueMtd = invoices
      .filter((i) => (i.type ?? "receivable") === "receivable" && i.status === "paid" && i.paid_at && new Date(i.paid_at).getTime() >= monthStart && normalizeCurrency(i.currency) === REPORTING_CURRENCY)
      .reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);
    const expensesMtd = expenses
      .filter((e) => normalizeCurrency(e.currency) === REPORTING_CURRENCY)
      .filter((e) => e.status === "approved" || e.status === "paid")
      .filter((e) => new Date(e.date ?? e.created_at ?? 0).getTime() >= monthStart)
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    // Company also spends in USD — surface it alongside TZS, never summed together
    const expensesMtdUsd = expenses
      .filter((e) => normalizeCurrency(e.currency) === "USD")
      .filter((e) => e.status === "approved" || e.status === "paid")
      .filter((e) => new Date(e.date ?? e.created_at ?? 0).getTime() >= monthStart)
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const activeTrips = trips.filter((t) => ["pending", "loading", "in_transit"].includes(String(t.status).toLowerCase())).length;
    const overdueTrips = trips.filter((t) => !["delivered", "cancelled"].includes(String(t.status).toLowerCase()) && t.created_at && isOverdue("trip", t.created_at)).length;
    const inUseVehicles = vehicles.filter((v) => v.status === "in_use").length;
    const availableVehicles = vehicles.filter((v) => v.status === "available").length;
    const maintenanceVehicles = vehicles.filter((v) => v.status === "maintenance").length;
    const outOfServiceVehicles = vehicles.filter((v) => v.status === "out_of_service").length;

    // Breakdown by fleet type
    const byType: Record<string, number> = {};
    for (const v of vehicles) {
      const t = String(v.type ?? "other").toUpperCase();
      byType[t] = (byType[t] ?? 0) + 1;
    }

    return {
      cash,
      cashUsd,
      revenueMtdUsd,
      ar,
      ap,
      revenueMtd,
      expensesMtd,
      expensesMtdUsd,
      netMtd: revenueMtd - expensesMtd,
      netMtdUsd: revenueMtdUsd - expensesMtdUsd,
      activeTrips,
      overdueTrips,
      totalVehicles: vehicles.length,
      inUseVehicles,
      availableVehicles,
      maintenanceVehicles,
      outOfServiceVehicles,
      utilization: vehicles.length > 0 ? (inUseVehicles / vehicles.length) * 100 : 0,
      byType,
      pendingFuel: fuel.length,
      pendingExpenses: expenses.filter((e) => e.status === "pending").length,
      pendingMaintenance: maintenance.filter((m) => m.status === "requested").length,
    };
  }, [banks, invoices, expenses, trips, vehicles, fuel, maintenance]);

  const alerts = useMemo(() => {
    const list: { id: string; icon: any; title: string; description: string; href: string; tone: string }[] = [];
    if (stats.overdueTrips > 0) list.push({ id: "trips", icon: Flame, title: `${stats.overdueTrips} overdue trips`, description: "Dispatch operations are behind SLA", href: "/dispatch", tone: "bg-red-50 border-red-200 text-red-800" });
    if (stats.pendingExpenses + stats.pendingFuel + stats.pendingMaintenance > 0) list.push({ id: "appr", icon: ClipboardList, title: `${stats.pendingExpenses + stats.pendingFuel + stats.pendingMaintenance} items waiting for approval`, description: "Route through the Approvals inbox", href: "/approvals", tone: "bg-amber-50 border-amber-200 text-amber-800" });
    const arOverdue = invoices.filter((i) => (i.type ?? "receivable") === "receivable" && i.status !== "paid" && i.due_date && new Date(i.due_date) < new Date());
    if (arOverdue.length > 0) list.push({ id: "ar", icon: AlertTriangle, title: `${arOverdue.length} overdue receivables`, description: "Collections need attention", href: "/finance/reports/aging-report", tone: "bg-red-50 border-red-200 text-red-800" });
    return list;
  }, [stats, invoices]);

  const recentTrips = useMemo(
    () => trips.slice(0, 6),
    [trips],
  );

  const topDebtors = useMemo(
    () =>
      invoices
        .filter((i) => (i.type ?? "receivable") === "receivable" && i.status !== "paid" && i.due_date && new Date(i.due_date) < new Date())
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5),
    [invoices],
  );

  return (
    <div className="space-y-6">
      {/* Command header */}
      <div className="cv-panel bg-gradient-to-br from-primary/95 via-primary to-[hsl(235_84%_65%)] text-primary-foreground border-primary">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Executive Command</p>
            <h1 className="text-2xl font-black tracking-tight">Everything at a glance</h1>
            <p className="text-sm opacity-90 mt-1">
              {stats.activeTrips} active shipments · {stats.utilization.toFixed(0)}% fleet utilization · {alerts.length} attention item{alerts.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshControl onRefresh={load} storageKey="ceo-dashboard" autoSeconds={60} compact />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {alerts.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.id} href={a.href} className={cn("flex items-center gap-3 px-4 py-3 rounded-2xl border", a.tone, "hover:brightness-95 transition")}>
                <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{a.title}</p>
                  <p className="text-xs opacity-90 truncate">{a.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0 opacity-70" />
              </Link>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label={`Cash (${REPORTING_CURRENCY}${stats.cashUsd > 0 ? " · USD" : ""})`}
          value={stats.cashUsd > 0 ? `${format(stats.cash)} · $${stats.cashUsd.toLocaleString()}` : format(stats.cash)}
          icon={Wallet}
          accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]"
          href="/finance/banking/bank-accounts"
        />
        <StatCard
          label={`Revenue MTD${stats.revenueMtdUsd > 0 ? " (TZS · USD)" : ""}`}
          value={stats.revenueMtdUsd > 0 ? `${format(stats.revenueMtd)} · $${stats.revenueMtdUsd.toLocaleString()}` : format(stats.revenueMtd)}
          icon={TrendingUp}
          accent="bg-primary/10 text-primary"
          href="/finance/reports/profit-loss"
        />
        <StatCard
          label={`Expenses MTD${stats.expensesMtdUsd > 0 ? " (TZS · USD)" : ""}`}
          value={stats.expensesMtdUsd > 0 ? `${format(stats.expensesMtd)} · $${stats.expensesMtdUsd.toLocaleString()}` : format(stats.expensesMtd)}
          icon={Receipt}
          accent="bg-red-100 text-red-700"
          href="/finance/reports/expense-analysis"
        />
        <StatCard
          label={`Net MTD${stats.expensesMtdUsd > 0 || stats.revenueMtdUsd > 0 ? " (TZS · USD)" : ""}`}
          value={stats.expensesMtdUsd > 0 || stats.revenueMtdUsd > 0 ? `${format(stats.netMtd)} · $${stats.netMtdUsd.toLocaleString()}` : format(stats.netMtd)}
          icon={DollarSign}
          accent={stats.netMtd >= 0 ? "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" : "bg-red-100 text-red-700"}
          href="/finance/reports/profit-loss"
        />
        <StatCard label="AR outstanding" value={format(stats.ar)} icon={CreditCard} accent="bg-amber-100 text-amber-700" href="/finance/invoicing/customer-invoices" />
        <StatCard label="AP outstanding" value={format(stats.ap)} icon={Building2} accent="bg-orange-100 text-orange-700" href="/finance/invoicing/vendor-bills" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total vehicles" value={stats.totalVehicles} icon={Truck} accent="bg-primary/10 text-primary" href="/fleet" />
        <StatCard label="In use" value={stats.inUseVehicles} sub={`${stats.utilization.toFixed(0)}% utilization`} icon={Navigation} accent="bg-sky-100 text-sky-700" href="/fleet" />
        <StatCard label="Available" value={stats.availableVehicles} icon={CheckCircle2} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" href="/fleet" />
        <StatCard label="In maintenance" value={stats.maintenanceVehicles} icon={Wrench} accent="bg-amber-100 text-amber-700" href="/maintenance" />
        <StatCard label="Out of service" value={stats.outOfServiceVehicles} icon={AlertTriangle} accent="bg-red-100 text-red-700" href="/fleet" />
        <StatCard label="Active trips" value={stats.activeTrips} sub={`${stats.overdueTrips} overdue`} icon={Package} accent="bg-primary/10 text-primary" href="/dispatch" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard title="Fleet composition" subtitle="Vehicles by type" href="/fleet">
          {stats.totalVehicles === 0 ? (
            <EmptyState icon={Truck} title="No vehicles yet" description="Add your first vehicle to see the composition." />
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const pct = (count / stats.totalVehicles) * 100;
                  const label = type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-foreground">{label}</span>
                        <span className="text-muted-foreground">{count} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Approvals & maintenance" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Pending approvals" value={stats.pendingExpenses + stats.pendingFuel + stats.pendingMaintenance} icon={ClipboardList} accent="bg-amber-100 text-amber-700" href="/approvals" />
            <StatCard label="Maintenance open" value={maintenance.length} icon={Wrench} accent="bg-red-100 text-red-700" href="/maintenance" />
          </div>
        </SectionCard>
      </div>

      {/* Recent trips + top debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Recent shipments" subtitle="Latest 6 trips across the fleet" href="/trips" padded={false} className="lg:col-span-2">
          {recentTrips.length === 0 ? (
            <EmptyState icon={Package} title="No trips yet" />
          ) : (
            <ul className="divide-y divide-border">
              {recentTrips.map((t) => {
                const status = String(t.status ?? "pending").toLowerCase();
                const chip =
                  status === "delivered" || status === "completed" ? "cv-chip-success" :
                  status === "in_transit" ? "cv-chip-info" :
                  status === "loading" ? "cv-chip-warning" :
                  status === "cancelled" ? "cv-chip-danger" :
                  "cv-chip-neutral";
                return (
                  <li key={t.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/40 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{t.trip_number ?? `TRP-${t.id.slice(0, 6)}`}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.origin} → {t.destination}</p>
                    </div>
                    <span className={cn("cv-chip", chip)}>{status.replace("_", " ")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Top overdue" subtitle="Customers owing money past due" href="/finance/reports/aging-report" padded={false}>
          {topDebtors.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All caught up" description="No overdue receivables." />
          ) : (
            <ul className="divide-y divide-border">
              {topDebtors.map((d: any) => (
                <li key={d.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 font-black text-xs flex items-center justify-center shrink-0">
                    {(d.customer_name ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{d.customer_name ?? d.client_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{d.invoice_number}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-red-600">{format(Number(d.total_amount ?? d.amount ?? 0))}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Quick launcher */}
      <SectionCard title="Quick actions" subtitle="Jump to the modules you use most">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { href: "/dispatch", label: "Dispatch", icon: Navigation, tone: "bg-primary/10 text-primary" },
            { href: "/trips", label: "Trips", icon: ClipboardList, tone: "bg-sky-100 text-sky-700" },
            { href: "/fleet", label: "Fleet", icon: Truck, tone: "bg-emerald-100 text-emerald-700" },
            { href: "/maintenance", label: "Maintenance", icon: Wrench, tone: "bg-amber-100 text-amber-700" },
            { href: "/approvals", label: "Approvals", icon: ClipboardList, tone: "bg-fuchsia-100 text-fuchsia-700" },
            { href: "/finance", label: "Finance", icon: BarChart2, tone: "bg-indigo-100 text-indigo-700" },
          ].map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors">
                <div className={cn("p-2 rounded-lg", l.tone)}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-foreground">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
