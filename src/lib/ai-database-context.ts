// AI Database Context - Provides database schema and query functions for AI agent
import { supabase } from './supabase';
import { getDriverLocationsForMapAction } from '@/app/tracking/actions';

export interface DatabaseSchema {
  tables: {
    name: string;
    columns: { name: string; type: string; description?: string }[];
  }[];
}

export const FLEET_SCHEMA: DatabaseSchema = {
  tables: [
    {
      name: 'vehicles',
      columns: [
        { name: 'id', type: 'UUID', description: 'Vehicle unique identifier' },
        { name: 'plate_number', type: 'TEXT', description: 'License plate' },
        { name: 'make', type: 'TEXT', description: 'Vehicle manufacturer' },
        { name: 'model', type: 'TEXT', description: 'Vehicle model' },
        { name: 'year', type: 'INTEGER', description: 'Manufacturing year' },
        { name: 'status', type: 'TEXT', description: 'Vehicle status (active/maintenance/inactive)' },
        { name: 'fuel_type', type: 'TEXT', description: 'Fuel type (diesel/petrol)' },
        { name: 'current_fuel_level', type: 'INTEGER', description: 'Current fuel percentage' },
        { name: 'mileage', type: 'INTEGER', description: 'Total kilometers' },
        { name: 'assigned_driver_id', type: 'UUID', description: 'Assigned driver' }
      ]
    },
    {
      name: 'trips',
      columns: [
        { name: 'id', type: 'UUID', description: 'Trip unique identifier' },
        { name: 'vehicle_id', type: 'UUID', description: 'Vehicle used' },
        { name: 'driver_id', type: 'UUID', description: 'Driver assigned' },
        { name: 'origin', type: 'TEXT', description: 'Starting location' },
        { name: 'destination', type: 'TEXT', description: 'Ending location' },
        { name: 'distance_km', type: 'INTEGER', description: 'Distance in kilometers' },
        { name: 'revenue', type: 'DECIMAL', description: 'Trip revenue' },
        { name: 'fuel_cost', type: 'DECIMAL', description: 'Fuel cost' },
        { name: 'status', type: 'TEXT', description: 'Trip status' },
        { name: 'created_at', type: 'TIMESTAMP', description: 'Trip creation date' }
      ]
    },
    {
      name: 'expenses',
      columns: [
        { name: 'id', type: 'UUID', description: 'Expense unique identifier' },
        { name: 'vehicle_id', type: 'UUID', description: 'Vehicle for expense' },
        { name: 'category', type: 'TEXT', description: 'Expense category' },
        { name: 'amount', type: 'DECIMAL', description: 'Expense amount' },
        { name: 'description', type: 'TEXT', description: 'Expense description' },
        { name: 'date', type: 'DATE', description: 'Expense date' }
      ]
    },
    {
      name: 'user_profiles',
      columns: [
        { name: 'id', type: 'UUID', description: 'User unique identifier' },
        { name: 'email', type: 'TEXT', description: 'User email' },
        { name: 'name', type: 'TEXT', description: 'User full name' },
        { name: 'role', type: 'TEXT', description: 'User role (CEO/ADMIN/DRIVER/etc)' },
        { name: 'status', type: 'TEXT', description: 'User status' }
      ]
    }
  ]
};

