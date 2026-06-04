'use client';

import { useMemo, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableCaption,
} from '@/components/ui/table';

const kpis = [
    {
        title: 'Active Vehicles',
        value: '128',
        metric: '88% utilization',
        accent: '#1976D2',
        icon: Truck,
    },
    {
        title: 'Monthly Revenue',
        value: 'TZS 149.2M',
        metric: '+14.8% vs last month',
        accent: '#17A2B8',
        icon: Wallet,
    },
    {
        title: 'Fuel Expenses',
        value: 'TZS 34.8M',
        metric: '-6.1% savings',
        accent: '#F9A825',
        icon: Gauge,
    },
    {
        title: 'Active Contracts',
        value: '62',
        metric: '4 new this week',
        accent: '#2E7D32',
        icon: FileText,
    },
];

const routeTrend = [
    { label: 'Jan', value: 82 },
    { label: 'Feb', value: 94 },
    { label: 'Mar', value: 105 },
    { label: 'Apr', value: 118 },
    { label: 'May', value: 143 },
    { label: 'Jun', value: 132 },
    { label: 'Jul', value: 152 },
];

const fuelTrend = [
    { label: 'Jan', value: 36 },
    { label: 'Feb', value: 32 },
    { label: 'Mar', value: 30 },
    { label: 'Apr', value: 28 },
    { label: 'May', value: 26 },
    { label: 'Jun', value: 24 },
    { label: 'Jul', value: 22 },
];

const expenseBreakdown = [
    { label: 'Fuel', value: 42, color: '#1976D2' },
    { label: 'Maintenance', value: 26, color: '#17A2B8' },
    { label: 'Labor', value: 18, color: '#F9A825' },
    { label: 'Insurance', value: 9, color: '#2E7D32' },
    { label: 'Other', value: 5, color: '#D32F2F' },
];

const recentContracts = [
    {
        id: 'CX-2101',
        partner: 'East Africa Logistics',
        type: 'Freight',
        status: 'Active',
        value: 'TZS 46.4M',
        due: 'Sep 18',
    },
    {
        id: 'CX-2104',
        partner: 'Nairobi Transit',
        type: 'Partial Load',
        status: 'Pending',
        value: 'TZS 18.7M',
        due: 'Aug 30',
    },
    {
        id: 'CX-2110',
        partner: 'Rwanda Express',
        type: 'Cross-Border',
        status: 'Active',
        value: 'TZS 29.3M',
        due: 'Oct 12',
    },
    {
        id: 'CX-2115',
        partner: 'Kigali Cargo',
        type: 'Dry Van',
        status: 'Delayed',
        value: 'TZS 8.1M',
        due: 'Aug 22',
    },
];

const fleetRows = [
    {
        vehicle: 'TRK-519',
        driver: 'Moses K.',
        location: 'Dar es Salaam',
        status: 'Active',
        fuel: 78,
        updated: '12 min ago',
    },
    {
        vehicle: 'TRK-423',
        driver: 'Amina N.',
        location: 'Mwanza',
        status: 'Maintenance',
        fuel: 42,
        updated: '34 min ago',
    },
    {
        vehicle: 'TRK-332',
        driver: 'David L.',
        location: 'Morogoro',
        status: 'Idle',
        fuel: 61,
        updated: '47 min ago',
    },
    {
        vehicle: 'TRK-601',
        driver: 'Grace T.',
        location: 'Dodoma',
        status: 'Delayed',
        fuel: 19,
        updated: '6 min ago',
    },
];

const navItems = [
    { label: 'Overview', icon: Layers, active: true },
    { label: 'Fleet', icon: Truck },
    { label: 'Routes', icon: MapPin },
    { label: 'Analytics', icon: ChartPie },
    { label: 'Contracts', icon: FileText },
    { label: 'Safety', icon: ShieldCheck },
];

