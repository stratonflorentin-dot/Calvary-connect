'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Bell,
    ChartPie,
    ChevronRight,
    FileText,
    Gauge,
    Layers,
    MapPin,
    Search,
    ShieldCheck,
    Sparkles,
    Truck,
    UserCircle2,
    Wallet,
    AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableCaption,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/hooks/use-currency';
import { isVehicleAvailable, isVehicleInMaintenance, vehicleStatusBucket } from '@/lib/fleet/vehicle-status';

const navItems = [
    { label: 'Overview', icon: Layers, active: true },
    { label: 'Fleet', icon: Truck },
    { label: 'Routes', icon: MapPin },
    { label: 'Analytics', icon: ChartPie },
    { label: 'Contracts', icon: FileText },
    { label: 'Safety', icon: ShieldCheck },
];

function statusBadge(status: string) {
    const variants: Record<string, string> = {
        active: 'bg-[#E8F3FF] text-[#1976D2] border-[#B1D4FF]',
        available: 'bg-[#E8F3FF] text-[#1976D2] border-[#B1D4FF]',
        idle: 'bg-[#F3F7FB] text-[#6B778C] border-[#DCE2EE]',
        in_use: 'bg-[#E8F6EF] text-[#2E7D32] border-[#B8E0C5]',
        maintenance: 'bg-[#FFF7E8] text-[#F9A825] border-[#F4DEA6]',
        repair: 'bg-[#FDECEA] text-[#D32F2F] border-[#F8C6C3]',
        delayed: 'bg-[#FDECEA] text-[#D32F2F] border-[#F8C6C3]',
        pending: 'bg-[#FFF7E8] text-[#F9A825] border-[#F4DEA6]',
        draft: 'bg-[#F3F7FB] text-[#6B778C] border-[#DCE2EE]',
        expired: 'bg-[#FDECEA] text-[#D32F2F] border-[#F8C6C3]',
    };

    return variants[status?.toLowerCase()] ?? 'bg-[#F3F5F9] text-[#6B778C] border-[#DCE2EE]';
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastNMonths(n: number) {
    const now = new Date();
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
        return { year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()] };
    });
}

interface ContractRow {
    id: string;
    contract_number: string;
    partner: string;
    status: string;
    contract_value: number;
    currency: string;
    end_date: string | null;
}

interface FleetRow {
    id: string;
    plate_number: string;
    status: string;
    driver_name: string | null;
}

