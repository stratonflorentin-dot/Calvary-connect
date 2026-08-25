'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Zap,
  FileText,
  Wallet,
  TrendingDown,
  Grid,
  Truck,
  Users,
  AlertTriangle,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GradientCard } from '@/components/ui/gradient-card';
import { DocumentStatusBadge } from '@/components/ui/document-status-badge';
import { PageShell, PageHeader, PageSection } from '@/components/design/page-shell';
import { KpiCard } from '@/components/design/kpi-card';
import { useDashboard } from '@/hooks/use-dashboard';
import { useCurrency } from '@/hooks/use-currency';
import { useSupabase } from '@/components/supabase-provider';
import { barGrowIn, TRANSITION } from '@/lib/animations';
import { cn } from '@/lib/utils';

function ExecutiveDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useSupabase();
  const { format } = useCurrency();

  const range = (searchParams.get('range') as any) || 'mtd';
  const mode = (searchParams.get('mode') as any) || 'operations';

  const {
    stats,
    fleetStatus,
    shipmentFinance,
    revenueTrend,
    tripPerformance,
    actionableShipments,
    recentInvoices,
    expiringDocs,
    actionCenter,
    pendingCashRequestsCount,
  } = useDashboard(range, mode);

  const handleFilterChange = (newRange: string, newMode: string) => {
    const params = new URLSearchParams();
    params.set('range', newRange);
    params.set('mode', newMode);
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <PageShell className="space-y-6 sm:space-y-8">
      <PageHeader
        title={`Welcome back, ${user?.name || user?.email || 'User'}!`}
        subtitle={new Date().toLocaleDateString('en-TZ', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      >
        {pendingCashRequestsCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl animate-pulse">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <span className="text-sm font-semibold text-warning">
              {pendingCashRequestsCount} pending cash requests
            </span>
            <Button size="sm" variant="ghost" className="text-warning hover:text-warning-foreground">
              Open
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Filters */}
      <PageSection>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Period</label>
                <Select value={range} onValueChange={(newRange) => handleFilterChange(newRange, mode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mtd">Month To Date</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="qtd">Quarter To Date</SelectItem>
                    <SelectItem value="ytd">Year To Date</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Dashboard Mode</label>
                <Select value={mode} onValueChange={(newMode) => handleFilterChange(range, newMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="fleet">Fleet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      {/* KPIs */}
      <PageSection className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Active Shipments"
          value={stats.activeShipments}
          icon={<Zap className="w-5 h-5 text-warning" />}
          href="/trips"
        />
        <KpiCard
          label="Revenue MTD"
          value={format(stats.revenueMtd)}
          icon={<DollarSign className="w-5 h-5 text-success" />}
        />
        <KpiCard
          label="Outstanding"
          value={format(stats.outstanding)}
          icon={<FileText className="w-5 h-5 text-warning" />}
          href="/finance"
        />
        <KpiCard
          label="AR Balance"
          value={format(stats.arBalance)}
          icon={<Wallet className="w-5 h-5 text-info" />}
          href="/finance"
        />
        <KpiCard
          label="Expenses MTD"
          value={format(stats.expensesMtd)}
          icon={<TrendingDown className="w-5 h-5 text-destructive" />}
          href="/expenses"
        />
        <KpiCard
          label="Available Vehicles"
          value={`${stats.availableVehicles}/${stats.totalVehicles}`}
          icon={<Grid className="w-5 h-5 text-accent-foreground" />}
          href="/fleet"
        />
      </PageSection>

      {/* Fleet status */}
      <PageSection>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-accent-foreground" />
              Fleet Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-8 sm:h-10 bg-muted rounded-xl overflow-hidden mb-4 shadow-inner">
              <div
                className="bg-info transition-all duration-500"
                style={{ width: `${(fleetStatus.inTransit / stats.totalVehicles) * 100}%` }}
              />
              <div
                className="bg-success transition-all duration-500"
                style={{ width: `${(fleetStatus.available / stats.totalVehicles) * 100}%` }}
              />
              <div
                className="bg-warning transition-all duration-500"
                style={{ width: `${(fleetStatus.maintenance / stats.totalVehicles) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
              <StatusLegend color="bg-info" label="In Transit" value={fleetStatus.inTransit} />
              <StatusLegend color="bg-success" label="Available" value={fleetStatus.available} />
              <StatusLegend color="bg-warning" label="Maintenance" value={fleetStatus.maintenance} />
            </div>
          </CardContent>
        </Card>
      </PageSection>

      {/* Shipment finance */}
      <PageSection>
        <GradientCard
          title="Shipment Operational Finance"
          icon={<Truck className="w-5 h-5 text-white" />}
          iconBg="bg-success"
          headerGradient="bg-gradient-to-r from-success to-success/80"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <FinanceTile label="Requested" value={format(shipmentFinance.requested)} tone="muted" />
            <FinanceTile label="Committed" value={format(shipmentFinance.committed)} tone="info" />
            <FinanceTile label="Actual" value={format(shipmentFinance.actual)} tone="success" />
            <FinanceTile label="Critical Var." value={shipmentFinance.criticalVariance} tone="destructive" />
            <FinanceTile label="Warn Var." value={shipmentFinance.warningVariance} tone="warning" />
          </div>
        </GradientCard>
      </PageSection>

      {/* Charts */}
      <PageSection className="grid lg:grid-cols-2 gap-6">
        <GradientCard
          title="Revenue Trend"
          icon={<TrendingDown className="w-5 h-5 text-white" />}
          iconBg="bg-success"
          headerGradient="bg-gradient-to-r from-success/80 to-success/60"
        >
          <div className="space-y-6">
            <div className="flex items-end justify-end gap-2 h-40">
              {revenueTrend.map((month, idx) => {
                const maxRevenue = Math.max(...revenueTrend.map((m) => m.revenue));
                const height = maxRevenue > 0 ? (month.revenue / maxRevenue) * 160 : 0;
                return (
                  <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                    <motion.div
                      className="w-full bg-gradient-to-t from-success/80 to-success/60 rounded-t-lg hover:from-success hover:to-success/80 cursor-pointer"
                      style={{ height: `${height}px`, transformOrigin: 'bottom' }}
                      variants={barGrowIn}
                      initial="hidden"
                      animate="visible"
                      transition={{ ...TRANSITION.modal, delay: idx * 0.03 }}
                      whileHover={{ scaleY: 1.02 }}
                    />
                    <span className="text-xs text-muted-foreground">{month.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-center border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Average/Month:</p>
              <p className="text-xl font-bold text-foreground">
                TZS {Math.round(revenueTrend.reduce((sum, m) => sum + m.revenue, 0) / revenueTrend.length).toLocaleString('en-TZ')}
              </p>
            </div>
          </div>
        </GradientCard>

        <GradientCard
          title="Trip Performance"
          icon={<Truck className="w-5 h-5 text-white" />}
          iconBg="bg-info"
          headerGradient="bg-gradient-to-r from-info/80 to-info/60"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FinanceTile label="In Transit" value={tripPerformance.inTransit} tone="info" />
              <FinanceTile label="Completed" value={tripPerformance.completed} tone="success" />
              <FinanceTile label="Total" value={tripPerformance.total} tone="muted" />
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-3">Completion Rate</p>
              <div className="w-full bg-muted rounded-xl h-3 overflow-hidden shadow-inner">
                <motion.div
                  className="bg-gradient-to-r from-success/80 to-success h-full w-full"
                  style={{ transformOrigin: 'left' }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: tripPerformance.completionRate / 100 }}
                  transition={TRANSITION.modal}
                />
              </div>
              <p className="text-lg font-bold mt-3 text-foreground">{tripPerformance.completionRate.toFixed(1)}%</p>
            </div>
          </div>
        </GradientCard>
      </PageSection>

      {/* Bottom grid */}
      <PageSection className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Shipments Needing Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionableShipments.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No shipments needing action</p>
              ) : (
                actionableShipments.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Badge variant="outline" className="font-medium shrink-0">{s.status}</Badge>
                      <span className="text-sm font-semibold text-foreground truncate">{s.shipment_number}</span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">{s.client_name}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 hover:bg-primary/10 hover:text-primary">
                      View
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentInvoices.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No recent invoices</p>
              ) : (
                recentInvoices.slice(0, 5).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{inv.customer_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="mb-2 font-medium">{inv.status}</Badge>
                      <p className="text-sm font-bold text-foreground">{format(inv.amount)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start h-11">+ New Quotation</Button>
                <Button variant="outline" className="w-full justify-start h-11">View Invoices</Button>
                <Button variant="outline" className="w-full justify-start h-11">Record Expense</Button>
                <Button variant="outline" className="w-full justify-start h-11">+ Add Client</Button>
                <Button variant="outline" className="w-full justify-start h-11">Request Cash</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Account Balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BalanceRow label="Bank Account (TZS)" value="TZS 50,000,000" />
                <BalanceRow label="Petty Cash" value="TZS 500,000" />
                <BalanceRow label="USD Account" value="USD 10,000" />
                <div className="flex justify-between text-sm font-bold pt-3 border-t border-border">
                  <span className="text-foreground">Total TZS</span>
                  <span className="text-foreground">TZS 50,500,000</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Documents Expiring ({expiringDocs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {expiringDocs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">All documents are valid</p>
              ) : (
                expiringDocs.slice(0, 8).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-destructive/5 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Badge variant="outline" className="bg-accent/10 font-medium shrink-0">{doc.vehicle_code}</Badge>
                      <span className="text-sm text-foreground truncate">{doc.doc_type}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <DocumentStatusBadge status={doc.status as any} expiryDate={doc.expiry_date} />
                      <p className="text-xs text-muted-foreground mt-2">{doc.expiry_date}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Action Center</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionCenter.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">All clear!</p>
              ) : (
                actionCenter.map((item) => (
                  <div key={item.id} className="border border-border rounded-xl p-4 hover:bg-muted/50 transition-colors">
                    <Badge
                      variant={item.severity === 'CRITICAL' ? 'destructive' : 'secondary'}
                      className={item.severity === 'CRITICAL' ? 'bg-destructive' : 'bg-warning'}
                    >
                      {item.severity}
                    </Badge>
                    <p className="text-sm font-semibold text-foreground mt-3">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    <Button size="sm" variant="ghost" className="mt-3 hover:bg-primary/10 hover:text-primary">
                      Open
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">My Cash Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <CashRequestTile label="Draft" value={0} tone="info" />
                <CashRequestTile label="Pending" value={0} tone="warning" />
                <CashRequestTile label="Retired" value={0} tone="success" />
                <CashRequestTile label="Overdue" value={0} tone="destructive" />
              </div>
              <Button size="sm" variant="outline" className="w-full h-11">
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <GradientCard
            title="Top Clients"
            subtitle="Month To Date"
            icon={<Users className="w-5 h-5 text-white" />}
            iconBg="bg-accent"
            headerGradient="bg-gradient-to-r from-violet-500 to-violet-400"
          >
            <div className="space-y-4">
              {[
                { rank: 1, name: 'Client A', revenue: 5000000 },
                { rank: 2, name: 'Client B', revenue: 3500000 },
                { rank: 3, name: 'Client C', revenue: 2800000 },
                { rank: 4, name: 'Client D', revenue: 1200000 },
                { rank: 5, name: 'Client E', revenue: 800000 },
              ].map((client) => {
                const maxRevenue = 5000000;
                const width = (client.revenue / maxRevenue) * 100;
                return (
                  <div key={client.rank} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl bg-warning flex items-center justify-center text-xs font-bold text-warning-foreground shadow-sm">
                      {client.rank}
                    </div>
                    <span className="text-sm font-semibold flex-1 text-foreground truncate">{client.name}</span>
                    <div className="flex-1 bg-muted rounded-xl h-2.5 overflow-hidden shadow-inner">
                      <motion.div
                        className="bg-accent h-full w-full"
                        style={{ transformOrigin: 'left' }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: width / 100 }}
                        transition={{ ...TRANSITION.modal, delay: client.rank * 0.04 }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground w-16 text-right">{format(client.revenue)}</span>
                  </div>
                );
              })}
            </div>
          </GradientCard>
        </div>
      </PageSection>
    </PageShell>
  );
}

function StatusLegend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-3 h-3 sm:w-4 sm:h-4 rounded-lg shadow-sm', color)} />
      <span className="text-foreground font-medium">{label}: {value}</span>
    </div>
  );
}

function FinanceTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'muted' | 'info' | 'success' | 'warning' | 'destructive';
}) {
  const toneClasses = {
    muted: 'bg-muted/50 text-foreground hover:bg-muted/70',
    info: 'bg-info/10 text-info hover:bg-info/20',
    success: 'bg-success/10 text-success hover:bg-success/20',
    warning: 'bg-warning/10 text-warning hover:bg-warning/20',
    destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  };
  return (
    <div className={cn('p-4 rounded-xl text-center transition-colors', toneClasses[tone])}>
      <p className="text-xs mb-2 font-medium opacity-90">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

function BalanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm pb-3 border-b border-border last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}

function CashRequestTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'info' | 'warning' | 'success' | 'destructive';
}) {
  const toneClasses = {
    info: 'bg-info/10 text-info hover:bg-info/20',
    warning: 'bg-warning/10 text-warning hover:bg-warning/20',
    success: 'bg-success/10 text-success hover:bg-success/20',
    destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  };
  return (
    <div className={cn('p-3 rounded-xl text-center text-xs transition-colors', toneClasses[tone])}>
      <p className="font-semibold text-lg">{value}</p>
      <p className="font-medium">{label}</p>
    </div>
  );
}

export default function ExecutiveDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <ExecutiveDashboardContent />
    </Suspense>
  );
}
