"use client";

import Link from "next/link";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Landmark,
  Loader2,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type FinanceRow = Record<string, unknown>;

type FinanceState = {
  invoices: FinanceRow[];
  expenses: FinanceRow[];
  income: FinanceRow[];
  trips: FinanceRow[];
  vehicles: FinanceRow[];
  journalEntries: FinanceRow[];
};

type Activity = {
  id: string;
  type: "revenue" | "expense" | "invoice" | "journal";
  title: string;
  detail: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
};

const EMPTY_STATE: FinanceState = {
  invoices: [],
  expenses: [],
  income: [],
  trips: [],
  vehicles: [],
  journalEntries: [],
};

const statusStyles: Record<string, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  submitted: "border-blue-200 bg-blue-50 text-blue-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  draft: "border-slate-200 bg-slate-100 text-slate-700",
};

const accountingAreas: Array<{
  title: string;
  description: string;
  href: string;
  icon: ElementType;
  tone: string;
}> = [
  {
    title: "Chart of Accounts",
    description: "Maintain assets, liabilities, equity, revenue, and expense accounts.",
    href: "/finance/chart-of-accounts",
    icon: BookOpen,
    tone: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    title: "Journal Entries",
    description: "Review operational postings from trips, fuel, payroll, and maintenance.",
    href: "/finance",
    icon: Receipt,
    tone: "bg-slate-100 text-slate-700 border-slate-200",
  },
  {
    title: "Customer Invoices",
    description: "Track receivables, outstanding balances, and collection pressure.",
    href: "/finance",
    icon: FileText,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    title: "Expense Approval",
    description: "Approve driver, vendor, fuel, maintenance, and payroll expenses.",
    href: "/accountant/expenses",
    icon: TrendingDown,
    tone: "bg-red-50 text-red-700 border-red-100",
  },
  {
    title: "Bank Reconciliation",
    description: "Import statements and match deposits or withdrawals to ledger records.",
    href: "/finance/bank-statement",
    icon: Landmark,
    tone: "bg-cyan-50 text-cyan-700 border-cyan-100",
  },
  {
    title: "Statutory Reports",
    description: "Prepare payroll and statutory finance reporting for compliance.",
    href: "/admin/hr/payroll/statutory",
    icon: Banknote,
    tone: "bg-amber-50 text-amber-700 border-amber-100",
  },
  {
    title: "Route Profitability",
    description: "Connect trips, vehicle costs, fuel, and revenue by route.",
    href: "/admin/reports/fleet/route-profitability",
    icon: Truck,
    tone: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
  {
    title: "Financial Reports",
    description: "Open board-ready reports for revenue, expenses, margins, and vehicles.",
    href: "/reports",
    icon: ClipboardList,
    tone: "bg-teal-50 text-teal-700 border-teal-100",
  },
];

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = "-"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function rowAmount(row: FinanceRow): number {
  return toNumber(row.amount ?? row.total ?? row.total_amount ?? row.balance ?? row.price);
}

function rowCurrency(row: FinanceRow): string {
  return text(row.currency, "TZS").toUpperCase();
}

function rowDate(row: FinanceRow): string {
  return text(row.date ?? row.expense_date ?? row.due_date ?? row.created_at ?? row.updated_at, new Date().toISOString());
}

function rowStatus(row: FinanceRow): string {
  return text(row.status, "draft").toLowerCase();
}

function formatCurrency(amount: number, currency = "TZS"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TZS" ? 0 : 2,
  }).format(amount);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isReceivable(invoice: FinanceRow): boolean {
  const type = text(invoice.type ?? invoice.invoice_type, "receivable").toLowerCase();
  return type !== "payable";
}

function isUnpaid(row: FinanceRow): boolean {
  return !["paid", "approved", "resolved"].includes(rowStatus(row));
}

