// AI Database Context - Provides database schema and query functions for AI agent
import { supabase } from './supabase';

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
    name: 'contracts',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'contract_number', type: 'TEXT' },
      { name: 'client_id', type: 'UUID' },
      { name: 'status', type: "TEXT /* draft/sent/active/expired/terminated */" },
      { name: 'effective_date', type: 'DATE' },
      { name: 'expiry_date', type: 'DATE' },
      { name: 'term_months', type: 'INTEGER' },
      { name: 'transporter_name', type: 'TEXT' },
      { name: 'client_signed_at', type: 'TIMESTAMP' },
      { name: 'transporter_signed_at', type: 'TIMESTAMP' },
      { name: 'terminated_at', type: 'TIMESTAMP' },
      { name: 'created_at', type: 'TIMESTAMP' }
    ]
  },
  {
    name: 'clients',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'name', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'contact_person', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' }
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
export async function getFleetContext() {
  async function safeQuery(queryFn: () => Promise<any>, fallbackKey = 'data') {
    try {
      const res = await queryFn();
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

  const [vehicles, trips, expenses, users, contracts, clients, fuelLogs, maintenance, rateSheets] = await Promise.all([
    safeQuery(() => supabase.from('vehicles').select('*').limit(200)),
    safeQuery(() => supabase.from('trips').select('*').order('created_at', { ascending: false }).limit(200)),
    safeQuery(() => supabase.from('expenses').select('*').order('date', { ascending: false }).limit(200)),
    safeQuery(() => supabase.from('user_profiles').select('*').limit(200)),
    safeQuery(() => supabase.from('contracts').select('*,clients(name)').limit(200)),
    safeQuery(() => supabase.from('clients').select('*').limit(200)),
    // Relationship selects can fail if FK relationship missing; try vehicles(plate_number) then fallback to '*'
    safeQuery(async () => {
      let r = await supabase.from('fuel_logs').select('*,vehicles(plate_number)').order('date', { ascending: false }).limit(200);
      if (r.error) {
        r = await supabase.from('fuel_logs').select('*').order('date', { ascending: false }).limit(200);
      }
      return r;
    }),
    safeQuery(async () => {
      let r = await supabase.from('maintenance_records').select('*,vehicles(plate_number)').order('date', { ascending: false }).limit(200);
      if (r.error) {
        r = await supabase.from('maintenance_records').select('*').order('date', { ascending: false }).limit(200);
      }
      return r;
    }),
    safeQuery(() => supabase.from('rate_sheets').select('*').eq('is_active', true).order('effective_date', { ascending: false }).limit(50))
  ]);

  return {
    vehicles: vehicles.data || [],
    trips: trips.data || [],
    expenses: expenses.data || [],
    users: users.data || [],
    contracts: contracts.data || [],
    clients: clients.data || [],
    fuelLogs: (fuelLogs.data || []).map((f: any) => ({ ...f, vehicle: f.vehicles })),
    maintenance: (maintenance.data || []).map((m: any) => ({ ...m, vehicle: m.vehicles })),
    rateSheets: rateSheets.data || []
  };
}

export function computeBusinessMetrics(ctx: any) {
  const completedTrips = (ctx.trips || []).filter((t: any) => t.status === 'completed');
  const totalRevenue = completedTrips.reduce((s: number, t: any) => s + (Number(t.revenue) || 0), 0);
  const totalExpenses = (ctx.expenses || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const totalFuelCost = (ctx.fuelLogs || []).reduce((s: number, f: any) => s + (Number(f.total_cost) || 0), 0);
  const totalMaintenanceCost = (ctx.maintenance || []).filter((m: any) => m.status === 'completed').reduce((s: number, m: any) => s + (Number(m.cost) || 0), 0);
  const inUseVehicles = (ctx.vehicles || []).filter((v: any) => v.status === 'in_use').length;
  const expiringContracts = (ctx.contracts || []).filter((c: any) => {
    if (!c.expiry_date) return false;
    const days = Math.ceil((new Date(c.expiry_date).getTime() - Date.now()) / 86400000);
    return days <= 30 && days >= 0;
  });

  return {
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : '0',
    fleetUtilization: (ctx.vehicles || []).length > 0 ? (inUseVehicles / (ctx.vehicles || []).length * 100).toFixed(1) : '0',
    activeTripsCount: (ctx.trips || []).filter((t: any) => ['in_transit', 'loading', 'pending'].includes(t.status)).length,
    completedTripsCount: completedTrips.length,
    totalFuelCost,
    totalMaintenanceCost,
    activeContracts: (ctx.contracts || []).filter((c: any) => c.status === 'active').length,
    expiringContracts: expiringContracts.length,
    overdueMaintenanceCount: (ctx.maintenance || []).filter((m: any) => m.status === 'overdue').length,
    costPerTrip: completedTrips.length > 0 ? totalExpenses / completedTrips.length : 0
  };
}

export function getSchemaString(): string {
  return FLEET_SCHEMA.tables.map(table => {
    const cols = table.columns.map(c => `${c.name} (${c.type})`).join(', ');
    return `Table ${table.name}: ${cols}`;
  }).join('\n');
}
