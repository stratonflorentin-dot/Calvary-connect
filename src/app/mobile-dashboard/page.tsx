'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Menu, Sparkles, Truck, DollarSign, ClipboardList, AlertTriangle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/hooks/use-dashboard';
import { useCurrency } from '@/hooks/use-currency';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { hydrateTrips } from '@/lib/trips/hydrate';

const quickActions = [
    { label: 'New Trip', icon: MapPin, color: 'bg-primary/15 text-primary' },
    { label: 'Fuel Log', icon: Truck, color: 'bg-warning/15 text-warning' },
    { label: 'Maintenance', icon: AlertTriangle, color: 'bg-destructive/15 text-destructive' },
    { label: 'Invoice', icon: DollarSign, color: 'bg-accent/15 text-accent-foreground' },
    { label: 'Reports', icon: ClipboardList, color: 'bg-muted/15 text-muted-foreground' },
    { label: 'AI Chat', icon: Sparkles, color: 'bg-info/15 text-info' },
];

const VEHICLE_STATUS_STYLE: Record<string, { color: string; label: string }> = {
    available: { color: 'bg-success', label: 'Available' },
    in_use: { color: 'bg-primary', label: 'In Use' },
    maintenance: { color: 'bg-warning', label: 'Maintenance' },
    repair: { color: 'bg-destructive', label: 'Repair' },
};

interface LiveVehicle {
    id: string;
    plate_number: string;
    status: string;
    driver_name?: string | null;
}

interface TopShipment {
    id: string;
    trip_number?: string;
    origin?: string;
    destination?: string;
    status: string;
    driver_name?: string | null;
    vehicle_plate?: string | null;
}

interface MaintenanceItem {
    id: string;
    record_number: string;
    priority: string;
    vehicle_plate?: string | null;
}