async function safeTable(table: string, limit = 80): Promise<FinanceRow[]> {
  const { data, error } = await supabase.from(table).select("*").limit(limit);
  if (error) {
    console.warn(`[Finance] ${table} unavailable:`, error.message);
    return [];
  }
  return (data ?? []) as FinanceRow[];
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", statusStyles[status] ?? statusStyles.draft)}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
  helper,
}: {
  title: string;
  value: string;
  icon: ElementType;
  tone: "blue" | "green" | "amber" | "red" | "slate";
  helper: string;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="app-kpi">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-normal text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg border", tones[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({
  title,
  description,
  href,
  icon: Icon,
  status,
}: {
  title: string;
  description: string;
  href: string;
  icon: ElementType;
  status: string;
}) {
  return (
    <Link href={href} className="app-section block transition-colors hover:border-primary/40 hover:bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">{status}</p>
        </div>
      </div>
    </Link>
  );
}

function AccountingAreaCard({
  title,
  description,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  href: string;
  icon: ElementType;
  tone: string;
}) {
  return (
    <Link href={href} className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
      <div className={cn("mb-4 flex size-10 items-center justify-center rounded-lg border", tone)}>
        <Icon className="size-5" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

export default function FinancialOperations() {
  const { role } = useRole();
  const [data, setData] = useState<FinanceState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadFinance = async () => {
    setLoading(true);
    const [invoices, expenses, income, trips, vehicles, journalEntries] = await Promise.all([
      safeTable("invoices"),
      safeTable("expenses"),
      safeTable("income"),
      safeTable("trips"),
      safeTable("vehicles"),
      safeTable("journal_entries"),
    ]);

    setData({ invoices, expenses, income, trips, vehicles, journalEntries });
    setLoading(false);
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const metrics = useMemo(() => {
    const invoiceRevenue = data.invoices
      .filter((row) => isReceivable(row))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const directIncome = data.income.reduce((sum, row) => sum + rowAmount(row), 0);
    const operatingExpense = data.expenses.reduce((sum, row) => sum + rowAmount(row), 0);
    const receivables = data.invoices
      .filter((row) => isReceivable(row) && isUnpaid(row))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const payables = data.invoices
      .filter((row) => !isReceivable(row) && isUnpaid(row))
      .reduce((sum, row) => sum + rowAmount(row), 0);
    const pendingExpenses = data.expenses.filter((row) => rowStatus(row) === "pending");
    const revenue = invoiceRevenue + directIncome;
    const net = revenue - operatingExpense;
    const margin = revenue > 0 ? Math.round((net / revenue) * 100) : 0;

    return {
      revenue,
      directIncome,
      operatingExpense,
      receivables,
      payables,
      pendingExpenseValue: pendingExpenses.reduce((sum, row) => sum + rowAmount(row), 0),
      pendingExpenseCount: pendingExpenses.length,
      net,
      margin,
      invoiceCount: data.invoices.length,
      vehicleCount: data.vehicles.length,
      tripCount: data.trips.length,
    };
  }, [data]);

  const activities = useMemo<Activity[]>(() => {
    const revenueActivities = data.income.map((row, index) => ({
      id: `income-${text(row.id, String(index))}`,
      type: "revenue" as const,
      title: text(row.description ?? row.source ?? row.customer_name, "Income record"),
      detail: "Direct income",
      amount: rowAmount(row),
      currency: rowCurrency(row),
      status: rowStatus(row),
      date: rowDate(row),
    }));

    const expenseActivities = data.expenses.map((row, index) => ({
      id: `expense-${text(row.id, String(index))}`,
      type: "expense" as const,
      title: text(row.description ?? row.category, "Expense record"),
      detail: text(row.category ?? row.vendor, "Operating cost"),
      amount: rowAmount(row),
      currency: rowCurrency(row),
      status: rowStatus(row),
      date: rowDate(row),
    }));

    const invoiceActivities = data.invoices.map((row, index) => ({
      id: `invoice-${text(row.id, String(index))}`,
      type: "invoice" as const,
      title: text(row.invoice_number ?? row.reference, "Invoice"),
      detail: text(row.customer_name ?? row.client_name ?? row.vendor, isReceivable(row) ? "Receivable" : "Payable"),
      amount: rowAmount(row),
      currency: rowCurrency(row),
      status: rowStatus(row),
      date: rowDate(row),
    }));

    const journalActivities = data.journalEntries.map((row, index) => ({
      id: `journal-${text(row.id, String(index))}`,
      type: "journal" as const,
      title: text(row.description ?? row.reference, "Journal entry"),
      detail: "Ledger posting",
      amount: rowAmount(row),
      currency: rowCurrency(row),
      status: rowStatus(row),
      date: rowDate(row),
    }));

    return [...revenueActivities, ...expenseActivities, ...invoiceActivities, ...journalActivities]
      .filter((row) => `${row.title} ${row.detail} ${row.status}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 18);
  }, [data, search]);

  const reconciliationScore = Math.min(
    100,
    Math.round(
      ((data.invoices.filter((row) => rowStatus(row) === "paid").length +
        data.expenses.filter((row) => ["approved", "paid"].includes(rowStatus(row))).length) /
        Math.max(data.invoices.length + data.expenses.length, 1)) *
        100,
    ),
  );

  const overdueInvoices = data.invoices.filter((row) => {
    if (!isUnpaid(row)) return false;
    const due = new Date(rowDate(row)).getTime();
    return Number.isFinite(due) && due < Date.now();
  });

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar role={(role || "ACCOUNTANT") as any} />
      <main className="min-w-0 flex-1 md:ml-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  Finance Command Center
                </Badge>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Integrated ledger
                </Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal md:text-3xl">Accounting and Finance</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                One finance workspace for trip revenue, invoices, expenses, payables, receivables, reconciliation, and audit-ready reporting.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={loadFinance} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Refresh
              </Button>
              <Button asChild className="gap-2">
                <Link href="/finance/bank-statement">
                  <CreditCard className="size-4" />
                  Reconcile Bank
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-4 md:p-6">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Revenue"
              value={formatCurrency(metrics.revenue)}
              icon={TrendingUp}
              tone="green"
              helper={`${metrics.invoiceCount} invoices plus direct income`}
            />
            <MetricCard
              title="Operating Expense"
              value={formatCurrency(metrics.operatingExpense)}
              icon={TrendingDown}
              tone="red"
              helper={`${metrics.pendingExpenseCount} pending approvals`}
            />
            <MetricCard
              title="Net Position"
              value={formatCurrency(metrics.net)}
              icon={Scale}
              tone={metrics.net >= 0 ? "blue" : "amber"}
              helper={`${metrics.margin}% operating margin`}
            />
            <MetricCard
              title="Receivables"
              value={formatCurrency(metrics.receivables)}
              icon={Wallet}
              tone="amber"
              helper={`${overdueInvoices.length} invoices need collection`}
            />
          </section>

          <section className="app-surface p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Accounting Workbench</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Full accounting stays available here: accounts, journals, invoices, expenses, reconciliation, statutory reports, and fleet profitability.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-primary/20 bg-primary/10 text-primary">
                No dead accounting links
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {accountingAreas.map((area) => (
                <AccountingAreaCard key={area.title} {...area} />
              ))}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="app-surface">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Finance Workflow</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Follow the money from operations into accounting with clear handoffs.
                    </p>
                  </div>
                  <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-9"
                      placeholder="Search ledger activity..."
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <WorkflowStep
                    title="Trip Revenue"
                    description="Convert completed dispatch activity into customer invoices and revenue reports."
                    href="/trips"
                    icon={Truck}
                    status={`${metrics.tripCount} trips connected`}
                  />
                  <WorkflowStep
                    title="Income Register"
                    description="Track deposits, manual receipts, and non-trip income in one clean register."
                    href="/income"
                    icon={ArrowUpRight}
                    status={formatCurrency(metrics.directIncome)}
                  />
                  <WorkflowStep
                    title="Expense Control"
                    description="Review driver, fuel, maintenance, payroll, and vendor costs before approval."
                    href="/expenses"
                    icon={Receipt}
                    status={`${metrics.pendingExpenseCount} pending`}
                  />
                  <WorkflowStep
                    title="Bank Reconciliation"
                    description="Import statements and match deposits or withdrawals against the ledger."
                    href="/finance/bank-statement"
                    icon={Landmark}
                    status={`${reconciliationScore}% matched signal`}
                  />
                  <WorkflowStep
                    title="Chart of Accounts"
                    description="Maintain the accounting structure that powers reports and journal postings."
                    href="/finance/chart-of-accounts"
                    icon={BookOpen}
                    status="Account map ready"
                  />
                  <WorkflowStep
                    title="Audit Reports"
                    description="Review vehicle profitability, driver costs, fuel, route margin, and statutory reports."
                    href="/reports"
                    icon={ClipboardList}
                    status={`${metrics.vehicleCount} vehicles tracked`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="app-surface">
              <CardContent className="space-y-5 p-5">
                <div>
                  <h2 className="text-lg font-semibold">Control Status</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Operational finance checks that protect cash flow.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">Reconciliation health</span>
                      <span className="text-muted-foreground">{reconciliationScore}%</span>
                    </div>
                    <Progress value={reconciliationScore} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payables</p>
                      <p className="mt-2 text-lg font-semibold">{formatCurrency(metrics.payables + metrics.pendingExpenseValue)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overdue</p>
                      <p className="mt-2 text-lg font-semibold">{overdueInvoices.length}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {overdueInvoices.length > 0 ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 size-4" />
                          <span>{overdueInvoices.length} unpaid invoice(s) are past due and should be followed up.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 size-4" />
                          <span>No overdue invoice pressure detected in the current sample.</span>
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 size-4" />
                        <span>Expenses, bank matching, and reports now sit in one accounting workflow.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Tabs defaultValue="activity" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/70 p-1 md:grid-cols-4">
              <TabsTrigger value="activity">Ledger Activity</TabsTrigger>
              <TabsTrigger value="receivables">Receivables</TabsTrigger>
              <TabsTrigger value="payables">Payables</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <div className="app-table-shell">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                          Loading finance records...
                        </TableCell>
                      </TableRow>
                    ) : activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No matching finance activity found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="max-w-[320px]">
                              <p className="truncate font-medium">{item.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell>{formatDate(item.date)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.amount, item.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="receivables">
              <FinanceList
                rows={data.invoices.filter((row) => isReceivable(row))}
                empty="No receivable invoices found."
                kind="receivable"
              />
            </TabsContent>

            <TabsContent value="payables">
              <FinanceList
                rows={[...data.invoices.filter((row) => !isReceivable(row)), ...data.expenses]}
                empty="No payable or expense records found."
                kind="payable"
              />
            </TabsContent>

            <TabsContent value="reports">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportLink href="/reports" icon={FileText} title="Financial Reports" description="Company reports and exportable summaries." />
                <ReportLink href="/admin/reports/fleet/revenue-by-vehicle" icon={Truck} title="Vehicle Revenue" description="Revenue, expenses, and margin by truck." />
                <ReportLink href="/admin/reports/fleet/route-profitability" icon={ArrowUpRight} title="Route Profitability" description="Gross margin by lane and destination." />
                <ReportLink href="/admin/hr/payroll/statutory" icon={Banknote} title="Statutory Reports" description="Payroll and statutory finance reporting." />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function FinanceList({
  rows,
  empty,
  kind,
}: {
  rows: FinanceRow[];
  empty: string;
  kind: "receivable" | "payable";
}) {
  return (
    <div className="app-table-shell">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{kind === "receivable" ? "Customer / Ref" : "Vendor / Ref"}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.slice(0, 24).map((row, index) => (
              <TableRow key={text(row.id, `${kind}-${index}`)}>
                <TableCell>
                  <div className="max-w-[360px]">
                    <p className="truncate font-medium">
                      {text(row.invoice_number ?? row.description ?? row.customer_name ?? row.vendor, "Finance record")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {text(row.customer_name ?? row.client_name ?? row.category ?? row.vendor, kind)}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={rowStatus(row)} />
                </TableCell>
                <TableCell>{formatDate(rowDate(row))}</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(rowAmount(row), rowCurrency(row))}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ReportLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="app-section block transition-colors hover:border-primary/40 hover:bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}
