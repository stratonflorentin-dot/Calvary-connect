'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, Zap, FileText, Wallet, TrendingDown, Grid, Truck, Users, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatMiniCard } from '@/components/ui/stat-mini-card';
import { GradientCard } from '@/components/ui/gradient-card';
import { useDashboard } from '@/hooks/use-dashboard';
import { useCurrency } from '@/hooks/use-currency';
import { useSupabase } from '@/components/supabase-provider';

export default function ExecutiveDashboard() {
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
        <div className="p-6 space-y-6">
            {/* PAGE HEADER */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Welcome back, {user?.user_metadata?.full_name || 'User'}!</h1>
                    <p className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString('en-TZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {pendingCashRequestsCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg animate-pulse">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700">
                            {pendingCashRequestsCount} pending cash requests
                        </span>
                        <Button size="sm" variant="ghost" className="ml-2">→</Button>
                    </div>
                )}
            </div>

            {/* FILTER BAR */}
            <Card className="p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-48">
                        <label className="text-sm font-semibold mb-2 block">Period</label>
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

                    <div className="flex-1 min-w-48">
                        <label className="text-sm font-semibold mb-2 block">Dashboard Mode</label>
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

                    <Button className="bg-sky-700 hover:bg-sky-800 text-white">Apply</Button>
                </div>

                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex justify-between">
                    <span>Mode: {mode.toUpperCase()} • Analytics cache: 90s</span>
                    <span>Last refreshed: {lastRefreshed.toLocaleTimeString('en-TZ')}</span>
                </div>
            </Card>

            {/* STAT CARDS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <StatMiniCard
                    title="Active Shipments"
                    value={stats.activeShipments}
                    icon={<Zap className="w-4 h-4 text-yellow-500" />}
                    iconBg="bg-gray-100"
                    valueColor="text-foreground"
                    href="/shipments?status=active"
                />
                <StatMiniCard
                    title="Revenue MTD"
                    value={format(stats.revenueMtd)}
                    icon={<DollarSign className="w-4 h-4 text-green-500" />}
                    iconBg="bg-gray-100"
                    valueColor="text-foreground"
                />
                <StatMiniCard
                    title="Outstanding"
                    value={format(stats.outstanding)}
                    icon={<FileText className="w-4 h-4 text-amber-500" />}
                    iconBg="bg-gray-100"
                    valueColor="text-foreground"
                    href="/accounting/invoices?status=sent"
                />
                <StatMiniCard
                    title="AR Balance"
                    value={format(stats.arBalance)}
                    icon={<Wallet className="w-4 h-4 text-blue-500" />}
                    iconBg="bg-gray-100"
                    valueColor="text-foreground"
                    href="/accounting/reports/ar-ledger"
                />
                <StatMiniCard
                    title="Expenses MTD"
                    value={format(stats.expensesMtd)}
                    icon={<TrendingDown className="w-4 h-4 text-red-500" />}
                    iconBg="bg-gray-100"
                    valueColor="text-foreground"
                    href="/accounting/expenses"
                />
                <StatMiniCard
                    title="Available Vehicles"
                    value={`${stats.availableVehicles}/${stats.totalVehicles}`}
                    icon={<Grid className="w-4 h-4 text-purple-500" />}
                    iconBg="bg-gray-100"
                    valueColor="text-foreground"
                    href="/fleet/vehicles"
                />
            </div>

            {/* FLEET STATUS BAR */}
            <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-purple-600" />
                    Fleet Status
                </h3>
                <div className="flex h-8 bg-muted rounded-full overflow-hidden mb-3">
                    <div
                        className="bg-teal-500"
                        style={{ width: `${(fleetStatus.inTransit / stats.totalVehicles) * 100}%` }}
                    ></div>
                    <div
                        className="bg-green-500"
                        style={{ width: `${(fleetStatus.available / stats.totalVehicles) * 100}%` }}
                    ></div>
                    <div
                        className="bg-amber-500"
                        style={{ width: `${(fleetStatus.maintenance / stats.totalVehicles) * 100}%` }}
                    ></div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                        <span>In Transit: {fleetStatus.inTransit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>Available: {fleetStatus.available}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        <span>Maintenance: {fleetStatus.maintenance}</span>
                    </div>
                </div>
            </Card>

            {/* SHIPMENT OPERATIONAL FINANCE */}
            <GradientCard
                title="Shipment Operational Finance"
                icon={<Truck className="w-5 h-5 text-white" />}
                iconBg="bg-green-600"
                headerGradient="bg-gradient-to-r from-green-500 to-green-600"
            >
                <div className="grid grid-cols-5 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-600 mb-1">Requested</p>
                        <p className="text-sm font-bold text-slate-700">{format(shipmentFinance.requested)}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-blue-600 mb-1">Committed</p>
                        <p className="text-sm font-bold text-blue-700">{format(shipmentFinance.committed)}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-emerald-600 mb-1">Actual</p>
                        <p className="text-sm font-bold text-emerald-700">{format(shipmentFinance.actual)}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-red-600 mb-1">Critical Var.</p>
                        <p className="text-sm font-bold text-red-700">{shipmentFinance.criticalVariance}</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-amber-600 mb-1">Warn Var.</p>
                        <p className="text-sm font-bold text-amber-700">{shipmentFinance.warningVariance}</p>
                    </div>
                </div>
            </GradientCard>

            {/* 2-COLUMN CHARTS */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Revenue Trend */}
                <GradientCard
                    title="Revenue Trend"
                    icon={<TrendingDown className="w-5 h-5 text-white" />}
                    iconBg="bg-green-600"
                    headerGradient="bg-gradient-to-r from-green-400 to-green-500"
                >
                    <div className="space-y-4">
                        <div className="flex items-end justify-end gap-1 h-32">
                            {revenueTrend.map((month, idx) => {
                                const maxRevenue = Math.max(...revenueTrend.map(m => m.revenue));
                                const height = maxRevenue > 0 ? (month.revenue / maxRevenue) * 128 : 0;
                                return (
                                    <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                                        <div
                                            className="w-full bg-gradient-to-t from-green-400 to-green-500 rounded-t-md transition-all"
                                            style={{ height: `${height}px` }}
                                        ></div>
                                        <span className="text-xs text-muted-foreground">{month.month}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-center border-t pt-3">
                            <p className="text-sm text-muted-foreground">Average/Month:</p>
                            <p className="text-lg font-bold">
                                TZS {Math.round(revenueTrend.reduce((sum, m) => sum + m.revenue, 0) / revenueTrend.length).toLocaleString('en-TZ')}
                            </p>
                        </div>
                    </div>
                </GradientCard>

                {/* Trip Performance */}
                <GradientCard
                    title="Trip Performance"
                    icon={<Truck className="w-5 h-5 text-white" />}
                    iconBg="bg-blue-600"
                    headerGradient="bg-gradient-to-r from-blue-500 to-blue-600"
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-blue-50 p-3 rounded-lg text-center">
                                <p className="text-xs text-blue-600 mb-1">In Transit</p>
                                <p className="text-sm font-bold text-blue-700">{tripPerformance.inTransit}</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg text-center">
                                <p className="text-xs text-green-600 mb-1">Completed</p>
                                <p className="text-sm font-bold text-green-700">{tripPerformance.completed}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg text-center">
                                <p className="text-xs text-gray-600 mb-1">Total</p>
                                <p className="text-sm font-bold text-gray-700">{tripPerformance.total}</p>
                            </div>
                        </div>
                        <div className="border-t pt-3">
                            <p className="text-sm text-muted-foreground mb-2">Completion Rate</p>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all"
                                    style={{ width: `${tripPerformance.completionRate}%` }}
                                ></div>
                            </div>
                            <p className="text-sm font-bold mt-2">{tripPerformance.completionRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </GradientCard>
            </div>

            {/* BOTTOM 3-COLUMN GRID */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN (span 2) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Shipments Needing Action */}
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4">Shipments Needing Action</h3>
                        {actionableShipments.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">No shipments needing action</p>
                        ) : (
                            <div className="space-y-2">
                                {actionableShipments.slice(0, 5).map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Badge variant="outline">{s.status}</Badge>
                                            <span className="text-sm font-semibold">{s.shipment_number}</span>
                                            <span className="text-xs text-muted-foreground">{s.client_name}</span>
                                        </div>
                                        <Button size="sm" variant="ghost">View →</Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Recent Invoices */}
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4">Recent Invoices</h3>
                        {recentInvoices.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">No recent invoices</p>
                        ) : (
                            <div className="space-y-2">
                                {recentInvoices.slice(0, 5).map(inv => (
                                    <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-3 flex-1">
                                            <div>
                                                <p className="text-sm font-semibold">{inv.invoice_number}</p>
                                                <p className="text-xs text-muted-foreground">{inv.customer_name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className="mb-1">{inv.status}</Badge>
                                            <p className="text-sm font-bold">{format(inv.amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Quick Actions & Account Balances */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Quick Actions */}
                        <Card className="p-4">
                            <h3 className="font-semibold mb-4">Quick Actions</h3>
                            <div className="space-y-2">
                                <Button className="w-full bg-sky-700 hover:bg-sky-800 text-white justify-start">
                                    + New Quotation
                                </Button>
                                <Button variant="outline" className="w-full justify-start">
                                    View Invoices
                                </Button>
                                <Button variant="outline" className="w-full justify-start">
                                    Record Expense
                                </Button>
                                <Button variant="outline" className="w-full justify-start">
                                    + Add Client
                                </Button>
                                <Button variant="outline" className="w-full justify-start">
                                    Request Cash
                                </Button>
                            </div>
                        </Card>

                        {/* Account Balances */}
                        <Card className="p-4">
                            <h3 className="font-semibold mb-4">Account Balances</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm pb-2 border-b">
                                    <span>Bank Account (TZS)</span>
                                    <span className="font-bold">TZS 50,000,000</span>
                                </div>
                                <div className="flex justify-between text-sm pb-2 border-b">
                                    <span>Petty Cash</span>
                                    <span className="font-bold">TZS 500,000</span>
                                </div>
                                <div className="flex justify-between text-sm pb-2 border-b">
                                    <span>USD Account</span>
                                    <span className="font-bold">USD 10,000</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold pt-2 border-t">
                                    <span>Total TZS</span>
                                    <span>TZS 50,500,000</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Documents Expiring */}
                    <Card className="p-4 border-red-500 border">
                        <h3 className="font-semibold text-red-600 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Documents Expiring ({expiringDocs.length})
                        </h3>
                        {expiringDocs.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">All documents are valid</p>
                        ) : (
                            <div className="space-y-2">
                                {expiringDocs.slice(0, 8).map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Badge variant="outline" className="bg-purple-50">{doc.vehicle_code}</Badge>
                                            <span className="text-sm">{doc.doc_type}</span>
                                        </div>
                                        <div className="text-right">
                                            <DocumentStatusBadge status={doc.status as any} expiryDate={doc.expiry_date} />
                                            <p className="text-xs text-muted-foreground mt-1">{doc.expiry_date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* Action Center */}
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4">Action Center</h3>
                        {actionCenter.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">All clear!</p>
                        ) : (
                            <div className="space-y-2">
                                {actionCenter.map(item => (
                                    <div key={item.id} className="border rounded-lg p-3">
                                        <div className="flex items-start gap-3 mb-2">
                                            <Badge
                                                variant={item.severity === 'CRITICAL' ? 'destructive' : 'secondary'}
                                                className={item.severity === 'CRITICAL' ? 'bg-red-600' : 'bg-amber-600'}
                                            >
                                                {item.severity}
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-semibold">{item.title}</p>
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                        <Button size="sm" variant="ghost" className="mt-2">
                                            Open →
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* My Cash Requests */}
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4">My Cash Requests</h3>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-blue-50 p-2 rounded-lg text-center text-xs">
                                <p className="text-blue-600 font-semibold">0</p>
                                <p className="text-blue-600">Draft</p>
                            </div>
                            <div className="bg-amber-50 p-2 rounded-lg text-center text-xs">
                                <p className="text-amber-600 font-semibold">0</p>
                                <p className="text-amber-600">Pending</p>
                            </div>
                            <div className="bg-green-50 p-2 rounded-lg text-center text-xs">
                                <p className="text-green-600 font-semibold">0</p>
                                <p className="text-green-600">Retired</p>
                            </div>
                            <div className="bg-red-50 p-2 rounded-lg text-center text-xs">
                                <p className="text-red-600 font-semibold">0</p>
                                <p className="text-red-600">Overdue</p>
                            </div>
                        </div>
                        <Button size="sm" variant="outline" className="w-full">
                            View All →
                        </Button>
                    </Card>

                    {/* Top Clients */}
                    <GradientCard
                        title="Top Clients"
                        subtitle="Month To Date"
                        icon={<Users className="w-5 h-5 text-white" />}
                        iconBg="bg-purple-600"
                        headerGradient="bg-gradient-to-r from-purple-500 to-purple-600"
                    >
                        <div className="space-y-3">
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
                                    <div key={client.rank} className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-xs font-bold">
                                            {client.rank}
                                        </div>
                                        <span className="text-sm font-semibold flex-1">{client.name}</span>
                                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                            <div className="bg-purple-500 h-full" style={{ width: `${width}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold">{format(client.revenue)}</span>
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

// Import DocumentStatusBadge
import { DocumentStatusBadge } from '@/components/ui/document-status-badge';
