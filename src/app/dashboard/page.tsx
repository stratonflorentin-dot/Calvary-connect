'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, Zap, FileText, Wallet, TrendingDown, Grid, Truck, Users, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatMiniCard } from '@/components/ui/stat-mini-card';
import { GradientCard } from '@/components/ui/gradient-card';
import { DocumentStatusBadge } from '@/components/ui/document-status-badge';
import { useDashboard } from '@/hooks/use-dashboard';
import { useCurrency } from '@/hooks/use-currency';
import { useSupabase } from '@/components/supabase-provider';

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
        lastRefreshed,
        loading,
    } = useDashboard(range, mode);

    const handleFilterChange = (newRange: string, newMode: string) => {
        const params = new URLSearchParams();
        params.set('range', newRange);
        params.set('mode', newMode);
        router.push(`/dashboard?${params.toString()}`);
    };

    return (
        <div className="p-8 space-y-8">
            {/* PAGE HEADER */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-4xl font-bold text-foreground">Welcome back, {user?.user_metadata?.full_name || 'User'}!</h1>
                    <p className="text-base text-muted-foreground mt-2">
                        {new Date().toLocaleDateString('en-TZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {pendingCashRequestsCount > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl animate-pulse hover:bg-warning/20 transition-colors">
                        <AlertTriangle className="w-5 h-5 text-warning" />
                        <span className="text-sm font-semibold text-warning">
                            {pendingCashRequestsCount} pending cash requests
                        </span>
                        <Button size="sm" variant="ghost" className="ml-2 text-warning hover:text-warning-foreground">→</Button>
                    </div>
                )}
            </div>

            {/* FILTER BAR */}
            <Card className="p-6 shadow-lg">
                <div className="flex flex-wrap items-end gap-6">
                    <div className="flex-1 min-w-56">
                        <label className="text-sm font-semibold mb-2 block text-foreground">Period</label>
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

                    <div className="flex-1 min-w-56">
                        <label className="text-sm font-semibold mb-2 block text-foreground">Dashboard Mode</label>
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

                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-6 shadow-md hover:shadow-lg transition-shadow">Apply</Button>
                </div>

                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground flex justify-between">
                    <span>Mode: {mode.toUpperCase()} • Analytics cache: 90s</span>
                    <span>Last refreshed: {lastRefreshed.toLocaleTimeString('en-TZ')}</span>
                </div>
            </Card>

            {/* STAT CARDS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <StatMiniCard
                    title="Active Shipments"
                    value={stats.activeShipments}
                    icon={<Zap className="w-4 h-4 text-warning" />}
                    iconBg="bg-muted"
                    valueColor="text-foreground"
                    href="/shipments?status=active"
                />
                <StatMiniCard
                    title="Revenue MTD"
                    value={format(stats.revenueMtd)}
                    icon={<DollarSign className="w-4 h-4 text-success" />}
                    iconBg="bg-muted"
                    valueColor="text-foreground"
                />
                <StatMiniCard
                    title="Outstanding"
                    value={format(stats.outstanding)}
                    icon={<FileText className="w-4 h-4 text-warning" />}
                    iconBg="bg-muted"
                    valueColor="text-foreground"
                    href="/accounting/invoices?status=sent"
                />
                <StatMiniCard
                    title="AR Balance"
                    value={format(stats.arBalance)}
                    icon={<Wallet className="w-4 h-4 text-info" />}
                    iconBg="bg-muted"
                    valueColor="text-foreground"
                    href="/accounting/reports/ar-ledger"
                />
                <StatMiniCard
                    title="Expenses MTD"
                    value={format(stats.expensesMtd)}
                    icon={<TrendingDown className="w-4 h-4 text-destructive" />}
                    iconBg="bg-muted"
                    valueColor="text-foreground"
                    href="/accounting/expenses"
                />
                <StatMiniCard
                    title="Available Vehicles"
                    value={`${stats.availableVehicles}/${stats.totalVehicles}`}
                    icon={<Grid className="w-4 h-4 text-accent" />}
                    iconBg="bg-muted"
                    valueColor="text-foreground"
                    href="/fleet/vehicles"
                />
            </div>

            {/* FLEET STATUS BAR */}
            <Card className="p-6 shadow-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                    <Truck className="w-5 h-5 text-accent" />
                    Fleet Status
                </h3>
                <div className="flex h-10 bg-muted rounded-xl overflow-hidden mb-4 shadow-inner">
                    <div
                        className="bg-info transition-all duration-500"
                        style={{ width: `${(fleetStatus.inTransit / stats.totalVehicles) * 100}%` }}
                    ></div>
                    <div
                        className="bg-success transition-all duration-500"
                        style={{ width: `${(fleetStatus.available / stats.totalVehicles) * 100}%` }}
                    ></div>
                    <div
                        className="bg-warning transition-all duration-500"
                        style={{ width: `${(fleetStatus.maintenance / stats.totalVehicles) * 100}%` }}
                    ></div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-info rounded-lg shadow-sm"></div>
                        <span className="text-foreground font-medium">In Transit: {fleetStatus.inTransit}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-success rounded-lg shadow-sm"></div>
                        <span className="text-foreground font-medium">Available: {fleetStatus.available}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-warning rounded-lg shadow-sm"></div>
                        <span className="text-foreground font-medium">Maintenance: {fleetStatus.maintenance}</span>
                    </div>
                </div>
            </Card>

            {/* SHIPMENT OPERATIONAL FINANCE */}
            <GradientCard
                title="Shipment Operational Finance"
                icon={<Truck className="w-5 h-5 text-white" />}
                iconBg="bg-success"
                headerGradient="bg-gradient-to-r from-success to-success/80"
            >
                <div className="grid grid-cols-5 gap-4">
                    <div className="bg-muted/50 p-4 rounded-xl text-center hover:bg-muted/70 transition-colors">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Requested</p>
                        <p className="text-base font-bold text-foreground">{format(shipmentFinance.requested)}</p>
                    </div>
                    <div className="bg-info/10 p-4 rounded-xl text-center hover:bg-info/20 transition-colors">
                        <p className="text-xs text-info mb-2 font-medium">Committed</p>
                        <p className="text-base font-bold text-info">{format(shipmentFinance.committed)}</p>
                    </div>
                    <div className="bg-success/10 p-4 rounded-xl text-center hover:bg-success/20 transition-colors">
                        <p className="text-xs text-success mb-2 font-medium">Actual</p>
                        <p className="text-base font-bold text-success">{format(shipmentFinance.actual)}</p>
                    </div>
                    <div className="bg-destructive/10 p-4 rounded-xl text-center hover:bg-destructive/20 transition-colors">
                        <p className="text-xs text-destructive mb-2 font-medium">Critical Var.</p>
                        <p className="text-base font-bold text-destructive">{shipmentFinance.criticalVariance}</p>
                    </div>
                    <div className="bg-warning/10 p-4 rounded-xl text-center hover:bg-warning/20 transition-colors">
                        <p className="text-xs text-warning mb-2 font-medium">Warn Var.</p>
                        <p className="text-base font-bold text-warning">{shipmentFinance.warningVariance}</p>
                    </div>
                </div>
            </GradientCard>

            {/* 2-COLUMN CHARTS */}
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Revenue Trend */}
                <GradientCard
                    title="Revenue Trend"
                    icon={<TrendingDown className="w-5 h-5 text-white" />}
                    iconBg="bg-success"
                    headerGradient="bg-gradient-to-r from-success/80 to-success/60"
                >
                    <div className="space-y-6">
                        <div className="flex items-end justify-end gap-2 h-40">
                            {revenueTrend.map((month, idx) => {
                                const maxRevenue = Math.max(...revenueTrend.map(m => m.revenue));
                                const height = maxRevenue > 0 ? (month.revenue / maxRevenue) * 160 : 0;
                                return (
                                    <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                                        <div
                                            className="w-full bg-gradient-to-t from-success/80 to-success/60 rounded-t-lg transition-all hover:from-success hover:to-success/80 cursor-pointer"
                                            style={{ height: `${height}px` }}
                                        ></div>
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

                {/* Trip Performance */}
                <GradientCard
                    title="Trip Performance"
                    icon={<Truck className="w-5 h-5 text-white" />}
                    iconBg="bg-info"
                    headerGradient="bg-gradient-to-r from-info/80 to-info/60"
                >
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-info/10 p-4 rounded-xl text-center hover:bg-info/20 transition-colors">
                                <p className="text-xs text-info mb-2 font-medium">In Transit</p>
                                <p className="text-base font-bold text-info">{tripPerformance.inTransit}</p>
                            </div>
                            <div className="bg-success/10 p-4 rounded-xl text-center hover:bg-success/20 transition-colors">
                                <p className="text-xs text-success mb-2 font-medium">Completed</p>
                                <p className="text-base font-bold text-success">{tripPerformance.completed}</p>
                            </div>
                            <div className="bg-muted/50 p-4 rounded-xl text-center hover:bg-muted/70 transition-colors">
                                <p className="text-xs text-muted-foreground mb-2 font-medium">Total</p>
                                <p className="text-base font-bold text-foreground">{tripPerformance.total}</p>
                            </div>
                        </div>
                        <div className="border-t border-border pt-4">
                            <p className="text-sm text-muted-foreground mb-3">Completion Rate</p>
                            <div className="w-full bg-muted rounded-xl h-3 overflow-hidden shadow-inner">
                                <div
                                    className="bg-gradient-to-r from-success/80 to-success h-full transition-all duration-500"
                                    style={{ width: `${tripPerformance.completionRate}%` }}
                                ></div>
                            </div>
                            <p className="text-lg font-bold mt-3 text-foreground">{tripPerformance.completionRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </GradientCard>
            </div>

            {/* BOTTOM 3-COLUMN GRID */}
            <div className="grid lg:grid-cols-3 gap-8">
                {/* LEFT COLUMN (span 2) */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Shipments Needing Action */}
                    <Card className="p-6 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-foreground">Shipments Needing Action</h3>
                        {actionableShipments.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-8">No shipments needing action</p>
                        ) : (
                            <div className="space-y-3">
                                {actionableShipments.slice(0, 5).map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4 flex-1">
                                            <Badge variant="outline" className="font-medium">{s.status}</Badge>
                                            <span className="text-sm font-semibold text-foreground">{s.shipment_number}</span>
                                            <span className="text-xs text-muted-foreground">{s.client_name}</span>
                                        </div>
                                        <Button size="sm" variant="ghost" className="hover:bg-primary/10 hover:text-primary">View →</Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Recent Invoices */}
                    <Card className="p-6 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-foreground">Recent Invoices</h3>
                        {recentInvoices.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-8">No recent invoices</p>
                        ) : (
                            <div className="space-y-3">
                                {recentInvoices.slice(0, 5).map(inv => (
                                    <div key={inv.id} className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">{inv.invoice_number}</p>
                                                <p className="text-xs text-muted-foreground">{inv.customer_name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className="mb-2 font-medium">{inv.status}</Badge>
                                            <p className="text-sm font-bold text-foreground">{format(inv.amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Quick Actions & Account Balances */}
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Quick Actions */}
                        <Card className="p-6 shadow-lg">
                            <h3 className="text-lg font-semibold mb-4 text-foreground">Quick Actions</h3>
                            <div className="space-y-3">
                                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground justify-start h-11 shadow-md hover:shadow-lg transition-shadow">
                                    + New Quotation
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-11 hover:bg-muted/50">
                                    View Invoices
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-11 hover:bg-muted/50">
                                    Record Expense
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-11 hover:bg-muted/50">
                                    + Add Client
                                </Button>
                                <Button variant="outline" className="w-full justify-start h-11 hover:bg-muted/50">
                                    Request Cash
                                </Button>
                            </div>
                        </Card>

                        {/* Account Balances */}
                        <Card className="p-6 shadow-lg">
                            <h3 className="text-lg font-semibold mb-4 text-foreground">Account Balances</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm pb-3 border-b border-border">
                                    <span className="text-muted-foreground">Bank Account (TZS)</span>
                                    <span className="font-bold text-foreground">TZS 50,000,000</span>
                                </div>
                                <div className="flex justify-between text-sm pb-3 border-b border-border">
                                    <span className="text-muted-foreground">Petty Cash</span>
                                    <span className="font-bold text-foreground">TZS 500,000</span>
                                </div>
                                <div className="flex justify-between text-sm pb-3 border-b border-border">
                                    <span className="text-muted-foreground">USD Account</span>
                                    <span className="font-bold text-foreground">USD 10,000</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold pt-3 border-t border-border">
                                    <span className="text-foreground">Total TZS</span>
                                    <span className="text-foreground">TZS 50,500,000</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Documents Expiring */}
                    <Card className="p-6 border-destructive/50 border shadow-lg">
                        <h3 className="text-lg font-semibold text-destructive mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Documents Expiring ({expiringDocs.length})
                        </h3>
                        {expiringDocs.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-8">All documents are valid</p>
                        ) : (
                            <div className="space-y-3">
                                {expiringDocs.slice(0, 8).map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-destructive/5 transition-colors">
                                        <div className="flex items-center gap-4 flex-1">
                                            <Badge variant="outline" className="bg-accent/10 font-medium">{doc.vehicle_code}</Badge>
                                            <span className="text-sm text-foreground">{doc.doc_type}</span>
                                        </div>
                                        <div className="text-right">
                                            <DocumentStatusBadge status={doc.status as any} expiryDate={doc.expiry_date} />
                                            <p className="text-xs text-muted-foreground mt-2">{doc.expiry_date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-8">
                    {/* Action Center */}
                    <Card className="p-6 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-foreground">Action Center</h3>
                        {actionCenter.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-8">All clear!</p>
                        ) : (
                            <div className="space-y-3">
                                {actionCenter.map(item => (
                                    <div key={item.id} className="border border-border rounded-xl p-4 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-start gap-3 mb-3">
                                            <Badge
                                                variant={item.severity === 'CRITICAL' ? 'destructive' : 'secondary'}
                                                className={item.severity === 'CRITICAL' ? 'bg-destructive' : 'bg-warning'}
                                            >
                                                {item.severity}
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                        <Button size="sm" variant="ghost" className="mt-3 hover:bg-primary/10 hover:text-primary">
                                            Open →
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* My Cash Requests */}
                    <Card className="p-6 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-foreground">My Cash Requests</h3>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-info/10 p-3 rounded-xl text-center text-xs hover:bg-info/20 transition-colors">
                                <p className="text-info font-semibold text-lg">0</p>
                                <p className="text-info font-medium">Draft</p>
                            </div>
                            <div className="bg-warning/10 p-3 rounded-xl text-center text-xs hover:bg-warning/20 transition-colors">
                                <p className="text-warning font-semibold text-lg">0</p>
                                <p className="text-warning font-medium">Pending</p>
                            </div>
                            <div className="bg-success/10 p-3 rounded-xl text-center text-xs hover:bg-success/20 transition-colors">
                                <p className="text-success font-semibold text-lg">0</p>
                                <p className="text-success font-medium">Retired</p>
                            </div>
                            <div className="bg-destructive/10 p-3 rounded-xl text-center text-xs hover:bg-destructive/20 transition-colors">
                                <p className="text-destructive font-semibold text-lg">0</p>
                                <p className="text-destructive font-medium">Overdue</p>
                            </div>
                        </div>
                        <Button size="sm" variant="outline" className="w-full h-11 hover:bg-muted/50">
                            View All →
                        </Button>
                    </Card>

                    {/* Top Clients */}
                    <GradientCard
                        title="Top Clients"
                        subtitle="Month To Date"
                        icon={<Users className="w-5 h-5 text-white" />}
                        iconBg="bg-accent"
                        headerGradient="bg-gradient-to-r from-accent/80 to-accent/60"
                    >
                        <div className="space-y-4">
                            {[
                                { rank: 1, name: 'Client A', revenue: 5000000 },
                                { rank: 2, name: 'Client B', revenue: 3500000 },
                                { rank: 3, name: 'Client C', revenue: 2800000 },
                                { rank: 4, name: 'Client D', revenue: 1200000 },
                                { rank: 5, name: 'Client E', revenue: 800000 },
                            ].map(client => {
                                const maxRevenue = 5000000;
                                const width = (client.revenue / maxRevenue) * 100;
                                return (
                                    <div key={client.rank} className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-xl bg-warning flex items-center justify-center text-xs font-bold text-warning-foreground shadow-sm">
                                            {client.rank}
                                        </div>
                                        <span className="text-sm font-semibold flex-1 text-foreground">{client.name}</span>
                                        <div className="flex-1 bg-muted rounded-xl h-2.5 overflow-hidden shadow-inner">
                                            <div className="bg-accent h-full transition-all duration-500" style={{ width: `${width}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-foreground">{format(client.revenue)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </GradientCard>
                </div>
            </div>
        </div>
    );
}

export default function ExecutiveDashboard() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        }>
            <ExecutiveDashboardContent />
        </Suspense>
    );
}
