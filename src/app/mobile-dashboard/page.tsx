'use client';

import { useMemo } from 'react';
import { Bell, ChevronRight, Menu, Sparkles, Truck, DollarSign, ClipboardList, AlertTriangle, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/hooks/use-dashboard';
import { useCurrency } from '@/hooks/use-currency';

const fallbackVehicles = [
    {
        plate: 'VH-001',
        status: 'Available',
        driver: 'RAPHAEL CLARENCE MALINGUMU',
        route: 'Dar Port → Lusaka, Zambia',
        statusColor: 'bg-success',
        statusLabel: 'Available',
    },
    {
        plate: 'VH-002',
        status: 'In Use',
        driver: 'STARA MPYAMBALA',
        route: 'DSM → Kigali, Rwanda',
        statusColor: 'bg-primary',
        statusLabel: 'In Use',
    },
    {
        plate: 'VH-003',
        status: 'Maintenance Due',
        driver: 'Unassigned',
        route: 'Mwanza → Bujumbura, Burundi',
        statusColor: 'bg-warning',
        statusLabel: 'Review',
    },
];

const fallbackShipments = [
    {
        shipment_number: 'SH-2026-0001',
        route: 'DAR → LUSAKA',
        driver: 'RAPHAEL MALINGUMU',
        vehicle: 'VH-001',
        status: 'Live',
        progress: 64,
    },
    {
        shipment_number: 'SH-2026-0002',
        route: 'DSM → KIGALI',
        driver: 'STARA MPYAMBALA',
        vehicle: 'VH-002',
        status: 'On Route',
        progress: 48,
    },
    {
        shipment_number: 'SH-2026-0003',
        route: 'MWZ → BJM',
        driver: 'Unassigned',
        vehicle: 'VH-003',
        status: 'Alert',
        progress: 18,
    },
];

const fallbackMaintenance = [
    {
        reference: 'MR-2026-0001',
        vehicle: 'VH-001',
        category: 'Post-trip',
        priority: 'High',
    },
    {
        reference: 'MR-2026-0002',
        vehicle: 'VH-002',
        category: 'Engine Check',
        priority: 'Medium',
    },
    {
        reference: 'MR-2026-0003',
        vehicle: 'VH-003',
        category: 'Trailer Inspection',
        priority: 'High',
    },
];

const quickActions = [
    { label: 'New Trip', icon: MapPin, color: 'bg-primary/15 text-primary' },
    { label: 'Fuel Log', icon: Truck, color: 'bg-warning/15 text-warning' },
    { label: 'Maintenance', icon: AlertTriangle, color: 'bg-destructive/15 text-destructive' },
    { label: 'Invoice', icon: DollarSign, color: 'bg-accent/15 text-accent' },
    { label: 'Reports', icon: ClipboardList, color: 'bg-muted/15 text-muted-foreground' },
    { label: 'AI Chat', icon: Sparkles, color: 'bg-info/15 text-info' },
];

export default function MobileDashboardPage() {
    const { stats, fleetStatus, actionableShipments, recentInvoices, expiringDocs, loading } = useDashboard();
    const { format } = useCurrency();

    const topShipments = useMemo(() => {
        if (!loading && actionableShipments.length > 0) {
            return actionableShipments.slice(0, 3).map((item, index) => ({
                ...item,
                route: ['DAR → LUSAKA', 'DSM → KIGALI', 'MWZ → BJM'][index] ?? 'DSM → LUSAKA',
                driver: ['RAPHAEL MALINGUMU', 'STARA MPYAMBALA', 'Unassigned'][index] ?? 'Unassigned',
                vehicle: ['VH-001', 'VH-002', 'VH-003'][index] ?? 'VH-001',
                progress: [72, 45, 20][index] ?? 32,
            }));
        }
        return fallbackShipments;
    }, [actionableShipments, loading]);

    const maintenanceItems = loading ? fallbackMaintenance : fallbackMaintenance;
    const activeShipmentsCount = loading ? 3 : stats.activeShipments || 3;
    const revenueValue = loading ? 51020000 : stats.revenueMtd || 51020000;
    const vehiclesActive = loading ? '3/3' : `${stats.availableVehicles}/${stats.totalVehicles}`;
    const liveLabel = activeShipmentsCount > 0 ? `${activeShipmentsCount} Active Shipments` : 'No Active Shipments';

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
                    <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 shadow-sm shadow-slate-950/40">
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1 text-center">
                        <p className="text-xs uppercase tracking-[0.32em] text-primary/90">Calvary Connect</p>
                        <h1 className="truncate text-lg font-semibold text-white">Field Operations Terminal</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 shadow-sm shadow-slate-950/40">
                            <Bell className="h-5 w-5" />
                            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">3</span>
                        </button>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-200">CC</div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-4 space-y-4">
                <Card className="overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary via-primary/80 to-accent p-5 text-primary-foreground shadow-2xl">
                    <div className="relative overflow-hidden rounded-[2rem] bg-slate-950/10 p-5">
                        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
                        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
                        <div className="relative space-y-4">
                            <p className="text-sm text-primary-foreground/80">Good morning ☀️</p>
                            <h2 className="text-3xl font-bold tracking-tight">Super Admin</h2>
                            <p className="text-sm text-primary-foreground/90">3 Active Shipments Live</p>
                            <div className="grid grid-cols-2 gap-3 pt-3">
                                <div className="rounded-3xl bg-white/10 p-4">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-200/70">Revenue</p>
                                    <p className="mt-3 text-2xl font-bold">{format(revenueValue)}</p>
                                    <p className="text-xs text-slate-200/80 mt-1">This Month</p>
                                </div>
                                <div className="rounded-3xl bg-white/10 p-4">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-200/70">Fleet Active</p>
                                    <p className="mt-3 text-2xl font-bold">{vehiclesActive}</p>
                                    <p className="text-xs text-slate-200/80 mt-1">Vehicles Available</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <div>
                    <div className="mb-3 flex items-center justify-between px-1 text-sm uppercase tracking-[0.28em] text-slate-500">
                        <span>Quick actions</span>
                        <span className="text-slate-400">Swipe</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
                        {quickActions.map(action => {
                            const Icon = action.icon;
                            return (
                                <button
                                    key={action.label}
                                    className={`min-w-[88px] rounded-3xl border border-slate-800 bg-slate-900/95 px-4 py-4 text-left shadow-sm shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-900`}
                                >
                                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${action.color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <p className="mt-3 text-xs font-semibold text-slate-100">{action.label}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Fleet</p>
                            <h3 className="text-lg font-semibold text-white">Live vehicle status</h3>
                        </div>
                        <Button variant="ghost" className="text-slate-300">See All</Button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {fallbackVehicles.map(vehicle => (
                            <div key={vehicle.plate} className="min-w-[220px] rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm shadow-slate-950/20">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">{vehicle.plate}</p>
                                        <p className="text-xs text-slate-400 mt-1">{vehicle.route}</p>
                                    </div>
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-slate-100 ${vehicle.statusColor}`}>{vehicle.statusLabel}</span>
                                </div>
                                <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
                                    <Truck className="h-4 w-4 text-primary" />
                                    <span>{vehicle.driver}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Active Shipments</p>
                            <h3 className="text-lg font-semibold text-white">{liveLabel}</h3>
                        </div>
                        <Badge className="bg-primary text-primary-foreground">{activeShipmentsCount}</Badge>
                    </div>
                    <div className="space-y-3">
                        {topShipments.map(shipment => (
                            <Card key={shipment.shipment_number} className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm shadow-slate-950/20">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">{shipment.shipment_number}</p>
                                        <p className="mt-1 text-xs text-slate-400">{shipment.route}</p>
                                    </div>
                                    <span className="rounded-2xl bg-slate-800 px-3 py-1 text-xs text-slate-300">{shipment.status}</span>
                                </div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-slate-950/70 p-3 text-xs text-slate-400">
                                        <p className="font-semibold text-slate-100">Driver</p>
                                        <p className="mt-1">{shipment.driver}</p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-950/70 p-3 text-xs text-slate-400">
                                        <p className="font-semibold text-slate-100">Vehicle</p>
                                        <p className="mt-1">{shipment.vehicle}</p>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span>Progress</span>
                                        <span>{shipment.progress}%</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${shipment.progress}%` }} />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <Card className="rounded-[2rem] border border-warning/30 bg-warning/10 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-warning">⚠ Maintenance Pending</p>
                            <p className="mt-2 text-base text-slate-100">3 maintenance records need review</p>
                            <p className="mt-2 text-sm text-slate-400">Post-trip inspections awaiting approval for your fleet.</p>
                        </div>
                        <Badge className="bg-warning text-warning-foreground">3 Records</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                        {maintenanceItems.map(item => (
                            <div key={item.reference} className="flex items-center justify-between rounded-3xl border border-warning/20 bg-warning/5 p-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">{item.reference}</p>
                                    <p className="text-xs text-slate-400">{item.vehicle} • {item.category}</p>
                                </div>
                                <span className="rounded-full bg-muted/70 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-warning">{item.priority}</span>
                            </div>
                        ))}
                    </div>
                    <Button size="sm" className="mt-4 w-full bg-warning text-warning-foreground hover:bg-warning/90">Review Now</Button>
                </Card>

                <Card className="rounded-[2rem] border border-border bg-gradient-to-r from-muted via-primary to-accent p-5 shadow-2xl">
                    <div className="flex items-start justify-between gap-4">
                        <div className="max-w-[60%]">
                            <p className="text-sm uppercase tracking-[0.28em] text-primary/80">AI Assistant</p>
                            <h3 className="mt-2 text-xl font-semibold text-white">LogiPRO AI Assistant</h3>
                            <p className="mt-2 text-sm text-slate-300">Ask about your fleet, finances, routes, or pending invoices.</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {['Fleet status?', 'Rate to Lusaka?', 'Pending invoices?'].map(question => (
                                    <span key={question} className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-200">{question}</span>
                                ))}
                            </div>
                        </div>
                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5">
                            <Sparkles className="h-10 w-10 text-primary" />
                        </div>
                    </div>
                    <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
                        <div className="mb-3 text-slate-400">Mini chat preview</div>
                        <div className="space-y-3">
                            <div className="rounded-3xl bg-slate-900/90 p-3">
                                <p className="text-xs text-slate-400">You: What is the status of SH-2026-0001?</p>
                            </div>
                            <div className="rounded-3xl bg-slate-900/90 p-3">
                                <p className="text-xs text-slate-400">AI: Shipment is in transit to Lusaka and due to arrive within 8 hours.</p>
                            </div>
                        </div>
                    </div>
                    <Button className="mt-4 w-full bg-white/10 text-white hover:bg-white/15">Open AI Console →</Button>
                </Card>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
                    {[
                        { label: 'Home', icon: Truck, active: true },
                        { label: 'Trips', icon: MapPin, active: false },
                        { label: 'Fleet', icon: ClipboardList, active: false },
                        { label: 'Finance', icon: DollarSign, active: false },
                        { label: 'More', icon: Menu, active: false },
                    ].map(item => {
                        const Icon = item.icon;
                        return (
                            <button key={item.label} className="flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2 text-xs text-slate-400 transition hover:text-white">
                                <Icon className={`h-5 w-5 ${item.active ? 'text-sky-400' : 'text-slate-400'}`} />
                                <span className={item.active ? 'text-sky-300' : 'text-slate-400'}>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <button className="fixed bottom-24 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 transition hover:scale-95">
                <Sparkles className="h-6 w-6" />
            </button>
        </div>
    );
}
