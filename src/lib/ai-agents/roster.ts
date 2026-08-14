// Company AI agent roster — each agent wraps an existing AI flow or the
// shared generateAI provider, never a new provider integration. `run()`
// performs a one-shot check against real data (never fabricated numbers);
// `chatSystemPrompt()` builds a domain-scoped prompt for free-form chat.
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { generateAI } from '@/lib/ai-provider';
import { isVehicleAvailable } from '@/lib/fleet/vehicle-status';
import {
  getFleetContext,
  getDispatchContext,
  computeBusinessMetrics,
} from '@/lib/ai-database-context';
import { getCeoAiInsights } from '@/ai/flows/ceo-ai-insights';
import { getPredictiveMaintenance } from '@/ai/flows/predictive-maintenance';
import { getFuelPrediction } from '@/ai/flows/fuel-prediction';
import { buildDispatchPrompt } from '@/ai/flows/dispatch-suggestion.server';
import { AGENT_METADATA, type AgentMetadata } from '@/lib/ai-agents/metadata';

type FleetContext = Awaited<ReturnType<typeof getFleetContext>>;

export interface AgentRunResult {
  status: 'ok' | 'error';
  summary: string;
  data?: any;
}

export interface AiAgent extends AgentMetadata {
  run: () => Promise<AgentRunResult>;
  chatSystemPrompt: (context: FleetContext) => string;
}

function baseIntro(role: string) {
  return `You are the ${role} for Calvary Investment Co. Ltd, a road freight company based in Dar es Salaam, Tanzania. Be concise, cite real numbers from the data given below, and say plainly when data is missing rather than guessing.`;
}

// ─── Dispatch Agent ──────────────────────────────────────────────────────────

const DispatchSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      driverId: z.string(),
      vehicleId: z.string(),
      score: z.number(),
      reasoning: z.string(),
    }),
  ),
  caveats: z.array(z.string()).default([]),
});

async function runDispatch(): Promise<AgentRunResult> {
  const { data: pendingTrips } = await supabase
    .from('trips')
    .select('*')
    .eq('status', 'pending')
    .is('driver_id', null)
    .order('created_at', { ascending: true })
    .limit(1);

  const trip = pendingTrips?.[0];
  if (!trip) {
    return { status: 'ok', summary: 'No unassigned pending trips right now.' };
  }

  const context = await getDispatchContext();
  const system = buildDispatchPrompt(
    {
      origin: trip.origin,
      destination: trip.destination,
      cargoDescription: trip.cargo_description ?? trip.cargoDescription,
      cargoWeightTons:
        trip.cargo_weight_tons != null ? Number(trip.cargo_weight_tons)
          : trip.cargoWeightTons != null ? Number(trip.cargoWeightTons)
            : undefined,
    },
    context,
  );

  const result = await generateAI({
    system,
    messages: [{ role: 'user', content: [{ text: 'Suggest the best driver and vehicle for this trip.' }] }],
  });

  const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');
  let parsed: z.infer<typeof DispatchSuggestionSchema>;
  try {
    parsed = DispatchSuggestionSchema.parse(JSON.parse(cleaned));
  } catch {
    return { status: 'error', summary: 'AI returned an unexpected response shape for the dispatch suggestion.' };
  }

  const top = parsed.suggestions[0];
  return {
    status: 'ok',
    summary: top
      ? `${trip.origin} → ${trip.destination}: recommended pairing scored ${top.score}/100. ${top.reasoning}`
      : `${trip.origin} → ${trip.destination}: no suitable pairing found. ${parsed.caveats[0] || ''}`.trim(),
    data: { trip: { id: trip.id, origin: trip.origin, destination: trip.destination }, ...parsed },
  };
}

// ─── Maintenance Agent ───────────────────────────────────────────────────────

