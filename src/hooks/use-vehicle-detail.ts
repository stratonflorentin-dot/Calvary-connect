import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Vehicle {
    id: string;
    vehicle_code: string;
    type: string;
    make: string;
    model: string;
    cargo_capacity_tons: number;
    gvwr_kg: number;
    tare_weight_kg: number;
    tank_capacity_litres: number;
    dimensions: string;
    color: string;
    odometer_km: number;
    chassis_number: string;
    location: string;
    purchase_price: number;
    purchase_date: string;
    warranty_expiry: string;
    rate_per_km: number;
    daily_rate: number;
    weekly_rate: number;
    monthly_rate: number;
    service_interval_km: number;
    last_service_date: string;
    next_service_date: string;
    health_score: number;
    registration_number: string;
    status: string;
    created_at: string;
    photo_url?: string | null;
}

interface Trip {
    id: string;
    trip_number: string;
    origin: string;
    destination: string;
    driver_id: string;
    vehicle_id: string;
    status: string;
    actual_cost: number;
    distance?: number;
    created_at: string;
}

interface MaintenanceRecord {
    id: string;
    vehicle_id: string;
    title: string;
    type: string;
    priority: string;
    requested_by: string;
    needed_by: string;
    expected_return: string;
    cost: number;
    status: string;
    created_at: string;
}

interface VehicleDocument {
    id: string;
    vehicle_id: string;
    doc_type: string;
    doc_name: string;
    expiry_date: string;
    issued_date: string;
    document_number: string;
    file_url: string;
    status: string;
    created_at: string;
}

interface VehicleInspection {
    id: string;
    vehicle_id: string;
    trip_id: string;
    inspected_by: string;
    inspection_type: string;
    overall_status: string;
    checklist: Record<string, string>;
    notes: string;
    inspected_at: string;
}

interface FuelLog {
    id: string;
    vehicle_id: string;
    litres: number;
    price_per_litre: number;
    total_cost: number;
    location: string;
    trip_id: string;
    created_at: string;
}

interface FuelRequest {
    id: string;
    vehicle_id: string;
    requested_litres: number;
    odometer_reading: number;
    status: string;
    created_at: string;
}

interface Invoice {
    id: string;
    invoice_number: string;
    vehicle_id: string;
    contract_id: string | null;
    trip_id: string | null;
    client_name: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    currency: string;
    issue_date: string;
}

interface Contract {
    id: string;
    contract_number: string;
    customer_id: string | null;
    client_id: string | null;
    contract_type: string;
    status: string;
    contract_value: number;
    currency: string;
    start_date: string | null;
    end_date: string | null;
}

interface DriverAssignment {
    driverId: string;
    driverName: string;
    tripCount: number;
    firstAssigned: string;
    lastAssigned: string;
}

interface Stats {
    totalCost: number;
    fuelSpend: number;
    maintenanceCost: number;
    totalTrips: number;
    kmDriven: number;
    totalLitres: number;
    fuelEfficiency: number;
    costPerKm: number;
    avgTripDistance: number;
    activeDaysPercent: number;
    /** Sum of invoice total_amount billed against this vehicle (not yet necessarily collected). */
    lifetimeRevenue: number;
    /** Sum of invoice paid_amount — cash actually collected. */
    collectedRevenue: number;
    profitability: number;
    profitMargin: number;
    roi: number;
    revenuePerTrip: number;
}

interface UtilizationMonth {
    month: string;
    year: number;
    percent: number;
    trips: number;
    km: number;
}

interface UseVehicleDetailReturn {
    vehicle: Vehicle | null;
    trips: Trip[];
    maintenance: MaintenanceRecord[];
    documents: VehicleDocument[];
    inspections: VehicleInspection[];
    fuelLogs: FuelLog[];
    fuelRequests: FuelRequest[];
    invoices: Invoice[];
    contracts: Contract[];
    driverAssignments: DriverAssignment[];
    stats: Stats;
    utilizationByMonth: UtilizationMonth[];
    loading: boolean;
}

