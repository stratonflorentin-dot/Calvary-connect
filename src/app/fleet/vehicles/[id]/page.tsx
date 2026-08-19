'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Truck, Download, Edit2, Wrench, AlertCircle, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatMiniCard } from '@/components/ui/stat-mini-card';
import { GradientCard } from '@/components/ui/gradient-card';
import { VehicleHealthBadge } from '@/components/ui/vehicle-health-badge';
import { DocumentStatusBadge } from '@/components/ui/document-status-badge';
import { useVehicleDetail } from '@/hooks/use-vehicle-detail';
import { useCurrency } from '@/hooks/use-currency';

export default function VehicleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const vehicleId = params.id as string;
    const { format } = useCurrency();
    const [activeTab, setActiveTab] = useState('overview');

    const {
        vehicle,
        trips,
        maintenance,
        documents,
        inspections,
        fuelLogs,
        fuelRequests,
        invoices,
        contracts,
        driverAssignments,
        stats,
        utilizationByMonth,
        loading,
    } = useVehicleDetail(vehicleId);

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-12 bg-muted rounded-lg"></div>
                    <div className="h-32 bg-muted rounded-lg"></div>
                </div>
            </div>
        );
    }

    if (!vehicle) {
        return (
            <div className="p-6">
                <Card className="p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Vehicle Not Found</h2>
                    <p className="text-muted-foreground mb-4">The vehicle you're looking for doesn't exist.</p>
                    <Button onClick={() => router.back()}>Go Back</Button>
                </Card>
            </div>
        );
    }

    // Determine status badge color — mirrors the real `vehicles_status_check`
    // constraint (available | in_use | maintenance | out_of_service).
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'available': return 'bg-success';
            case 'in_use': return 'bg-info';
            case 'maintenance': return 'bg-warning';
            case 'out_of_service': return 'bg-destructive';
            default: return 'bg-muted';
        }
    };

    const formatStatusLabel = (status: string) =>
        status
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    // Check docs validity
    const docsValid = documents.every(d => d.status === 'valid' || d.status === 'no_expiry');

    // Real split of stats.totalCost — previously this chart showed a
    // fixed 40/35/25 regardless of the vehicle's actual numbers.
    const otherCost = Math.max(0, stats.totalCost - stats.fuelSpend - stats.maintenanceCost);
    const costBreakdown = stats.totalCost > 0
        ? [
            { label: 'Fuel', value: stats.fuelSpend, pct: (stats.fuelSpend / stats.totalCost) * 100, color: 'bg-primary' },
            { label: 'Maintenance', value: stats.maintenanceCost, pct: (stats.maintenanceCost / stats.totalCost) * 100, color: 'bg-warning' },
            { label: 'Other', value: otherCost, pct: (otherCost / stats.totalCost) * 100, color: 'bg-success' },
        ]
        : [];

    return (
        <div className="p-6 space-y-6">
            {/* SECTION 1: VEHICLE HEADER */}
            <Card className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        {/* Breadcrumb */}
                        <p className="text-xs text-muted-foreground mb-3">Fleet / {vehicle.vehicle_code}</p>

                        {/* Vehicle Icon & Info */}
                        <div className="flex items-start gap-4 mb-4">
                            {vehicle.photo_url ? (
                                <img
                                    src={vehicle.photo_url}
                                    alt={vehicle.vehicle_code}
                                    className="w-14 h-14 rounded-xl object-cover border border-border"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                                    <Truck className="w-7 h-7 text-primary-foreground" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold">{vehicle.vehicle_code}</h1>
                                <p className="text-sm text-muted-foreground">
                                    {vehicle.make} — {vehicle.model}
                                </p>
                            </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap gap-2">
                            <Badge className={`${getStatusColor(vehicle.status)}`}>
                                {formatStatusLabel(vehicle.status)}
                            </Badge>
                            <Badge variant={docsValid ? 'outline' : 'destructive'}>
                                {docsValid ? '✓ Docs Valid' : '✗ Docs Expired'}
                            </Badge>
                            <VehicleHealthBadge score={vehicle.health_score || 100} />
                            <Badge variant="outline" className="font-mono">
                                {vehicle.registration_number}
                            </Badge>
                            {vehicle.odometer_km === 0 && (
                                <Badge variant="secondary" className="bg-warning/10 text-warning">
                                    No Odometer
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2">
                        <Button className="bg-success hover:bg-success/90 text-success-foreground gap-2">
                            <Download className="w-4 h-4" />
                            Download Report
                        </Button>
                        <Button variant="outline" className="text-primary border-primary/20">
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit Vehicle
                        </Button>
                        <Button className="bg-warning hover:bg-warning/90 text-warning-foreground gap-2">
                            <Wrench className="w-4 h-4" />
                            Log Maintenance
                        </Button>
                    </div>
                </div>
            </Card>

            {/* SECTION 2: STAT MINI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatMiniCard
                    title="Total Cost"
                    value={format(stats.totalCost)}
                    icon={<Truck className="w-4 h-4 text-warning" />}
                    iconBg="bg-warning/10"
                    valueColor="text-warning"
                />
                <StatMiniCard
                    title="Fuel Spend"
                    value={format(stats.fuelSpend)}
                    icon={<Truck className="w-4 h-4 text-info" />}
                    iconBg="bg-info/10"
                    valueColor="text-info"
                />
                <StatMiniCard
                    title="Maintenance"
                    value={format(stats.maintenanceCost)}
                    icon={<Wrench className="w-4 h-4 text-warning" />}
                    iconBg="bg-warning/10"
                    valueColor="text-warning"
                />
                <StatMiniCard
                    title="Total Trips"
                    value={stats.totalTrips}
                    icon={<Truck className="w-4 h-4 text-success" />}
                    iconBg="bg-success/10"
                    valueColor="text-success"
                />
                <StatMiniCard
                    title="KM Driven"
                    value={stats.kmDriven.toLocaleString('en-TZ')}
                    icon={<Truck className="w-4 h-4 text-accent-foreground" />}
                    iconBg="bg-accent/10"
                    valueColor="text-accent-foreground"
                />
                <StatMiniCard
                    title="Fuel Litres"
                    value={stats.totalLitres.toLocaleString('en-TZ')}
                    icon={<Truck className="w-4 h-4 text-info" />}
                    iconBg="bg-info/10"
                    valueColor="text-info"
                />
            </div>

            {/* SECTION 3: PERFORMANCE & FINANCIAL */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* LEFT: Performance */}
                <GradientCard
                    title="Performance & Efficiency"
                    icon={<Truck className="w-5 h-5 text-white" />}
                    iconBg="bg-primary"
                    headerGradient="bg-gradient-to-r from-primary to-primary/80"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-4 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Fuel Efficiency</p>
                            <p className="text-sm font-bold text-foreground">
                                {stats.fuelEfficiency.toFixed(1)} km/L
                            </p>
                        </div>
                        <div className="bg-warning/10 p-4 rounded-lg">
                            <p className="text-xs text-warning mb-1">Cost per km</p>
                            <p className="text-sm font-bold text-warning">
                                TZS {stats.costPerKm.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-accent/10 p-4 rounded-lg">
                            <p className="text-xs text-accent-foreground mb-1">Avg Trip Distance</p>
                            <p className="text-sm font-bold text-accent-foreground">
                                {stats.avgTripDistance.toFixed(0)} km
                            </p>
                        </div>
                        <div className="bg-success/10 p-4 rounded-lg">
                            <p className="text-xs text-success mb-1" title="Share of owned days with at least one trip — no status-history tracking exists to measure true downtime">Active Days %</p>
                            <p className="text-sm font-bold text-success">
                                {stats.activeDaysPercent.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </GradientCard>

                {/* RIGHT: Financial */}
                <GradientCard
                    title="Financial Performance"
                    icon={<Truck className="w-5 h-5 text-white" />}
                    iconBg="bg-warning"
                    headerGradient="bg-gradient-to-r from-warning to-warning/80"
                >
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-info/10 p-3 rounded-lg">
                                <p className="text-xs text-info" title="Total invoiced against this vehicle">Invoiced Revenue</p>
                                <p className="text-sm font-bold text-info">
                                    {format(stats.lifetimeRevenue)}
                                </p>
                            </div>
                            <div className="bg-info/10 p-3 rounded-lg">
                                <p className="text-xs text-info" title="Actually collected, not just billed">Collected Revenue</p>
                                <p className="text-sm font-bold text-info">
                                    {format(stats.collectedRevenue)}
                                </p>
                            </div>
                        </div>
                        <div className="bg-success/10 p-3 rounded-lg">
                            <p className="text-xs text-success">Profitability</p>
                            <p className="text-sm font-bold text-success">
                                {format(stats.profitability)}
                            </p>
                        </div>
                        <div className="bg-warning/10 p-3 rounded-lg">
                            <p className="text-xs text-warning">Profit Margin %</p>
                            <p className="text-sm font-bold text-warning">
                                {stats.profitMargin.toFixed(1)}%
                            </p>
                        </div>
                        <div className="bg-destructive/10 p-3 rounded-lg">
                            <p className="text-xs text-destructive">ROI %</p>
                            <p className="text-sm font-bold text-destructive">
                                {stats.roi.toFixed(1)}%
                            </p>
                        </div>
                        <div className="bg-accent/10 p-3 rounded-lg">
                            <p className="text-xs text-accent-foreground">Revenue per Trip</p>
                            <p className="text-sm font-bold text-accent-foreground">
                                {format(stats.revenuePerTrip)}
                            </p>
                        </div>
                    </div>
                </GradientCard>
            </div>

            {/* SECTION 4: UTILIZATION TREND */}
            <GradientCard
                title="Utilization Trend — Last 6 months performance"
                icon={<Truck className="w-5 h-5 text-white" />}
                iconBg="bg-accent"
                headerGradient="bg-gradient-to-r from-info to-info/80"
            >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs text-center">
                    {utilizationByMonth.map((month, idx) => {
                        const utilizationColor = month.percent > 70 ? 'text-success' : month.percent > 40 ? 'text-warning' : 'text-muted-foreground';
                        return (
                            <div key={idx} className="border rounded-lg p-2">
                                <p className="font-semibold">{month.month}</p>
                                <p className={`font-bold ${utilizationColor}`}>{month.percent.toFixed(0)}%</p>
                                <p className="text-muted-foreground">{month.trips} trips</p>
                                <p className="text-muted-foreground">{month.km.toLocaleString('en-TZ')} km</p>
                            </div>
                        );
                    })}
                </div>
            </GradientCard>

            {/* SECTION 5: TAB NAVIGATION */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-10">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="trips">Trips & Costs</TabsTrigger>
                    <TabsTrigger value="revenue">Revenue</TabsTrigger>
                    <TabsTrigger value="drivers">Drivers</TabsTrigger>
                    <TabsTrigger value="contracts">Contracts</TabsTrigger>
                    <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                    <TabsTrigger value="inspections">Inspections</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    <TabsTrigger value="requests">Requests</TabsTrigger>
                    <TabsTrigger value="fuel">Fuel Logs</TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* LEFT: 2fr */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Specifications */}
                            <GradientCard
                                title="Specifications"
                                icon={<Truck className="w-5 h-5 text-white" />}
                                iconBg="bg-primary"
                                headerGradient="bg-gradient-to-r from-primary to-primary/80"
                            >
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Type', value: vehicle.type },
                                        { label: 'Plate', value: vehicle.registration_number },
                                        { label: 'Cargo', value: `${vehicle.cargo_capacity_tons}t` },
                                        { label: 'GVW', value: `${vehicle.gvwr_kg}kg` },
                                        { label: 'Fuel Type', value: 'Diesel' },
                                        { label: 'Color', value: vehicle.color },
                                        { label: 'Tare', value: `${vehicle.tare_weight_kg}kg` },
                                        { label: 'Tank', value: `${vehicle.tank_capacity_litres}L` },
                                        { label: 'Dimensions', value: vehicle.dimensions },
                                        { label: 'Odometer', value: `${vehicle.odometer_km}km` },
                                    ].map((spec, idx) => (
                                        <div key={idx} className="text-center">
                                            <p className="text-xs text-muted-foreground">{spec.label}</p>
                                            <p className="text-sm font-semibold">{spec.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </GradientCard>

                            {/* Financial & Rates */}
                            <GradientCard
                                title="Financial & Rates"
                                icon={<Truck className="w-5 h-5 text-white" />}
                                iconBg="bg-warning"
                                headerGradient="bg-gradient-to-r from-warning to-warning/80"
                            >
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-primary/10 p-3 rounded-lg text-center">
                                            <p className="text-xs text-primary">Daily Rate</p>
                                            <p className="text-sm font-bold text-primary">
                                                TZS {vehicle.daily_rate?.toLocaleString('en-TZ') || '0'}
                                            </p>
                                        </div>
                                        <div className="bg-primary/10 p-3 rounded-lg text-center">
                                            <p className="text-xs text-primary">Weekly Rate</p>
                                            <p className="text-sm font-bold text-primary">
                                                TZS {vehicle.weekly_rate?.toLocaleString('en-TZ') || '0'}
                                            </p>
                                        </div>
                                        <div className="bg-primary/10 p-3 rounded-lg text-center">
                                            <p className="text-xs text-primary">Monthly Rate</p>
                                            <p className="text-sm font-bold text-primary">
                                                TZS {vehicle.monthly_rate?.toLocaleString('en-TZ') || '0'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 border-t pt-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm">Purchase Price</span>
                                            <span className="font-semibold">{format(vehicle.purchase_price || 0)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Purchase Date</span>
                                            <span className="font-semibold">{vehicle.purchase_date}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Warranty Expiry</span>
                                            <span className="font-semibold">{vehicle.warranty_expiry || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Rate per km</span>
                                            <span className="font-semibold">TZS {vehicle.rate_per_km?.toFixed(2) || '0.00'}</span>
                                        </div>
                                    </div>
                                </div>
                            </GradientCard>
                        </div>

                        {/* RIGHT: 1fr */}
                        <div className="space-y-6">
                            {/* Identity */}
                            <Card className="p-4">
                                <h3 className="font-semibold text-sm mb-4">Identity</h3>
                                <div className="space-y-3 text-sm divide-y">
                                    <div className="flex justify-between pb-2">
                                        <span className="text-muted-foreground">Asset #</span>
                                        <span className="font-semibold">{vehicle.vehicle_code}</span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-muted-foreground">Plate</span>
                                        <span className="font-semibold">{vehicle.registration_number}</span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-muted-foreground">Chassis</span>
                                        <span className="font-semibold text-xs">{vehicle.chassis_number}</span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-muted-foreground">Location</span>
                                        <span className="font-semibold">{vehicle.location}</span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-muted-foreground">Added</span>
                                        <span className="font-semibold">{new Date(vehicle.created_at).toLocaleDateString('en-TZ')}</span>
                                    </div>
                                    <div className="flex justify-between pt-2">
                                        <span className="text-muted-foreground">Trips</span>
                                        <span className="font-semibold">{trips.length}</span>
                                    </div>
                                </div>
                            </Card>

                            {/* Cost Breakdown */}
                            <Card className="p-4">
                                <h3 className="font-semibold text-sm mb-4">Cost Breakdown</h3>
                                <div className="space-y-2">
                                    {costBreakdown.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-2">No costs recorded yet</p>
                                    ) : (
                                        <>
                                            <div className="flex h-6 bg-muted rounded-full overflow-hidden">
                                                {costBreakdown.map((c) => (
                                                    <div key={c.label} className={c.color} style={{ width: `${c.pct}%` }} title={`${c.label}: ${c.pct.toFixed(1)}%`}></div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs pt-2">
                                                {costBreakdown.map((c) => (
                                                    <div key={c.label} className="flex items-center gap-1">
                                                        <div className={`w-2 h-2 rounded ${c.color}`}></div>
                                                        <span>{c.label} {c.pct.toFixed(0)}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    <div className="text-right text-sm font-bold pt-2 border-t">
                                        {format(stats.totalCost)}
                                    </div>
                                </div>
                            </Card>

                            {/* Change Status */}
                            <Card className="p-4">
                                <h3 className="font-semibold text-sm mb-4">Change Status</h3>
                                <div className="space-y-3">
                                    <select
                                        defaultValue={vehicle.status}
                                        className="w-full border border-border rounded-lg px-2 py-2 text-sm bg-card text-foreground"
                                    >
                                        <option value="available">Available</option>
                                        <option value="in_use">In Use</option>
                                        <option value="maintenance">Maintenance</option>
                                        <option value="out_of_service">Out of Service</option>
                                    </select>
                                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                                        Update Status
                                    </Button>
                                </div>
                            </Card>

                            {/* Danger Zone */}
                            <Card className="p-4 border-destructive border bg-destructive/10">
                                <h3 className="font-semibold text-sm text-destructive mb-4">Danger Zone</h3>
                                <Button variant="destructive" className="w-full">
                                    Delete Vehicle
                                </Button>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* TRIPS & COSTS TAB */}
                <TabsContent value="trips">
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold">Trips ({trips.length})</h3>
                        </div>
                        <div className="space-y-2">
                            {trips.length === 0 ? (
                                <p className="text-muted-foreground text-sm p-4 text-center">No trips recorded</p>
                            ) : (
                                trips.slice(0, 10).map(trip => (
                                    <div key={trip.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{trip.trip_number}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {trip.origin} → {trip.destination}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline">{trip.status}</Badge>
                                            <p className="text-sm font-bold mt-1">{format(trip.actual_cost || 0)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </TabsContent>

                {/* REVENUE TAB */}
                <TabsContent value="revenue">
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold">Invoices ({invoices.length})</h3>
                            <div className="text-right text-xs text-muted-foreground">
                                <p>Invoiced: <span className="font-bold text-foreground">{format(stats.lifetimeRevenue)}</span></p>
                                <p>Collected: <span className="font-bold text-foreground">{format(stats.collectedRevenue)}</span></p>
                            </div>
                        </div>
                        {invoices.length === 0 ? (
                            <p className="text-muted-foreground text-sm p-4 text-center">No invoices billed against this vehicle yet</p>
                        ) : (
                            <div className="space-y-2">
                                {invoices.map(inv => (
                                    <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{inv.invoice_number}</p>
                                            <p className="text-xs text-muted-foreground">{inv.client_name} · {new Date(inv.issue_date).toLocaleDateString('en-TZ')}</p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline">{inv.status}</Badge>
                                            <p className="text-sm font-bold mt-1">{format(inv.total_amount, inv.currency)}</p>
                                            {Number(inv.paid_amount) > 0 && Number(inv.paid_amount) < Number(inv.total_amount) && (
                                                <p className="text-xs text-muted-foreground">{format(inv.paid_amount, inv.currency)} paid</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* DRIVERS TAB */}
                <TabsContent value="drivers">
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4">Who's driven this vehicle ({driverAssignments.length})</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Derived from trip history — there's no separate assignment record, so this reflects who was actually dispatched with this vehicle.
                        </p>
                        {driverAssignments.length === 0 ? (
                            <p className="text-muted-foreground text-sm p-4 text-center">No trips assigned to a driver yet</p>
                        ) : (
                            <div className="space-y-2">
                                {driverAssignments.map(d => (
                                    <div key={d.driverId} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{d.driverName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(d.firstAssigned).toLocaleDateString('en-TZ')} — {new Date(d.lastAssigned).toLocaleDateString('en-TZ')}
                                            </p>
                                        </div>
                                        <Badge variant="outline">{d.tripCount} trip{d.tripCount === 1 ? '' : 's'}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* CONTRACTS TAB */}
                <TabsContent value="contracts">
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4">Contracts ({contracts.length})</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Contracts aren't tied to a specific vehicle directly — these are the contracts behind invoices actually billed for this vehicle.
                        </p>
                        {contracts.length === 0 ? (
                            <p className="text-muted-foreground text-sm p-4 text-center">No contracts linked to this vehicle's invoices yet</p>
                        ) : (
                            <div className="space-y-2">
                                {contracts.map(c => (
                                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{c.contract_number}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {c.contract_type}
                                                {c.start_date ? ` · ${new Date(c.start_date).toLocaleDateString('en-TZ')}` : ''}
                                                {c.end_date ? ` — ${new Date(c.end_date).toLocaleDateString('en-TZ')}` : ''}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline">{c.status}</Badge>
                                            <p className="text-sm font-bold mt-1">{format(c.contract_value, c.currency)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* MAINTENANCE TAB */}
                <TabsContent value="maintenance">
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold">Maintenance Records</h3>
                            <Button size="sm" variant="outline">Request Maintenance</Button>
                        </div>
                        {maintenance.length === 0 ? (
                            <p className="text-muted-foreground text-sm p-4 text-center">No maintenance records</p>
                        ) : (
                            <div className="space-y-2">
                                {maintenance.slice(0, 5).map(m => (
                                    <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{m.title}</p>
                                            <p className="text-xs text-muted-foreground">{m.type}</p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline">{m.status}</Badge>
                                            <p className="text-sm font-bold mt-1">{format(m.cost || 0)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* INSPECTIONS TAB */}
                <TabsContent value="inspections">
                    <Card className="p-4">
                        {inspections.length === 0 ? (
                            <div className="text-center py-8">
                                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">No inspections recorded</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {inspections.map(i => (
                                    <div key={i.id} className="border rounded-lg p-3">
                                        <p className="font-semibold text-sm">{i.inspection_type} • {i.overall_status}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(i.inspected_at).toLocaleDateString('en-TZ')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* DOCUMENTS TAB */}
                <TabsContent value="documents">
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4">
                            Vehicle Documents {documents.length > 0 && `(${documents.length})`}
                        </h3>
                        {documents.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center">No documents</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {documents.map(doc => (
                                    <div key={doc.id} className="border rounded-lg p-3">
                                        <div className="flex items-start gap-2 mb-2">
                                            <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${doc.status === 'expired' ? 'bg-destructive' :
                                                    doc.status === 'expiring' ? 'bg-warning' :
                                                        'bg-success'
                                                }`}></div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">{doc.doc_name}</p>
                                                <p className="text-xs text-muted-foreground">{doc.doc_type}</p>
                                            </div>
                                        </div>
                                        <DocumentStatusBadge
                                            status={doc.status as any}
                                            expiryDate={doc.expiry_date}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* REQUESTS TAB */}
                <TabsContent value="requests">
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold">Fuel Requests</h3>
                            <Button size="sm" variant="outline">New Request</Button>
                        </div>
                        {fuelRequests.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center">No requests</p>
                        ) : (
                            <div className="space-y-2">
                                {fuelRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <p className="font-semibold text-sm">{req.requested_litres}L</p>
                                            <p className="text-xs text-muted-foreground">{req.odometer_reading}km</p>
                                        </div>
                                        <Badge variant="outline">{req.status}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* FUEL LOGS TAB */}
                <TabsContent value="fuel">
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold">Fuel Logs</h3>
                            <Button size="sm" variant="outline">Request Fuel</Button>
                        </div>
                        {fuelLogs.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center">No fuel logs</p>
                        ) : (
                            <div className="space-y-2">
                                {fuelLogs.slice(0, 10).map(log => (
                                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{log.litres}L @ {log.price_per_litre}/L</p>
                                            <p className="text-xs text-muted-foreground">{log.location}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold">{format(log.total_cost || 0)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(log.created_at).toLocaleDateString('en-TZ')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