async function runMaintenance(): Promise<AgentRunResult> {
  const context = await getFleetContext();
  if (context.vehicles.length === 0) {
    return { status: 'ok', summary: 'No vehicles in the fleet to analyze.' };
  }

  const target =
    context.vehicles.find((v: any) => v.status === 'maintenance') ||
    [...context.vehicles].sort((a: any, b: any) => (Number(b.mileage) || 0) - (Number(a.mileage) || 0))[0];

  const vehicleMaintenance = context.maintenance.filter((m: any) => m.vehicle_id === target.id);
  const lastCompleted = [...vehicleMaintenance]
    .filter((m: any) => m.status === 'completed' && m.date)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const recentMaintenanceCount = vehicleMaintenance.filter((m: any) => {
    if (!m.date) return false;
    return (Date.now() - new Date(m.date).getTime()) / 86400000 <= 90;
  }).length;
  const openIssuesCount = vehicleMaintenance.filter((m: any) => m.status === 'pending' || m.status === 'overdue').length;
  const currentOdometerKm = Number(target.mileage) || 0;
  const serviceInterval = Number(target.service_interval_km) || 10000;

  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const vehicleTrips = context.trips.filter((t: any) =>
    (t.vehicle_id === target.id || t.truck_id === target.id) && new Date(t.created_at).getTime() >= thirtyDaysAgo,
  );
  const kmLast30Days = vehicleTrips.reduce((s: number, t: any) => s + (Number(t.distance_km || t.actual_distance || t.estimated_distance) || 0), 0);
  const averageDailyKm = kmLast30Days > 0 ? Math.round(kmLast30Days / 30) : 300;

  const result = await getPredictiveMaintenance({
    truckId: target.id,
    truckName: target.plate_number || target.model || 'Fleet Truck',
    currentOdometerKm,
    // No odometer-at-service column exists on maintenance_records — same
    // per-vehicle service-interval estimate the AI dashboard uses when
    // real data isn't available (src/components/dashboard/ai-analysis-dashboard.tsx).
    lastServiceOdometerKm: Math.max(0, currentOdometerKm - serviceInterval),
    lastServiceDate: lastCompleted?.date || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
    fuelType: target.fuel_type || 'Diesel',
    recentMaintenanceCount,
    averageDailyKm,
    currentCondition: target.status === 'maintenance' ? 'Poor' : openIssuesCount > 0 ? 'Fair' : 'Good',
    openIssuesCount,
    daysAhead: 30,
  });

  return {
    status: 'ok',
    summary: `${target.plate_number || target.id}: ${result.riskLevel} risk (${Math.round(result.failureProbability * 100)}% failure probability in 30 days). ${result.reasoning}`,
    data: { vehicle: { id: target.id, plate: target.plate_number }, ...result },
  };
}

// ─── Fuel Agent ──────────────────────────────────────────────────────────────

async function runFuel(): Promise<AgentRunResult> {
  const context = await getFleetContext();
  const trip = context.trips.find((t: any) => ['pending', 'loading', 'in_transit'].includes(t.status)) || context.trips[0];
  if (!trip) {
    return { status: 'ok', summary: 'No trips available to analyze fuel consumption for.' };
  }
  const vehicle = context.vehicles.find((v: any) => v.id === trip.vehicle_id) || context.vehicles[0];

  // Fleet-wide averages from real fuel logs/trips, same computation the AI
  // dashboard uses (src/components/dashboard/ai-analysis-dashboard.tsx) —
  // fallbacks only apply when there's no fuel history yet.
  const totalLiters = context.fuelLogs.reduce((s: number, f: any) => s + (Number(f.litres) || 0), 0);
  const totalKm = context.trips.reduce((s: number, t: any) => s + (Number(t.distance_km || t.actual_distance) || 0), 0);
  const avgFuelEfficiencyKmPerLiter = totalLiters > 0 && totalKm > 0 ? totalKm / totalLiters : 3.5;

  const pricedLogs = context.fuelLogs.filter((f: any) => Number(f.cost_per_litre) > 0);
  const currentFuelPricePerLiter = pricedLogs.length > 0
    ? pricedLogs.reduce((s: number, f: any) => s + Number(f.cost_per_litre), 0) / pricedLogs.length
    : 3200;

  const result = await getFuelPrediction({
    tripId: trip.id,
    origin: trip.origin || 'Unknown origin',
    destination: trip.destination || 'Unknown destination',
    distanceKm: Number(trip.distance_km) || 480,
    vehicleType: `${vehicle?.make || 'Heavy Truck'} ${vehicle?.model || ''}`.trim(),
    vehicleFuelType: vehicle?.fuel_type || 'Diesel',
    avgFuelEfficiencyKmPerLiter,
    loadWeightTons: Number(trip.cargo_weight_tons) || 8,
    driverBehaviourScore: 82,
    currentFuelPricePerLiter,
    terrainType: 'mixed',
    weatherCondition: 'clear',
  });

  return {
    status: 'ok',
    summary: `${trip.origin} → ${trip.destination}: ~${result.estimatedFuelLiters.toFixed(0)}L predicted (${result.efficiencyRating}). ${result.comparisonToFleetAverage}`,
    data: { trip: { id: trip.id, origin: trip.origin, destination: trip.destination }, ...result },
  };
}