// Extend schema with additional tables used by AI
FLEET_SCHEMA.tables.push(
  {
    // NOT the legacy `contracts` table — that one is abandoned (see
    // migration 041's era investigation this session: real contract data
    // lives in transport_contracts, created from src/app/sales/page.tsx's
    // Contracts tab; `contracts`/`clients` are dead duplicates that were
    // silently making Contract Health and CEO Insights report zero data).
    name: 'transport_contracts',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'contract_number', type: 'TEXT' },
      { name: 'customer_id', type: 'UUID' },
      { name: 'contract_type', type: 'TEXT' },
      { name: 'status', type: "TEXT /* draft/active/expired/terminated */" },
      { name: 'start_date', type: 'DATE' },
      { name: 'end_date', type: 'DATE' },
      { name: 'contract_value', type: 'DECIMAL' },
      { name: 'currency', type: 'TEXT' },
      { name: 'created_at', type: 'TIMESTAMP' }
    ]
  },
  {
    name: 'customers',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'company_name', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'contact_person', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' }
    ]
  },
  {
    name: 'inventory',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'item_name', type: 'TEXT' },
      { name: 'category', type: 'TEXT' },
      { name: 'quantity_available', type: 'INTEGER' },
      { name: 'min_stock_level', type: 'INTEGER' },
      { name: 'unit_cost', type: 'DECIMAL' },
    ]
  },
  {
    name: 'fuel_logs',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'vehicle_id', type: 'UUID' },
      { name: 'litres', type: 'DECIMAL' },
      { name: 'cost_per_litre', type: 'DECIMAL' },
      { name: 'total_cost', type: 'DECIMAL' },
      { name: 'date', type: 'DATE' },
      { name: 'location', type: 'TEXT' }
    ]
  },
  {
    name: 'maintenance_records',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'vehicle_id', type: 'UUID' },
      { name: 'type', type: "TEXT /* service/repair/inspection */" },
      { name: 'description', type: 'TEXT' },
      { name: 'cost', type: 'DECIMAL' },
      { name: 'date', type: 'DATE' },
      { name: 'next_service_date', type: 'DATE' },
      { name: 'status', type: "TEXT /* pending/completed/overdue */" }
    ]
  },
  {
    name: 'rate_sheets',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'rate_sheet_name', type: 'TEXT' },
      { name: 'effective_date', type: 'DATE' },
      { name: 'currency', type: 'TEXT' },
      { name: 'rates', type: 'JSONB' },
      { name: 'is_active', type: 'BOOLEAN' }
    ]
  }
);

// Data fetchers for AI context
async function safeQuery(queryFn: () => any, fallbackKey = 'data') {
  try {
    const res = await Promise.resolve(queryFn());
    if (res && res.error) {
      console.warn('Supabase query error:', res.error.message || res.error);
      return { [fallbackKey]: [] };
    }
    return res || { [fallbackKey]: [] };
  } catch (err) {
    console.warn('Supabase query threw:', err);
    return { [fallbackKey]: [] };
  }
}

export async function getFleetContext() {
  const [vehicles, trips, expenses, users, contracts, customers, fuelLogs, maintenance, rateSheets, inventory] = await Promise.all([
    safeQuery(() => supabase.from('vehicles').select('*').limit(200)),
    safeQuery(() => supabase.from('trips').select('*').order('created_at', { ascending: false }).limit(200)),
    safeQuery(() => supabase.from('expenses').select('*').order('date', { ascending: false }).limit(200)),
    safeQuery(() => supabase.from('user_profiles').select('*').limit(200)),
    safeQuery(async () => {
      let r = await supabase.from('transport_contracts').select('*, customers(company_name)').order('created_at', { ascending: false }).limit(200);
      if (r.error) return { data: [] };
      return r;
    }),
    safeQuery(() => supabase.from('customers').select('*').limit(200)),
    // Relationship selects can fail if FK relationship missing; try vehicles(plate_number) then fallback to '*'
    safeQuery(async () => {
      try {
        let r = await supabase.from('fuel_logs').select('*,vehicles(plate_number)').order('fuel_date', { ascending: false }).limit(200);
        if (r.error) {
          r = await supabase.from('fuel_logs').select('*').order('fuel_date', { ascending: false }).limit(200);
        }
        return r;
      } catch (e) {
        return { data: [] };
      }
    }),
    safeQuery(async () => {
      try {
        let r = await supabase.from('maintenance_records').select('*,vehicles(plate_number)').order('created_at', { ascending: false }).limit(200);
        if (r.error) {
          r = await supabase.from('maintenance_records').select('*').order('created_at', { ascending: false }).limit(200);
        }
        return r;
      } catch (e) {
        return { data: [] };
      }
    }),
    safeQuery(() => supabase.from('rate_sheets').select('*').eq('is_active', true).order('effective_date', { ascending: false }).limit(50)),
    safeQuery(() => supabase.from('inventory').select('*').limit(500)),
  ]);

  return {
    vehicles: vehicles.data || [],
    trips: trips.data || [],
    expenses: expenses.data || [],
    users: users.data || [],
    contracts: contracts.data || [],
    customers: customers.data || [],
    fuelLogs: (fuelLogs.data || []).map((f: any) => ({ ...f, vehicle: f.vehicles })),
    maintenance: (maintenance.data || []).map((m: any) => ({ ...m, vehicle: m.vehicles })),
    rateSheets: rateSheets.data || [],
    inventory: inventory.data || [],
  };
}

