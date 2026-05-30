"use client";

import {
  DashboardLayout,
  StatCard,
  DataTable,
  ActivityFeed,
  AlertPanel,
} from "@/components/dashboard/shared/dashboard-layout";
import { useExpenses } from "@/hooks/data/use-expenses";
import { useInvoices } from "@/hooks/data/use-invoices";
import { useTrips } from "@/hooks/data/use-trips";
import { useMonthlyReports } from "@/hooks/data/use-monthly-reports";
import { useUsers } from "@/hooks/data/use-users";
import { useRole } from "@/hooks/use-role";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Users,
  FileText,
  BarChart2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Shield,
  Calendar,
  Download,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Eye,
  Briefcase,
  Calculator,
  ArrowRight,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { StatCards } from "./stat-cards";
import { AuditService } from "@/services/audit-service";
import { useEffect } from "react";

export default function AccountantDashboard() {
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { role } = useRole();

  // Data hooks
  const { expenses, loading: expensesLoading } = useExpenses();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { trips, loading: tripsLoading } = useTrips();
  const { reports, loading: reportsLoading } = useMonthlyReports();
  const { users: drivers, loading: driversLoading } = useUsers({
    role: "DRIVER",
  });

  const [alerts, setAlerts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);

  useEffect(() => {
    const loadExtra = async () => {
      try {
        setExtraLoading(true);
        // Real financial activities
        const logs = await AuditService.getLogs({ limit: 5 });
        const mappedActivities = logs.filter(l => ['expenses', 'sales', 'invoices', 'bank_accounts'].includes(l.table_name)).map(log => ({
          id: log.id,
          title: log.change_summary || "Financial Activity",
          description: `${log.user_name} updated ${log.table_name}`,
          time: new Date(log.created_at).toLocaleTimeString(),
          icon: DollarSign,
          color: "bg-emerald-500",
        }));
        setActivities(mappedActivities.length > 0 ? mappedActivities : [
          { id: '1', title: 'No recent financial activity', description: 'Ledger is balanced', time: 'Now', icon: DollarSign, color: 'bg-slate-400' }
        ]);

        // Real financial alerts
        const unpaidInv = invoices.filter(i => String(i.status).toLowerCase() !== 'paid' && new Date(i.due_date) < new Date());
        const pendingExps = expenses.filter(e => String(e.status).toLowerCase() === 'pending');
        
        const combinedAlerts = [
          ...(unpaidInv.map(i => ({
            id: i.id,
            title: "Overdue Invoice",
            description: `${i.invoice_number} from ${i.customer_name} is past due.`,
            severity: "critical" as const,
            time: "Now"
          }))),
          ...(pendingExps.map(e => ({
            id: e.id,
            title: "Pending Expense",
            description: `New expense of ${format(e.amount)} needs approval.`,
            severity: "warning" as const,
            time: "Recent"
          })))
        ];
        setAlerts(combinedAlerts);
      } catch (err) {
        console.error("Error loading Accountant extra data:", err);
      } finally {
        setExtraLoading(false);
      }
    };
    loadExtra();
  }, [invoices, expenses]);

  const loading =
    expensesLoading ||
    invoicesLoading ||
    tripsLoading ||
    reportsLoading ||
    driversLoading ||
    extraLoading;

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingExpenseCount = expenses.filter(
    (e) => String(e.status || "pending").toLowerCase() === "pending",
  ).length;
  const totalRevenue = trips.reduce(
    (sum, t) => sum + (Number(t.revenue || t.price) || 0),
    0,
  );
  const unpaidInvoices = invoices.filter((i) => {
    const s = (i.status || "").toLowerCase();
    return s && !["paid", "settled", "closed"].includes(s);
  });
  const totalUnpaidAmount = unpaidInvoices.reduce(
    (sum, inv) => sum + (Number(inv.amount) || 0),
    0,
  );

  // Current month report
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentReport = reports.find((r) =>
    (r.month || "").toString().startsWith(currentMonth),
  );
  const recentReports = reports.slice(0, 6);

  // Expense categories
  const expenseCategories = useMemo(() => {
    const categories: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "Other";
      categories[cat] = (categories[cat] || 0) + (e.amount || 0);
    });
    return categories;
  }, [expenses]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Accountant Dashboard"
      description="Financial management and reporting"
      role={role || "ACCOUNTANT"}
    >
      {/* Alert Panel */}
      <AlertPanel alerts={alerts} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/accountant/expenses">
            Review expenses
            {pendingExpenseCount > 0 && ` (${pendingExpenseCount} pending)`}
          </Link>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={format(totalRevenue)}
          icon={DollarSign}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Total Expenses"
          value={format(totalExpenses)}
          icon={Calculator}
          color="text-red-600"
          bgColor="bg-red-50"
        />
        <StatCard
          title="Net Profit"
          value={format(totalRevenue - totalExpenses)}
          icon={TrendingUp}
          color={
            totalRevenue - totalExpenses >= 0
              ? "text-green-600"
              : "text-red-600"
          }
          bgColor={
            totalRevenue - totalExpenses >= 0 ? "bg-green-50" : "bg-red-50"
          }
        />
        <StatCard
          title="Unpaid Invoices"
          value={unpaidInvoices.length}
          icon={FileText}
          color="text-orange-600"
          bgColor="bg-orange-50"
        />
        <StatCard
          title="Total Drivers"
          value={drivers.length}
          icon={Users}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
        <StatCard
          title="Expense Categories"
          value={Object.keys(expenseCategories).length}
          icon={Briefcase}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Completed Trips"
          value={trips.filter((t) => t.status === "completed").length}
          icon={Navigation}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
        />
        <StatCard
          title="Monthly Reports"
          value={reports.length}
          icon={Calendar}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue vs Expenses Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="size-5" />
              Financial Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-bold text-green-600">
                  {format(totalRevenue)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-bold text-red-600">
                  {format(totalExpenses)}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Unpaid Invoices</p>
                <p className="text-lg font-bold text-blue-600">
                  {format(totalUnpaidAmount)}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Profit Margin</p>
                <p
                  className={`text-lg font-bold ${totalRevenue - totalExpenses >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {totalRevenue > 0
                    ? (
                        ((totalRevenue - totalExpenses) / totalRevenue) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
            {/* Expense Breakdown */}
            <h4 className="text-sm font-medium mb-3">
              Expense Breakdown by Category
            </h4>
            <div className="space-y-2">
              {Object.entries(expenseCategories).map(([cat, amount]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-muted-foreground truncate">
                    {cat}
                  </div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm font-medium">
                    {format(amount)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => {
                  /* Add expense logic */
                }}
              >
                <Plus className="size-4 mr-2" /> Record Expense
              </Button>
              <Button variant="outline" className="w-full">
                <Upload className="size-4 mr-2" /> Upload Receipt
              </Button>
              <Button variant="outline" className="w-full">
                <Download className="size-4 mr-2" /> Export Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" />
                Recent Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed activities={activities} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Expense & Invoice Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Recent Expenses
            </CardTitle>
            <Badge variant="secondary">{expenses.length} total</Badge>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "category", label: "Category" },
                {
                  key: "amount",
                  label: "Amount",
                  render: (row) => (
                    <span className="text-rose-600 font-medium">
                      -{format(row.amount)}
                    </span>
                  ),
                },
                { key: "description", label: "Description" },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <Badge
                      variant={
                        row.status === "approved"
                          ? "default"
                          : row.status === "pending"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {row.status}
                    </Badge>
                  ),
                },
              ]}
              data={expenses.slice(0, 10)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Invoices
            </CardTitle>
            <Badge variant="destructive">{unpaidInvoices.length} unpaid</Badge>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "invoice_number", label: "Invoice #" },
                { key: "client", label: "Client" },
                { key: "amount", label: "Amount" },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <Badge
                      variant={
                        row.status === "paid" ? "default" : "destructive"
                      }
                    >
                      {row.status}
                    </Badge>
                  ),
                },
              ]}
              data={invoices.slice(0, 10)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Monthly Reports */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Monthly Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                key: "month",
                label: "Month",
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
                  <span className="text-green-600">
                    {format(Number(row.total_revenue || 0))}
                  </span>
                ),
              },
              {
                key: "total_expenses",
                label: "Expenses",
                render: (row) => (
                  <span className="text-red-600">
                    {format(Number(row.total_expenses || 0))}
                  </span>
                ),
              },
              {
                key: "net_profit",
                label: "Net Profit",
                render: (row) => (
                  <span
                    className={`font-semibold ${Number(row.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {format(Number(row.net_profit || 0))}
                  </span>
                ),
              },
            ]}
            data={recentReports}
          />
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export { AccountantDashboard as AccountantView };