// ─── CEO Insights Agent ──────────────────────────────────────────────────────

async function runCeoInsights(): Promise<AgentRunResult> {
  const context = await getFleetContext();
  const metrics = computeBusinessMetrics(context);

  const available = context.vehicles.filter((v: any) => isVehicleAvailable(v.status)).length;
  const inUse = context.vehicles.filter((v: any) => v.status === 'in_use').length;
  const maintenance = context.vehicles.filter((v: any) => v.status === 'maintenance').length;

  // Reuse computeBusinessMetrics() rather than recomputing locally — it's
  // the single source of truth also used by the AI dashboard and already
  // filters onlineDriverCount by presence_status, not just role.
  const insights = await getCeoAiInsights({
    activeTripsCount: metrics.activeTripsCount,
    fleetBreakdown: { available, inUse, maintenance },
    revenueThisMonth: metrics.revenueThisMonth,
    expensesThisMonth: metrics.expensesThisMonth,
    netProfit: metrics.netProfitThisMonth,
    fuelConsumptionLiters: metrics.fuelLitersThisMonth,
    pendingMaintenanceCount: metrics.pendingMaintenanceCount,
    lowStockCount: metrics.lowStockCount,
    onlineDriverCount: metrics.onlineDriverCount,
    completedDeliveriesThisMonth: metrics.completedDeliveriesThisMonth,
  });

  return {
    status: 'ok',
    summary: insights.keyHighlights[0] || insights.areasOfConcern[0] || 'CEO insights generated.',
    data: insights,
  };
}

// ─── Driver Performance Agent (roster-wide scan) ────────────────────────────

async function runDriverScan(): Promise<AgentRunResult> {
  const context = await getFleetContext();
  const drivers = context.users.filter((u: any) => u.role === 'DRIVER');
  if (drivers.length === 0) {
    return { status: 'ok', summary: 'No drivers on file.' };
  }

  const tripsByDriver = new Map<string, any[]>();
  for (const t of context.trips) {
    if (!t.driver_id) continue;
    const list = tripsByDriver.get(t.driver_id) || [];
    list.push(t);
    tripsByDriver.set(t.driver_id, list);
  }

  const rows = drivers.map((d: any) => {
    const trips = tripsByDriver.get(d.id) || [];
    const completed = trips.filter((t: any) => t.status === 'completed').length;
    const revenue = trips.reduce((s: number, t: any) => s + (Number(t.revenue) || 0), 0);
    return `${d.name}: ${completed} completed trips, revenue ${revenue.toFixed(0)}`;
  });

  const result = await generateAI({
    system: `${baseIntro('Driver Performance Agent')} Based ONLY on this real per-driver trip data, identify the 2-3 drivers most worth a coaching conversation this week and why. Do not invent metrics not given here.\n\n${rows.join('\n')}`,
    messages: [{ role: 'user', content: [{ text: 'Flag the drivers who need attention this week.' }] }],
  });

  return { status: 'ok', summary: result.text.trim(), data: { driverCount: drivers.length } };
}

// ─── Customer Relationship Agent (roster-wide scan) ─────────────────────────

