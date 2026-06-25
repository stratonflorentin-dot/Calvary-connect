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
    uptimePercent: number;
    lifetimeRevenue: number;
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
        uptimePercent: 0,
        lifetimeRevenue: 0,
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

    if (vehicle && vehicle.purchase_date) {
        const daysOwned = Math.floor(
            (Date.now() - new Date(vehicle.purchase_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysActive = daysOwned; // Simplified
        stats.uptimePercent = daysOwned > 0 ? (daysActive / daysOwned) * 100 : 0;

        if (vehicle.purchase_price && stats.lifetimeRevenue > 0) {
            stats.roi = ((stats.lifetimeRevenue - vehicle.purchase_price) / vehicle.purchase_price) * 100;
            stats.profitMargin = ((stats.lifetimeRevenue - stats.totalCost) / stats.lifetimeRevenue) * 100;
        }
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
        stats,
        utilizationByMonth,
        loading,
    };
}