const insightCards = [
    {
        title: 'Optimize fuel usage',
        description: 'Route consolidation can reduce fuel spend by 14% for long-haul lanes.',
        label: 'Recommendation',
        color: '#17A2B8',
    },
    {
        title: 'Driver readiness alert',
        description: '3 vehicles need preventive maintenance before next dispatch.',
        label: 'Alert',
        color: '#F9A825',
    },
    {
        title: 'Contract renewal',
        description: 'East Africa Logistics contract renews in 22 days.',
        label: 'Action',
        color: '#1976D2',
    },
];

function statusBadge(status: string) {
    const variants: Record<string, string> = {
        Active: 'bg-[#E8F3FF] text-[#1976D2] border-[#B1D4FF]',
        Idle: 'bg-[#F3F7FB] text-[#6B778C] border-[#DCE2EE]',
        Maintenance: 'bg-[#E8F6EF] text-[#2E7D32] border-[#B8E0C5]',
        Delayed: 'bg-[#FDECEA] text-[#D32F2F] border-[#F8C6C3]',
        Pending: 'bg-[#FFF7E8] text-[#F9A825] border-[#F4DEA6]',
    };

    return variants[status] ?? 'bg-[#F3F5F9] text-[#6B778C] border-[#DCE2EE]';
}

function PremiumDashboard() {
    const [searchQuery, setSearchQuery] = useState('');
    const filteredContracts = useMemo(
        () =>
            recentContracts.filter((contract) =>
                contract.partner.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contract.id.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        [searchQuery]
    );

    const maxRoute = Math.max(...routeTrend.map((point) => point.value));
    const maxFuel = Math.max(...fuelTrend.map((point) => point.value));

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

                    <div className="mt-10 rounded-[16px] border border-white/10 bg-white/5 p-5">
                        <div className="flex items-center justify-between text-sm text-[#A2B1D1]">
                            <span>Realtime uptime</span>
                            <span>99.8%</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full w-11/12 rounded-full bg-[#17A2B8]" />
                        </div>
                    </div>
                </aside>

                <main className="p-6">
                    <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm uppercase tracking-[0.32em] text-[#6B778C]">Executive overview</p>
                            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#243041]">
                                Premium Fleet Command Center
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B778C]">
                                Monitor route performance, fuel spend, contracts and AI recommendations for your logistics enterprise.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative flex w-full items-center rounded-[16px] border border-[#DCE2EE] bg-white px-4 py-3 shadow-sm sm:w-[420px]">
                                <Search className="text-[#6B778C]" />
                                <input
                                    type="search"
                                    placeholder="Search contracts, vehicles or routes"
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
                                                    <p className="text-3xl font-semibold text-[#243041]">{item.value}</p>
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
                                        <CardTitle className="text-2xl">AI Insights</CardTitle>
                                        <CardDescription className="mt-2 text-sm text-[#6B778C]">
                                            Actionable recommendations generated for your fleet and contract operations.
                                        </CardDescription>
                                    </div>
                                    <Button className="h-11 rounded-[14px] bg-[#1976D2] px-4 text-white hover:bg-[#155FA3]">Run analysis</Button>
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
                                            Weekly route efficiency and planned vs actual lane performance.
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" className="h-11 rounded-[14px] px-4 text-[#1976D2] border-[#DCE2EE] hover:bg-[#F3F5F9]">
                                        Full report
                                    </Button>
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
                                        <text x="44" y="40" className="text-xs fill-[#6B778C]">
                                            Total routes
                                        </text>
                                        <text x="44" y="64" className="text-2xl fill-[#243041] font-semibold">
                                            1,420
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
                                            Monthly fuel burn per route segment, trending downward.
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
                                                <span className="w-10 text-right font-semibold text-[#243041]">{point.value}%</span>
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
                                            Relative cost distribution for the current month.
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 p-6 pt-0">
                                    {expenseBreakdown.map((item) => (
                                        <div key={item.label} className="space-y-2">
                                            <div className="flex items-center justify-between text-sm text-[#243041]">
                                                <span>{item.label}</span>
                                                <span>{item.value}%</span>
                                            </div>
                                            <div className="h-3 overflow-hidden rounded-full bg-[#F3F5F9]">
                                                <div style={{ width: `${item.value}%`, backgroundColor: item.color }} className="h-full rounded-full" />
                                            </div>
                                        </div>
                                    ))}
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
                                            Active agreements and renewal schedule for your logistics partners.
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" className="h-11 rounded-[14px] px-4 text-[#1976D2] border-[#DCE2EE] hover:bg-[#F3F5F9]">
                                        View all
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
                                            <TableHead>Due</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredContracts.map((contract) => (
                                            <TableRow key={contract.id}>
                                                <TableCell className="font-semibold">{contract.id}</TableCell>
                                                <TableCell>{contract.partner}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`${statusBadge(contract.status)} border text-xs font-semibold`}>
                                                        {contract.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{contract.value}</TableCell>
                                                <TableCell>{contract.due}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableCaption>Filtered by contract search</TableCaption>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[16px] border border-[#DCE2EE] bg-white shadow-[0_18px_40px_rgba(21,34,64,0.08)]">
                            <CardHeader className="p-6">
                                <div>
                                    <CardTitle className="text-2xl">Fleet Status</CardTitle>
                                    <CardDescription className="mt-2 text-sm text-[#6B778C]">
                                        Real-time overview of vehicle health, fuel levels and dispatcher status.
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5 p-6 pt-0">
                                {fleetRows.map((row) => (
                                    <div key={row.vehicle} className="rounded-[16px] border border-[#E8EBF4] bg-[#F8FBFF] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-[#243041]">{row.vehicle} • {row.driver}</p>
                                                <p className="text-xs text-[#6B778C]">{row.location}</p>
                                            </div>
                                            <Badge variant="outline" className={`${statusBadge(row.status)} text-xs font-semibold`}>
                                                {row.status}
                                            </Badge>
                                        </div>
                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <p className="text-xs uppercase tracking-[0.2em] text-[#6B778C]">Fuel level</p>
                                                <Progress value={row.fuel} />
                                                <p className="text-sm font-semibold text-[#243041]">{row.fuel}% available</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs uppercase tracking-[0.2em] text-[#6B778C]">Last updated</p>
                                                <p className="text-sm font-semibold text-[#243041]">{row.updated}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
                                        <p className="text-sm font-semibold text-[#243041]">Safety review due</p>
                                        <p className="text-sm text-[#6B778C]">3 drivers require paperwork verification.</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="rounded-[14px] border-[#DCE2EE] text-[#243041] hover:bg-[#F3F5F9]">
                                        Review
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[#DCE2EE] bg-[#F3F5F9] p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-[#243041]">Idle asset optimization</p>
                                        <p className="text-sm text-[#6B778C]">5 vehicles idle over 8 hours. Recommend reassignment.</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="rounded-[14px] border-[#DCE2EE] text-[#243041] hover:bg-[#F3F5F9]">
                                        Assign
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
                                <div className="flex items-center justify-between rounded-[16px] border border-[#DCE2EE] bg-[#F8FBFF] p-4">
                                    <div>
                                        <p className="font-semibold text-[#243041]">On-time payments</p>
                                        <p>95% of invoices paid within 7 days.</p>
                                    </div>
                                    <span className="text-sm font-semibold text-[#2E7D32]">Stable</span>
                                </div>
                                <div className="flex items-center justify-between rounded-[16px] border border-[#DCE2EE] bg-[#FFF6E5] p-4">
                                    <div>
                                        <p className="font-semibold text-[#243041]">Fuel reserve</p>
                                        <p>Remaining budget is on track for Q3.</p>
                                    </div>
                                    <span className="text-sm font-semibold text-[#F9A825]">Watch</span>
                                </div>
                                <div className="flex items-center justify-between rounded-[16px] border border-[#DCE2EE] bg-[#FDECEA] p-4">
                                    <div>
                                        <p className="font-semibold text-[#243041]">Contract renewals</p>
                                        <p>2 premium contracts require negotiation next month.</p>
                                    </div>
                                    <span className="text-sm font-semibold text-[#D32F2F]">Urgent</span>
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
