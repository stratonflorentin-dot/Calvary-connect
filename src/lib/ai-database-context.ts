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
    // The real, live contract ledger — confirmed this session against the
    // actual schema. transport_contracts (what this file queried until now)
    // is the dead duplicate: zero rows, nothing writes to it anymore. Every
    // real contract created through Sales (contract-generator.tsx,
    // saveContractFromAgreement) writes here, keyed by customer_id.
    name: 'contracts',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'contract_number', type: 'TEXT' },
      { name: 'customer_id', type: 'UUID' },
      { name: 'contract_type', type: 'TEXT' },
      { name: 'status', type: "TEXT /* draft/sent/active/expired/terminated */" },
      { name: 'start_date', type: 'DATE' },
      { name: 'end_date', type: 'DATE' },
      { name: 'contract_value', type: 'DECIMAL' },
      { name: 'currency', type: 'TEXT' },
      { name: 'created_at', type: 'TIMESTAMP' }
    ]
  },
  {
    name: 'quotations',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'quotation_number', type: 'TEXT' },
      { name: 'customer_id', type: 'UUID' },
      { name: 'status', type: "TEXT /* draft/sent/viewed/accepted/rejected/expired */" },
      { name: 'origin', type: 'TEXT' },
      { name: 'destination', type: 'TEXT' },
      { name: 'total_amount', type: 'DECIMAL' },
      { name: 'currency', type: 'TEXT' },
      { name: 'shipment_id', type: 'UUID /* set once accepted and converted into a real job */' },
      { name: 'created_at', type: 'TIMESTAMP' }
    ]
  },
  {
    name: 'invoices',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'invoice_number', type: 'TEXT' },
      { name: 'customer_id', type: 'UUID' },
      { name: 'type', type: "TEXT /* receivable/payable */" },
      { name: 'status', type: "TEXT /* draft/sent/partial/paid/overdue/cancelled */" },
      { name: 'total_amount', type: 'DECIMAL' },
      { name: 'currency', type: 'TEXT' },
      { name: 'due_date', type: 'DATE' },
      { name: 'paid_at', type: 'TIMESTAMP' }
    ]
  },
  {
    name: 'bookings',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'booking_number', type: 'TEXT' },
      { name: 'customer_id', type: 'UUID' },
      { name: 'status', type: 'TEXT' },
      { name: 'amount', type: 'DECIMAL' },
      { name: 'currency', type: 'TEXT' },
      { name: 'created_at', type: 'TIMESTAMP' }
    ]
  },
  {
    name: 'shipments',
    columns: [
      { name: 'id', type: 'UUID' },
      { name: 'shipment_number', type: 'TEXT' },
      { name: 'customer_id', type: 'UUID' },
      { name: 'status', type: "TEXT /* created/approved/active/delivered/paid/cancelled */" },
      { name: 'origin_city', type: 'TEXT' },
      { name: 'destination_city', type: 'TEXT' },
      { name: 'quoted_amount', type: 'DECIMAL' },
      { name: 'currency', type: 'TEXT' }
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
  const [
    vehicles, trips, expenses, users, contracts, customers, fuelLogs, maintenance,
    rateSheets, inventory, quotations, invoices, bookings, shipments, bankAccounts,
  ] = await Promise.all([
    safeQuery(() => supabase.from('vehicles').select('*').limit(200)),
    safeQuery(() => supabase.from('trips').select('*').order('created_at', { ascending: false }).limit(200)),
    safeQuery(() => supabase.from('expenses').select('*').order('date', { ascending: false }).limit(200)),
    safeQuery(() => supabase.from('user_profiles').select('*').limit(200)),
    // contracts, not transport_contracts — confirmed dead (zero rows,
    // nothing writes to it) elsewhere this session. customer_id is the
    // real FK this table is linked by.
    safeQuery(async () => {
      let r = await supabase.from('contracts').select('*, customers:customer_id(company_name)').order('created_at', { ascending: false }).limit(200);
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
    // Sales pipeline — the AI previously had no visibility into quotations
    // at all, so it couldn't answer anything about pipeline/conversion.
    safeQuery(async () => {
      let r = await supabase.from('quotations').select('*, customers:customer_id(company_name)').order('created_at', { ascending: false }).limit(200);
      if (r.error) return { data: [] };
      return r;
    }),
    // Real revenue/AR — trips.revenue is a dead legacy column (always 0);
    // invoices is the actual billing/receivable record, and the AI
    // previously had zero visibility into it.
    safeQuery(async () => {
      let r = await supabase.from('invoices').select('*, customers:customer_id(company_name)').order('created_at', { ascending: false }).limit(200);
      if (r.error) return { data: [] };
      return r;
    }),
    safeQuery(() => supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(200)),
    safeQuery(async () => {
      let r = await supabase.from('shipments').select('*, customers:customer_id(company_name)').order('created_at', { ascending: false }).limit(200);
      if (r.error) return { data: [] };
      return r;
    }),
    safeQuery(() => supabase.from('bank_accounts').select('*')),
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
    quotations: quotations.data || [],
    invoices: invoices.data || [],
    bookings: bookings.data || [],
    shipments: shipments.data || [],
    bankAccounts: bankAccounts.data || [],
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

function sumByCurrency(rows: any[], amountOf: (r: any) => number, currencyOf: (r: any) => string = (r) => r.currency || 'TZS'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const cur = currencyOf(r) || 'TZS';
    out[cur] = (out[cur] ?? 0) + (Number(amountOf(r)) || 0);
  }
  return out;
}

export function computeBusinessMetrics(ctx: any) {
  const now = new Date();
  const isThisMonth = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  // Real terminal trip status is 'delivered' (not 'completed', which no
  // trip ever has), and trips.revenue/price are dead legacy columns
  // (always 0) — total_amount/sales_amount are the real figures. Kept
  // for trip-volume counts; paid invoices below are the real revenue
  // source, since they're the actual billing/recognition record.
  const deliveredTrips = (ctx.trips || []).filter((t: any) => t.status === 'delivered');
  const deliveredTripsThisMonth = deliveredTrips.filter((t: any) => isThisMonth(t.created_at));

  // Revenue and expenses are grouped by currency rather than blindly
  // summed — a USD invoice and a TZS expense are not the same unit, and
  // presenting a blended "total" would just be a wrong number with a
  // confident-looking label. The AI is instructed (system prompt) to
  // always state currency and never sum across these maps itself.
  const paidInvoices = (ctx.invoices || []).filter((i: any) => i.status === 'paid' && (i.type ?? 'receivable') === 'receivable');
  const revenueByCurrency = sumByCurrency(paidInvoices, (i) => i.total_amount ?? i.amount ?? 0);
  const revenueThisMonthByCurrency = sumByCurrency(paidInvoices.filter((i: any) => isThisMonth(i.paid_at ?? i.issue_date ?? i.created_at)), (i) => i.total_amount ?? i.amount ?? 0);
  const outstandingReceivables = (ctx.invoices || []).filter((i: any) => (i.type ?? 'receivable') === 'receivable' && i.status !== 'paid' && i.status !== 'cancelled');
  const outstandingReceivablesByCurrency = sumByCurrency(outstandingReceivables, (i) => (i.total_amount ?? i.amount ?? 0) - (i.paid_amount ?? 0));
  const overdueReceivables = outstandingReceivables.filter((i: any) => i.due_date && new Date(i.due_date).getTime() < Date.now());
  const overdueReceivablesByCurrency = sumByCurrency(overdueReceivables, (i) => (i.total_amount ?? i.amount ?? 0) - (i.paid_amount ?? 0));

  const expensesByCurrency = sumByCurrency(ctx.expenses || [], (e) => e.amount ?? 0);
  const expensesThisMonthByCurrency = sumByCurrency((ctx.expenses || []).filter((e: any) => isThisMonth(e.date)), (e) => e.amount ?? 0);

  const cashByCurrency = sumByCurrency(ctx.bankAccounts || [], (a) => a.current_balance ?? 0);

  // Sales pipeline — previously entirely invisible to the AI.
  const quotations = ctx.quotations || [];
  const openQuotations = quotations.filter((q: any) => !['accepted', 'rejected', 'expired'].includes(q.status));
  const acceptedQuotations = quotations.filter((q: any) => Boolean(q.shipment_id));
  const pipelineValueByCurrency = sumByCurrency(openQuotations, (q) => q.total_amount ?? q.amount ?? 0);
  const quotationConversionRate = quotations.length > 0 ? Number(((acceptedQuotations.length / quotations.length) * 100).toFixed(1)) : null;

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

  return {
    revenueByCurrency,
    revenueThisMonthByCurrency,
    expensesByCurrency,
    expensesThisMonthByCurrency,
    cashByCurrency,
    outstandingReceivablesByCurrency,
    overdueReceivablesByCurrency,
    overdueReceivablesCount: overdueReceivables.length,
    pipelineValueByCurrency,
    openQuotationsCount: openQuotations.length,
    quotationConversionRate,
    fleetUtilization: (ctx.vehicles || []).length > 0 ? (inUseVehicles / (ctx.vehicles || []).length * 100).toFixed(1) : '0',
    activeTripsCount: (ctx.trips || []).filter((t: any) => ['in_transit', 'loading', 'pending'].includes(t.status)).length,
    deliveredTripsCount: deliveredTrips.length,
    deliveredTripsThisMonthCount: deliveredTripsThisMonth.length,
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
  };
}

export function getSchemaString(): string {
  return FLEET_SCHEMA.tables.map(table => {
    const cols = table.columns.map(c => `${c.name} (${c.type})`).join(', ');
    return `Table ${table.name}: ${cols}`;
  }).join('\n');
}