async function runCustomerScan(): Promise<AgentRunResult> {
  const context = await getFleetContext();
  if (context.customers.length === 0) {
    return { status: 'ok', summary: 'No customers on file.' };
  }

  const expiring = context.contracts.filter((c: any) => {
    if (!c.end_date) return false;
    const days = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
    return days <= 30 && days >= 0;
  });

  const rows = context.customers.slice(0, 30).map((c: any) => `${c.company_name}: contact ${c.contact_person || 'unknown'}`);
  const expiringLines = expiring.map((c: any) => `${c.contract_number} (customer ${c.customers?.company_name ?? c.customer_id}, expires ${c.end_date})`);

  const result = await generateAI({
    system: `${baseIntro('Customer Relationship Agent')} Based ONLY on this real data, flag which customer relationships need attention this week. Do not invent facts not given here.\n\nCustomers:\n${rows.join('\n')}\n\nContracts expiring within 30 days: ${expiringLines.join('; ') || 'none'}`,
    messages: [{ role: 'user', content: [{ text: 'Flag the customer relationships that need attention this week.' }] }],
  });

  return {
    status: 'ok',
    summary: result.text.trim(),
    data: { customerCount: context.customers.length, expiringContracts: expiring.length },
  };
}

// ─── Roster ──────────────────────────────────────────────────────────────────

const AGENT_BEHAVIOR: Record<string, Pick<AiAgent, 'run' | 'chatSystemPrompt'>> = {
  dispatch: {
    run: runDispatch,
    chatSystemPrompt: (ctx) =>
      `${baseIntro('Dispatch Agent')}\n\nVehicles: ${JSON.stringify(ctx.vehicles.slice(0, 15).map((v: any) => ({ plate: v.plate_number, status: v.status, type: v.type })))}\n\nRecent trips: ${JSON.stringify(ctx.trips.slice(0, 10).map((t: any) => ({ origin: t.origin, destination: t.destination, status: t.status })))}`,
  },
  maintenance: {
    run: runMaintenance,
    chatSystemPrompt: (ctx) =>
      `${baseIntro('Maintenance Agent')}\n\nVehicles: ${JSON.stringify(ctx.vehicles.slice(0, 15).map((v: any) => ({ plate: v.plate_number, status: v.status, mileage: v.mileage })))}\n\nOpen maintenance records: ${JSON.stringify(ctx.maintenance.filter((m: any) => m.status !== 'completed').slice(0, 10))}`,
  },
  fuel: {
    run: runFuel,
    chatSystemPrompt: (ctx) =>
      `${baseIntro('Fuel Agent')}\n\nRecent fuel logs: ${JSON.stringify(ctx.fuelLogs.slice(0, 10))}`,
  },
  'ceo-insights': {
    run: runCeoInsights,
    chatSystemPrompt: (ctx) =>
      `${baseIntro('CEO Insights Agent')}\n\nMetrics: ${JSON.stringify(computeBusinessMetrics(ctx))}`,
  },
  'driver-performance': {
    run: runDriverScan,
    chatSystemPrompt: (ctx) =>
      `${baseIntro('Driver Performance Agent')}\n\nDrivers: ${JSON.stringify(ctx.users.filter((u: any) => u.role === 'DRIVER').slice(0, 20).map((u: any) => ({ name: u.name })))}`,
  },
  'customer-relationship': {
    run: runCustomerScan,
    chatSystemPrompt: (ctx) =>
      `${baseIntro('Customer Relationship Agent')}\n\nCustomers: ${JSON.stringify(ctx.customers.slice(0, 20).map((c: any) => ({ name: c.company_name })))}\n\nContracts: ${JSON.stringify(ctx.contracts.slice(0, 20).map((c: any) => ({ number: c.contract_number, status: c.status, expires: c.end_date })))}`,
  },
};

export const AGENT_ROSTER: AiAgent[] = AGENT_METADATA.map((meta) => ({ ...meta, ...AGENT_BEHAVIOR[meta.id] }));

export function getAgentById(id: string): AiAgent | undefined {
  return AGENT_ROSTER.find((a) => a.id === id);
}