const BUSY_TRIP_STATUSES = ["pending", "loading", "in_transit"];

export interface DispatchCandidateVehicle {
  id: string;
  plate_number: string;
  type: string | null;
  trailer_sub_type: string | null;
  status: string | null;
  cargo_capacity_tons: number | null;
  gvw_kg: number | null;
  tare_weight_kg: number | null;
  tank_capacity_litres: number | null;
  dimensions: string | null;
}

export interface DispatchCandidateDriver {
  id: string;
  name: string;
  license_class: string | null;
  license_expiry: string | null;
  performanceScore: number | null;
  location: { status: string; lastUpdate: string } | null;
}

export interface DispatchContext {
  vehicles: DispatchCandidateVehicle[];
  drivers: DispatchCandidateDriver[];
  busyVehicleIds: Set<string>;
  busyDriverIds: Set<string>;
}

/**
 * Context for AI dispatch suggestions — trimmed to what a driver+vehicle
 * ranking prompt needs, unlike `getFleetContext()` which returns full rows
 * for a general-purpose chat/analysis feature. Driver "busy" status has no
 * DB column and is derived from active trip assignments.
 */
export async function getDispatchContext(): Promise<DispatchContext> {
  const [vehiclesRes, driversRes, activeTripsRes, reviewsRes, locationsResult] = await Promise.all([
    safeQuery(() =>
      supabase
        .from('vehicles')
        .select('id, plate_number, type, trailer_sub_type, status, cargo_capacity_tons, gvw_kg, tare_weight_kg, tank_capacity_litres, dimensions')
        .limit(300),
    ),
    safeQuery(() => supabase.from('user_profiles').select('id, name, license_class, license_expiry').eq('role', 'DRIVER').limit(300)),
    safeQuery(() => supabase.from('trips').select('driver_id, truck_id, trailer_id, vehicle_id, status').in('status', BUSY_TRIP_STATUSES)),
    safeQuery(() => supabase.from('performance_reviews').select('employee_id, rating')),
    // Trusted server-side context (same as getFleetContext, which has no
    // auth check either) — bypasses the manager-session verification that
    // gates this action's normal client-facing callers.
    getDriverLocationsForMapAction(null, null, null, true).catch(() => ({ locations: [] as const })),
  ]);

  const activeTrips = activeTripsRes.data || [];
  const busyDriverIds = new Set<string>(activeTrips.map((t: any) => t.driver_id).filter(Boolean));
  const busyVehicleIds = new Set<string>(
    activeTrips.flatMap((t: any) => [t.truck_id, t.trailer_id, t.vehicle_id]).filter(Boolean),
  );

  const reviews = reviewsRes.data || [];
  const scoreByDriver = new Map<string, number | null>();
  for (const driver of driversRes.data || []) {
    const driverReviews = reviews.filter((r: any) => r.employee_id === driver.id);
    // No reviews means no evidenced score, not an assumed-average one —
    // see src/app/api/reports/driver-performance/route.ts, which used to
    // default this to 4.5 and has since been fixed to do the same.
    const avg = driverReviews.length > 0
      ? driverReviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / driverReviews.length
      : null;
    scoreByDriver.set(driver.id, avg !== null ? Number(avg.toFixed(1)) : null);
  }

  const locationByDriver = new Map<string, { status: string; lastUpdate: string }>();
  for (const loc of locationsResult.locations || []) {
    locationByDriver.set(loc.driverId, { status: loc.status, lastUpdate: loc.lastUpdate });
  }

  return {
    vehicles: vehiclesRes.data || [],
    drivers: (driversRes.data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      license_class: d.license_class,
      license_expiry: d.license_expiry,
      performanceScore: scoreByDriver.get(d.id) ?? null,
      location: locationByDriver.get(d.id) ?? null,
    })),
    busyVehicleIds,
    busyDriverIds,
  };
}