export function useVehicleDetail(vehicleId: string): UseVehicleDetailReturn {
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
    const [documents, setDocuments] = useState<VehicleDocument[]>([]);
    const [inspections, setInspections] = useState<VehicleInspection[]>([]);
    const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
    const [fuelRequests, setFuelRequests] = useState<FuelRequest[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!vehicleId) return;

        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch vehicle
                const { data: vehicleData } = await supabase
                    .from('vehicles')
                    .select('*')
                    .eq('id', vehicleId)
                    .single();

                if (vehicleData) {
                    setVehicle(vehicleData);
                }

                // Fetch trips
                const { data: tripsData } = await supabase
                    .from('trips')
                    .select('*')
                    .eq('vehicle_id', vehicleId)
                    .order('created_at', { ascending: false });

                if (tripsData) {
                    setTrips(tripsData);

                    // "Who was assigned" — there's no dedicated assignment
                    // table, so this is derived from real trip history:
                    // every distinct driver who's actually driven this
                    // vehicle, with how many trips and over what span.
                    const driverIds = [...new Set(tripsData.map((t) => t.driver_id).filter(Boolean))];
                    if (driverIds.length > 0) {
                        const { data: driverProfiles } = await supabase
                            .from('user_profiles')
                            .select('id, name')
                            .in('id', driverIds);
                        const nameById = new Map((driverProfiles ?? []).map((p) => [p.id, p.name]));
                        const byDriver = new Map<string, { dates: string[] }>();
                        for (const t of tripsData) {
                            if (!t.driver_id) continue;
                            const entry = byDriver.get(t.driver_id) ?? { dates: [] };
                            entry.dates.push(t.created_at);
                            byDriver.set(t.driver_id, entry);
                        }
                        const assignments: DriverAssignment[] = [...byDriver.entries()]
                            .map(([driverId, { dates }]) => ({
                                driverId,
                                driverName: nameById.get(driverId) ?? 'Unknown driver',
                                tripCount: dates.length,
                                firstAssigned: dates.reduce((a, b) => (a < b ? a : b)),
                                lastAssigned: dates.reduce((a, b) => (a > b ? a : b)),
                            }))
                            .sort((a, b) => b.lastAssigned.localeCompare(a.lastAssigned));
                        setDriverAssignments(assignments);
                    } else {
                        setDriverAssignments([]);
                    }
                }

                // Fetch maintenance records
                const { data: maintData } = await supabase
                    .from('maintenance_requests')
                    .select('*')
                    .eq('vehicle_id', vehicleId)
                    .order('created_at', { ascending: false });

                if (maintData) {
                    setMaintenance(maintData);
                }

                // Fetch documents
                const { data: docsData } = await supabase
                    .from('vehicle_documents')
                    .select('*')
                    .eq('vehicle_id', vehicleId)
                    .order('expiry_date', { ascending: true });

                if (docsData) {
                    setDocuments(docsData);
                }

                // Fetch inspections
                const { data: inspectData } = await supabase
                    .from('vehicle_inspections')
                    .select('*')
                    .eq('vehicle_id', vehicleId)
                    .order('inspected_at', { ascending: false });

                if (inspectData) {
                    setInspections(inspectData);
                }

                // Fetch fuel logs
                const { data: fuelData } = await supabase
                    .from('fuel_logs')
                    .select('*')
                    .eq('vehicle_id', vehicleId)
                    .order('created_at', { ascending: false });

                if (fuelData) {
                    setFuelLogs(fuelData);
                }

                // Fetch fuel requests
                const { data: requestsData } = await supabase
                    .from('item_requests')
                    .select('*')
                    .eq('vehicle_id', vehicleId)
                    .order('created_at', { ascending: false });

                if (requestsData) {
                    setFuelRequests(requestsData);
                }

                // Fetch invoices billed against this vehicle — the real
                // revenue record (Dr/Cr posted, not a free-text amount on
                // the trip), excluding drafts/cancelled since those were
                // never actually committed revenue.
                const { data: invoiceData } = await supabase
                    .from('invoices')
                    .select('id, invoice_number, vehicle_id, contract_id, trip_id, client_name, status, total_amount, paid_amount, currency, issue_date')
                    .eq('vehicle_id', vehicleId)
                    .not('status', 'in', '(draft,cancelled)')
                    .order('issue_date', { ascending: false });

                if (invoiceData) {
                    setInvoices(invoiceData);

                    // Contracts aren't linked to a vehicle directly — they
                    // cover a customer/route — but invoices billed for this
                    // vehicle carry the contract_id that generated them, so
                    // that's the real link back to "which contracts this
                    // vehicle has actually been billed under."
                    const contractIds = [...new Set(invoiceData.map((i) => i.contract_id).filter(Boolean))];
                    if (contractIds.length > 0) {
                        const { data: contractData } = await supabase
                            .from('contracts')
                            .select('id, contract_number, customer_id, client_id, contract_type, status, contract_value, currency, start_date, end_date')
                            .in('id', contractIds);
                        setContracts(contractData ?? []);
                    } else {
                        setContracts([]);
                    }
                } else {
                    setInvoices([]);
                    setContracts([]);
                }
            } catch (error) {
                console.error('Error fetching vehicle detail:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Set up real-time subscriptions
        const subscription = supabase
            .channel(`vehicle-${vehicleId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'vehicles', filter: `id=eq.${vehicleId}` },
                () => fetchData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'maintenance_requests', filter: `vehicle_id=eq.${vehicleId}` },
                () => fetchData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'vehicle_documents', filter: `vehicle_id=eq.${vehicleId}` },
                () => fetchData()
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [vehicleId, supabase]);

    // Calculate statistics
    const stats: Stats = {
        totalCost: trips.reduce((sum, trip) => sum + (trip.actual_cost || 0), 0) +
            fuelLogs.reduce((sum, log) => sum + (log.total_cost || 0), 0) +
            maintenance.reduce((sum, m) => sum + (m.cost || 0), 0),
        fuelSpend: fuelLogs.reduce((sum, log) => sum + (log.total_cost || 0), 0),
        maintenanceCost: maintenance.reduce((sum, m) => sum + (m.cost || 0), 0),
        totalTrips: trips.length,
        kmDriven: trips.reduce((sum, trip) => sum + (trip.distance || 0), 0),
        totalLitres: fuelLogs.reduce((sum, log) => sum + (log.litres || 0), 0),
        fuelEfficiency: 0,
        costPerKm: 0,
        avgTripDistance: 0,
        activeDaysPercent: 0,
        // Real revenue, from posted invoices — previously this was never
        // assigned anywhere and silently stayed 0, so every figure derived
        // from it (profitability, margin, ROI, revenue/trip) was always 0
        // regardless of how much the vehicle actually earned.
        lifetimeRevenue: invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0),
        collectedRevenue: invoices.reduce((sum, inv) => sum + (Number(inv.paid_amount) || 0), 0),
        profitability: 0,
        profitMargin: 0,
        roi: 0,
        revenuePerTrip: 0,
    };

    // Calculate derived metrics
    if (stats.kmDriven > 0 && stats.totalLitres > 0) {
        stats.fuelEfficiency = stats.kmDriven / stats.totalLitres;
        stats.costPerKm = stats.totalCost / stats.kmDriven;
    }

    if (stats.totalTrips > 0) {
        stats.avgTripDistance = stats.kmDriven / stats.totalTrips;
        stats.revenuePerTrip = stats.lifetimeRevenue / stats.totalTrips;
    }

    stats.profitability = stats.lifetimeRevenue - stats.totalCost;
    if (stats.lifetimeRevenue > 0) {
        stats.profitMargin = (stats.profitability / stats.lifetimeRevenue) * 100;
    }
    if (vehicle?.purchase_price) {
        stats.roi = (stats.profitability / vehicle.purchase_price) * 100;
    }

    if (vehicle && vehicle.purchase_date) {
        const daysOwned = Math.floor(
            (Date.now() - new Date(vehicle.purchase_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        // No status-history table exists to track real downtime, so this
        // is an honest proxy — the share of owned days that had at least
        // one trip — rather than the previous version, which set
        // daysActive = daysOwned and so always showed exactly 100%.
        const activeDates = new Set(trips.map((t) => t.created_at?.slice(0, 10)).filter(Boolean));
        stats.activeDaysPercent = daysOwned > 0 ? (activeDates.size / daysOwned) * 100 : 0;
    }

    // Calculate utilization by month (last 6 months)
    const utilizationByMonth: UtilizationMonth[] = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('en-TZ', { month: 'long' });
        const year = date.getFullYear();
        const monthTrips = trips.filter(trip => {
            const tripDate = new Date(trip.created_at);
            return tripDate.getMonth() === date.getMonth() && tripDate.getFullYear() === year;
        });

        utilizationByMonth.push({
            month,
            year,
            percent: Math.min((monthTrips.length / 10) * 100, 100), // Simplified
            trips: monthTrips.length,
            km: monthTrips.reduce((sum, trip) => sum + (trip.distance || 0), 0),
        });
    }

    return {
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
    };
}
