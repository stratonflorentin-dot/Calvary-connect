import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { isVehicleAvailable } from '@/lib/fleet/vehicle-status';

type DashboardMode = 'operations' | 'finance' | 'fleet';
type PeriodRange = 'mtd' | '7d' | '30d' | 'qtd' | 'ytd' | 'custom';

interface DashboardStats {
    activeShipments: number;
    revenueMtd: number;
    outstanding: number;
    arBalance: number;
    expensesMtd: number;
    availableVehicles: number;
    totalVehicles: number;
    utilizationPct: number;
}

interface FleetStatus {
    inTransit: number;
    available: number;
    maintenance: number;
    repair: number;
    retired: number;
}

interface ShipmentFinance {
    requested: number;
    committed: number;
    actual: number;
    criticalVariance: number;
    warningVariance: number;
    shipmentCount: number;
}

interface RevenueTrendPoint {
    month: string;
    year: number;
    revenue: number;
}

interface TripPerformance {
    inTransit: number;
    completed: number;
    total: number;
    completionRate: number;
}

interface ActionableShipment {
    id: string;
    shipment_number: string;
    status: string;
    client_name: string;
}

interface RecentInvoice {
    id: string;
    invoice_number: string;
    customer_name: string;
    status: string;
    amount: number;
}

interface BankAccount {
    id: string;
    account_name: string;
    currency: string;
    balance: number;
}

interface ExpiringDoc {
    id: string;
    vehicle_id: string;
    vehicle_code: string;
    doc_type: string;
    expiry_date: string;
    status: string;
}

interface ActionCenterItem {
    id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    description: string;
    count: number;
    action_url: string;
}

interface CashRequest {
    id: string;
    reference: string;
    purpose: string;
    amount: number;
    status: string;
    created_at: string;
}

interface TopClient {
    id: string;
    name: string;
    revenue: number;
    rank: number;
}

interface UseDashboardReturn {
    stats: DashboardStats;
    fleetStatus: FleetStatus;
    shipmentFinance: ShipmentFinance;
    revenueTrend: RevenueTrendPoint[];
    tripPerformance: TripPerformance;
    actionableShipments: ActionableShipment[];
    recentInvoices: RecentInvoice[];
    bankAccounts: BankAccount[];
    expiringDocs: ExpiringDoc[];
    actionCenter: ActionCenterItem[];
    cashRequests: CashRequest[];
    topClients: TopClient[];
    pendingCashRequestsCount: number;
    lastRefreshed: Date;
    loading: boolean;
}

function getDateRange(range: PeriodRange, fromDate?: Date, toDate?: Date): [Date, Date] {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (range) {
        case 'mtd':
            start.setDate(1);
            end.setDate(now.getDate());
            end.setMonth(now.getMonth());
            end.setFullYear(now.getFullYear());
            break;
        case '7d':
            start.setDate(now.getDate() - 7);
            break;
        case '30d':
            start.setDate(now.getDate() - 30);
            break;
        case 'qtd':
            const quarter = Math.floor(now.getMonth() / 3);
            start.setMonth(quarter * 3);
            start.setDate(1);
            break;
        case 'ytd':
            start.setMonth(0);
            start.setDate(1);
            break;
        case 'custom':
            if (fromDate && toDate) {
                return [fromDate, toDate];
            }
            break;
    }

    return [start, end];
}