export default function MobileDashboardPage() {
    const { stats, loading } = useDashboard();
    const { format } = useCurrency();
    const { user } = useSupabase();

    const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
    const [topShipments, setTopShipments] = useState<TopShipment[]>([]);
    const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        (async () => {
            const [vehiclesRes, tripsRes, maintenanceRes] = await Promise.all([
                supabase.from('vehicles').select('id, plate_number, status, current_driver_id').limit(6),
                supabase.from('trips').select('*').in('status', ['in_transit', 'loading']).order('created_at', { ascending: false }).limit(3),
                supabase
                    .from('maintenance_records')
                    .select('id, record_number, priority, vehicle_id, vehicles(plate_number)')
                    .in('status', ['requested', 'scheduled', 'in_progress'])
                    .order('created_at', { ascending: false })
                    .limit(3),
            ]);

            const driverIds = Array.from(new Set((vehiclesRes.data ?? []).map((v: any) => v.current_driver_id).filter(Boolean)));
            const { data: drivers } = driverIds.length > 0
                ? await supabase.from('user_profiles').select('id, name').in('id', driverIds)
                : { data: [] as any[] };
            const driverNameById = new Map((drivers ?? []).map((d: any) => [d.id, d.name]));
            setLiveVehicles(
                (vehiclesRes.data ?? []).map((v: any) => ({
                    id: v.id,
                    plate_number: v.plate_number,
                    status: v.status,
                    driver_name: v.current_driver_id ? driverNameById.get(v.current_driver_id) ?? null : null,
                })),
            );

            const hydrated = tripsRes.data ? await hydrateTrips(tripsRes.data) : [];
            setTopShipments(
                hydrated.map((t: any) => ({
                    id: t.id,
                    trip_number: t.trip_number,
                    origin: t.origin,
                    destination: t.destination,
                    status: t.status,
                    driver_name: t.driver_name,
                    vehicle_plate: t.vehicle_plate,
                })),
            );

            setMaintenanceItems(
                (maintenanceRes.data ?? []).map((m: any) => ({
                    id: m.id,
                    record_number: m.record_number,
                    priority: m.priority,
                    vehicle_plate: m.vehicles?.plate_number ?? null,
                })),
            );

            if (user?.id) {
                const { count } = await supabase
                    .from('notifications')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('read', false);
                setUnreadCount(count ?? 0);
            }
        })();
    }, [user?.id]);

    const activeShipmentsCount = loading ? 0 : stats.activeShipments ?? 0;
    const revenueValue = loading ? 0 : stats.revenueMtd ?? 0;
    const vehiclesActive = loading ? '—' : `${stats.availableVehicles}/${stats.totalVehicles}`;
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
                            {unreadCount > 0 && (
                                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-200">CC</div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-4 space-y-4">
                <Card className="overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary via-primary/80 to-violet-500 p-5 text-primary-foreground shadow-2xl">
                    <div className="relative overflow-hidden rounded-[2rem] bg-slate-950/10 p-5">
                        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
                        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
                        <div className="relative space-y-4">
                            <p className="text-sm text-primary-foreground/80">Good morning ☀️</p>
                            <h2 className="text-3xl font-bold tracking-tight">{user?.name?.split(' ')[0] ?? 'there'}</h2>
                            <p className="text-sm text-primary-foreground/90">{liveLabel}</p>
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
                        <Button variant="ghost" className="text-slate-300" asChild>
                            <Link href="/fleet">See All</Link>
                        </Button>
                    </div>
                    {liveVehicles.length === 0 ? (
                        <p className="text-sm text-slate-500 px-1">No vehicles yet.</p>
                    ) : (
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                            {liveVehicles.map(vehicle => {
                                const meta = VEHICLE_STATUS_STYLE[vehicle.status] ?? { color: 'bg-muted', label: vehicle.status };
                                return (
                                    <div key={vehicle.id} className="min-w-[220px] rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm shadow-slate-950/20">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{vehicle.plate_number}</p>
                                            </div>
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-slate-100 ${meta.color}`}>{meta.label}</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
                                            <Truck className="h-4 w-4 text-primary" />
                                            <span>{vehicle.driver_name ?? 'Unassigned'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Active Shipments</p>
                            <h3 className="text-lg font-semibold text-white">{liveLabel}</h3>
                        </div>
                        <Badge className="bg-primary text-primary-foreground">{activeShipmentsCount}</Badge>
                    </div>
                    {topShipments.length === 0 ? (
                        <p className="text-sm text-slate-500 px-1">No shipments in transit right now.</p>
                    ) : (
                        <div className="space-y-3">
                            {topShipments.map(shipment => (
                                <Card key={shipment.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm shadow-slate-950/20">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{shipment.trip_number ?? shipment.id.slice(0, 8)}</p>
                                            <p className="mt-1 text-xs text-slate-400">{shipment.origin} → {shipment.destination}</p>
                                        </div>
                                        <span className="rounded-2xl bg-slate-800 px-3 py-1 text-xs text-slate-300 capitalize">{shipment.status.replace('_', ' ')}</span>
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl bg-slate-950/70 p-3 text-xs text-slate-400">
                                            <p className="font-semibold text-slate-100">Driver</p>
                                            <p className="mt-1">{shipment.driver_name ?? 'Unassigned'}</p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-950/70 p-3 text-xs text-slate-400">
                                            <p className="font-semibold text-slate-100">Vehicle</p>
                                            <p className="mt-1">{shipment.vehicle_plate ?? 'Unassigned'}</p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {maintenanceItems.length > 0 && (
                    <Card className="rounded-[2rem] border border-warning/30 bg-warning/10 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-warning">⚠ Maintenance Pending</p>
                                <p className="mt-2 text-base text-slate-100">{maintenanceItems.length} maintenance record{maintenanceItems.length === 1 ? '' : 's'} need review</p>
                                <p className="mt-2 text-sm text-slate-400">Post-trip inspections awaiting approval for your fleet.</p>
                            </div>
                            <Badge className="bg-warning text-warning-foreground">{maintenanceItems.length} Records</Badge>
                        </div>
                        <div className="mt-4 space-y-3">
                            {maintenanceItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between rounded-3xl border border-warning/20 bg-warning/5 p-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">{item.record_number}</p>
                                        <p className="text-xs text-slate-400">{item.vehicle_plate ?? 'Unassigned'}</p>
                                    </div>
                                    <span className="rounded-full bg-muted/70 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-warning">{item.priority}</span>
                                </div>
                            ))}
                        </div>
                        <Button size="sm" className="mt-4 w-full bg-warning text-warning-foreground hover:bg-warning/90" asChild>
                            <Link href="/maintenance">Review Now</Link>
                        </Button>
                    </Card>
                )}

                <Card className="rounded-[2rem] border border-border bg-gradient-to-r from-primary/80 via-primary to-violet-500 p-5 shadow-2xl">
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
                    <Button className="mt-4 w-full bg-white/10 text-white hover:bg-white/15" asChild>
                        <Link href="/ai-assistant">Open AI Console →</Link>
                    </Button>
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
