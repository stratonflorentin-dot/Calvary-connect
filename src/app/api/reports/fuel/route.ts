import { NextRequest, NextResponse } from 'next/server';
import { requireFleetReportAccess } from '../helpers';

// Real per-vehicle fuel figures from vehicle_costs (cost_type='fuel') — no
// fabricated liters-from-cost-divided-by-3000 guess and no default-120km
// distance fallback. A vehicle's costs/liters are tracked per currency
// rather than blended, since vehicle_costs.currency can vary per entry.
export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = await requireFleetReportAccess(request);
  } catch (err: any) {
    const status = String(err.message).startsWith('FORBIDDEN') ? 403 : 401;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = searchParams.get('to') || new Date().toISOString();

    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*');
    if (vehiclesError) throw vehiclesError;

    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);
    if (tripsError) throw tripsError;

    const { data: fuelCosts, error: fuelCostsError } = await supabase
      .from('vehicle_costs')
      .select('*')
      .eq('cost_type', 'fuel')
      .gte('date', fromDate.slice(0, 10))
      .lte('date', toDate.slice(0, 10));
    if (fuelCostsError) throw fuelCostsError;

    const vehicleFuelData = (vehicles || []).map((vehicle) => {
      const vehicleTrips = (trips || []).filter(
        (t) => t.truck_id === vehicle.id || t.truckId === vehicle.id || t.vehicle_id === vehicle.id
      );
      const completedTrips = vehicleTrips.filter((t) => t.status?.toLowerCase() !== 'cancelled');

      // Real recorded distance only — a trip with none recorded contributes
      // 0, never a guessed figure, so efficiency numbers stay honest.
      const kmDriven = completedTrips.reduce((sum, t) => {
        return sum + Number(t.distance_km ?? t.actual_distance ?? t.actualDistance ?? t.estimated_distance ?? t.estimatedDistance ?? 0);
      }, 0);

      const vehicleFuelCosts = (fuelCosts || []).filter((c) => c.vehicle_id === vehicle.id);
      const byCurrency: Record<string, { liters: number; cost: number }> = {};
      for (const c of vehicleFuelCosts) {
        const cur = c.currency || 'TZS';
        if (!byCurrency[cur]) byCurrency[cur] = { liters: 0, cost: 0 };
        byCurrency[cur].liters += Number(c.liters || 0);
        byCurrency[cur].cost += Number(c.amount || 0);
      }
      const currencies = Object.keys(byCurrency);
      const mixedCurrencies = currencies.length > 1;
      // Primary currency for this vehicle's single-number fields — the one
      // with the largest cost share. Every currency's real totals are still
      // available in costsByCurrency for the UI/export to show honestly.
      const primaryCurrency = currencies.length > 0
        ? currencies.reduce((a, b) => (byCurrency[a].cost >= byCurrency[b].cost ? a : b))
        : 'TZS';
      const totalLitres = byCurrency[primaryCurrency]?.liters ?? 0;
      const totalFuelCost = byCurrency[primaryCurrency]?.cost ?? 0;

      const litresPer100km = kmDriven > 0 && totalLitres > 0
        ? parseFloat(((totalLitres / kmDriven) * 100).toFixed(1))
        : 0;

      return {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber || vehicle.plate_number || 'N/A',
        makeModel: `${vehicle.make || 'Unknown'} ${vehicle.model || ''}`.trim(),
        currency: primaryCurrency,
        mixedCurrencies,
        costsByCurrency: byCurrency,
        totalLitresDispensed: totalLitres,
        totalFuelCost,
        kmDriven,
        litresPer100km,
        status: vehicle.status || 'available'
      };
    });

    // Summary Statistics — grouped by currency, not blended into one number.
    const totalLitresByCurrency: Record<string, number> = {};
    const totalCostByCurrency: Record<string, number> = {};
    for (const v of vehicleFuelData) {
      for (const [cur, { liters, cost }] of Object.entries(v.costsByCurrency)) {
        totalLitresByCurrency[cur] = (totalLitresByCurrency[cur] ?? 0) + liters;
        totalCostByCurrency[cur] = (totalCostByCurrency[cur] ?? 0) + cost;
      }
    }
    const totalKm = vehicleFuelData.reduce((sum, v) => sum + v.kmDriven, 0);

    const efficientVehicles = vehicleFuelData.filter((v) => v.kmDriven > 100 && v.litresPer100km > 0);
    const mostEfficient = efficientVehicles.length > 0
      ? efficientVehicles.reduce((prev, curr) => (curr.litresPer100km < prev.litresPer100km ? curr : prev), efficientVehicles[0])
      : null;

    return NextResponse.json({
      success: true,
      summary: {
        totalLitresByCurrency,
        totalCostByCurrency,
        totalKmDriven: totalKm,
        mostEfficientVehicle: mostEfficient ? `${mostEfficient.plateNumber} (${mostEfficient.litresPer100km} L/100km)` : 'N/A'
      },
      data: vehicleFuelData
    });

  } catch (error: any) {
    console.error('[API Fuel Consumption Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