export function useDashboard(
    range: PeriodRange = 'mtd',
    mode: DashboardMode = 'operations',
    fromDate?: Date,
    toDate?: Date
): UseDashboardReturn {
    const [stats, setStats] = useState<DashboardStats>({
        activeShipments: 0,
        revenueMtd: 0,
        outstanding: 0,
        arBalance: 0,
        expensesMtd: 0,
        availableVehicles: 0,
        totalVehicles: 0,
        utilizationPct: 0,
    });

    const [fleetStatus, setFleetStatus] = useState<FleetStatus>({
        inTransit: 0,
        available: 0,
        maintenance: 0,
        repair: 0,
        retired: 0,
    });

    const [shipmentFinance, setShipmentFinance] = useState<ShipmentFinance>({
        requested: 0,
        committed: 0,
        actual: 0,
        criticalVariance: 0,
        warningVariance: 0,
        shipmentCount: 0,
    });

    const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
    const [tripPerformance, setTripPerformance] = useState<TripPerformance>({
        inTransit: 0,
        completed: 0,
        total: 0,
        completionRate: 0,
    });

    const [actionableShipments, setActionableShipments] = useState<ActionableShipment[]>([]);
    const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [expiringDocs, setExpiringDocs] = useState<ExpiringDoc[]>([]);
    const [actionCenter, setActionCenter] = useState<ActionCenterItem[]>([]);
    const [cashRequests, setCashRequests] = useState<CashRequest[]>([]);
    const [topClients, setTopClients] = useState<TopClient[]>([]);
    const [pendingCashRequestsCount, setPendingCashRequestsCount] = useState(0);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                const [startDate, endDate] = getDateRange(range, fromDate, toDate);

                // Fetch vehicles
                const { data: vehiclesData } = await supabase
                    .from('vehicles')
                    .select('id, status');

                const totalVehicles = vehiclesData?.length || 0;
                const availableCount = vehiclesData?.filter((v: any) => isVehicleAvailable(v.status)).length || 0;
                const inTransitCount = vehiclesData?.filter((v: any) => v.status === 'in_transit').length || 0;
                const maintenanceCount = vehiclesData?.filter((v: any) => v.status === 'maintenance').length || 0;
                const repairCount = vehiclesData?.filter((v: any) => v.status === 'repair').length || 0;
                const retiredCount = vehiclesData?.filter((v: any) => v.status === 'retired').length || 0;

                setFleetStatus({
                    inTransit: inTransitCount,
                    available: availableCount,
                    maintenance: maintenanceCount,
                    repair: repairCount,
                    retired: retiredCount,
                });

                setStats(prev => ({
                    ...prev,
                    totalVehicles,
                    availableVehicles: availableCount,
                    utilizationPct: totalVehicles > 0 ? ((inTransitCount / totalVehicles) * 100) : 0,
                }));

                // Fetch trips for revenue trend and performance. actual_cost is
                // not a real trips column (confirmed against the live schema —
                // querying it throws "column trips.actual_cost does not exist"),
                // so this silently returned null and revenueMtd/revenue trend
                // showed 0 every time; the real revenue figure is
                // total_amount/sales_amount. Status also used 'completed',
                // which no trip ever has — the real terminal status is
                // 'delivered'.
                const { data: tripsData } = await supabase
                    .from('trips')
                    .select('id, status, total_amount, sales_amount, currency, created_at')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString());

                if (tripsData) {
                    const completed = tripsData.filter((t: any) => t.status === 'delivered').length;
                    const inTransit = tripsData.filter((t: any) => t.status === 'in_transit').length;
                    const completionRate = tripsData.length > 0 ? (completed / tripsData.length) * 100 : 0;

                    setTripPerformance({
                        completed,
                        inTransit,
                        total: tripsData.length,
                        completionRate,
                    });

                    // TZS-only, same as every other single-number trend/KPI on
                    // this dashboard — a trip in another currency isn't summed
                    // in here rather than being silently blended into a wrong
                    // TZS-labeled figure.
                    const revenue = tripsData
                        .filter((trip: any) => (trip.currency || 'TZS') === 'TZS')
                        .reduce((sum: number, trip: any) => sum + Number(trip.total_amount ?? trip.sales_amount ?? 0), 0);
                    setStats(prev => ({
                        ...prev,
                        revenueMtd: revenue,
                    }));
                }

                // Fetch invoices
                const { data: invoicesData } = await supabase
                    .from('invoices')
                    .select('id, invoice_number, customer_name, status, amount, due_date')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString())
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (invoicesData) {
                    setRecentInvoices(invoicesData);

                    const outstanding = invoicesData
                        .filter((i: any) => i.status !== 'paid')
                        .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);

                    setStats(prev => ({
                        ...prev,
                        outstanding,
                        arBalance: outstanding,
                    }));
                }

                // Fetch shipments
                const { data: shipmentsData } = await supabase
                    .from('shipments')
                    .select('id, shipment_number, status, client_name');

                if (shipmentsData) {
                    const activeShipments = shipmentsData.filter((s: any) => s.status === 'active').length;
                    setStats(prev => ({
                        ...prev,
                        activeShipments,
                    }));

                    setActionableShipments(
                        shipmentsData.filter((s: any) => ['delivered', 'pending', 'overdue'].includes(s.status)).slice(0, 10)
                    );
                }

                // Fetch expenses
                const { data: expensesData } = await supabase
                    .from('expenses')
                    .select('amount')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString());

                if (expensesData) {
                    const totalExpenses = expensesData.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
                    setStats(prev => ({
                        ...prev,
                        expensesMtd: totalExpenses,
                    }));
                }

                // Fetch expiring documents
                const { data: docsData } = await supabase
                    .from('vehicle_documents')
                    .select('id, vehicle_id, doc_type, expiry_date, status, vehicles(vehicle_code)')
                    .neq('status', 'valid')
                    .order('expiry_date', { ascending: true })
                    .limit(10);

                if (docsData) {
                    setExpiringDocs(docsData as any);
                }

                // Pending cash requests — mirrors the query already used on
                // premium-dashboard/page.tsx. This hook declared the state
                // for it (cashRequests/pendingCashRequestsCount, both
                // exported and consumed by dashboard/page.tsx's banner) but
                // never actually fetched anything, so the count was always 0
                // and that banner could never show even with real pending
                // requests.
                const { data: cashRequestsData } = await supabase
                    .from('cash_requests')
                    .select('id, reference:request_number, purpose, amount, status, created_at')
                    .eq('status', 'pending');

                if (cashRequestsData) {
                    setCashRequests(cashRequestsData as any);
                    setPendingCashRequestsCount(cashRequestsData.length);
                }

                // Fetch revenue trend (last 6 months)
                const trendData: RevenueTrendPoint[] = [];
                for (let i = 5; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

                    const { data: monthTrips } = await supabase
                        .from('trips')
                        .select('total_amount, sales_amount, currency')
                        .gte('created_at', monthStart.toISOString())
                        .lte('created_at', monthEnd.toISOString());

                    const revenue = (monthTrips ?? [])
                        .filter((trip: any) => (trip.currency || 'TZS') === 'TZS')
                        .reduce((sum: number, trip: any) => sum + Number(trip.total_amount ?? trip.sales_amount ?? 0), 0);

                    trendData.push({
                        month: date.toLocaleString('en-TZ', { month: 'short' }),
                        year: date.getFullYear(),
                        revenue,
                    });
                }
                setRevenueTrend(trendData);

                // Set up action center alerts
                const alerts: ActionCenterItem[] = [];

                // FIX: read the values just fetched this cycle (docsData,
                // cashRequestsData), not the expiringDocs/pendingCashRequestsCount
                // state variables — those are captured in this effect's closure
                // from whenever it was created and never update between the
                // 90-second setInterval ticks, since the effect's own deps
                // don't change on a timer. Reading state instead of the fresh
                // fetch result meant these alerts used a permanently-stale
                // (pre-first-fetch, i.e. always empty) snapshot.
                const expiringDocsCount = docsData?.length ?? 0;
                if (expiringDocsCount > 0) {
                    alerts.push({
                        id: 'expired-docs',
                        severity: 'CRITICAL',
                        title: 'Expired Compliance Docs',
                        description: `${expiringDocsCount} vehicle documents are expired`,
                        count: expiringDocsCount,
                        action_url: '/fleet/vehicles?filter=expired_docs',
                    });
                }

                const pendingCashCount = cashRequestsData?.length ?? 0;
                if (pendingCashCount > 0) {
                    alerts.push({
                        id: 'pending-cash',
                        severity: 'WARNING',
                        title: 'Pending Cash Requests',
                        description: `${pendingCashCount} cash requests awaiting approval`,
                        count: pendingCashCount,
                        action_url: '/accountant/expenses',
                    });
                }

                setActionCenter(alerts);
                setLastRefreshed(new Date());
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();

        // Auto-refresh every 90 seconds
        const interval = setInterval(fetchDashboardData, 90000);

        return () => clearInterval(interval);
    }, [range, mode, fromDate, toDate, supabase]);

    return {
        stats,
        fleetStatus,
        shipmentFinance,
        revenueTrend,
        tripPerformance,
        actionableShipments,
        recentInvoices,
        bankAccounts,
        expiringDocs,
        actionCenter,
        cashRequests,
        topClients,
        pendingCashRequestsCount,
        lastRefreshed,
        loading,
    };
}