export function computeBusinessMetrics(ctx: any) {
  const now = new Date();
  const isThisMonth = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  const completedTrips = (ctx.trips || []).filter((t: any) => t.status === 'completed');
  const totalRevenue = completedTrips.reduce((s: number, t: any) => s + (Number(t.revenue) || 0), 0);
  const totalExpenses = (ctx.expenses || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const revenueThisMonth = completedTrips.filter((t: any) => isThisMonth(t.created_at)).reduce((s: number, t: any) => s + (Number(t.revenue) || 0), 0);
  const expensesThisMonth = (ctx.expenses || []).filter((e: any) => isThisMonth(e.date)).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const totalFuelCost = (ctx.fuelLogs || []).reduce((s: number, f: any) => s + (Number(f.total_cost) || 0), 0);
  const totalFuelLiters = (ctx.fuelLogs || []).reduce((s: number, f: any) => s + (Number(f.litres) || 0), 0);
  const fuelLitersThisMonth = (ctx.fuelLogs || []).filter((f: any) => isThisMonth(f.date)).reduce((s: number, f: any) => s + (Number(f.litres) || 0), 0);
  const totalMaintenanceCost = (ctx.maintenance || []).filter((m: any) => m.status === 'completed').reduce((s: number, m: any) => s + (Number(m.cost) || 0), 0);
  const inUseVehicles = (ctx.vehicles || []).filter((v: any) => v.status === 'in_use').length;
  const expiringContracts = (ctx.contracts || []).filter((c: any) => {
    if (!c.end_date) return false;
    const days = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
    return days <= 30 && days >= 0;
  });
  const lowStockCount = (ctx.inventory || []).filter((i: any) =>
    Number(i.quantity_available) <= Number(i.min_stock_level ?? 0),
  ).length;
  const onlineDrivers = (ctx.users || []).filter((u: any) =>
    u.role === 'DRIVER' && u.presence_status === 'online',
  ).length;
  const completedDeliveriesThisMonth = completedTrips.filter((t: any) => isThisMonth(t.created_at)).length;

  return {
    totalRevenue,
    totalExpenses,
    revenueThisMonth,
    expensesThisMonth,
    netProfit: totalRevenue - totalExpenses,
    netProfitThisMonth: revenueThisMonth - expensesThisMonth,
    profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : '0',
    fleetUtilization: (ctx.vehicles || []).length > 0 ? (inUseVehicles / (ctx.vehicles || []).length * 100).toFixed(1) : '0',
    activeTripsCount: (ctx.trips || []).filter((t: any) => ['in_transit', 'loading', 'pending'].includes(t.status)).length,
    completedTripsCount: completedTrips.length,
    completedDeliveriesThisMonth,
    totalFuelCost,
    totalFuelLiters,
    fuelLitersThisMonth,
    totalMaintenanceCost,
    activeContracts: (ctx.contracts || []).filter((c: any) => c.status === 'active').length,
    expiringContracts: expiringContracts.length,
    overdueMaintenanceCount: (ctx.maintenance || []).filter((m: any) => m.status === 'overdue').length,
    pendingMaintenanceCount: (ctx.maintenance || []).filter((m: any) => m.status === 'pending').length,
    lowStockCount,
    onlineDriverCount: onlineDrivers,
    costPerTrip: completedTrips.length > 0 ? totalExpenses / completedTrips.length : 0
  };
}

export function getSchemaString(): string {
  return FLEET_SCHEMA.tables.map(table => {
    const cols = table.columns.map(c => `${c.name} (${c.type})`).join(', ');
    return `Table ${table.name}: ${cols}`;
  }).join('\n');
}