function PremiumDashboard() {
    const { format } = useCurrency();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const [vehicleCount, setVehicleCount] = useState(0);
    const [activeVehicleCount, setActiveVehicleCount] = useState(0);
    const [monthRevenue, setMonthRevenue] = useState(0);
    const [monthFuelCost, setMonthFuelCost] = useState(0);
    const [prevMonthFuelCost, setPrevMonthFuelCost] = useState(0);
    const [activeContractCount, setActiveContractCount] = useState(0);
    const [newContractsThisWeek, setNewContractsThisWeek] = useState(0);
    const [routeTrend, setRouteTrend] = useState<{ label: string; value: number }[]>([]);
    const [fuelTrend, setFuelTrend] = useState<{ label: string; value: number }[]>([]);
    const [expenseBreakdown, setExpenseBreakdown] = useState<{ label: string; value: number; color: string }[]>([]);
    const [contracts, setContracts] = useState<ContractRow[]>([]);
    const [fleetRows, setFleetRows] = useState<FleetRow[]>([]);
    const [maintenanceDueCount, setMaintenanceDueCount] = useState(0);
    const [idleVehicleCount, setIdleVehicleCount] = useState(0);
    const [expiringContracts, setExpiringContracts] = useState(0);
    const [overdueInvoices, setOverdueInvoices] = useState(0);
    const [pendingCashRequests, setPendingCashRequests] = useState(0);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const months = lastNMonths(7);
            const rangeStart = new Date(months[0].year, months[0].month, 1).toISOString();
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
            const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
            const today = new Date().toISOString().slice(0, 10);

            const [
                vehiclesRes,
                tripsRes,
                costsRes,
                contractsRes,
                invoicesRes,
                cashRequestsRes,
            ] = await Promise.all([
                supabase.from('vehicles').select('id, plate_number, status, current_driver_id'),
                supabase.from('trips').select('id, revenue, price, created_at').gte('created_at', rangeStart),
                supabase.from('vehicle_costs').select('cost_type, amount, date').gte('date', rangeStart.slice(0, 10)),
                supabase.from('transport_contracts').select('id, contract_number, status, contract_value, currency, end_date, created_at, customers(company_name)').order('created_at', { ascending: false }).limit(6),
                supabase.from('invoices').select('id, status, due_date').lt('due_date', today).neq('status', 'paid'),
                supabase.from('cash_requests').select('id, status').eq('status', 'pending'),
            ]);

            const vehicles = vehiclesRes.data ?? [];
            setVehicleCount(vehicles.length);
            setActiveVehicleCount(vehicles.filter((v: any) => vehicleStatusBucket(v.status) !== 'maintenance').length);
            setMaintenanceDueCount(vehicles.filter((v: any) => isVehicleInMaintenance(v.status)).length);
            setIdleVehicleCount(vehicles.filter((v: any) => isVehicleAvailable(v.status)).length);

            const driverIds = Array.from(new Set(vehicles.map((v: any) => v.current_driver_id).filter(Boolean)));
            const { data: drivers } = driverIds.length > 0
                ? await supabase.from('user_profiles').select('id, name').in('id', driverIds)
                : { data: [] as any[] };
            const driverNameById = new Map((drivers ?? []).map((d: any) => [d.id, d.name]));
            setFleetRows(
                vehicles.slice(0, 6).map((v: any) => ({
                    id: v.id,
                    plate_number: v.plate_number,
                    status: v.status,
                    driver_name: v.current_driver_id ? driverNameById.get(v.current_driver_id) ?? null : null,
                })),
            );

            const trips = tripsRes.data ?? [];
            const routeByMonth = months.map(({ year, month, label }) => ({
                label,
                value: trips.filter((t: any) => {
                    const d = new Date(t.created_at);
                    return d.getFullYear() === year && d.getMonth() === month;
                }).length,
            }));
            setRouteTrend(routeByMonth);
            setMonthRevenue(
                trips
                    .filter((t: any) => new Date(t.created_at) >= new Date(monthStart))
                    .reduce((s: number, t: any) => s + Number(t.revenue ?? t.price ?? 0), 0),
            );

            const costs = costsRes.data ?? [];
            const fuelCosts = costs.filter((c: any) => c.cost_type === 'fuel');
            const fuelByMonth = months.map(({ year, month, label }) => ({
                label,
                value: fuelCosts
                    .filter((c: any) => {
                        const d = new Date(c.date);
                        return d.getFullYear() === year && d.getMonth() === month;
                    })
                    .reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
            }));
            setFuelTrend(fuelByMonth);

            const thisMonthCosts = costs.filter((c: any) => new Date(c.date) >= new Date(monthStart));
            setMonthFuelCost(thisMonthCosts.filter((c: any) => c.cost_type === 'fuel').reduce((s: number, c: any) => s + Number(c.amount || 0), 0));
            const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
            const prevMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            setPrevMonthFuelCost(
                costs
                    .filter((c: any) => c.cost_type === 'fuel' && new Date(c.date) >= prevMonthStart && new Date(c.date) < prevMonthEnd)
                    .reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
            );

            const totalThisMonth = thisMonthCosts.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
            const byType = new Map<string, number>();
            for (const c of thisMonthCosts) byType.set(c.cost_type, (byType.get(c.cost_type) ?? 0) + Number(c.amount || 0));
            const typeColors: Record<string, string> = { fuel: '#1976D2', maintenance: '#17A2B8', tyre: '#F9A825', insurance: '#2E7D32', other: '#D32F2F' };
            setExpenseBreakdown(
                Array.from(byType.entries())
                    .map(([label, value]) => ({ label, value: totalThisMonth > 0 ? Math.round((value / totalThisMonth) * 100) : 0, color: typeColors[label] ?? '#6B778C' }))
                    .sort((a, b) => b.value - a.value),
            );

            const contractRows = contractsRes.data ?? [];
            setContracts(
                contractRows.map((c: any) => ({
                    id: c.id,
                    contract_number: c.contract_number,
                    partner: c.customers?.company_name ?? 'Unknown',
                    status: c.status,
                    contract_value: Number(c.contract_value || 0),
                    currency: c.currency ?? 'TZS',
                    end_date: c.end_date,
                })),
            );
            setActiveContractCount(contractRows.filter((c: any) => c.status === 'active').length);
            setNewContractsThisWeek(contractRows.filter((c: any) => new Date(c.created_at) >= new Date(weekAgo)).length);
            setExpiringContracts(contractRows.filter((c: any) => c.end_date && c.end_date <= in30Days && c.end_date >= today).length);

            setOverdueInvoices((invoicesRes.data ?? []).length);
            setPendingCashRequests((cashRequestsRes.data ?? []).length);

            setLoading(false);
        })();
    }, []);

    const filteredContracts = useMemo(
        () =>
            contracts.filter((contract) =>
                contract.partner.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contract.contract_number.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        [contracts, searchQuery]
    );

    const maxRoute = Math.max(1, ...routeTrend.map((point) => point.value));
    const maxFuel = Math.max(1, ...fuelTrend.map((point) => point.value));
    const fuelTrendPct = prevMonthFuelCost > 0 ? Math.round(((monthFuelCost - prevMonthFuelCost) / prevMonthFuelCost) * 100) : 0;
    const utilizationPct = vehicleCount > 0 ? Math.round((activeVehicleCount / vehicleCount) * 100) : 0;

    const kpis = [
        { title: 'Active Vehicles', value: String(activeVehicleCount), metric: `${utilizationPct}% utilization`, accent: '#1976D2', icon: Truck },
        { title: 'Monthly Revenue', value: format(monthRevenue), metric: 'This month, from trips', accent: '#17A2B8', icon: Wallet },
        { title: 'Fuel Expenses', value: format(monthFuelCost), metric: fuelTrendPct === 0 ? 'Flat vs last month' : `${fuelTrendPct > 0 ? '+' : ''}${fuelTrendPct}% vs last month`, accent: '#F9A825', icon: Gauge },
        { title: 'Active Contracts', value: String(activeContractCount), metric: `${newContractsThisWeek} new this week`, accent: '#2E7D32', icon: FileText },
    ];

    const insightCards = [
        {
            title: 'Fuel spend trend',
            description: fuelTrendPct <= 0
                ? `Fuel costs are down ${Math.abs(fuelTrendPct)}% vs last month.`
                : `Fuel costs are up ${fuelTrendPct}% vs last month — worth a look.`,
            label: fuelTrendPct <= 0 ? 'On track' : 'Watch',
            color: fuelTrendPct <= 0 ? '#2E7D32' : '#F9A825',
        },
        {
            title: 'Maintenance backlog',
            description: `${maintenanceDueCount} vehicle${maintenanceDueCount === 1 ? '' : 's'} currently in maintenance or repair.`,
            label: maintenanceDueCount > 0 ? 'Alert' : 'Clear',
            color: maintenanceDueCount > 0 ? '#F9A825' : '#2E7D32',
        },
        {
            title: 'Contract renewals',
            description: expiringContracts > 0
                ? `${expiringContracts} contract${expiringContracts === 1 ? '' : 's'} expiring within 30 days.`
                : 'No contracts expiring in the next 30 days.',
            label: expiringContracts > 0 ? 'Action' : 'Clear',
            color: expiringContracts > 0 ? '#1976D2' : '#2E7D32',
        },
    ];

    return (
        <div className="min-h-screen bg-[#F3F5F9] text-[#243041]">
            <div className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)]">
                <aside className="sticky top-0 h-screen border-r border-[#DCE2EE] bg-[#16213E] px-6 py-8 text-white">
                    <div className="mb-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#F3F5F9] shadow-lg shadow-black/10">
                                <Truck className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-[#A2B1D1]">Calvary</p>
                                <h2 className="text-xl font-semibold">Fleet Connect</h2>
                            </div>
                        </div>
                        <p className="text-sm leading-6 text-[#A2B1D1]">
                            Executive dashboard for premium logistics operations.
                        </p>
                    </div>

                    <nav className="space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    className={`flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left text-sm transition-all ${item.active
                                            ? 'bg-white/10 text-white shadow-[0_12px_24px_rgba(0,0,0,0.12)]'
                                            : 'text-[#A2B1D1] hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                    {item.active && <ChevronRight className="h-4 w-4 ml-auto" />}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <main className="p-6">
                    <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm uppercase tracking-[0.32em] text-[#6B778C]">Executive overview</p>
                            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#243041]">
                                Premium Fleet Command Center
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B778C]">
                                Monitor route performance, fuel spend, contracts and live fleet status for your logistics enterprise.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative flex w-full items-center rounded-[16px] border border-[#DCE2EE] bg-white px-4 py-3 shadow-sm sm:w-[420px]">
                                <Search className="text-[#6B778C]" />
                                <input
                                    type="search"
                                    placeholder="Search contracts by number or partner"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    className="ml-3 w-full border-none bg-transparent text-sm text-[#243041] outline-none placeholder:text-[#A2B1D1]"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-[#243041] shadow-sm transition hover:shadow-md">
                                    <Bell className="h-5 w-5" />
                                </button>
                                <button className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-[#243041] shadow-sm transition hover:shadow-md">
                                    <UserCircle2 className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                    </header>

                    <section className="grid gap-6 xl:grid-cols-[1.6fr_0.95fr]">
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {kpis.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Card
                                        key={item.title}
                                        className="rounded-[16px] border border-[#DCE2EE] bg-white shadow-[0_18px_40px_rgba(21,34,64,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_60px_rgba(21,34,64,0.14)]"
                                    >
                                        <CardContent className="space-y-4 p-6">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#6B778C]">{item.title}</p>
                                                    <p className="text-3xl font-semibold text-[#243041]">{loading ? '—' : item.value}</p>
                                                </div>
                                                <div className="flex h-12 w-12 items-center justify-center rounded-3xl" style={{ backgroundColor: `${item.accent}1A` }}>
                                                    <Icon className="h-5 w-5" style={{ color: item.accent }} />
                                                </div>
                                            </div>
                                            <p className="text-sm text-[#6B778C]">{item.metric}</p>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        <Card className="rounded-[16px] border border-[#DCE2EE] bg-white shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                            <CardHeader className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-2xl">Fleet Insights</CardTitle>
                                        <CardDescription className="mt-2 text-sm text-[#6B778C]">
                                            Live conditions computed from current fleet and contract data.
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 p-6 pt-0">
                                {insightCards.map((item) => (
                                    <div key={item.title} className="rounded-[16px] border border-[#DCE2EE] bg-[#F8FBFF] p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-[#243041]">{item.title}</p>
                                                <p className="mt-2 text-sm leading-6 text-[#6B778C]">{item.description}</p>
                                            </div>
                                            <span
                                                className="rounded-full px-3 py-1 text-xs font-semibold uppercase"
                                                style={{ backgroundColor: `${item.color}22`, color: item.color }}
                                            >
                                                {item.label}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr] mt-6">
                        <Card className="rounded-[16px] border border-[#DCE2EE] bg-white shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                            <CardHeader className="p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-2xl">Route Analytics</CardTitle>
                                        <CardDescription className="mt-2 text-sm text-[#6B778C]">
                                            Trips created per month, last 7 months.
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-0">
                                <div className="relative h-[300px] overflow-hidden rounded-[16px] bg-[#F3F5F9] p-6">
                                    <svg viewBox="0 0 700 260" className="h-full w-full">
                                        <defs>
                                            <linearGradient id="route-gradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#1976D2" stopOpacity="0.4" />
                                                <stop offset="100%" stopColor="#1976D2" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        {routeTrend.length > 0 && (
                                            <>
                                                <path
                                                    d={routeTrend
                                                        .map((point, index) => {
                                                            const x = 90 + index * 90;
                                                            const y = 240 - (point.value / maxRoute) * 200;
                                                            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                                                        })
                                                        .join(' ')}
                                                    fill="none"
                                                    stroke="#1976D2"
                                                    strokeWidth="4"
                                                    strokeLinecap="round"
                                                />
                                                <path
                                                    d={`${routeTrend
                                                        .map((point, index) => {
                                                            const x = 90 + index * 90;
                                                            const y = 240 - (point.value / maxRoute) * 200;
                                                            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                                                        })
                                                        .join(' ')} L 650 240 L 90 240 Z`}
                                                    fill="url(#route-gradient)"
                                                    opacity="0.8"
                                                />
                                                {routeTrend.map((point, index) => {
                                                    const x = 90 + index * 90;
                                                    const y = 240 - (point.value / maxRoute) * 200;
                                                    return (
                                                        <circle key={point.label} cx={x} cy={y} r="7" fill="#1976D2" stroke="#ffffff" strokeWidth="3" />
                                                    );
                                                })}
                                                {routeTrend.map((point, index) => (
                                                    <text key={`${point.label}-label`} x={90 + index * 90} y="256" textAnchor="middle" className="text-xs fill-[#6B778C]">
                                                        {point.label}
                                                    </text>
                                                ))}
                                            </>
                                        )}
                                        <text x="44" y="40" className="text-xs fill-[#6B778C]">
                                            Total trips (7 mo)
                                        </text>
                                        <text x="44" y="64" className="text-2xl fill-[#243041] font-semibold">
                                            {routeTrend.reduce((s, p) => s + p.value, 0)}
                                        </text>
                                    </svg>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="rounded-[16px] border border-[#DCE2EE] bg-white shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                                <CardHeader className="p-6">
                                    <div>
                                        <CardTitle className="text-2xl">Fuel Consumption</CardTitle>
                                        <CardDescription className="mt-2 text-sm text-[#6B778C]">
                                            Monthly fuel spend, last 7 months.
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 p-6 pt-0">
                                    <div className="space-y-4">
                                        {fuelTrend.map((point) => (
                                            <div key={point.label} className="flex items-center gap-4 text-sm">
                                                <span className="w-12 text-[#6B778C]">{point.label}</span>
                                                <div className="relative flex-1 overflow-hidden rounded-full bg-[#EAF4FF]">
                                                    <div
                                                        className="h-3 rounded-full bg-[#17A2B8]"
                                                        style={{ width: `${(point.value / maxFuel) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="w-24 text-right font-semibold text-[#243041]">{format(point.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[16px] border border-[#DCE2EE] bg-white shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                                <CardHeader className="p-6">
                                    <div>
                                        <CardTitle className="text-2xl">Expense Breakdown</CardTitle>
                                        <CardDescription className="mt-2 text-sm text-[#6B778C]">
                                            Vehicle cost distribution for the current month.
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 p-6 pt-0">
                                    {expenseBreakdown.length === 0 ? (
                                        <p className="text-sm text-[#6B778C]">No vehicle costs recorded this month.</p>
                                    ) : (
                                        expenseBreakdown.map((item) => (
                                            <div key={item.label} className="space-y-2">
                                                <div className="flex items-center justify-between text-sm text-[#243041] capitalize">
                                                    <span>{item.label}</span>
                                                    <span>{item.value}%</span>
                                                </div>
                                                <div className="h-3 overflow-hidden rounded-full bg-[#F3F5F9]">
                                                    <div style={{ width: `${item.value}%`, backgroundColor: item.color }} className="h-full rounded-full" />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-2 mt-6">
                        <Card className="rounded-[16px] border border-[#DCE2EE] bg-white shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                            <CardHeader className="p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-2xl">Recent Contracts</CardTitle>
                                        <CardDescription className="mt-2 text-sm text-[#6B778C]">
                                            Latest transport contracts and renewal schedule.
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" className="h-11 rounded-[14px] px-4 text-[#1976D2] border-[#DCE2EE] hover:bg-[#F3F5F9]" asChild>
                                        <Link href="/sales?tab=contracts">View all</Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Contract</TableHead>
                                            <TableHead>Partner</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Value</TableHead>
                                            <TableHead>Ends</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredContracts.map((contract) => (
                                            <TableRow key={contract.id}>
                                                <TableCell className="font-semibold">{contract.contract_number}</TableCell>
                                                <TableCell>{contract.partner}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`${statusBadge(contract.status)} border text-xs font-semibold capitalize`}>
                                                        {contract.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{format(contract.contract_value)}</TableCell>
                                                <TableCell>{contract.end_date ?? '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    {filteredContracts.length === 0 && <TableCaption>No contracts found.</TableCaption>}
                                </Table>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[16px] border border-[#DCE2EE] bg-white shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                            <CardHeader className="p-6">
                                <div>
                                    <CardTitle className="text-2xl">Fleet Status</CardTitle>
                                    <CardDescription className="mt-2 text-sm text-[#6B778C]">
                                        Live vehicle status and current driver assignment.
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5 p-6 pt-0">
                                {fleetRows.length === 0 ? (
                                    <p className="text-sm text-[#6B778C]">No vehicles yet.</p>
                                ) : (
                                    fleetRows.map((row) => (
                                        <div key={row.id} className="rounded-[16px] border border-[#E8EBF4] bg-[#F8FBFF] p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-[#243041]">{row.plate_number}</p>
                                                    <p className="text-xs text-[#6B778C]">{row.driver_name ?? 'Unassigned'}</p>
                                                </div>
                                                <Badge variant="outline" className={`${statusBadge(row.status)} text-xs font-semibold capitalize`}>
                                                    {row.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <section className="mt-6 grid gap-6 sm:grid-cols-2">
                        <Card className="rounded-[16px] border border-[#DCE2EE] bg-white p-6 shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#6B778C]">Operational pulses</p>
                                    <h2 className="mt-3 text-2xl font-semibold text-[#243041]">Alerts & quick actions</h2>
                                </div>
                                <Sparkles className="h-6 w-6 text-[#17A2B8]" />
                            </div>
                            <div className="mt-6 space-y-4">
                                <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[#DCE2EE] bg-[#F3F5F9] p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-[#243041]">Maintenance backlog</p>
                                        <p className="text-sm text-[#6B778C]">{maintenanceDueCount} vehicle{maintenanceDueCount === 1 ? '' : 's'} in maintenance or repair.</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="rounded-[14px] border-[#DCE2EE] text-[#243041] hover:bg-[#F3F5F9]" asChild>
                                        <Link href="/maintenance">Review</Link>
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[#DCE2EE] bg-[#F3F5F9] p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-[#243041]">Available vehicles</p>
                                        <p className="text-sm text-[#6B778C]">{idleVehicleCount} vehicle{idleVehicleCount === 1 ? '' : 's'} available for dispatch.</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="rounded-[14px] border-[#DCE2EE] text-[#243041] hover:bg-[#F3F5F9]" asChild>
                                        <Link href="/dispatch">Dispatch</Link>
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        <Card className="rounded-[16px] border border-[#DCE2EE] bg-white p-6 shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#6B778C]">Financial snapshot</p>
                                    <h2 className="mt-3 text-2xl font-semibold text-[#243041]">Performance pulse</h2>
                                </div>
                                <AlertTriangle className="h-6 w-6 text-[#D32F2F]" />
                            </div>
                            <div className="mt-6 space-y-4 text-sm text-[#6B778C]">
                                <div className={`flex items-center justify-between rounded-[16px] border border-[#DCE2EE] p-4 ${overdueInvoices > 0 ? 'bg-[#FDECEA]' : 'bg-[#F8FBFF]'}`}>
                                    <div>
                                        <p className="font-semibold text-[#243041]">Overdue invoices</p>
                                        <p>{overdueInvoices} invoice{overdueInvoices === 1 ? '' : 's'} past due date, unpaid.</p>
                                    </div>
                                    <span className={`text-sm font-semibold ${overdueInvoices > 0 ? 'text-[#D32F2F]' : 'text-[#2E7D32]'}`}>{overdueInvoices > 0 ? 'Urgent' : 'Clear'}</span>
                                </div>
                                <div className={`flex items-center justify-between rounded-[16px] border border-[#DCE2EE] p-4 ${pendingCashRequests > 0 ? 'bg-[#FFF6E5]' : 'bg-[#F8FBFF]'}`}>
                                    <div>
                                        <p className="font-semibold text-[#243041]">Pending cash requests</p>
                                        <p>{pendingCashRequests} request{pendingCashRequests === 1 ? '' : 's'} awaiting approval.</p>
                                    </div>
                                    <span className={`text-sm font-semibold ${pendingCashRequests > 0 ? 'text-[#F9A825]' : 'text-[#2E7D32]'}`}>{pendingCashRequests > 0 ? 'Watch' : 'Clear'}</span>
                                </div>
                                <div className={`flex items-center justify-between rounded-[16px] border border-[#DCE2EE] p-4 ${expiringContracts > 0 ? 'bg-[#FDECEA]' : 'bg-[#F8FBFF]'}`}>
                                    <div>
                                        <p className="font-semibold text-[#243041]">Contract renewals</p>
                                        <p>{expiringContracts} contract{expiringContracts === 1 ? '' : 's'} expiring within 30 days.</p>
                                    </div>
                                    <span className={`text-sm font-semibold ${expiringContracts > 0 ? 'text-[#D32F2F]' : 'text-[#2E7D32]'}`}>{expiringContracts > 0 ? 'Urgent' : 'Clear'}</span>
                                </div>
                            </div>
                        </Card>
                    </section>
                </main>
            </div>
        </div>
    );
}

export default PremiumDashboard;
